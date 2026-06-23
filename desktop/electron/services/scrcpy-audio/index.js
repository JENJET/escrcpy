import { spawn } from 'node:child_process'
import treeKill from '@magda/tree-kill'
import { ipcMain } from 'electron'
import { setupEnvPath } from '$electron/process/helper.js'

const audioMirrorMap = new Map()
const audioProcessMap = new Map()
const usedPorts = new Set()
const portRange = {
  first: 27183,
  last: 27199,
}

function startAudioProcess(serial) {
  if (audioProcessMap.has(serial)) {
    return
  }

  setupEnvPath()

  const port = acquirePort()

  const args = [
    `--serial=${serial}`,
    '--no-video',
    '--no-window',
  ]

  if (port) {
    args.push(`--port=${port}:${port}`)
  }

  const proc = spawn('scrcpy', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  audioProcessMap.set(serial, proc)

  proc.on('exit', () => {
    if (port) {
      releasePort(port)
    }
    if (audioProcessMap.get(serial) === proc) {
      audioProcessMap.delete(serial)
    }
  })

  proc.stdout?.on('data', () => {})
  proc.stderr?.on('data', () => {})
}

function stopAudioProcess(serial) {
  const proc = audioProcessMap.get(serial)
  if (proc) {
    treeKill(proc.pid, 'SIGTERM')
    audioProcessMap.delete(serial)
  }
}

function retain(serial, muted) {
  if (!serial || muted) {
    return null
  }

  const existing = audioMirrorMap.get(serial)

  if (existing) {
    existing.refs += 1

    if (!existing.owner) {
      existing.owner = true
      return {
        key: serial,
        isOwner: true,
      }
    }

    return {
      key: serial,
      isOwner: false,
    }
  }

  audioMirrorMap.set(serial, {
    owner: true,
    refs: 1,
  })

  startAudioProcess(serial)

  return {
    key: serial,
    isOwner: true,
  }
}

function release(token) {
  if (!token?.key) {
    return -1
  }

  const audioMirror = audioMirrorMap.get(token.key)

  if (!audioMirror) {
    return -1
  }

  audioMirror.refs -= 1

  if (audioMirror.refs > 0) {
    if (token.isOwner) {
      audioMirror.owner = false
    }

    return audioMirror.refs
  }

  audioMirrorMap.delete(token.key)
  stopAudioProcess(token.key)
  return 0
}

function acquirePort() {
  for (let port = portRange.first; port <= portRange.last; port += 1) {
    if (!usedPorts.has(port)) {
      usedPorts.add(port)
      return port
    }
  }

  return null
}

function releasePort(port) {
  if (!port) {
    return false
  }

  return usedPorts.delete(port)
}

export default {
  name: 'service:scrcpy-audio',
  apply() {
    ipcMain.on('scrcpy-audio-retain', (event, payload = {}) => {
      event.returnValue = retain(payload.serial, payload.muted)
    })

    ipcMain.on('scrcpy-audio-release', (event, token) => {
      event.returnValue = release(token)
    })

    ipcMain.on('scrcpy-port-acquire', (event) => {
      event.returnValue = acquirePort()
    })

    ipcMain.on('scrcpy-port-release', (event, port) => {
      event.returnValue = releasePort(port)
    })

    ipcMain.on('scrcpy-audio-kill-all', () => {
      for (const proc of audioProcessMap.values()) {
        treeKill(proc.pid, 'SIGTERM')
      }
      audioProcessMap.clear()
      audioMirrorMap.clear()
    })

    return () => {
      ipcMain.removeAllListeners('scrcpy-audio-retain')
      ipcMain.removeAllListeners('scrcpy-audio-release')
      ipcMain.removeAllListeners('scrcpy-port-acquire')
      ipcMain.removeAllListeners('scrcpy-port-release')
      ipcMain.removeAllListeners('scrcpy-audio-kill-all')
      for (const proc of audioProcessMap.values()) {
        treeKill(proc.pid, 'SIGTERM')
      }
      audioProcessMap.clear()
      audioMirrorMap.clear()
      usedPorts.clear()
    }
  },
}
