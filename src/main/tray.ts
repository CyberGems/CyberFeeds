import { Tray, Menu, app, BrowserWindow, nativeImage, globalShortcut, screen, shell, net } from 'electron'
import fs from 'fs'
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

const trayMenuIconCache = new Map<string, Electron.NativeImage>()

// Raster PNGs are more reliable than SVG data URLs in Windows native menus.
// Sources are 64px, then reduced to the display's physical 16 logical pixels.
function getTrayMenuIcon(filename: string): Electron.NativeImage {
  let scale = screen.getPrimaryDisplay().scaleFactor
  try {
    if (tray && !tray.isDestroyed()) {
      const bounds = tray.getBounds()
      scale = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).scaleFactor
    }
  } catch {
    // Keep the primary display scale as a safe fallback.
  }
  const size = Math.max(16, Math.round(16 * scale))
  const cacheKey = `${filename}:${size}`
  const cached = trayMenuIconCache.get(cacheKey)
  if (cached) return cached

  const source = nativeImage.createFromPath(
    path.join(__dirname, '../../resources', 'menu-icons', filename)
  )
  const image = source.isEmpty()
    ? nativeImage.createEmpty()
    : source.resize({ width: size, height: size, quality: 'best' })
  trayMenuIconCache.set(cacheKey, image)
  return image
}

// Submenú "Más de CyberGems": lista canónica en resources/suite/suite.json
// (copia local generada con _Website/scripts/build-suite-json.mjs; sin red).
// Si el archivo falta, respaldo con las 4 hermanas principales.
type SuiteEntry = { slug: string; name: string; site: string }
interface SuiteJsonEntry {
  slug?: unknown
  name?: unknown
  site?: unknown
}
let suiteAppsCache: SuiteEntry[] | null = null
function loadSuiteApps(): SuiteEntry[] {
  if (suiteAppsCache) return suiteAppsCache
  const fallback: SuiteEntry[] = [
    { slug: 'cybernotes', name: 'CyberNotes', site: 'https://cybergems.org/apps/cybernotes/' },
    { slug: 'cyberpaste', name: 'CyberPaste', site: 'https://cybergems.org/apps/cyberpaste/' },
    { slug: 'cybersnap', name: 'CyberSnap', site: 'https://cybergems.org/apps/cybersnap/' },
    { slug: 'cyberviewer', name: 'CyberViewer', site: 'https://cybergems.org/apps/cyberviewer/' }
  ]
  try {
    const resourcesDir = path.join(__dirname, '../../resources')
    const raw = fs.readFileSync(path.join(resourcesDir, 'suite', 'suite.json'), 'utf8')
    const parsed = JSON.parse(raw) as { apps?: SuiteJsonEntry[] }
    if (Array.isArray(parsed?.apps) && parsed.apps.length > 0) {
      const list: SuiteEntry[] = parsed.apps
        .filter((a) => a && typeof a.slug === 'string' && typeof a.name === 'string')
        .map((a) => ({
          slug: a.slug as string,
          name: String(a.name),
          site: typeof a.site === 'string' && a.site ? a.site : `https://cybergems.org/apps/${a.slug}/`
        }))
      suiteAppsCache = list
      return list
    }
  } catch {
    /* respaldo */
  }
  suiteAppsCache = fallback
  return suiteAppsCache
}

const suiteIconCache = new Map<string, Electron.NativeImage>()
function loadSuiteIcon(slug: string): Electron.NativeImage | undefined {
  const cached = suiteIconCache.get(slug)
  if (cached) return cached.isEmpty() ? undefined : cached
  try {
    const resourcesDir = path.join(__dirname, '../../resources')
    const img = nativeImage.createFromPath(path.join(resourcesDir, 'suite', `${slug}.png`))
    if (!img.isEmpty()) {
      const resized = img.resize({ width: 16, height: 16, quality: 'best' })
      suiteIconCache.set(slug, resized)
      return resized
    }
  } catch {
    /* sin icono */
  }
  return undefined
}

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

function formatTrayArticleTitle(item: {
  title: string
  feedTitle?: string
  feedName?: string
  read?: number
}): string {
  const maxTitleLen = 46
  const maxFeedLen = 16
  const cleanTitle = (item.title || '').replace(/\s+/g, ' ').trim()
  const truncatedTitle =
    cleanTitle.length > maxTitleLen ? cleanTitle.slice(0, maxTitleLen) + '…' : cleanTitle

  const feedName = item.feedTitle || item.feedName
  let raw = truncatedTitle
  if (feedName) {
    const cleanFeed = feedName.replace(/\s+/g, ' ').trim()
    const truncatedFeed =
      cleanFeed.length > maxFeedLen ? cleanFeed.slice(0, maxFeedLen) + '…' : cleanFeed
    raw = `[${truncatedFeed}] ${truncatedTitle}`
  }
  if (item.read === 0) {
    raw = `• ${raw}`
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

  tray.on('right-click', () => {
    buildMenu()
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
  scheduleMenuRebuild()
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

  const recentArticles = db.getArticles({ limit: 15 })
  const unreadCount = db.getArticleCount({ unreadOnly: true })
  const unseenCount = db.getUnseenNotificationCount()
  const recentLabel =
    unreadCount > 0 ? `${t.recentArticles} (${unreadCount})` : t.recentArticles

  const resourcesDir = path.join(__dirname, '../../resources')
  const iconsDir = path.join(resourcesDir, 'menu-icons')
  const iconShowHide = getTrayMenuIcon('show-hide.png')
  const iconFetch = getTrayMenuIcon('refresh.png')
  const iconPause = getTrayMenuIcon('pause.png')
  const iconPlay = getTrayMenuIcon('play-green.png')
  const iconRecentArticles = getTrayMenuIcon('recent-articles.png')
  const iconNotifications = getTrayMenuIcon('notifications.png')
  const iconSettings = getTrayMenuIcon('settings.png')
  const iconHelp = getTrayMenuIcon('help.png')
  const iconFaq = getTrayMenuIcon('faq.png')
  const iconChangelog = getTrayMenuIcon('changelog.png')
  const iconHome = getTrayMenuIcon('homepage.png')
  const iconDonate = getTrayMenuIcon('donate.png')
  const iconAbout = getTrayMenuIcon('about.png')
  const iconUpdate = getTrayMenuIcon('update.png')
  const iconSuite = getTrayMenuIcon('suite.png')
  const iconQuit = getTrayMenuIcon('quit.png')

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
      icon: iconRecentArticles,
      submenu:
        recentArticles.length === 0
          ? [
              {
                label: t.noRecentArticles,
                enabled: false
              }
            ]
          : [
              ...recentArticles.map((article) => ({
                label: formatTrayArticleTitle({
                  title: article.title,
                  feedTitle: article.feedTitle,
                  read: article.read
                }),
                icon: getTrayIcon(article.feedIcon),
                click: () => {
                  const win = _mainWindow
                  if (!win || win.isDestroyed()) return
                  restoreMainWindow()
                  win.webContents.send('app:openArticle', {
                    feedId: article.feedId,
                    articleId: article.id
                  })
                }
              })),
              { type: 'separator' as const },
              {
                label: t.viewAllArticles,
                icon: iconRecentArticles,
                click: () => {
                  const win = _mainWindow
                  if (!win || win.isDestroyed()) return
                  restoreMainWindow()
                  win.webContents.send('app:openArticle', {
                    feedId: 'all',
                    articleId: ''
                  })
                }
              }
            ]
    },
    {
      label: unseenCount > 0 ? `${t.notifications} (${unseenCount})` : t.notifications,
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
    ...(settings.showSuitePromo !== false
      ? [
          {
            label: t.suite,
            icon: iconSuite,
            submenu: [
              ...loadSuiteApps().map((a) => ({
                label: a.name,
                icon: loadSuiteIcon(a.slug),
                click: () => {
                  void shell.openExternal(a.site)
                }
              })),
              { type: 'separator' as const },
              {
                label: t.viewAllApps,
                click: () => {
                  void shell.openExternal('https://cybergems.org/#apps')
                }
              }
            ]
          }
        ]
      : []),
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
