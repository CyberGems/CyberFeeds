import { app, BrowserWindow, shell, screen, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'
import {
  initDb,
  getSettings,
  getWindowState,
  saveWindowState,
  backfillFavicons,
  cleanupOldArticles
} from './db'
import { startPolling, setOnNewArticles } from './polling'
import { registerIpc, setAutoStart } from './ipc'
import { initUpdater } from './updater'
import { initNotifier, registerNotifierIpc, showNotification } from './notifications'
import { createTray, destroyTray } from './tray'
import { clampWindowBounds, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from './window-bounds'
import type { NotificationHistoryItem, WindowState } from './types'
import crypto from 'crypto'

// Keep development data isolated from the installed app's profile and database.
if (is.dev) {
  const devUserDataPath = path.join(app.getPath('appData'), 'CyberFeeds-dev')
  fs.mkdirSync(devUserDataPath, { recursive: true })
  app.setPath('userData', devUserDataPath)
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  // Someone tried to run a second instance, focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

let mainWindow: BrowserWindow | null = null

const THEME_BACKGROUND: Record<string, string> = {
  dark: '#0d1117',
  grayscale: '#18181b',
  light: '#f6f8fa',
  dracula: '#282a36',
  nord: '#2e3440',
  monokai: '#272822'
}

function resolveStartupBounds(raw: WindowState): ReturnType<typeof clampWindowBounds> & {
  inflated: boolean
  maximized: boolean
} {
  const clamped = clampWindowBounds(raw, {
    displays: screen.getAllDisplays(),
    primary: screen.getPrimaryDisplay(),
    savedDisplayId: raw.displayId
  })
  const inflated = !!(
    Number.isFinite(raw.width) &&
    Number.isFinite(raw.height) &&
    (raw.width > clamped.width + 32 || raw.height > clamped.height + 32)
  )
  return {
    ...clamped,
    inflated,
    // Prefer maximized when previously maximized, first-run, or saved size was DPI-inflated
    maximized: raw.maximized === true || inflated
  }
}

function persistMainWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  try {
    if (!win.isVisible() || win.isMinimized()) return
    if (typeof win.isFullScreen === 'function' && win.isFullScreen()) return

    const maximized = win.isMaximized()
    // Live bounds identify the monitor even while maximized
    const live = win.getBounds()
    const liveDisplay =
      (typeof screen.getDisplayMatching === 'function' && screen.getDisplayMatching(live)) ||
      screen.getDisplayNearestPoint({
        x: Math.round(live.x + live.width / 2),
        y: Math.round(live.y + live.height / 2)
      })

    // getNormalBounds avoids DPI-inflated maximized metrics on Windows
    const raw = typeof win.getNormalBounds === 'function' ? win.getNormalBounds() : live
    const clamped = clampWindowBounds(raw, {
      displays: screen.getAllDisplays(),
      primary: screen.getPrimaryDisplay(),
      savedDisplayId: liveDisplay?.id
    })

    saveWindowState({
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      maximized,
      displayId: liveDisplay?.id ?? clamped.displayId
    })
  } catch (err) {
    console.error('[Main] Failed to persist window state:', err)
  }
}

/** Restore the main window preserving maximized state. */
export function restoreMainWindow(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) return

  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()

  win.maximize()
  win.focus()
}

function createMainWindow(): BrowserWindow {
  const saved = getWindowState()
  const startup = resolveStartupBounds(saved)
  const theme = getSettings().theme || 'dark'

  // Start hidden only when launched by Windows startup with "start minimized"
  // enabled. The login item is registered with a `--hidden` arg in that case
  // (see setAutoStart), so a manual launch never carries the flag and shows
  // the window normally.
  const startHidden = process.argv.includes('--hidden')

  const win = new BrowserWindow({
    width: startup.width,
    height: startup.height,
    x: startup.x,
    y: startup.y,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: THEME_BACKGROUND[theme] ?? THEME_BACKGROUND.dark,
    icon: path.join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  try {
    win.setBackgroundColor(THEME_BACKGROUND[theme] ?? THEME_BACKGROUND.dark)
  } catch {
    /* ignore */
  }

  // Debounce persistence — move/resize fire often and mixed-DPI getBounds is noisy
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  const schedulePersist = (): void => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      if (!win || win.isDestroyed()) return
      if (win.isMaximized()) return
      persistMainWindowState(win)
    }, 400)
  }

  // Reveal only after the renderer paints (CyberViewer pattern) to avoid white flash.
  let shown = false
  const revealWindow = (): void => {
    if (shown || win.isDestroyed()) return
    shown = true

    if (startHidden) {
      // Brief invisible show/hide initializes renderer context for tray startup
      try {
        win.setOpacity(0)
      } catch {
        /* ignore */
      }
      win.show()
      win.hide()
      try {
        win.setOpacity(1)
      } catch {
        /* ignore */
      }
      return
    }

    try {
      win.setOpacity(0)
    } catch {
      /* ignore */
    }

    // Place on the resolved startup display (keeps last-used monitor)
    try {
      win.setBounds({
        x: startup.x,
        y: startup.y,
        width: startup.width,
        height: startup.height
      })
    } catch {
      /* ignore */
    }

    win.show()

    if (startup.maximized) {
      try {
        // Nudge onto the target display before maximize if Electron placed us elsewhere
        const target = screen.getDisplayNearestPoint({
          x: startup.x + Math.floor(startup.width / 2),
          y: startup.y + Math.floor(startup.height / 2)
        })
        const cur = win.getBounds()
        const curDisp =
          (typeof screen.getDisplayMatching === 'function' && screen.getDisplayMatching(cur)) ||
          screen.getDisplayNearestPoint({
            x: Math.round(cur.x + cur.width / 2),
            y: Math.round(cur.y + cur.height / 2)
          })
        if (target && curDisp && target.id !== curDisp.id) {
          const wa = target.workArea || target.bounds
          win.setBounds({
            x: wa.x + 48,
            y: wa.y + 48,
            width: Math.min(startup.width, Math.max(MIN_WINDOW_WIDTH, wa.width - 96)),
            height: Math.min(startup.height, Math.max(MIN_WINDOW_HEIGHT, wa.height - 96))
          })
        }
        if (!win.isMaximized()) win.maximize()
      } catch {
        /* ignore */
      }
    }

    // Two ticks: let Chromium/DWM composite the dark frame before becoming visible
    setTimeout(() => {
      if (win.isDestroyed()) return
      try {
        win.setOpacity(1)
      } catch {
        /* ignore */
      }
    }, 32)
  }

  const onUiReady = (): void => {
    ipcMain.removeListener('ui-ready', onUiReady)
    revealWindow()
  }
  // Register before loadURL to avoid missing a fast ui-ready
  ipcMain.on('ui-ready', onUiReady)
  win.once('ready-to-show', () => {
    // Fallback if renderer never acks
    setTimeout(() => revealWindow(), 1500)
  })
  win.on('closed', () => {
    ipcMain.removeListener('ui-ready', onUiReady)
  })

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Minimize to tray on close (respect setting)
  win.on('close', (e) => {
    if (!(app as any).isQuitting && getSettings().minimizeToTray) {
      e.preventDefault()
      win.hide()
      return
    }
    persistMainWindowState(win)
  })

  win.on('move', schedulePersist)
  win.on('resize', schedulePersist)
  win.on('show', () => {
    if (!win.isDestroyed()) win.webContents.send('window:shown')
  })
  win.on('restore', () => {
    if (!win.isDestroyed()) win.webContents.send('window:shown')
  })
  win.on('hide', () => {
    if (!win.isDestroyed()) win.webContents.send('window:hidden')
  })
  win.on('minimize', () => {
    if (!win.isDestroyed()) win.webContents.send('window:hidden')
  })
  win.on('maximize', () => {
    persistMainWindowState(win)
    win.webContents.send('window:maximized-change', true)
  })
  win.on('unmaximize', () => {
    win.webContents.send('window:maximized-change', false)
    // Re-clamp after unmaximize — Windows/DPI often restores oversized bounds
    setTimeout(() => {
      if (!win || win.isDestroyed() || win.isMaximized()) return
      try {
        const raw = win.getBounds()
        const clamped = clampWindowBounds(raw, {
          displays: screen.getAllDisplays(),
          primary: screen.getPrimaryDisplay(),
          savedDisplayId: getWindowState().displayId
        })
        if (raw.width > clamped.width + 8 || raw.height > clamped.height + 8) {
          win.setBounds({
            x: clamped.x,
            y: clamped.y,
            width: clamped.width,
            height: clamped.height
          })
        }
      } catch {
        /* ignore */
      }
      persistMainWindowState(win)
    }, 50)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  if (!gotTheLock) return

  initDb()
  backfillFavicons() // Assign Google S2 favicon URLs to any feeds missing icons
  const settings = getSettings()

  registerIpc()
  registerNotifierIpc()
  initNotifier(settings.notifications)

  mainWindow = createMainWindow()
  createTray(mainWindow)

  // Wire new-article notifications
  setOnNewArticles((feedId, inserted, feedTitle, feedIcon) => {
    for (const article of inserted) {
      const item: NotificationHistoryItem = {
        id: crypto.randomUUID(),
        title: article.title,
        body: article.snippet,
        link: article.link,
        feedName: feedTitle,
        icon: feedIcon,
        thumbnail: article.thumbnail,
        createdAt: Date.now(),
        feedId: feedId,
        articleId: article.id
      }
      showNotification(item)
    }
    // Tell renderer to refresh article count
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('articles:updated', { feedId, count: inserted.length })
    }
  })

  // Auto cleanup on startup
  if (settings.autoCleanup && settings.cleanupReadDays > 0) {
    cleanupOldArticles(settings.cleanupReadDays)
  }

  // Start polling
  console.log(`[Main] Startup: Polling interval is ${settings.pollingInterval} minutes`)
  startPolling(settings.pollingInterval, true)

  // Auto-start
  setAutoStart(settings.autoStart, settings.startMinimized)

  // Auto-update (electron-updater). No-op in dev / unpacked builds.
  initUpdater(settings)
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  destroyTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.handle('window:is-maximized', () => (mainWindow ? mainWindow.isMaximized() : false))
