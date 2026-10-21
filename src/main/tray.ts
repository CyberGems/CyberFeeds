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

  let cardX: number
  let cardY: number

  // Detect taskbar position
  const isTaskbarBottom = wa.y + wa.height < db.y + db.height
  const isTaskbarTop = wa.y > db.y
  const isTaskbarLeft = wa.x > db.x
  const isTaskbarRight = wa.x + wa.width < db.x + db.width

  if (isTaskbarBottom) {
    cardY = wa.y + wa.height - cardH - gap
    cardX = anchorX - Math.round(cardW / 2)
  } else if (isTaskbarTop) {
    cardY = wa.y + gap
    cardX = anchorX - Math.round(cardW / 2)
  } else if (isTaskbarLeft) {
    cardX = wa.x + gap
    cardY = anchorY - Math.round(cardH / 2)
  } else if (isTaskbarRight) {
    cardX = wa.x + wa.width - cardW - gap
    cardY = anchorY - Math.round(cardH / 2)
  } else {
    // Hidden taskbar fallback
    if (anchorY > wa.y + wa.height / 2) {
      cardY = anchorY - cardH - gap
    } else {
      cardY = anchorY + gap
    }
    cardX = anchorX - Math.round(cardW / 2)
  }

  // Clamp within work area bounds
  cardX = Math.min(wa.x + wa.width - cardW, Math.max(wa.x, cardX))
  cardY = Math.min(wa.y + wa.height - cardH, Math.max(wa.y, cardY))

  const winX = cardX - shadowPad
  const winY = cardY - shadowPad

  trayWindow.setBounds({
    x: winX,
    y: winY,
    width,
    height
  })
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

  let anchorX = 0
  let anchorY = 0

  if (tray && !tray.isDestroyed()) {
    try {
      const bounds = tray.getBounds()
      if (bounds.width > 0 && bounds.height > 0) {
        anchorX = Math.round(bounds.x + bounds.width / 2)
        anchorY = Math.round(bounds.y + bounds.height / 2)
      }
    } catch {
      // fallback
    }
  }

  if (anchorX === 0 && anchorY === 0) {
    const cursor = screen.getCursorScreenPoint()
    anchorX = cursor.x
    anchorY = cursor.y
  }

  trayAnchor = { x: anchorX, y: anchorY }
  applyTrayWindowGeometry(anchorX, anchorY, currentTraySize.width, currentTraySize.height)

  win.show()
  win.focus()
  win.webContents.send('tray:show')
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
        trayWindow.webContents.send('tray:show')
      }
      break
    }
    case 'settings': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      restoreMainWindow()
      _mainWindow.webContents.send('app:openSettings')
      break
    }
    case 'about': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      restoreMainWindow()
      _mainWindow.webContents.send('app:openAbout', { checkUpdates: false })
      break
    }
    case 'checkUpdates': {
      hideTrayMenu()
      if (!_mainWindow || _mainWindow.isDestroyed()) return
      restoreMainWindow()
      _mainWindow.webContents.send('app:openAbout', { checkUpdates: true })
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
    currentTraySize = {
      width: Math.max(260, Math.min(450, Math.round(size.width))),
      height: Math.max(200, Math.min(800, Math.round(size.height)))
    }
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
      trayWindow.webContents.send('tray:show')
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
    trayWindow.webContents.send('tray:show')
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
