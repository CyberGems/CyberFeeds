import { Tray, Menu, app, BrowserWindow, nativeImage, globalShortcut, screen, shell, net } from 'electron'
import path from 'path'
import { pollFeeds } from './polling'
import { restoreMainWindow } from './index'
import * as db from './db'
import { translations } from '../shared/translations'
import type { KeyboardShortcuts } from '../shared/types'

let tray: Tray | null = null
let _mainWindow: BrowserWindow | null = null
let registeredGlobalShortcuts: string[] = []

const activeActivities = new Set<'polling' | 'batch'>()
let animTimer: NodeJS.Timeout | null = null
let currentFrame = 1

let currentScaleFactor = 0
let cachedIdleImage: Electron.NativeImage | null = null
const cachedFrames: Electron.NativeImage[] = []

const trayFaviconCache = new Map<string, Electron.NativeImage>()
let menuRebuildTimer: NodeJS.Timeout | null = null

function scheduleMenuRebuild(): void {
  if (menuRebuildTimer) clearTimeout(menuRebuildTimer)
  menuRebuildTimer = setTimeout(() => {
    menuRebuildTimer = null
    buildMenu()
  }, 150)
}

function getTrayIcon(iconUrl?: string): Electron.NativeImage | undefined {
  if (!iconUrl) return undefined
  if (trayFaviconCache.has(iconUrl)) {
    return trayFaviconCache.get(iconUrl)
  }

  if (iconUrl.startsWith('data:')) {
    try {
      const img = nativeImage.createFromDataURL(iconUrl)
      if (!img.isEmpty()) {
        const resized = img.resize({ width: 16, height: 16, quality: 'best' })
        trayFaviconCache.set(iconUrl, resized)
        return resized
      }
    } catch {
      // ignore
    }
    return undefined
  }

  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
    void fetchTrayFavicon(iconUrl)
  }
  return undefined
}

async function fetchTrayFavicon(url: string): Promise<void> {
  if (trayFaviconCache.has(url)) return
  try {
    const res = await net.fetch(url)
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      const img = nativeImage.createFromBuffer(buf)
      if (!img.isEmpty()) {
        const resized = img.resize({ width: 16, height: 16, quality: 'best' })
        trayFaviconCache.set(url, resized)
        scheduleMenuRebuild()
      }
    }
  } catch {
    // Ignore fetch failure
  }
}

function formatTrayNotificationTitle(item: { title: string; feedName?: string }): string {
  const maxTitleLen = 50
  const maxFeedLen = 18
  const cleanTitle = (item.title || '').replace(/\s+/g, ' ').trim()
  const truncatedTitle =
    cleanTitle.length > maxTitleLen ? cleanTitle.slice(0, maxTitleLen) + '…' : cleanTitle

  let raw = truncatedTitle
  if (item.feedName) {
    const cleanFeed = item.feedName.replace(/\s+/g, ' ').trim()
    const truncatedFeed =
      cleanFeed.length > maxFeedLen ? cleanFeed.slice(0, maxFeedLen) + '…' : cleanFeed
    raw = `[${truncatedFeed}] ${truncatedTitle}`
  }
  // Escape ampersands so Windows doesn't interpret them as shortcut mnemonics
  return raw.replace(/&/g, '&&')
}

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
    const hiRes = nativeImage.createFromPath(path.join(resourcesDir, `tray-frame-${frameNumber}.png`))
    if (!hiRes.isEmpty()) {
      const resized = hiRes.resize({ width: px, height: px, quality: 'best' })
      cachedFrames[frameNumber] = resized
      return resized
    }
    const trayPng = nativeImage.createFromPath(path.join(resourcesDir, `tray-frame-${frameNumber}-32.png`))
    if (!trayPng.isEmpty()) {
      const resized = trayPng.getSize().width === px ? trayPng : trayPng.resize({ width: px, height: px, quality: 'best' })
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
    cachedIdleImage = width === px ? trayPng : trayPng.resize({ width: px, height: px, quality: 'best' })
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
    const loadingText = translations[lang]?.mainProcess?.tray?.loadingFeeds || 'Loading feeds...'
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
          // Feeds predominantly receive incoming data (~65% inward), with occasional outgoing queries (~35% outward)
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

export function createTray(mainWindow: BrowserWindow): Tray {
  tray = new Tray(loadTrayFrame())
  _mainWindow = mainWindow

  buildMenu()
  registerGlobalShortcuts()

  updateTrayTooltip(false)

  tray.on('click', () => {
    const win = _mainWindow
    if (!win || win.isDestroyed()) return
    if (win.isVisible()) {
      win.hide()
    } else {
      restoreMainWindow()
    }
  })

  tray.on('double-click', () => {
    restoreMainWindow()
  })

  // Rebuild menu automatically when window is shown or hidden to update label
  mainWindow.on('show', () => {
    buildMenu()
  })
  mainWindow.on('hide', () => {
    buildMenu()
  })

  return tray
}

export function rebuildTrayMenu(): void {
  buildMenu()
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
      if (win.isVisible()) {
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
  // Unregister anything we believe we registered during this runtime.
  for (const accelerator of registeredGlobalShortcuts) {
    globalShortcut.unregister(accelerator)
  }

  // Extra safety: also try to unregister the current DB shortcuts.
  // This prevents stale registrations surviving across hot-reloads/resets.
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


function buildMenu(): void {
  if (!tray || tray.isDestroyed()) return
  const version = app.getVersion()
  const settings = db.getSettings()
  const lang = settings.language || 'en'
  const t = translations[lang].mainProcess.tray
  const shortcuts = settings.shortcuts as KeyboardShortcuts

  const recentItems = db.getRecentNotifications(15)
  const unseenCount = db.getUnseenNotificationCount()
  const recentLabel =
    unseenCount > 0 ? `${t.recentNotifications} (${unseenCount})` : t.recentNotifications

  const resourcesDir = path.join(__dirname, '../../resources')
  const iconsDir = path.join(resourcesDir, 'menu-icons')
  const iconShowHide = nativeImage.createFromPath(path.join(iconsDir, 'show-hide.png'))
  const iconNotifications = nativeImage.createFromPath(path.join(iconsDir, 'notifications.png'))
  const iconSettings = nativeImage.createFromPath(path.join(iconsDir, 'settings.png'))
  const refreshIcon = nativeImage.createFromPath(path.join(iconsDir, 'refresh.png'))
  const iconFetch = refreshIcon.isEmpty()
    ? nativeImage.createFromPath(path.join(iconsDir, 'fetch.png'))
    : refreshIcon
  const neutralPause = nativeImage.createFromPath(path.join(iconsDir, 'pause.png'))
  const iconPause = neutralPause.isEmpty()
    ? nativeImage.createFromPath(path.join(iconsDir, 'pause-blue.png'))
    : neutralPause
  const iconPlay = nativeImage.createFromPath(path.join(iconsDir, 'play-green.png'))
  const iconQuit = nativeImage.createFromPath(path.join(iconsDir, 'quit.png'))

  const iconHelp = nativeImage.createFromPath(path.join(iconsDir, 'help.png'))
  const iconFaq = nativeImage.createFromPath(path.join(iconsDir, 'faq.png'))
  const iconChangelog = nativeImage.createFromPath(path.join(iconsDir, 'changelog.png'))
  const iconHome = nativeImage.createFromPath(path.join(iconsDir, 'homepage.png'))
  const iconDonate = nativeImage.createFromPath(path.join(iconsDir, 'donate.png'))
  const iconAbout = nativeImage.createFromPath(path.join(iconsDir, 'about.png'))
  const iconUpdate = nativeImage.createFromPath(path.join(iconsDir, 'update.png'))

  const brandIcon = nativeImage.createFromPath(path.join(iconsDir, 'brand.png'))
  const iconBrand = brandIcon.isEmpty()
    ? nativeImage.createFromPath(path.join(resourcesDir, 'tray.png')).resize({ width: 16, height: 16, quality: 'best' })
    : brandIcon

  const isVisible = _mainWindow && !_mainWindow.isDestroyed() && _mainWindow.isVisible()
  const parts = t.showHide.split(' / ')
  const dynamicLabel = isVisible
    ? (parts[1] || 'Hide')
    : (parts[0] || 'Show')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `CyberFeeds v${version}`,
      icon: iconBrand,
      click: () => {
        const win = _mainWindow
        if (!win || win.isDestroyed()) return
        restoreMainWindow()
        win.webContents.send('app:openAbout', { checkUpdates: false })
      }
    },
    { type: 'separator' },
    {
      label: dynamicLabel,
      icon: iconShowHide,
      accelerator: shortcuts.showHide.enabled ? shortcuts.showHide.accelerator : undefined,
      click: () => {
        const win = _mainWindow
        if (!win || win.isDestroyed()) return
        if (win.isVisible()) {
          win.hide()
        } else {
          restoreMainWindow()
        }
      }
    },
    {
      label: t.updateFeeds,
      icon: iconFetch,
      accelerator: shortcuts.fetch.enabled ? shortcuts.fetch.accelerator : undefined,
      click: () => { pollFeeds() }
    },
    {
      label: settings.pollingEnabled ? t.pauseFeeds : t.resumeFeeds,
      icon: settings.pollingEnabled ? iconPause : iconPlay,
      click: () => {
        const current = db.getSettings()
        const pollingEnabled = !current.pollingEnabled
        db.saveSettings({ ...current, pollingEnabled })
        buildMenu()
        if (_mainWindow && !_mainWindow.isDestroyed()) {
          _mainWindow.webContents.send('settings:pollingToggled', pollingEnabled)
        }
      }
    },
    {
      label: recentLabel,
      icon: iconNotifications,
      submenu:
        recentItems.length === 0
          ? [
              {
                label: t.noRecentNotifications,
                enabled: false
              }
            ]
          : [
              ...recentItems.map((item) => ({
                label: formatTrayNotificationTitle(item),
                icon: getTrayIcon(item.icon),
                click: () => {
                  const win = _mainWindow
                  if (!win || win.isDestroyed()) return
                  restoreMainWindow()
                  if (item.feedId && item.articleId) {
                    win.webContents.send('app:openArticle', {
                      feedId: item.feedId,
                      articleId: item.articleId
                    })
                  } else if (item.link) {
                    shell.openExternal(item.link)
                  }
                }
              })),
              { type: 'separator' as const },
              {
                label: t.viewAllNotifications,
                icon: iconNotifications,
                click: () => {
                  const win = _mainWindow
                  if (!win || win.isDestroyed()) return
                  restoreMainWindow()
                  win.webContents.send('app:openHistory')
                }
              }
            ]
    },
    {
      label: t.notifications,
      icon: iconNotifications,
      accelerator: shortcuts.notifications.enabled ? shortcuts.notifications.accelerator : undefined,
      click: () => {
        const win = _mainWindow
        if (!win || win.isDestroyed()) return
        restoreMainWindow()
        win.webContents.send('app:openHistory')
      }
    },
    {
      label: t.settings,
      icon: iconSettings,
      accelerator: shortcuts.settings.enabled ? shortcuts.settings.accelerator : undefined,
      click: () => {
        const win = _mainWindow
        if (!win || win.isDestroyed()) return
        restoreMainWindow()
        win.webContents.send('app:openSettings')
      }
    },
    {
      label: t.help,
      icon: iconHelp,
      submenu: [
        {
          label: t.help,
          icon: iconHelp,
          click: () => { void shell.openExternal('https://github.com/CyberGems/CyberFeeds/wiki') }
        },
        {
          label: t.faq,
          icon: iconFaq,
          click: () => { void shell.openExternal('https://github.com/CyberGems/CyberFeeds/wiki/FAQ') }
        },
        {
          label: t.changelog,
          icon: iconChangelog,
          click: () => { void shell.openExternal('https://github.com/CyberGems/CyberFeeds/releases') }
        },
        {
          label: t.homepage,
          icon: iconHome,
          click: () => { void shell.openExternal('https://cybergems.org') }
        },
        {
          label: t.donate,
          icon: iconDonate,
          click: () => { void shell.openExternal('https://github.com/CyberGems/CyberFeeds#%EF%B8%8F-donate') }
        },
        { type: 'separator' },
        {
          label: t.about,
          icon: iconAbout,
          click: () => {
            const win = _mainWindow
            if (!win || win.isDestroyed()) return
            restoreMainWindow()
            win.webContents.send('app:openAbout', { checkUpdates: false })
          }
        },
        {
          label: t.checkUpdates,
          icon: iconUpdate,
          click: () => {
            const win = _mainWindow
            if (!win || win.isDestroyed()) return
            restoreMainWindow()
            win.webContents.send('app:openAbout', { checkUpdates: true })
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: t.quit,
      icon: iconQuit,
      click: () => { app.quit() }
    }
  ])
  try {
    tray.setContextMenu(contextMenu)
  } catch {
    /* ignore if destroyed */
  }
}

export function destroyTray(): void {
  if (animTimer) {
    clearInterval(animTimer)
    animTimer = null
  }
  if (menuRebuildTimer) {
    clearTimeout(menuRebuildTimer)
    menuRebuildTimer = null
  }
  unregisterGlobalShortcuts()
  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy()
    } catch {
      /* ignore if destroyed */
    }
  }
  tray = null
}
