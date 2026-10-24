import { app, BrowserWindow, screen, ipcMain, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { is } from '@electron-toolkit/utils'
import {
  initDb,
  getSettings,
  saveSettings,
  getWindowState,
  saveWindowState,
  backfillFavicons,
  cleanupOldArticles
} from './db'
import { startPolling, setOnNewArticles, setOnAutoCleanup } from './polling'
import { registerIpc, setAutoStart, openInConfiguredBrowser } from './ipc'
import { initUpdater } from './updater'
import { initNotifier, registerNotifierIpc, showNotificationsBatch } from './notifications'
import { createTray, destroyTray, rebuildTrayMenu } from './tray'
import { clampWindowBounds, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from './window-bounds'
import { initAutoBackup } from './auto-backup'
import type { NotificationHistoryItem, WindowState } from './types'
import crypto from 'crypto'

// Keep development data isolated from the installed app's profile and database.
// When running in portable mode, isolate user data in a 'data' folder alongside the executable.
if (is.dev) {
  const devUserDataPath = path.join(app.getPath('appData'), 'CyberFeeds-dev')
  fs.mkdirSync(devUserDataPath, { recursive: true })
  app.setPath('userData', devUserDataPath)
} else if (process.env.PORTABLE_EXECUTABLE_DIR) {
  const portableUserDataPath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
  fs.mkdirSync(portableUserDataPath, { recursive: true })
  app.setPath('userData', portableUserDataPath)
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  // Someone tried to run a second instance, focus the existing window
  if (mainWindow) {
    restoreMainWindow()
  }
})

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

const THEME_BACKGROUND: Record<string, string> = {
  dark: '#0d1117',
  grayscale: '#18181b',
  light: '#f6f8fa'
}

function resolveStartupBounds(raw: WindowState): ReturnType<typeof clampWindowBounds> & {
  inflated: boolean
  maximized: boolean
} {
  const clamped = clampWindowBounds(raw, {
    displays: screen.getAllDisplays(),
    primary: screen.getPrimaryDisplay(),
    savedDisplayId: raw.displayId,
    savedDisplayBounds: raw.displayBounds
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
      savedDisplayId: liveDisplay?.id,
      savedDisplayBounds: liveDisplay?.bounds
    })

    saveWindowState({
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      maximized,
      displayId: liveDisplay?.id ?? clamped.displayId,
      displayBounds: liveDisplay
        ? {
            x: liveDisplay.bounds.x,
            y: liveDisplay.bounds.y,
            width: liveDisplay.bounds.width,
            height: liveDisplay.bounds.height
          }
        : null
    })
  } catch (err) {
    console.error('[Main] Failed to persist window state:', err)
  }
}

/** Restore the main window on the last-used monitor. */
export function restoreMainWindow(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) return

  // Move to saved display before showing/maximizing so Electron maximizes on
  // the correct monitor instead of whichever one it happens to be on now.
  try {
    const saved = getWindowState()
    const startup = resolveStartupBounds(saved)
    const displays = screen.getAllDisplays()
    const targetDisplay =
      displays.find((d) => d.id === startup.displayId) ||
      (saved.displayBounds &&
        displays.find(
          (d) =>
            d.bounds.x === saved.displayBounds!.x &&
            d.bounds.y === saved.displayBounds!.y &&
            d.bounds.width === saved.displayBounds!.width &&
            d.bounds.height === saved.displayBounds!.height
        )) ||
      screen.getPrimaryDisplay()
    const wa = targetDisplay.workArea || targetDisplay.bounds

    // If the window is currently on a different display, nudge it
    const cur = win.getBounds()
    const curDisplay =
      (typeof screen.getDisplayMatching === 'function' && screen.getDisplayMatching(cur)) ||
      screen.getDisplayNearestPoint({
        x: Math.round(cur.x + cur.width / 2),
        y: Math.round(cur.y + cur.height / 2)
      })
    if (curDisplay && targetDisplay && curDisplay.id !== targetDisplay.id) {
      win.setBounds({
        x: wa.x + 48,
        y: wa.y + 48,
        width: Math.min(startup.width, Math.max(MIN_WINDOW_WIDTH, wa.width - 96)),
        height: Math.min(startup.height, Math.max(MIN_WINDOW_HEIGHT, wa.height - 96))
      })
    }
  } catch {
    /* ignore — fall through to show on current monitor */
  }

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

  // Open external links in configured browser (including links clicked inside embedded iframes like YouTube)
  win.webContents.setWindowOpenHandler(({ url }) => {
    openInConfiguredBrowser(url)
    return { action: 'deny' }
  })

  // Close behavior (ask choice on first close, or minimize to tray)
  win.on('close', (e) => {
    // Always persist state so the last monitor is remembered
    persistMainWindowState(win)
    if (!(app as any).isQuitting) {
      const settings = getSettings()
      if (!settings.closeChoiceRemembered) {
        e.preventDefault()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('window:confirm-close')
        return
      }
      if (settings.minimizeToTray) {
        e.preventDefault()
        win.hide()
        return
      }
    }
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
        const saved = getWindowState()
        const raw = win.getBounds()
        const clamped = clampWindowBounds(raw, {
          displays: screen.getAllDisplays(),
          primary: screen.getPrimaryDisplay(),
          savedDisplayId: saved.displayId,
          savedDisplayBounds: saved.displayBounds
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

  // Ensure YouTube iframe embeds receive proper Referer and clean User-Agent headers.
  // In Electron (served via file:// or localhost), Chromium omits or strips the Referer header,
  // causing YouTube embeds to fail with Error 153 (Video Player Configuration Error).
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.youtube.com/*',
        '*://*.youtube-nocookie.com/*',
        '*://*.googlevideo.com/*'
      ]
    },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://cyberfeeds.app/'
      if (details.requestHeaders['User-Agent']) {
        details.requestHeaders['User-Agent'] = details.requestHeaders['User-Agent'].replace(/Electron\/[0-9.]+\s*/i, '')
      }
      callback({ cancel: false, requestHeaders: details.requestHeaders })
    }
  )

  registerIpc()
  registerNotifierIpc()
  initNotifier(settings.notifications)

  mainWindow = createMainWindow()
  createTray(mainWindow)

  // Wire new-article notifications
  setOnNewArticles((feedId, inserted, feedTitle, feedIcon, options, notifiable) => {
    const toNotify = notifiable ?? inserted
    const suppressForFeed = options?.suppressNotificationFeedIds?.includes(feedId) ?? false
    if (!options?.suppressNotifications && !suppressForFeed && toNotify.length > 0) {
      const items: NotificationHistoryItem[] = toNotify.map((article) => ({
        id: crypto.randomUUID(),
        title: article.title,
        body: article.snippet,
        link: article.link,
        feedName: feedTitle,
        icon: feedIcon,
        thumbnail: article.thumbnail,
        createdAt: typeof article.pubDate === 'number' && !isNaN(article.pubDate) && article.pubDate > 0 ? article.pubDate : Date.now(),
        // Receipt time: when we actually discovered/raised the notification.
        // Publication time can be far in the past for backfilled feeds.
        receivedAt: Date.now(),
        feedId: feedId,
        articleId: article.id
      }))
      showNotificationsBatch(items)
    }
    if (inserted.length > 0) {
      rebuildTrayMenu()
    }
    // Tell renderer to refresh article count
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('articles:updated', { feedId, count: inserted.length })
    }
  })

  // Wire auto-cleanup notifications from background polling
  setOnAutoCleanup((res) => {
    rebuildTrayMenu()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cleanup:completed', res)
    }
  })

  // Auto cleanup on startup
  if (settings.autoCleanup && settings.cleanupReadDays > 0) {
    const res = cleanupOldArticles(settings.cleanupReadDays, settings.cleanupScope || 'all')
    if (settings.cleanupShowBanner !== false && (res.deletedArticles > 0 || res.purgedTrash > 0)) {
      mainWindow.webContents.once('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cleanup:completed', res)
        }
      })
    }
  }

  // Start polling
  console.log(`[Main] Startup: Polling interval is ${settings.pollingInterval} minutes`)
  startPolling(settings.pollingInterval, true)

  // Auto-start
  setAutoStart(settings.autoStart, settings.startMinimized)

  // Auto-backup scheduler
  initAutoBackup()

  // Auto-update (electron-updater). No-op in dev / unpacked builds.
  initUpdater(settings)

  // Listen for displays added or metrics changed after startup (e.g. secondary monitor powers on after Windows boot)
  const recheckDisplay = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
      const saved = getWindowState()
      if (!saved.displayBounds) return
      const displays = screen.getAllDisplays()
      const matched = displays.find(
        (d) =>
          d.bounds.x === saved.displayBounds!.x &&
          d.bounds.y === saved.displayBounds!.y &&
          d.bounds.width === saved.displayBounds!.width &&
          d.bounds.height === saved.displayBounds!.height
      )
      if (matched) {
        const cur = mainWindow.getBounds()
        const curDisp =
          (typeof screen.getDisplayMatching === 'function' && screen.getDisplayMatching(cur)) ||
          screen.getDisplayNearestPoint({
            x: Math.round(cur.x + cur.width / 2),
            y: Math.round(cur.y + cur.height / 2)
          })
        if (curDisp && curDisp.id !== matched.id) {
          console.log(`[Main] Saved display ${matched.id} became available. Moving window.`)
          const wa = matched.workArea || matched.bounds
          const wasMax = mainWindow.isMaximized()
          if (wasMax) mainWindow.unmaximize()
          mainWindow.setBounds({
            x: wa.x + 48,
            y: wa.y + 48,
            width: Math.min(saved.width, Math.max(MIN_WINDOW_WIDTH, wa.width - 96)),
            height: Math.min(saved.height, Math.max(MIN_WINDOW_HEIGHT, wa.height - 96))
          })
          if (wasMax || saved.maximized) {
            mainWindow.maximize()
          }
          persistMainWindowState(mainWindow)
        }
      }
    } catch (err) {
      console.error('[Main] Error handling display recheck:', err)
    }
  }

  screen.on('display-added', recheckDisplay)
  screen.on('display-metrics-changed', recheckDisplay)
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  if (mainWindow && !mainWindow.isDestroyed()) {
    persistMainWindowState(mainWindow)
  }
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
ipcMain.on('window:hide', () => mainWindow?.hide())
ipcMain.handle('window:is-maximized', () => (mainWindow ? mainWindow.isMaximized() : false))
ipcMain.handle('window:close-choice', (_e, action: string, remember: boolean) => {
  if (action !== 'tray' && action !== 'quit') return false
  const settings = getSettings()
  let changed = false
  const nextSettings = { ...settings }

  if (remember) {
    nextSettings.closeChoiceRemembered = true
    nextSettings.minimizeToTray = action === 'tray'
    changed = true
  }

  if (changed) {
    saveSettings(nextSettings)
    mainWindow?.webContents.send('settings:changed', nextSettings)
  }

  if (action === 'tray') {
    mainWindow?.hide()
    return true
  }

  // action === 'quit'
  ;(app as any).isQuitting = true
  destroyTray()
  app.quit()
  return true
})
