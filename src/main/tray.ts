import { Tray, app, BrowserWindow, nativeImage, globalShortcut, screen, ipcMain } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { pollFeeds } from './polling'
import { restoreMainWindow } from './index'
import * as db from './db'
import { translations } from '../shared/translations'
import type { KeyboardShortcuts, TrayMenuSnapshot } from '../shared/types'

let tray: Tray | null = null
let _mainWindow: BrowserWindow | null = null
let registeredGlobalShortcuts: string[] = []

const activeActivities = new Set<'polling' | 'batch'>()
let animTimer: NodeJS.Timeout | null = null
let currentFrame = 1

let currentScaleFactor = 0
let cachedIdleImage: Electron.NativeImage | null = null
const cachedFrames: Electron.NativeImage[] = []

let trayWindow: BrowserWindow | null = null
let trayAnchor: { x: number; y: number } | null = null
let currentTraySize = { width: 292, height: 380 }
let ipcRegistered = false

function loadTrayFrame(frameNumber?: number): Electron.NativeImage {
  const resourcesDir = path.join(__dirname, '../../resources')
  const scale = screen.getPrimaryDisplay().scaleFactor
  const px = Math.max(16, Math.round(16 * scale))

  // Invalidate cache if DPI / scale factor changed
  if (scale !== currentScaleFactor) {
    currentScaleFactor = scale
    cachedIdleImage = null
    cachedFrames.length = 0
  }

  if (frameNumber && frameNumber >= 1 && frameNumber <= 4) {
    if (cachedFrames[frameNumber]) {
      return cachedFrames[frameNumber]
    }
    const hiRes = nativeImage.createFromPath(
      path.join(resourcesDir, `tray-frame-${frameNumber}.png`)
    )
    if (!hiRes.isEmpty()) {
      const resized = hiRes.resize({ width: px, height: px, quality: 'best' })
      cachedFrames[frameNumber] = resized
      return resized
    }
    const trayPng = nativeImage.createFromPath(
      path.join(resourcesDir, `tray-frame-${frameNumber}-32.png`)
    )
    if (!trayPng.isEmpty()) {
      const resized =
        trayPng.getSize().width === px
          ? trayPng
          : trayPng.resize({ width: px, height: px, quality: 'best' })
      cachedFrames[frameNumber] = resized
      return resized
    }
  }

  if (cachedIdleImage) return cachedIdleImage

  const hiRes = nativeImage.createFromPath(path.join(resourcesDir, 'icon.png'))
  if (!hiRes.isEmpty()) {
    cachedIdleImage = hiRes.resize({ width: px, height: px, quality: 'best' })
    return cachedIdleImage
  }

  const trayPng = nativeImage.createFromPath(path.join(resourcesDir, 'tray.png'))
  if (!trayPng.isEmpty()) {
    const { width } = trayPng.getSize()
    cachedIdleImage =
      width === px ? trayPng : trayPng.resize({ width: px, height: px, quality: 'best' })
    return cachedIdleImage
  }

  cachedIdleImage = nativeImage.createFromPath(path.join(resourcesDir, 'icon.ico'))
  return cachedIdleImage
}

function updateTrayTooltip(busy: boolean): void {
  if (!tray || tray.isDestroyed()) return
  const version = app.getVersion()
  if (busy) {
    const lang = db.getSettings().language || 'en'
    const loadingText = translations[lang]?.mainProcess?.tray?.updateFeeds || 'Loading feeds...'
    try {
      tray.setToolTip(`CyberFeeds v${version}: ${loadingText}`)
    } catch {
      /* ignore if destroyed */
    }
  } else {
    try {
      tray.setToolTip(`CyberFeeds v${version}`)
    } catch {
      /* ignore if destroyed */
    }
  }
}

const OUTWARD_PULSE = [1, 2, 3, 4]
const INWARD_PULSE = [3, 2, 1, 4]
let activePulse = OUTWARD_PULSE
let pulseStep = 0

export function setTrayActivity(source: 'polling' | 'batch', active: boolean): void {
  if (active) {
    activeActivities.add(source)
  } else {
    activeActivities.delete(source)
  }

  const isBusy = activeActivities.size > 0

  if (isBusy) {
    if (!animTimer) {
      activePulse = OUTWARD_PULSE
      pulseStep = 0
      currentFrame = activePulse[0]
      if (tray && !tray.isDestroyed()) {
        try {
          tray.setImage(loadTrayFrame(currentFrame))
          updateTrayTooltip(true)
        } catch {
          /* ignore */
        }
      }
      animTimer = setInterval(() => {
        if (!tray || tray.isDestroyed()) {
          if (animTimer) {
            clearInterval(animTimer)
            animTimer = null
          }
          return
        }
        pulseStep++
        if (pulseStep >= activePulse.length) {
          pulseStep = 0
          activePulse = Math.random() < 0.65 ? INWARD_PULSE : OUTWARD_PULSE
        }
        currentFrame = activePulse[pulseStep]
        try {
          tray.setImage(loadTrayFrame(currentFrame))
        } catch {
          if (animTimer) {
            clearInterval(animTimer)
            animTimer = null
          }
        }
      }, 235)
    }
  } else {
    if (animTimer) {
      clearInterval(animTimer)
      animTimer = null
    }
    activePulse = OUTWARD_PULSE
    pulseStep = 0
    currentFrame = 1
    if (tray && !tray.isDestroyed()) {
      try {
        tray.setImage(loadTrayFrame())
        updateTrayTooltip(false)
      } catch {
        /* ignore */
      }
    }
  }
}

function getMainWindowState(): 'visible' | 'minimized' | 'hidden' {
  if (!_mainWindow || _mainWindow.isDestroyed()) return 'hidden'
  if (_mainWindow.isMinimized()) return 'minimized'
  if (!_mainWindow.isVisible()) return 'hidden'
  return 'visible'
}

function getTrayMenuSnapshot(): TrayMenuSnapshot {
  const version = app.getVersion()
  const settings = db.getSettings()
  const shortcuts = settings.shortcuts as KeyboardShortcuts
  const winState = getMainWindowState()

  return {
    version,
    windowState: winState,
    hotkey: shortcuts?.showHide?.enabled ? shortcuts.showHide.accelerator : null,
    fetchHotkey: shortcuts?.fetch?.enabled ? shortcuts.fetch.accelerator : null,
    settingsHotkey: shortcuts?.settings?.enabled ? shortcuts.settings.accelerator : null,
    pollingEnabled: settings.pollingEnabled !== false,
    isPolling: activeActivities.has('polling'),
    language: settings.language === 'es' ? 'es' : 'en',
    theme: settings.theme || 'dark',
    showSuitePromo: settings.showSuitePromo !== false
  }
}

function applyTrayWindowGeometry(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number
): void {
  if (!trayWindow || trayWindow.isDestroyed()) return

  const point = { x: anchorX, y: anchorY }
  const display = screen.getDisplayNearestPoint(point) || screen.getPrimaryDisplay()
  const { workArea: wa, bounds: db } = display

  const shadowPad = 12
  const gap = 4

  const cardW = width - 2 * shadowPad
  const cardH = height - 2 * shadowPad

  // Calculate taskbar thickness on each edge to find the actual taskbar location
  const bottomThick = (db.y + db.height) - (wa.y + wa.height)
  const topThick = wa.y - db.y
  const leftThick = wa.x - db.x
  const rightThick = (db.x + db.width) - (wa.x + wa.width)

  let taskbarPosition: 'bottom' | 'top' | 'left' | 'right' = 'bottom'
  let maxThick = 0

  if (bottomThick > maxThick) {
    maxThick = bottomThick
    taskbarPosition = 'bottom'
  }
  if (topThick > maxThick) {
    maxThick = topThick
    taskbarPosition = 'top'
  }
  if (leftThick > maxThick) {
    maxThick = leftThick
    taskbarPosition = 'left'
  }
  if (rightThick > maxThick) {
    maxThick = rightThick
    taskbarPosition = 'right'
  }

  // If auto-hide taskbar (workArea equals bounds), deduce edge closest to anchor
  if (maxThick === 0) {
    const distLeft = Math.abs(anchorX - db.x)
    const distRight = Math.abs(db.x + db.width - anchorX)
    const distTop = Math.abs(anchorY - db.y)
    const distBottom = Math.abs(db.y + db.height - anchorY)

    const minDist = Math.min(distLeft, distRight, distTop, distBottom)
    if (minDist === distLeft) taskbarPosition = 'left'
    else if (minDist === distRight) taskbarPosition = 'right'
    else if (minDist === distTop) taskbarPosition = 'top'
    else taskbarPosition = 'bottom'
  }

  let cardX: number
  let cardY: number

  if (taskbarPosition === 'bottom') {
    cardY = wa.y + wa.height - cardH - gap
    cardX = anchorX - Math.round(cardW / 2)
  } else if (taskbarPosition === 'top') {
    cardY = wa.y + gap
    cardX = anchorX - Math.round(cardW / 2)
  } else if (taskbarPosition === 'left') {
    cardX = wa.x + gap
    cardY = anchorY - Math.round(cardH / 2)
  } else {
    // right
    cardX = wa.x + wa.width - cardW - gap
    cardY = anchorY - Math.round(cardH / 2)
  }

  // Clamp within work area bounds with gap padding
  cardX = Math.max(wa.x + gap, Math.min(wa.x + wa.width - cardW - gap, cardX))
  cardY = Math.max(wa.y + gap, Math.min(wa.y + wa.height - cardH - gap, cardY))

  const winX = cardX - shadowPad
  const winY = cardY - shadowPad

  // Only call setBounds if dimensions or coordinates changed to avoid DWM flicker
  const currentBounds = trayWindow.getBounds()
  if (
    currentBounds.x !== winX ||
    currentBounds.y !== winY ||
    currentBounds.width !== width ||
    currentBounds.height !== height
  ) {
    trayWindow.setBounds({
      x: winX,
      y: winY,
      width,
      height
    })
  }
}

function ensureTrayWindow(): BrowserWindow {
  if (trayWindow && !trayWindow.isDestroyed()) {
    return trayWindow
  }

  trayWindow = new BrowserWindow({
    width: currentTraySize.width,
    height: currentTraySize.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  trayWindow.webContents.setBackgroundThrottling(false)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    trayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/tray/index.html`)
  } else {
    trayWindow.loadFile(path.join(__dirname, '../renderer/tray/index.html'))
  }

  trayWindow.on('blur', () => {
    hideTrayMenu()
  })

  trayWindow.on('closed', () => {
    trayWindow = null
  })

  return trayWindow
}

function showTrayMenu(): void {
  const win = ensureTrayWindow()
  if (win.isDestroyed()) return

  const cursor = screen.getCursorScreenPoint()
  const cursorDisplay = screen.getDisplayNearestPoint(cursor)

  let anchorX = cursor.x
  let anchorY = cursor.y

  if (tray && !tray.isDestroyed()) {
    try {
      const bounds = tray.getBounds()
      if (bounds.width > 0 && bounds.height > 0) {
        const boundsCenter = {
          x: Math.round(bounds.x + bounds.width / 2),
          y: Math.round(bounds.y + bounds.height / 2)
        }
        const boundsDisplay = screen.getDisplayNearestPoint(boundsCenter)
        // Only use tray bounds if they reside on the same monitor as the click
        // and are reasonably near the cursor to protect against Windows multi-DPI bugs
        const dx = Math.abs(boundsCenter.x - cursor.x)
        const dy = Math.abs(boundsCenter.y - cursor.y)
        if (boundsDisplay.id === cursorDisplay.id && dx < 150 && dy < 150) {
          anchorX = boundsCenter.x
          anchorY = boundsCenter.y
        }
      }
    } catch {
      // fallback to cursor
    }
  }

  trayAnchor = { x: anchorX, y: anchorY }
  applyTrayWindowGeometry(anchorX, anchorY, currentTraySize.width, currentTraySize.height)

  const snapshot = getTrayMenuSnapshot()
  win.webContents.send('tray:show', snapshot)

  win.show()
  win.focus()
}

export function hideTrayMenu(): void {
  if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) {
    trayWindow.hide()
  }
}

function toggleTrayMenu(): void {
  if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) {
    hideTrayMenu()
  } else {
    showTrayMenu()
  }
}

function handleTrayAction(action: string): void {
  switch (action) {
    case 'toggle': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      if (getMainWindowState() === 'visible') {
        _mainWindow.hide()
      } else {
        restoreMainWindow()
      }
      break
    }
    case 'poll': {
      hideTrayMenu()
      pollFeeds()
      break
    }
    case 'togglePolling': {
      const current = db.getSettings()
      const pollingEnabled = !current.pollingEnabled
      db.saveSettings({ ...current, pollingEnabled })
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('settings:pollingToggled', pollingEnabled)
      }
      if (trayWindow && !trayWindow.isDestroyed()) {
        trayWindow.webContents.send('tray:show', getTrayMenuSnapshot())
      }
      break
    }
    case 'settings': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      restoreMainWindow()
      _mainWindow.webContents.send('app:openSettings')
      setTimeout(() => {
        if (_mainWindow && !_mainWindow.isDestroyed()) {
          _mainWindow.webContents.send('app:openSettings')
        }
      }, 80)
      break
    }
    case 'about': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      restoreMainWindow()
      _mainWindow.webContents.send('app:openAbout', { checkUpdates: false })
      setTimeout(() => {
        if (_mainWindow && !_mainWindow.isDestroyed()) {
          _mainWindow.webContents.send('app:openAbout', { checkUpdates: false })
        }
      }, 80)
      break
    }
    case 'checkUpdates': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      restoreMainWindow()
      _mainWindow.webContents.send('app:openAbout', { checkUpdates: true })
      setTimeout(() => {
        if (_mainWindow && !_mainWindow.isDestroyed()) {
          _mainWindow.webContents.send('app:openAbout', { checkUpdates: true })
        }
      }, 80)
      break
    }
    case 'quit': {
      hideTrayMenu()
      app.quit()
      break
    }
  }
}

function registerTrayIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.handle('tray:getState', () => {
    return getTrayMenuSnapshot()
  })

  ipcMain.handle('tray:action', (_event, action: string) => {
    handleTrayAction(action)
  })

  ipcMain.handle('tray:hide', () => {
    hideTrayMenu()
  })

  ipcMain.handle('tray:reportSize', (_event, size: { width: number; height: number }) => {
    if (!size || typeof size.width !== 'number' || typeof size.height !== 'number') return
    const newWidth = Math.max(260, Math.min(450, Math.round(size.width)))
    const newHeight = Math.max(200, Math.min(800, Math.round(size.height)))

    if (newWidth === currentTraySize.width && newHeight === currentTraySize.height) {
      return
    }

    currentTraySize = { width: newWidth, height: newHeight }
    if (trayAnchor) {
      applyTrayWindowGeometry(
        trayAnchor.x,
        trayAnchor.y,
        currentTraySize.width,
        currentTraySize.height
      )
    }
  })
}

export function createTray(mainWindow: BrowserWindow): Tray {
  tray = new Tray(loadTrayFrame())
  _mainWindow = mainWindow

  registerTrayIpc()
  registerGlobalShortcuts()
  updateTrayTooltip(false)

  // Preload hidden tray window
  ensureTrayWindow()

  // Left click on tray: toggle main window (and dismiss tray menu)
  tray.on('click', () => {
    hideTrayMenu()
    const win = _mainWindow
    if (!win || win.isDestroyed()) return
    if (getMainWindowState() === 'visible') {
      win.hide()
    } else {
      restoreMainWindow()
    }
  })

  // Double click: restore main window
  tray.on('double-click', () => {
    hideTrayMenu()
    restoreMainWindow()
  })

  // Right click: toggle floating tray menu card
  tray.on('right-click', () => {
    toggleTrayMenu()
  })

  // Re-broadcast state when main window visibility changes
  const notifyState = (): void => {
    if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) {
      trayWindow.webContents.send('tray:show', getTrayMenuSnapshot())
    }
  }

  mainWindow.on('show', notifyState)
  mainWindow.on('hide', notifyState)
  mainWindow.on('minimize', notifyState)
  mainWindow.on('restore', notifyState)

  return tray
}

export function rebuildTrayMenu(): void {
  if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) {
    trayWindow.webContents.send('tray:show', getTrayMenuSnapshot())
  }
}

export function rebuildGlobalShortcuts(): void {
  unregisterGlobalShortcuts()
  registerGlobalShortcuts()
}

function registerGlobalShortcuts(): void {
  const settings = db.getSettings()
  const shortcuts = settings.shortcuts as KeyboardShortcuts

  unregisterGlobalShortcuts()

  if (shortcuts.showHide.enabled && shortcuts.showHide.global) {
    globalShortcut.register(shortcuts.showHide.accelerator, () => {
      const win = _mainWindow
      if (!win || win.isDestroyed()) return
      if (getMainWindowState() === 'visible') {
        win.hide()
      } else {
        restoreMainWindow()
      }
    })
    registeredGlobalShortcuts.push(shortcuts.showHide.accelerator)
  }

  if (shortcuts.notifications.enabled && shortcuts.notifications.global) {
    globalShortcut.register(shortcuts.notifications.accelerator, () => {
      const win = _mainWindow
      if (!win || win.isDestroyed()) return
      restoreMainWindow()
      win.webContents.send('app:openHistory')
    })
    registeredGlobalShortcuts.push(shortcuts.notifications.accelerator)
  }

  if (shortcuts.settings.enabled && shortcuts.settings.global) {
    globalShortcut.register(shortcuts.settings.accelerator, () => {
      const win = _mainWindow
      if (!win || win.isDestroyed()) return
      restoreMainWindow()
      win.webContents.send('app:openSettings')
    })
    registeredGlobalShortcuts.push(shortcuts.settings.accelerator)
  }

  if (shortcuts.fetch.enabled && shortcuts.fetch.global) {
    globalShortcut.register(shortcuts.fetch.accelerator, () => {
      pollFeeds()
    })
    registeredGlobalShortcuts.push(shortcuts.fetch.accelerator)
  }
}

function unregisterGlobalShortcuts(): void {
  for (const accelerator of registeredGlobalShortcuts) {
    globalShortcut.unregister(accelerator)
  }

  try {
    const shortcuts = db.getSettings().shortcuts as KeyboardShortcuts
    const candidates = [
      shortcuts.showHide.accelerator,
      shortcuts.notifications.accelerator,
      shortcuts.settings.accelerator,
      shortcuts.fetch.accelerator
    ]

    for (const acc of candidates) {
      if (acc) globalShortcut.unregister(acc)
    }
  } catch {
    // ignore
  }

  registeredGlobalShortcuts = []
}

export function destroyTray(): void {
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = null
  }
  unregisterGlobalShortcuts()
  if (trayWindow && !trayWindow.isDestroyed()) {
    try {
      trayWindow.destroy()
    } catch {
      /* ignore */
    }
    trayWindow = null
  }
  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy()
    } catch {
      /* ignore */
    }
  }
  tray = null
}
