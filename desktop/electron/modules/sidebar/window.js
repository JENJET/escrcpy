import { createWindowManager } from '@escrcpy/electron-setup/main'
import { trySend } from '$electron/helpers/index.js'
import { controlBarHeight } from '$control/configs/index.js'
import { sidebarWidth } from '$sidebar/configs/index.js'
import { ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = join(fileURLToPath(import.meta.url), '..')

const SIDEBAR_BTN_COUNT = 15
const SIDEBAR_HEIGHT = SIDEBAR_BTN_COUNT * controlBarHeight
const cfg = { sw: sidebarWidth, ch: controlBarHeight, height: SIDEBAR_HEIGHT }

let _exe = null

// Search paths for t.exe binary
function findExe(name) {
  const candidates = [
    join(process.resourcesPath || '', 'extra', 'win', name),
    join(process.cwd(), 'resources', 'extra', 'win', name),
    join(process.cwd(), 'dist-electron', name),
    join(__dirname, name),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p))
        return p
    }
    catch {}
  }
  return ''
}

function getExe() {
  if (_exe !== null)
    return _exe
  _exe = findExe('t.exe') || ''
  return _exe
}

// Spawn and manage t.exe tracker for a sidebar window
function startTracker(win, title, height) {
  if (!title || !win || win.isDestroyed() || !getExe())
    return () => {}

  let proc = null
  // closed=true means CLOSE was received (mirror window destroyed)
  let closed = false
  let killed = false
  let retries = 0
  let pending = false

  function start() {
    // No retry limit: keep spawning on crash until closed/killed
    if (pending || killed || win.isDestroyed()) {
      return
    }
    pending = true

    try {
      const exe = getExe()
      if (!exe) {
        pending = false
        return
      }

      const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE(0))
      proc = spawn(exe, [String(hwnd), title, String(height), String(cfg.sw)], {
        stdio: ['ignore', 'pipe', 'ignore'],
        detached: false,
      })
      pending = false

      closed = false

      // Handle stdout signals from t.exe
      proc.stdout.on('data', (data) => {
        if (win.isDestroyed())
          return
        const str = data.toString()
        // FOUND: initial attach successful, position sidebar
        if (str.includes('FOUND')) {
          retries = 0
          const [, x, y] = str.split(/\s+/)
          win.show()
          win.moveTop()
          if (x && y)
            win.setBounds({ x: Number(x), y: Number(y), width: cfg.sw, height: cfg.height })
        }
        // PROCESS_EXIT / CLOSE_CONFIRMED: scrcpy actually exited
        else if (str.includes('PROCESS_EXIT') || str.includes('CLOSE_CONFIRMED')) {
          win.close()
        }
        // RECOVER: mirror window recreated after DESTROY
        else if (str.includes('RECOVER')) {
          closed = false
          retries = 0
          const parts = str.split(/\s+/)
          if (parts[1] && parts[2])
            win.setBounds({ x: Number(parts[1]), y: Number(parts[2]), width: cfg.sw, height: cfg.height })
        }
        // CLOSE: mirror window destroyed, t.exe handles recovery internally
        else if (str.includes('CLOSE')) {
          closed = true
        }
      })

      // On t.exe exit: retry on crash, stop on killed/closed
      proc.on('exit', () => {
        if (killed || win.isDestroyed())
          return
        // If CLOSE was received but recovery was interrupted, retry fresh
        if (closed) {
          closed = false
        }
        retries++
        setTimeout(start, 1000)
      })

      proc.on('error', () => {})
    }
    catch {
      pending = false
      retries++
      setTimeout(start, 1000)
    }
  }

  start()

  // Kill the tracker process (called when sidebar closes)
  const kill = () => {
    killed = true
    try {
      if (proc)
        proc.kill()
    }
    catch {}
  }

  return kill
}

export default {
  name: 'module:sidebar:window',
  apply(mainApp) {
    const managers = new Map()

    // Create a sidebar window for a device mirror
    function onOpen(event, data) {
      const { mirrorId, deviceId, mirrorTitle } = data
      if (!mirrorId || !mirrorTitle)
        return

      const existing = managers.get(mirrorId)
      if (existing) {
        const win = existing.get()
        if (win && !win.isDestroyed()) {
          win.focus()
          return
        }
        managers.delete(mirrorId)
      }

      const uid = `sidebar_${mirrorId}`
      let stopTracker = null

      const manager = createWindowManager(uid, {
        singleton: false,
        browserWindow: {
          frame: false,
          resizable: false,
          backgroundColor: '#1f2937',
          width: cfg.sw,
          height: cfg.height,
          skipTaskbar: true,
          show: false,
          hasShadow: false,
          roundedCorners: true,
        },
        hooks: {
          ready(win) {
            trySend(win, 'device-change', { id: deviceId })
            stopTracker = startTracker(win, mirrorTitle, cfg.height)
          },
          closed() {
            if (stopTracker)
              stopTracker()
            managers.delete(mirrorId)
          },
        },
      })

      managers.set(mirrorId, manager)
      manager.open({ mirrorId, deviceId, mirrorTitle, page: 'pages/sidebar', show: false })
    }

    // Close sidebar via IPC (from preload when scrcpy exits)
    function onClose(event, mirrorId) {
      const manager = managers.get(mirrorId)
      if (manager) {
        const win = manager.get()
        if (win && !win.isDestroyed())
          win.close()
        managers.delete(mirrorId)
      }
    }

    ipcMain.on('sidebar-open', onOpen)
    ipcMain.on('sidebar-close', onClose)

    return () => {
      ipcMain.removeListener('sidebar-open', onOpen)
      ipcMain.removeListener('sidebar-close', onClose)
      for (const manager of managers.values()) {
        const win = manager.get()
        if (win && !win.isDestroyed())
          win.close()
      }
      managers.clear()
    }
  },
}
