using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

class T {
  [DllImport("user32.dll")] static extern IntPtr FindWindow(string c, string w);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowLongPtr(IntPtr h, int n, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint eMin, uint eMax, IntPtr hmod, WinEventDelegate del, uint pid, uint tid, uint flags);
  [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  delegate void WinEventDelegate(IntPtr hHook, uint evt, IntPtr hwnd, int idObj, int idChild, uint thread, uint time);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L,T,R,B; }
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X,Y; }

  const uint EVENT_OBJECT_DESTROY = 0x8001;
  const uint EVENT_OBJECT_LOCATIONCHANGE = 0x800B;
  const uint SYNCHRONIZE = 0x00100000;
  const uint INFINITE = 0xFFFFFFFF;

  static string _title;
  static IntPtr _mh = IntPtr.Zero;
  static IntPtr _sb = IntPtr.Zero;
  static int _sh = 0, _sw;
  static int _pw, _ph, _px, _py;
  static IntPtr _hProc = IntPtr.Zero;

  // WinEvent callback: handles mirror window destroy/reposition
  static void OnEvent(IntPtr hHook, uint evt, IntPtr hwnd, int idObj, int idChild, uint thread, uint time) {
    try {
    if (!IsWindow(_sb)) { Application.Exit(); return; }
    if (hwnd != _mh) return;

    // Mirror window destroyed: enter recovery loop
    if (evt == EVENT_OBJECT_DESTROY) {
      Console.WriteLine("CLOSE");
      _pw = _ph = _px = _py = 0;
      // If we have the process handle, wait forever; otherwise 30s max
      int timeout = _hProc != IntPtr.Zero ? -1 : 150;
      for (int i = 0; timeout < 0 || i < timeout; i++) {
        System.Threading.Thread.Sleep(200);
        // Look for a new window with the same title (e.g., SDL recreation)
        IntPtr mh = FindWindow(null, _title);
        if (mh != IntPtr.Zero) {
          if (!IsWindow(_sb)) { Application.Exit(); return; }
          // Re-attach sidebar to the new mirror window
          SetWindowLongPtr(_sb, -8, mh);
          _mh = mh;
          _pw = _ph = _px = _py = 0;
          // Wait for position to stabilize (up to 5s)
          for (int j = 0; j < 25; j++) {
            System.Threading.Thread.Sleep(200);
            if (!IsWindowVisible(_mh)) continue;
            RECT cr2; GetClientRect(_mh, out cr2);
            if (cr2.R > 0 && cr2.B > 0) {
              POINT p2; p2.X = 0; p2.Y = 0; ClientToScreen(_mh, ref p2);
              int w = cr2.R - cr2.L, h = cr2.B - cr2.T;
              if (w == _pw && h == _ph && p2.X == _px && p2.Y == _py) {
                int rfx = p2.X + cr2.R, rfy = p2.Y + (cr2.B - _sh) / 2;
                SetWindowPos(_sb, IntPtr.Zero, rfx, rfy, _sw, _sh, 0x0004 | 0x0010);
                Console.WriteLine("RECOVER " + rfx + " " + rfy);
                return;
              }
              _pw = w; _ph = h; _px = p2.X; _py = p2.Y;
            }
          }
          Console.WriteLine("RECOVER");
          return;
        }
        // Check if scrcpy process has exited during recovery
        if (_hProc != IntPtr.Zero && WaitForSingleObject(_hProc, 0) == 0) {
          Console.WriteLine("CLOSE_CONFIRMED");
          Application.Exit();
          return;
        }
      }
      Console.WriteLine("CLOSE_CONFIRMED");
      Application.Exit();
    }

    // Mirror window moved/resized: reposition sidebar
    if (evt != EVENT_OBJECT_LOCATIONCHANGE) return;
    if (!IsWindow(_mh)) return;
    RECT cr; GetClientRect(_mh, out cr);
    if (cr.R <= 0 || cr.B <= 0) return;
    POINT p; p.X = 0; p.Y = 0; ClientToScreen(_mh, ref p);
    int fx = p.X + cr.R, fy = p.Y + (cr.B - _sh) / 2;
    SetWindowPos(_sb, IntPtr.Zero, fx, fy, _sw, _sh, 0x0004 | 0x0010);
    }
    catch {}
  }

  [STAThread]
  static int Main(string[] a) {
    if (a.Length < 4) return 1;
    _sb = new IntPtr(long.Parse(a[0]));
    _title = a[1];
    _sh = int.Parse(a[2]);
    _sw = int.Parse(a[3]);

    // Find mirror window by title, retry for up to 2s
    IntPtr mh = IntPtr.Zero;
    for (int i = 0; i < 10 && mh == IntPtr.Zero; i++) {
      mh = FindWindow(null, _title);
      if (mh == IntPtr.Zero) System.Threading.Thread.Sleep(200);
    }
    if (mh == IntPtr.Zero) return 1;
    if (!IsWindow(_sb)) return 1;

    // Set sidebar as owned window of mirror, so they move together
    SetWindowLongPtr(_sb, -8, mh);
    _mh = mh;

    // Wait for window position to become stable (up to 5s)
    int fx = 0, fy = 0;
    RECT cr;
    for (int i = 0; i < 50; i++) {
      System.Threading.Thread.Sleep(100);
      if (!IsWindowVisible(_mh)) continue;
      if (GetClientRect(_mh, out cr) && cr.R > 0 && cr.B > 0) {
        POINT p; p.X = 0; p.Y = 0; ClientToScreen(_mh, ref p);
        int w = cr.R - cr.L, h = cr.B - cr.T;
        if (w == _pw && h == _ph && p.X == _px && p.Y == _py) {
          fx = p.X + cr.R; fy = p.Y + (cr.B - _sh) / 2;
          SetWindowPos(_sb, IntPtr.Zero, fx, fy, _sw, _sh, 0x0004 | 0x0010);
          break;
        }
        _pw = w; _ph = h; _px = p.X; _py = p.Y;
      }
    }
    if (fx == 0 && fy == 0) return 1;
    Console.WriteLine("FOUND " + fx + " " + fy);

    // Get scrcpy process handle for exit detection
    uint pid;
    GetWindowThreadProcessId(_mh, out pid);
    _hProc = OpenProcess(SYNCHRONIZE, false, pid);

    // Register WinEvent hooks for tracking and recovery
    var del = new WinEventDelegate(OnEvent);
    var hookLoc = SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE, IntPtr.Zero, del, 0, 0, 0);
    var hookClose = SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_DESTROY, IntPtr.Zero, del, 0, 0, 0);
    if (hookLoc == IntPtr.Zero || hookClose == IntPtr.Zero) {
      if (_hProc != IntPtr.Zero) CloseHandle(_hProc);
      return 1;
    }

    // Background thread: detect when scrcpy process exits
    if (_hProc != IntPtr.Zero) {
      new System.Threading.Thread(() => {
        WaitForSingleObject(_hProc, INFINITE);
        Console.WriteLine("PROCESS_EXIT");
        Application.Exit();
      }).Start();
    }

    Application.Run();
    UnhookWinEvent(hookLoc);
    UnhookWinEvent(hookClose);
    if (_hProc != IntPtr.Zero) CloseHandle(_hProc);
    return 0;
  }
}
