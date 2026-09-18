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

function resolveInitialBounds(): { x: number; y: number; width: number; height: number } {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint) || screen.getPrimaryDisplay()
  const wa = display.workArea || display.bounds

  const defaultWidth = 520
  const defaultHeight = Math.round((defaultWidth * 9) / 16)

  if (lastBounds) {
    // Check if lastBounds is roughly visible in any current display
    const visible = screen.getAllDisplays().some((d) => {
      const db = d.bounds
      return (
        lastBounds!.x + 100 >= db.x &&
        lastBounds!.x <= db.x + db.width &&
        lastBounds!.y + 100 >= db.y &&
        lastBounds!.y <= db.y + db.height
      )
    })
    if (visible) {
      return {
        x: lastBounds.x,
        y: lastBounds.y,
        width: Math.max(320, lastBounds.width),
        height: Math.max(180, Math.round((Math.max(320, lastBounds.width) * 9) / 16))
      }
    }
  }

  // Default to bottom-right corner of current display work area
  const margin = 24
  return {
    x: wa.x + wa.width - defaultWidth - margin,
    y: wa.y + wa.height - defaultHeight - margin,
    width: defaultWidth,
    height: defaultHeight
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
    if (pipWindow && !pipWindow.isDestroyed() && currentPayload) {
      pipWindow.webContents.send('pip:update-data', currentPayload)
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
