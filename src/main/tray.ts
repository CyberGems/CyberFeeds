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

let trayMenuLastShown = 0
let trayMenuHideTimer: NodeJS.Timeout | null = null
let trayMenuShowPending = false
let trayMenuShowFallback: NodeJS.Timeout | null = null
let trayMenuRevealTimer: NodeJS.Timeout | null = null
let trayMenuAnchor: any = null

function calculateTrayMenuGeometry(
  iconBounds: any,
  windowW: number,
  windowH: number
): { x: number; y: number; width: number; height: number } {
  // 1) Cursor position is the most reliable anchor on Windows, especially
  //    on secondary monitors with vertical taskbars and mixed DPI where
  //    tray.getBounds() can return incorrect/stale coordinates.
  let cursor: { x: number; y: number } = { x: 0, y: 0 }
  try {
    cursor = screen.getCursorScreenPoint()
  } catch {
    cursor = { x: 0, y: 0 }
  }

  // 2) Use iconBounds only if they seem plausible (on the same display as cursor).
  //    On vertical taskbars, tray.getBounds() often returns primary-display coords.
  let b: { x: number; y: number; width: number; height: number }

  const eventBoundsValid = iconBounds && typeof iconBounds.x === 'number' &&
    (iconBounds.width > 0 || iconBounds.height > 0)

  if (eventBoundsValid) {
    // Check if event bounds are on the same display as the cursor
    const cursorDisplay = screen.getDisplayNearestPoint(cursor)
    const boundsCenter = {
      x: iconBounds.x + (iconBounds.width || 0) / 2,
      y: iconBounds.y + (iconBounds.height || 0) / 2
    }
    const boundsDisplay = screen.getDisplayNearestPoint(boundsCenter)

    if (cursorDisplay.id === boundsDisplay.id) {
      b = { x: iconBounds.x, y: iconBounds.y, width: iconBounds.width || 0, height: iconBounds.height || 0 }
    } else {
      // Bounds are on a different display than cursor; cursor is more reliable
      b = { x: cursor.x, y: cursor.y, width: 0, height: 0 }
    }
  } else {
    b = { x: cursor.x, y: cursor.y, width: 0, height: 0 }
  }

  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  let display: Electron.Display
  try {
    display = screen.getDisplayNearestPoint({ x: cx, y: cy })
  } catch {
    display = screen.getPrimaryDisplay()
  }
  const work = display.workArea || display.bounds

  const gap = 4
  const shadowPad = 12
  const cardW = windowW - 2 * shadowPad
  const cardH = windowH - 2 * shadowPad

  let cardX: number, cardY: number
  const dLeft = cx - work.x
  const dRight = (work.x + work.width) - cx
  const dTop = cy - work.y
  const dBottom = (work.y + work.height) - cy

  if (dBottom <= dLeft && dBottom <= dRight && dBottom <= dTop) {
    // Taskbar at bottom
    cardX = cx - cardW / 2
    cardY = (b.height > 0 ? b.y - cardH : work.y + work.height - cardH) - gap
  } else if (dTop <= dLeft && dTop <= dRight) {
    // Taskbar at top
    cardX = cx - cardW / 2
    cardY = (b.height > 0 ? b.y + b.height : work.y) + gap
  } else if (dLeft <= dRight) {
    // Taskbar at left
    cardX = (b.width > 0 ? b.x + b.width : work.x) + gap
    cardY = cy - cardH / 2
  } else {
    // Taskbar at right
    cardX = (b.width > 0 ? b.x - cardW : work.x + work.width - cardW) - gap
    cardY = cy - cardH / 2
  }

  let windowX = cardX - shadowPad
  let windowY = cardY - shadowPad

  windowX = Math.min(Math.max(windowX, work.x + 2), work.x + work.width - windowW - 2)
  const screenBottom = (display.bounds ? display.bounds.y + display.bounds.height : work.y + work.height) - 2
  windowY = Math.min(Math.max(windowY, work.y + 2), screenBottom - windowH)

  return {
    x: Math.round(windowX),
    y: Math.round(windowY),
    width: Math.round(windowW),
    height: Math.round(windowH)
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
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
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

  trayWindow.setAlwaysOnTop(true, 'pop-up-menu')
  trayWindow.webContents.setBackgroundThrottling(false)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    trayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/tray/index.html`)
  } else {
    trayWindow.loadFile(path.join(__dirname, '../renderer/tray/index.html'))
  }

  trayWindow.on('blur', () => {
    if (trayMenuHideTimer) return
    if (Date.now() - trayMenuLastShown < 250) return
    trayMenuHideTimer = setTimeout(() => {
      trayMenuHideTimer = null
      hideTrayMenu()
    }, 120)
  })

  trayWindow.on('closed', () => {
    trayWindow = null
  })

  return trayWindow
}

function revealTrayMenuWin(): void {
  if (!trayWindow || trayWindow.isDestroyed()) return
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  trayMenuShowPending = false
  if (!trayWindow.isVisible()) {
    try { trayWindow.setOpacity(0) } catch { /* ignore */ }
    trayWindow.show()
    if (trayMenuRevealTimer) clearTimeout(trayMenuRevealTimer)
    trayMenuRevealTimer = setTimeout(() => {
      trayMenuRevealTimer = null
      if (trayWindow && !trayWindow.isDestroyed()) {
        try { trayWindow.setOpacity(1) } catch { /* ignore */ }
      }
    }, 40)
  } else {
    try { trayWindow.setOpacity(1) } catch { /* ignore */ }
  }
  trayWindow.focus()
  trayMenuLastShown = Date.now()
}

function showTrayMenu(eventBounds?: any): void {
  if (trayMenuHideTimer) {
    clearTimeout(trayMenuHideTimer)
    trayMenuHideTimer = null
  }
  const win = ensureTrayWindow()
  if (win.isDestroyed()) return

  trayMenuAnchor = eventBounds
  const geo = calculateTrayMenuGeometry(eventBounds, currentTraySize.width, currentTraySize.height)

  // To avoid flicker: hide first if visible, reposition, then show.
  // This prevents the user from seeing the window jump from its old position.
  const wasVisible = win.isVisible()
  if (wasVisible) {
    win.hide()
  }

  // Set final position while hidden
  const current = win.getBounds()
  if (current.x !== geo.x || current.y !== geo.y || current.width !== geo.width || current.height !== geo.height) {
    win.setBounds(geo)
  }

  trayMenuShowPending = true
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  trayMenuShowFallback = setTimeout(() => {
    trayMenuShowFallback = null
    if (trayMenuShowPending) revealTrayMenuWin()
  }, 500)

  const snapshot = getTrayMenuSnapshot()
  win.webContents.send('tray:show', snapshot)
}

export function hideTrayMenu(): void {
  if (trayMenuHideTimer) {
    clearTimeout(trayMenuHideTimer)
    trayMenuHideTimer = null
  }
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  if (trayMenuRevealTimer) { clearTimeout(trayMenuRevealTimer); trayMenuRevealTimer = null }
  trayMenuShowPending = false
  if (trayWindow && !trayWindow.isDestroyed()) {
    try { trayWindow.setOpacity(1) } catch { /* ignore */ }
    if (trayWindow.isVisible()) {
      trayWindow.hide()
    }
  }
}

function toggleTrayMenu(eventBounds?: any): void {
  if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) {
    hideTrayMenu()
  } else {
    showTrayMenu(eventBounds)
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

    if (Math.abs(newWidth - currentTraySize.width) >= 6 || Math.abs(newHeight - currentTraySize.height) >= 6) {
      currentTraySize = { width: newWidth, height: newHeight }
    }

    if (trayMenuShowPending && trayWindow && !trayWindow.isDestroyed()) {
      const geo = calculateTrayMenuGeometry(trayMenuAnchor, newWidth, newHeight)
      const current = trayWindow.getBounds()
      if (current.x !== geo.x || current.y !== geo.y || current.width !== geo.width || current.height !== geo.height) {
        trayWindow.setBounds(geo)
      }
      revealTrayMenuWin()
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
  tray.on('right-click', (_event, bounds) => {
    toggleTrayMenu(bounds)
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
