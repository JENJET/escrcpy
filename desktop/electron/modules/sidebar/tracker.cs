using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

class T
{
  [DllImport("user32.dll")] static extern IntPtr FindWindow(string c, string w);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowLongPtr(IntPtr h, int n, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint eMin, uint eMax, IntPtr hmod, WinEventDelegate del, uint pid, uint tid, uint flags);
  [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  delegate void WinEventDelegate(IntPtr hHook, uint evt, IntPtr hwnd, int idObj, int idChild, uint thread, uint time);
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }

  const uint EVENT_OBJECT_DESTROY = 0x8001;
  const uint EVENT_OBJECT_LOCATIONCHANGE = 0x800B;
  const uint SYNCHRONIZE = 0x00100000;
  const uint INFINITE = 0xFFFFFFFF;

  static string _title;
  static IntPtr _mh = IntPtr.Zero;
  static IntPtr _preferredMh = IntPtr.Zero;
  static IntPtr _sb = IntPtr.Zero;
  // dimensions: pw/ph = portrait, lw/lh = landscape
  static int _pw, _ph, _lw, _lh;
  static int _lpw, _lph, _lpx, _lpy; // last known mirror pos/size
  static int _sx, _sy; // last computed sidebar screen position
  static int _sw, _sh; // last computed sidebar size
  static bool _landscape; // current orientation
  static IntPtr _hProc = IntPtr.Zero;

  static bool MatchesTitle(IntPtr hwnd)
  {
    if (hwnd == IntPtr.Zero || !IsWindow(hwnd)) return false;
    var title = new System.Text.StringBuilder(512);
    GetWindowText(hwnd, title, title.Capacity);
    return title.ToString() == _title;
  }

  static IntPtr FindMirrorWindow()
  {
    if (MatchesTitle(_preferredMh))
      return _preferredMh;

    return FindWindow(null, _title);
  }

  // Calculate sidebar position & size based on mirror window & orientation
  static void PositionSidebar()
  {
    if (!IsWindow(_mh)) return;
    RECT cr; GetClientRect(_mh, out cr);
    if (cr.R <= 0 || cr.B <= 0) return;
    POINT p; p.X = 0; p.Y = 0; ClientToScreen(_mh, ref p);

    bool isLandscape = cr.R >= cr.B;
    int sw, sh;

    if (isLandscape)
    {
      // Portrait sidebar width (used as landscape height) should not exceed mirror width
      sw = _lw; sh = _lh;
      if (sw > cr.R) sw = cr.R;
      _sx = p.X + (cr.R - sw) / 2;
      _sy = p.Y + cr.B;
    }
    else
    {
      // Portrait sidebar height should not exceed mirror height
      sw = _pw; sh = _ph;
      if (sh > cr.B) sh = cr.B;
      _sx = p.X + cr.R;
      _sy = p.Y + (cr.B - sh) / 2;
    }

    bool sizeChanged = sw != _sw || sh != _sh;

    SetWindowPos(_sb, IntPtr.Zero, _sx, _sy, sw, sh, 0x0004 | 0x0010);

    if (sizeChanged)
    {
      _sw = sw;
      _sh = sh;
      Console.WriteLine("RESIZE " + sw + " " + sh);
    }

    if (isLandscape != _landscape)
    {
      _landscape = isLandscape;
      Console.WriteLine("ORIENTATION " + (isLandscape ? "1" : "0"));
    }
  }

  // WinEvent callback: handles mirror window destroy/reposition
  static void OnEvent(IntPtr hHook, uint evt, IntPtr hwnd, int idObj, int idChild, uint thread, uint time)
  {
    try
    {
      if (!IsWindow(_sb)) { Application.Exit(); return; }
      if (hwnd != _mh) return;

      // Mirror window destroyed: enter recovery loop
      if (evt == EVENT_OBJECT_DESTROY)
      {
        Console.WriteLine("CLOSE");
        _lpw = _lph = _lpx = _lpy = 0;
        // If we have the process handle, wait forever; otherwise 5s max
        int timeout = _hProc != IntPtr.Zero ? -1 : 25;
        for (int i = 0; timeout < 0 || i < timeout; i++)
        {
          System.Threading.Thread.Sleep(200);
          // Look for a new window with the same title (e.g., SDL recreation)
          IntPtr mh = FindMirrorWindow();
          if (mh != IntPtr.Zero)
          {
            if (!IsWindow(_sb)) { Application.Exit(); return; }
            // Re-attach sidebar to the new mirror window
            SetWindowLongPtr(_sb, -8, mh);
            _mh = mh;
            _lpw = _lph = _lpx = _lpy = 0;
            // Wait for position to stabilize (up to 5s)
            for (int j = 0; j < 25; j++)
            {
              System.Threading.Thread.Sleep(200);
              if (!IsWindowVisible(_mh)) continue;
              RECT cr2; GetClientRect(_mh, out cr2);
              if (cr2.R > 0 && cr2.B > 0)
              {
                POINT p2; p2.X = 0; p2.Y = 0; ClientToScreen(_mh, ref p2);
                int w = cr2.R - cr2.L, h = cr2.B - cr2.T;
                if (w == _lpw && h == _lph && p2.X == _lpx && p2.Y == _lpy)
                {
                  PositionSidebar();
                  Console.WriteLine("RECOVER " + w + " " + h);
                  return;
                }
                _lpw = w; _lph = h; _lpx = p2.X; _lpy = p2.Y;
              }
            }
            Console.WriteLine("RECOVER");
            return;
          }
          // Check if scrcpy process has exited during recovery
          if (_hProc != IntPtr.Zero && WaitForSingleObject(_hProc, 0) == 0)
          {
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
      PositionSidebar();
    }
    catch { }
  }

  [STAThread]
  static int Main(string[] a)
  {
    if (a.Length < 6) return 1;
    _sb = new IntPtr(long.Parse(a[0]));
    _title = a[1];
    _pw = int.Parse(a[2]);
    _ph = int.Parse(a[3]);
    _lw = int.Parse(a[4]);
    _lh = int.Parse(a[5]);
    if (a.Length >= 7)
      _preferredMh = new IntPtr(long.Parse(a[6]));

    // Prefer a known mirror HWND, then fall back to finding the window by title.
    IntPtr mh = IntPtr.Zero;
    for (int i = 0; i < 10 && mh == IntPtr.Zero; i++)
    {
      mh = FindMirrorWindow();
      if (mh == IntPtr.Zero) System.Threading.Thread.Sleep(200);
    }
    if (mh == IntPtr.Zero) return 1;
    if (!IsWindow(_sb)) return 1;

    // Set sidebar as owned window of mirror, so they move together
    SetWindowLongPtr(_sb, -8, mh);
    _mh = mh;

    // Wait for window position to become stable (up to 5s)
    _sx = _sy = 0;
    RECT cr;
    for (int i = 0; i < 50; i++)
    {
      System.Threading.Thread.Sleep(100);
      if (!IsWindowVisible(_mh)) continue;
      if (GetClientRect(_mh, out cr) && cr.R > 0 && cr.B > 0)
      {
        POINT p; p.X = 0; p.Y = 0; ClientToScreen(_mh, ref p);
        int w = cr.R - cr.L, h = cr.B - cr.T;
        if (w == _lpw && h == _lph && p.X == _lpx && p.Y == _lpy)
        {
          PositionSidebar();
          break;
        }
        _lpw = w; _lph = h; _lpx = p.X; _lpy = p.Y;
      }
    }
    if (_sx == 0 && _sy == 0) return 1;
    Console.WriteLine("FOUND " + _sx + " " + _sy);

    // Get scrcpy process handle for exit detection
    uint pid;
    GetWindowThreadProcessId(_mh, out pid);
    _hProc = OpenProcess(SYNCHRONIZE, false, pid);

    // Register WinEvent hooks for tracking and recovery
    var del = new WinEventDelegate(OnEvent);
    var hookLoc = SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE, IntPtr.Zero, del, 0, 0, 0);
    var hookClose = SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_DESTROY, IntPtr.Zero, del, 0, 0, 0);
    if (hookLoc == IntPtr.Zero || hookClose == IntPtr.Zero)
    {
      if (_hProc != IntPtr.Zero) CloseHandle(_hProc);
      return 1;
    }

    // Background thread: detect when scrcpy process exits
    if (_hProc != IntPtr.Zero)
    {
      new System.Threading.Thread(() =>
      {
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
