import { createWindowManager } from '@escrcpy/electron-setup/main'
import { BrowserWindow, ipcMain, screen } from 'electron'

const launcherWidth = 420
const launcherHeight = 360
const launcherGap = 6
const warmingWindows = new WeakSet()

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function resolveBounds(anchor = {}) {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const area = display.workArea
  const x = Number(anchor.x ?? cursor.x)
  const y = Number(anchor.y ?? cursor.y)
  const placement = anchor.placement || 'bottom'

  const rawBounds = {
    x,
    y: placement === 'top' ? y - launcherHeight - launcherGap : y + launcherGap,
    width: launcherWidth,
    height: launcherHeight,
  }

  return {
    ...rawBounds,
    x: clamp(rawBounds.x, area.x, area.x + area.width - launcherWidth),
    y: clamp(rawBounds.y, area.y, area.y + area.height - launcherHeight),
  }
}

function conceal(win) {
  if (!win || win.isDestroyed()) {
    return false
  }

  win.setOpacity(0)
  win.setIgnoreMouseEvents(true)
  return true
}

function reveal(win, payload = {}) {
  if (!win || win.isDestroyed()) {
    return false
  }

  win.setBounds(resolveBounds(payload.anchor))
  win.webContents.send('app-launcher-open', payload)
  win.setIgnoreMouseEvents(false)
  win.setOpacity(1)
  win.focus()
  return true
}

export default {
  name: 'module:app-launcher:window',
  apply() {
    function onHide(event) {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win?.customId !== 'pages/app-launcher') {
        return false
      }

      return conceal(win)
    }

    createWindowManager('pages/app-launcher', {
      singleton: true,
      browserWindow({ payload }) {
        return {
          frame: false,
          transparent: false,
          backgroundColor: '#1f2023',
          resizable: false,
          skipTaskbar: true,
          alwaysOnTop: true,
          show: false,
          hasShadow: false,
          roundedCorners: true,
          opacity: 0,
          ...resolveBounds(payload.anchor),
        }
      },
      hooks: {
        ready(win, { payload }) {
          conceal(win)
          win.setBounds(resolveBounds(payload.anchor))
          warmingWindows.add(win)
          win.showInactive()
          setTimeout(() => {
            warmingWindows.delete(win)
            reveal(win, payload)
          }, 120)
        },
        shown(win, { payload }) {
          if (warmingWindows.has(win)) {
            return
          }

          reveal(win, payload)
        },
        blur(win) {
          conceal(win)
        },
      },
    })

    ipcMain.on('app-launcher-hide', onHide)

    return () => {
      ipcMain.removeListener('app-launcher-hide', onHide)
    }
  },
}
