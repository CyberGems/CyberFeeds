import { Tray, app, BrowserWindow, nativeImage, globalShortcut, screen, ipcMain, shell } from 'electron'
import path from 'path'
import { is } from '@electron-toolkit/utils'
import { pollFeeds } from './polling'
import { restoreMainWindow } from './index'
import * as db from './db'
import { formatTrayTooltip } from './tray-tooltip'
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

const TRAY_MENU_CARD_WIDTH = 268
const TRAY_MENU_FLYOUT_WIDTH = 268
const TRAY_MENU_FLYOUT_GAP = 4
const TRAY_MENU_FLYOUT_SPAN = TRAY_MENU_FLYOUT_GAP + TRAY_MENU_FLYOUT_WIDTH
const TRAY_MENU_SHADOW_PAD = 12
const TRAY_MENU_WINDOW_WIDTH =
  TRAY_MENU_CARD_WIDTH + TRAY_MENU_FLYOUT_SPAN + 2 * TRAY_MENU_SHADOW_PAD

let trayWindow: BrowserWindow | null = null
let trayWindowLoaded = false
let trayMenuPrewarmTimer: NodeJS.Timeout | null = null
let currentTraySize = { width: TRAY_MENU_WINDOW_WIDTH, height: 440 }
let ipcRegistered = false
let trayMenuFlyoutSide: 'left' | 'right' = 'left'
let trayMenuVerticalAlign: 'bottom' | 'top' = 'bottom'

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

function buildTrayTooltip(busy: boolean): string {
  const lang = db.getSettings().language || 'en'
  const t = translations[lang] || translations.en
  if (busy) {
    const status = t?.mainProcess?.tray?.refreshingFeeds || 'Refreshing feeds...'
    return formatTrayTooltip(status)
  }
  const shortcuts = db.getSettings().shortcuts as KeyboardShortcuts
  const hotkey =
    shortcuts?.showHide?.enabled && shortcuts?.showHide?.global
      ? shortcuts.showHide.accelerator
      : null
  return formatTrayTooltip(hotkey)
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
    showSuitePromo: settings.showSuitePromo !== false,
    flyoutSide: trayMenuFlyoutSide,
    verticalAlign: trayMenuVerticalAlign
  }
}

let trayMenuLastShown = 0
let trayMenuHideTimer: NodeJS.Timeout | null = null
let trayMenuShowPending = false
let trayMenuShowFallback: NodeJS.Timeout | null = null
let trayMenuAnchor: any = null
let trayMenuPendingGeo: { x: number; y: number; width: number; height: number } | null = null

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
  _windowW: number,
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
  const shadowPad = TRAY_MENU_SHADOW_PAD
  const cardW = TRAY_MENU_CARD_WIDTH
  const windowW = TRAY_MENU_WINDOW_WIDTH
  const cardH = windowH - 2 * shadowPad

  let cardX: number, cardY: number
  let verticalAlign: 'bottom' | 'top' = 'bottom'
  const dLeft = cx - work.x
  const dRight = work.x + work.width - cx
  const dTop = cy - work.y
  const dBottom = work.y + work.height - cy

  if (dBottom <= dLeft && dBottom <= dRight && dBottom <= dTop) {
    cardX = cx - cardW / 2
    cardY = (b.height > 0 ? b.y - cardH : work.y + work.height - cardH) - gap
    verticalAlign = 'bottom'
  } else if (dTop <= dLeft && dTop <= dRight) {
    cardX = cx - cardW / 2
    cardY = (b.height > 0 ? b.y + b.height : work.y) + gap
    verticalAlign = 'top'
  } else if (dLeft <= dRight) {
    cardX = (b.width > 0 ? b.x + b.width : work.x) + gap
    cardY = cy - cardH / 2
    verticalAlign = 'bottom'
  } else {
    cardX = (b.width > 0 ? b.x - cardW : work.x + work.width - cardW) - gap
    cardY = cy - cardH / 2
    verticalAlign = 'bottom'
  }

  cardX = Math.min(Math.max(cardX, work.x + 4), work.x + work.width - cardW - 4)
  cardY = Math.min(Math.max(cardY, work.y + 4), work.y + work.height - cardH - 4)

  const spaceLeft = cardX - work.x
  const spaceRight = work.x + work.width - (cardX + cardW)
  const preferLeft = cx >= work.x + work.width / 2
  const flyoutSide: 'left' | 'right' = preferLeft
    ? spaceLeft >= TRAY_MENU_FLYOUT_SPAN || spaceLeft >= spaceRight
      ? 'left'
      : 'right'
    : spaceRight >= TRAY_MENU_FLYOUT_SPAN || spaceRight >= spaceLeft
      ? 'right'
      : 'left'

  const mainWindowX = cardX - shadowPad
  const rawWindowX =
    flyoutSide === 'left' ? mainWindowX - TRAY_MENU_FLYOUT_SPAN : mainWindowX
  const minWindowX = work.x - shadowPad
  const maxWindowX = Math.max(minWindowX, work.x + work.width + shadowPad - windowW)
  const windowX = Math.min(Math.max(rawWindowX, minWindowX), maxWindowX)
  const minWindowY = work.y - shadowPad
  const maxWindowY = Math.max(minWindowY, work.y + work.height + shadowPad - windowH)
  const windowY = Math.min(Math.max(cardY - shadowPad, minWindowY), maxWindowY)

  trayMenuFlyoutSide = flyoutSide
  trayMenuVerticalAlign = verticalAlign

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

  trayWindowLoaded = false
  const win = new BrowserWindow({
    width: currentTraySize.width,
    height: currentTraySize.height,
    show: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  trayWindow = win

  // The tray menu never navigates and never opens windows: a navigation or a
  // window.open is routed to the user's browser instead, and anything that
  // is not a web link is dropped. Its preload only bridges IPC, so the
  // window runs sandboxed like the main one.
  const openWebLink = (target: string): void => {
    try {
      const parsed = new URL(target)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        void shell.openExternal(parsed.toString())
      }
    } catch {
      /* ignore */
    }
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    openWebLink(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openWebLink(url)
  })

  win.setAlwaysOnTop(true, 'pop-up-menu')
  win.webContents.setBackgroundThrottling(false)

  // Log-only: ensureTrayWindow recreates the window if it was destroyed, so a
  // dead tray renderer self-heals on the next open. Main-window recovery lives
  // in createMainWindow (index.ts).
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return
    console.error('[Tray] Tray window renderer gone:', details.reason, 'exitCode', details.exitCode)
  })

  const load = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/tray/index.html`)
    : win.loadFile(path.join(__dirname, '../renderer/tray/index.html'))
  load.catch((error) => {
    console.error('[Tray] the tray menu failed to load:', error)
  })

  win.on('blur', () => {
    if (trayMenuHideTimer) return
    if (Date.now() - trayMenuLastShown < 250) return
    trayMenuHideTimer = setTimeout(() => {
      trayMenuHideTimer = null
      hideTrayMenu()
    }, 120)
  })

  win.on('closed', () => {
    if (trayWindow === win) {
      trayWindow = null
      trayWindowLoaded = false
    }
  })

  return win
}

function schedulePrewarmTrayWindow(): void {
  if (trayMenuPrewarmTimer) {
    clearTimeout(trayMenuPrewarmTimer)
    trayMenuPrewarmTimer = null
  }
  if ((app as any).isQuitting || !tray || tray.isDestroyed()) return
  trayMenuPrewarmTimer = setTimeout(() => {
    trayMenuPrewarmTimer = null
    if ((app as any).isQuitting || !tray || tray.isDestroyed() || trayWindow) return
    ensureTrayWindow()
  }, 80)
}

function boundsClose(a: Electron.Rectangle, b: Electron.Rectangle, tol = 2): boolean {
  return (
    Math.abs(a.x - b.x) <= tol &&
    Math.abs(a.y - b.y) <= tol &&
    Math.abs(a.width - b.width) <= tol &&
    Math.abs(a.height - b.height) <= tol
  )
}

function applyTrayBounds(win: BrowserWindow, geo: Electron.Rectangle): void {
  try {
    const before = win.getBounds()
    if (boundsClose(before, geo)) return
    win.setBounds(geo, false)
    const after = win.getBounds()
    if (!boundsClose(after, geo)) {
      win.setBounds(geo, false)
    }
  } catch {
    /* ignore */
  }
}

function revealTrayMenuWin(): void {
  if (!trayWindow || trayWindow.isDestroyed()) return
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  trayMenuShowPending = false
  if (trayMenuPendingGeo) {
    applyTrayBounds(trayWindow, trayMenuPendingGeo)
  }
  trayMenuLastShown = Date.now()
  if (!trayWindow.isVisible()) {
    trayWindow.show()
  }
  trayWindow.focus()
  try {
    trayWindow.webContents.send('tray:reveal')
  } catch {
    /* ignore */
  }
}

function showTrayMenu(eventBounds?: any): void {
  if (trayMenuHideTimer) {
    clearTimeout(trayMenuHideTimer)
    trayMenuHideTimer = null
  }
  if (trayMenuPrewarmTimer) {
    clearTimeout(trayMenuPrewarmTimer)
    trayMenuPrewarmTimer = null
  }
  if (trayMenuShowFallback) {
    clearTimeout(trayMenuShowFallback)
    trayMenuShowFallback = null
  }

  // Never reuse a previously shown/hidden BrowserWindow: Chromium on Windows
  // suspends Viz while hidden and evicts/retains stale DirectComposition frames
  // across hide->show, causing 2nd-click flicker and cross-monitor side jumps.
  if (trayWindow && !trayWindow.isDestroyed() && trayWindow.isVisible()) {
    const stale = trayWindow
    trayWindow = null
    trayWindowLoaded = false
    try { stale.destroy() } catch { /* ignore */ }
  }

  trayMenuAnchor = getInitialAnchor(eventBounds)
  const geo = calculateTrayMenuGeometry(trayMenuAnchor, currentTraySize.width, currentTraySize.height)
  const win = ensureTrayWindow()
  if (win.isDestroyed()) return

  applyTrayBounds(win, geo)
  trayMenuPendingGeo = { x: geo.x, y: geo.y, width: geo.width, height: geo.height }

  trayMenuShowPending = true
  trayMenuShowFallback = setTimeout(() => {
    trayMenuShowFallback = null
    if (trayMenuShowPending) revealTrayMenuWin()
  }, 450)

  if (trayWindowLoaded) {
    win.webContents.send('tray:show', getTrayMenuSnapshot())
  }
}

export function hideTrayMenu(): void {
  if (trayMenuHideTimer) {
    clearTimeout(trayMenuHideTimer)
    trayMenuHideTimer = null
  }
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  if (trayMenuPrewarmTimer) { clearTimeout(trayMenuPrewarmTimer); trayMenuPrewarmTimer = null }
  trayMenuShowPending = false
  trayMenuPendingGeo = null
  const win = trayWindow
  trayWindow = null
  trayWindowLoaded = false
  if (win && !win.isDestroyed()) {
    try {
      win.destroy()
    } catch {
      /* ignore */
    }
  }
  schedulePrewarmTrayWindow()
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

  ipcMain.handle('tray:getState', (event) => {
    const snap = getTrayMenuSnapshot()
    if (trayWindow && !trayWindow.isDestroyed() && event.sender === trayWindow.webContents) {
      trayWindowLoaded = true
      if (trayMenuShowPending) {
        const win = trayWindow
        setImmediate(() => {
          if (trayWindow === win && !win.isDestroyed() && trayMenuShowPending) {
            win.webContents.send('tray:show', getTrayMenuSnapshot())
          }
        })
      }
    }
    return snap
  })

  ipcMain.handle('tray:action', (_event, action: string) => {
    handleTrayAction(action)
  })

  ipcMain.handle('tray:hide', () => {
    hideTrayMenu()
  })

  ipcMain.handle('tray:reportSize', (event, size: { width: number; height: number; prepared?: boolean }) => {
    if (!size || typeof size.width !== 'number' || typeof size.height !== 'number') return
    const newWidth = TRAY_MENU_WINDOW_WIDTH
    const newHeight = Math.max(200, Math.min(800, Math.round(size.height)))

    const sizeChanged =
      Math.abs(newWidth - currentTraySize.width) >= 4 ||
      Math.abs(newHeight - currentTraySize.height) >= 4

    if (sizeChanged) {
      currentTraySize = { width: newWidth, height: newHeight }
    }

    if (!trayWindow || trayWindow.isDestroyed() || event.sender !== trayWindow.webContents) return

    if (trayMenuShowPending && size.prepared) {
      const geo = calculateTrayMenuGeometry(trayMenuAnchor, newWidth, newHeight)
      trayMenuPendingGeo = { x: geo.x, y: geo.y, width: geo.width, height: geo.height }
      revealTrayMenuWin()
    } else if (trayWindow.isVisible() && sizeChanged) {
      const geo = calculateTrayMenuGeometry(trayMenuAnchor, newWidth, newHeight)
      applyTrayBounds(trayWindow, geo)
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
  if (trayMenuHideTimer) { clearTimeout(trayMenuHideTimer); trayMenuHideTimer = null }
  if (trayMenuShowFallback) { clearTimeout(trayMenuShowFallback); trayMenuShowFallback = null }
  if (trayMenuPrewarmTimer) { clearTimeout(trayMenuPrewarmTimer); trayMenuPrewarmTimer = null }
  trayMenuShowPending = false
  trayMenuPendingGeo = null
  trayWindowLoaded = false
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
