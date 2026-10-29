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

// Windows caps tray tooltips at 63 characters.
const TRAY_TOOLTIP_MAX_LEN = 63

function clampTrayTooltip(text: string): string {
  return text.length > TRAY_TOOLTIP_MAX_LEN ? text.slice(0, TRAY_TOOLTIP_MAX_LEN) : text
}

function buildTrayTooltip(busy: boolean): string {
  const lang = db.getSettings().language || 'en'
  const t = translations[lang] || translations.en
  if (busy) {
    const status = t?.mainProcess?.tray?.refreshingFeeds || 'Refreshing feeds...'
    return clampTrayTooltip(`CyberFeeds · ${status}`)
  }
  const shortcuts = db.getSettings().shortcuts as KeyboardShortcuts
  const hotkey =
    shortcuts?.showHide?.enabled && shortcuts?.showHide?.global
      ? shortcuts.showHide.accelerator
      : null
  return clampTrayTooltip(hotkey ? `CyberFeeds · ${hotkey}` : 'CyberFeeds')
}

function updateTrayTooltip(busy: boolean): void {
  if (!tray || tray.isDestroyed()) return
  try {
    tray.setToolTip(buildTrayTooltip(busy))
  } catch {
    /* ignore if destroyed */
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
// Geometry awaiting the reveal; re-stamped after the DPI context attaches
// because the first setBounds across displays converts the position with the
// window's previous scale, landing the window off-target (tray-diag logs).
let trayMenuPendingGeo: { x: number; y: number; width: number; height: number } | null = null
let trayMenuCrossingReveal = false
let trayMenuCrossingTimer: NodeJS.Timeout | null = null
let trayMenuOpenCount = 0

function getInitialAnchor(eventBounds?: any): { x: number; y: number; width: number; height: number } {
  let cursor: { x: number; y: number } | null = null
  try {
    cursor = screen.getCursorScreenPoint()
  } catch {
    cursor = null
  }

  // The cursor sits on the tray icon while the user right-clicks it, so any
  // candidate rect whose center is far from the cursor is expressed in the
  // wrong coordinate space (mixed-DPI tray rects are scaled by the primary
  // display's factor) and must not anchor the menu.
  const nearCursor = (r: { x: number; y: number; width: number; height: number }): boolean => {
    if (!cursor) return true
    const cx = r.x + r.width / 2
    const cy = r.y + r.height / 2
    return Math.abs(cx - cursor.x) <= 80 && Math.abs(cy - cursor.y) <= 80
  }

  if (eventBounds && typeof eventBounds.x === 'number' && (eventBounds.width || eventBounds.height)) {
    const r = {
      x: eventBounds.x,
      y: eventBounds.y,
      width: eventBounds.width || 0,
      height: eventBounds.height || 0
    }
    if (nearCursor(r)) {
      return r
    }
  }
  try {
    const tb = tray?.getBounds()
    if (tb && typeof tb.x === 'number' && (tb.width > 0 || tb.height > 0)) {
      const r = { x: tb.x, y: tb.y, width: tb.width, height: tb.height }
      if (nearCursor(r)) {
        return r
      }
    }
  } catch {
    /* ignore */
  }
  if (cursor) {
    return { x: cursor.x, y: cursor.y, width: 0, height: 0 }
  }
  return { x: 0, y: 0, width: 0, height: 0 }
}

function calculateTrayMenuGeometry(
  iconBounds: any,
  windowW: number,
  windowH: number
): { x: number; y: number; width: number; height: number } {
  let b: { x: number; y: number; width: number; height: number }

  if (iconBounds && typeof iconBounds.x === 'number') {
    b = {
      x: iconBounds.x,
      y: iconBounds.y,
      width: iconBounds.width || 0,
      height: iconBounds.height || 0
    }
  } else {
    let cursor = { x: 0, y: 0 }
    try {
      cursor = screen.getCursorScreenPoint()
    } catch {
      cursor = { x: 0, y: 0 }
    }
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

  trayMenuAnchor = getInitialAnchor(eventBounds)
  const geo = calculateTrayMenuGeometry(trayMenuAnchor, currentTraySize.width, currentTraySize.height)

  trayMenuOpenCount += 1
  let fromDisplay: Electron.Display | null = null
  try { fromDisplay = screen.getDisplayMatching(win.getBounds()) } catch { fromDisplay = null }

  // TEMP DIAGNOSTIC: capture the raw first-open inputs; remove once the
  // first-open mispositioning root cause is confirmed.
  let diagTrayBounds: unknown = null
  try { diagTrayBounds = tray?.getBounds() } catch { /* ignore */ }
  let diagCursor: unknown = null
  try { diagCursor = screen.getCursorScreenPoint() } catch { /* ignore */ }
  let toDisplay: Electron.Display | null = null
  try { toDisplay = screen.getDisplayMatching(geo) } catch { toDisplay = null }
  const crossing =
    !!fromDisplay && !!toDisplay &&
    fromDisplay.id !== toDisplay.id &&
    fromDisplay.scaleFactor !== toDisplay.scaleFactor
  console.log(
    '[tray-diag] show',
    '| open:', trayMenuOpenCount,
    '| eventBounds:', JSON.stringify(eventBounds ?? null),
    '| anchor:', JSON.stringify(trayMenuAnchor),
    '| trayBounds:', JSON.stringify(diagTrayBounds),
    '| cursor:', JSON.stringify(diagCursor),
    '| size:', JSON.stringify(currentTraySize),
    '| geo:', JSON.stringify(geo),
    '| crossing:', crossing
  )

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
  trayMenuPendingGeo = { x: geo.x, y: geo.y, width: geo.width, height: geo.height }

  trayMenuShowPending = true
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  trayMenuShowFallback = setTimeout(() => {
    trayMenuShowFallback = null
    if (trayMenuShowPending) revealTrayMenuWin()
  }, 500)

  // When the hidden window crosses to a display with a different scale,
  // Electron converts the setBounds position with the previous scale, so the
  // window lands off-target. Let the new DPI context attach, then re-stamp
  // the geometry and reveal. Without this the first open after launch on a
  // monitor whose scale differs from the primary floats far from the taskbar.
  if (crossing) {
    trayMenuCrossingReveal = true
    if (trayMenuCrossingTimer) clearTimeout(trayMenuCrossingTimer)
    trayMenuCrossingTimer = setTimeout(() => {
      trayMenuCrossingTimer = null
      trayMenuCrossingReveal = false
      if (!trayMenuShowPending) return
      if (!trayWindow || trayWindow.isDestroyed()) return
      try {
        if (trayMenuPendingGeo) trayWindow.setBounds(trayMenuPendingGeo)
      } catch {
        /* ignore */
      }
      revealTrayMenuWin()
    }, 120)
  }

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
  if (trayMenuCrossingTimer) { clearTimeout(trayMenuCrossingTimer); trayMenuCrossingTimer = null }
  trayMenuShowPending = false
  trayMenuCrossingReveal = false
  trayMenuPendingGeo = null
  // Keep the last reported menu size so the next open positions correctly in
  // one step instead of first landing on the 292x380 default and jumping
  // after the renderer reports the real height.
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

    const sizeChanged =
      Math.abs(newWidth - currentTraySize.width) >= 4 ||
      Math.abs(newHeight - currentTraySize.height) >= 4

    if (sizeChanged) {
      currentTraySize = { width: newWidth, height: newHeight }
    }

    if (!trayWindow || trayWindow.isDestroyed()) return

    if (trayMenuShowPending) {
      const geo = calculateTrayMenuGeometry(trayMenuAnchor, newWidth, newHeight)
      // TEMP DIAGNOSTIC: remove once the first-open mispositioning is confirmed
      console.log(
        '[tray-diag] reportSize',
        '| open:', trayMenuOpenCount,
        '| reported:', newWidth + 'x' + newHeight,
        '| anchor:', JSON.stringify(trayMenuAnchor),
        '| geo:', JSON.stringify(geo)
      )
      trayMenuPendingGeo = { x: geo.x, y: geo.y, width: geo.width, height: geo.height }
      if (trayMenuCrossingReveal) {
        // Re-stamp the new size but defer the reveal to the crossing timer,
        // which fires once the DPI context of the target display has attached.
        try {
          trayWindow.setBounds(geo)
        } catch {
          /* ignore */
        }
        return
      }
      const current = trayWindow.getBounds()
      if (current.x !== geo.x || current.y !== geo.y || current.width !== geo.width || current.height !== geo.height) {
        trayWindow.setBounds(geo)
      }
      revealTrayMenuWin()
    } else if (trayWindow.isVisible() && sizeChanged) {
      const geo = calculateTrayMenuGeometry(trayMenuAnchor, newWidth, newHeight)
      const current = trayWindow.getBounds()
      if (current.x !== geo.x || current.y !== geo.y || current.width !== geo.width || current.height !== geo.height) {
        trayWindow.setBounds(geo)
      }
    }
  })
}

export function createTray(mainWindow: BrowserWindow): Tray {
  tray = new Tray(loadTrayFrame())
  _mainWindow = mainWindow

  // TEMP DIAGNOSTIC: remove once the first-open mispositioning is confirmed
  console.log(
    '[tray-diag] displays:',
    JSON.stringify(
      screen.getAllDisplays().map((d) => ({
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        scale: d.scaleFactor
      }))
    )
  )

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
  refreshTrayTooltip()
}

/** Re-apply the tray tooltip after a language or global shortcut change. */
export function refreshTrayTooltip(): void {
  updateTrayTooltip(activeActivities.size > 0)
}

function registerGlobalShortcuts(): void {
  const settings = db.getSettings()
  const shortcuts = settings.shortcuts as KeyboardShortcuts

  unregisterGlobalShortcuts()

  if (shortcuts.showHide.enabled && shortcuts.showHide.global) {
    const ok = globalShortcut.register(shortcuts.showHide.accelerator, () => {
      const win = _mainWindow
      if (!win || win.isDestroyed()) return
      if (getMainWindowState() === 'visible') {
        win.hide()
      } else {
        restoreMainWindow()
      }
    })
    if (ok) {
      registeredGlobalShortcuts.push(shortcuts.showHide.accelerator)
    } else {
      console.warn(`[Shortcuts] Failed to register global shortcut: ${shortcuts.showHide.accelerator}`)
    }
  }

  if (shortcuts.notifications.enabled && shortcuts.notifications.global) {
    const ok = globalShortcut.register(shortcuts.notifications.accelerator, () => {
      const win = _mainWindow
      if (!win || win.isDestroyed()) return
      restoreMainWindow()
      win.webContents.send('app:openHistory')
    })
    if (ok) {
      registeredGlobalShortcuts.push(shortcuts.notifications.accelerator)
    } else {
      console.warn(`[Shortcuts] Failed to register global shortcut: ${shortcuts.notifications.accelerator}`)
    }
  }

  if (shortcuts.settings.enabled && shortcuts.settings.global) {
    const ok = globalShortcut.register(shortcuts.settings.accelerator, () => {
      const win = _mainWindow
      if (!win || win.isDestroyed()) return
      restoreMainWindow()
      win.webContents.send('app:openSettings')
    })
    if (ok) {
      registeredGlobalShortcuts.push(shortcuts.settings.accelerator)
    } else {
      console.warn(`[Shortcuts] Failed to register global shortcut: ${shortcuts.settings.accelerator}`)
    }
  }

  if (shortcuts.fetch.enabled && shortcuts.fetch.global) {
    const ok = globalShortcut.register(shortcuts.fetch.accelerator, () => {
      pollFeeds()
    })
    if (ok) {
      registeredGlobalShortcuts.push(shortcuts.fetch.accelerator)
    } else {
      console.warn(`[Shortcuts] Failed to register global shortcut: ${shortcuts.fetch.accelerator}`)
    }
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
