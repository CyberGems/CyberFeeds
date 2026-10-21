import { BrowserWindow, screen, ipcMain } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import type { PipVideoPayload } from '../shared/types'
import { getMainWindow, restoreMainWindow } from './index'

let pipWindow: BrowserWindow | null = null
let currentPayload: PipVideoPayload | null = null
let isPinned = true
let lastBounds: { x: number; y: number; width: number; height: number } | null = null

function notifyMainWindow(active: boolean, articleId?: string): void {
  const mainWin = getMainWindow()
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('pip:status-changed', { active, articleId })
  }
}

function getTargetDisplay(): Electron.Display {
  const mainWin = getMainWindow()
  if (mainWin && !mainWin.isDestroyed()) {
    try {
      const mb = mainWin.getBounds()
      const center = {
        x: Math.round(mb.x + mb.width / 2),
        y: Math.round(mb.y + mb.height / 2)
      }
      const match =
        (typeof screen.getDisplayMatching === 'function' && screen.getDisplayMatching(mb)) ||
        screen.getDisplayNearestPoint(center)
      if (match) return match
    } catch {
      // fallback
    }
  }

  const cursorPoint = screen.getCursorScreenPoint()
  return screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay()
}

function resolveInitialBounds(): { x: number; y: number; width: number; height: number } {
  const targetDisplay = getTargetDisplay()
  const wa = targetDisplay.workArea || targetDisplay.bounds

  const defaultWidth = 520

  // Clamp desired dimensions to work area
  const width = Math.min(wa.width - 32, Math.max(320, lastBounds ? lastBounds.width : defaultWidth))
  const height = Math.round((width * 9) / 16)

  // If lastBounds exists AND is located within the target display's work area, preserve user position
  if (
    lastBounds &&
    lastBounds.x >= wa.x &&
    lastBounds.x + width <= wa.x + wa.width &&
    lastBounds.y >= wa.y &&
    lastBounds.y + height <= wa.y + wa.height
  ) {
    return {
      x: lastBounds.x,
      y: lastBounds.y,
      width,
      height
    }
  }

  // Default to bottom-right corner of target display work area
  const margin = 24
  return {
    x: wa.x + wa.width - width - margin,
    y: wa.y + wa.height - height - margin,
    width,
    height
  }
}

export function createOrUpdatePipWindow(payload: PipVideoPayload): void {
  currentPayload = payload

  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.webContents.send('pip:update-data', payload)
    if (!pipWindow.isVisible()) {
      pipWindow.show()
    }
    pipWindow.focus()
    notifyMainWindow(true, payload.articleId)
    return
  }

  const bounds = resolveInitialBounds()

  pipWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 320,
    minHeight: 180,
    frame: false,
    alwaysOnTop: isPinned,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: payload.title || 'CyberFeeds — Picture-in-Picture',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  pipWindow.setAspectRatio(16 / 9)
  pipWindow.setAlwaysOnTop(isPinned, 'floating')

  pipWindow.on('resize', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      lastBounds = pipWindow.getBounds()
    }
  })

  pipWindow.on('move', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      lastBounds = pipWindow.getBounds()
    }
  })

  pipWindow.webContents.on('did-finish-load', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      try {
        pipWindow.webContents.setZoomFactor(1.0)
        pipWindow.webContents.setVisualZoomLevelLimits(1, 1)
      } catch {
        // ignore
      }
      if (currentPayload) {
        pipWindow.webContents.send('pip:update-data', currentPayload)
      }
    }
  })

  pipWindow.on('close', () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      lastBounds = pipWindow.getBounds()
    }
  })

  pipWindow.on('closed', () => {
    pipWindow = null
    currentPayload = null
    notifyMainWindow(false)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    pipWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/pip/index.html`)
  } else {
    pipWindow.loadFile(path.join(__dirname, '../renderer/pip/index.html'))
  }

  notifyMainWindow(true, payload.articleId)
}

export function closePipWindow(): void {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.close()
  }
  pipWindow = null
  currentPayload = null
  notifyMainWindow(false)
}

export function togglePipPin(): boolean {
  isPinned = !isPinned
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.setAlwaysOnTop(isPinned, 'floating')
  }
  return isPinned
}

export function returnPipToReader(): void {
  restoreMainWindow()
  closePipWindow()
}

export function initPipIpc(): void {
  ipcMain.handle('pip:open', (_event, payload: PipVideoPayload) => {
    createOrUpdatePipWindow(payload)
    return { ok: true }
  })

  ipcMain.handle('pip:close', () => {
    closePipWindow()
    return { ok: true }
  })

  ipcMain.handle('pip:togglePin', () => {
    return togglePipPin()
  })

  ipcMain.handle('pip:returnToReader', () => {
    returnPipToReader()
    return { ok: true }
  })

  ipcMain.handle('pip:getData', () => {
    return currentPayload
  })

  ipcMain.handle('pip:getStatus', () => {
    return {
      active: Boolean(pipWindow && !pipWindow.isDestroyed()),
      articleId: currentPayload?.articleId,
      isPinned
    }
  })
}
