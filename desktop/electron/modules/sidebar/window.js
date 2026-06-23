import { createWindowManager } from '@escrcpy/electron-setup/main'
import { trySend } from '$electron/helpers/index.js'
import { sidebarBtnCount, sidebarBtnHeight, sidebarBtnWidth, sidebarLandscapeHeight, sidebarNavBtnSize, sidebarWidth } from '$sidebar/configs/index.js'
import { ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = join(fileURLToPath(import.meta.url), '..')

let _exe = null

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
    catch { }
  }
  return ''
}

function getExe() {
  if (_exe !== null)
    return _exe
  _exe = findExe('t.exe') || ''
  return _exe
}

function getDimensions(btnCount) {
  const count = Math.max(1, btnCount || sidebarBtnCount)
  return {
    pw: sidebarWidth,
    ph: count * sidebarBtnHeight + 2 * sidebarNavBtnSize,
    lw: count * sidebarBtnWidth + 2 * sidebarNavBtnSize,
    lh: sidebarLandscapeHeight,
  }
}

function startTracker(win, title, pw, ph, lw, lh, mirrorHwnd = 0) {
  if (!title || !win || win.isDestroyed() || !getExe())
    return () => { }

  let proc = null
  let closed = false
  let killed = false
  let retries = 0
  let pending = false
  let orientation = 0 // 0=portrait, 1=landscape

  const dims = { pw, ph, lw, lh }

  function sendOrientation(val) {
    if (win.isDestroyed())
      return
    orientation = val
    trySend(win, 'sidebar-orientation', val)
  }

  function start() {
    if (pending || killed || win.isDestroyed())
      return
    pending = true

    try {
      const exe = getExe()
      if (!exe) {
        pending = false
        return
      }

      const hwnd = Number(win.getNativeWindowHandle().readBigUInt64LE(0))
      proc = spawn(exe, [
        String(hwnd),
        title,
        String(dims.pw),
        String(dims.ph),
        String(dims.lw),
        String(dims.lh),
        String(mirrorHwnd || 0),
      ], {
        stdio: ['pipe', 'pipe', 'ignore'],
        detached: false,
      })
      pending = false
      closed = false

      proc.stdout.on('data', (data) => {
        if (win.isDestroyed())
          return
        const str = data.toString()
        for (const line of str.split('\n').filter(Boolean)) {
          if (line.startsWith('ORIENTATION')) {
            const val = Number(line.split(/\s+/)[1] || 0)
            sendOrientation(val)
            const w = val === 1 ? dims.lw : dims.pw
            const h = val === 1 ? dims.lh : dims.ph
            trySend(win, 'sidebar-size', { width: w, height: h })
          }
          else if (line.startsWith('FOUND')) {
            retries = 0
            win.show()
            win.moveTop()
            const w = orientation === 1 ? dims.lw : dims.pw
            const h = orientation === 1 ? dims.lh : dims.ph
            trySend(win, 'sidebar-size', { width: w, height: h })
          }
          else if (line.startsWith('RESIZE')) {
            const parts = line.split(/\s+/)
            if (parts[1] && parts[2]) {
              const sw = Number(parts[1])
              const sh = Number(parts[2])
              if (!win.isDestroyed()) {
                trySend(win, 'sidebar-size', { width: sw, height: sh })
              }
            }
          }
          else if (line.includes('PROCESS_EXIT') || line.includes('CLOSE_CONFIRMED')) {
            win.close()
          }
          else if (line.startsWith('RECOVER')) {
            closed = false
            retries = 0
          }
          else if (line.includes('CLOSE')) {
            closed = true
          }
        }
      })

      proc.on('exit', () => {
        if (killed || win.isDestroyed())
          return
        if (closed)
          closed = false
        retries++
        setTimeout(start, 1000)
      })

      proc.on('error', () => { })
    }
    catch {
      pending = false
      retries++
      setTimeout(start, 1000)
    }
  }

  start()

  const kill = () => {
    killed = true
    try {
      if (proc)
        proc.kill()
    }
    catch { }
  }

  return kill
}

export default {
  name: 'module:sidebar:window',
  apply(mainApp) {
    const managers = new Map()
    const trackers = new Map()

    function onOpen(event, data) {
      const { mirrorId, deviceId, mirrorTitle, btnCount, mirrorHwnd } = data
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
      const dims = getDimensions(btnCount)

      const manager = createWindowManager(uid, {
        singleton: false,
        browserWindow: {
          frame: false,
          resizable: false,
          backgroundColor: '#1f2937',
          width: dims.pw,
          height: dims.ph,
          minHeight: 1,
          minWidth: 1,
          skipTaskbar: true,
          show: false,
          hasShadow: false,
          roundedCorners: true,
        },
        hooks: {
          ready(win) {
            trySend(win, 'device-change', { id: deviceId })
            const stopTracker = startTracker(win, mirrorTitle, dims.pw, dims.ph, dims.lw, dims.lh, mirrorHwnd)
            trackers.set(mirrorId, stopTracker)
          },
          closed() {
            const stopTracker = trackers.get(mirrorId)
            if (stopTracker) {
              stopTracker()
              trackers.delete(mirrorId)
            }
            managers.delete(mirrorId)
          },
        },
      })

      managers.set(mirrorId, manager)
      manager.open({ mirrorId, deviceId, mirrorTitle, page: 'pages/sidebar', show: false })
    }

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
      for (const entry of managers.values()) {
        const win = entry?.get?.()
        if (win && !win.isDestroyed())
          win.close()
      }
      for (const stopTracker of trackers.values()) {
        stopTracker()
      }
      managers.clear()
      trackers.clear()
    }
  },
}
