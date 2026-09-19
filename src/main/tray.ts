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

type TrayMenuIcon =
  | 'showHide'
  | 'refresh'
  | 'pause'
  | 'play'
  | 'recentArticles'
  | 'notifications'
  | 'settings'
  | 'help'
  | 'faq'
  | 'changelog'
  | 'homepage'
  | 'donate'
  | 'about'
  | 'update'
  | 'suite'
  | 'quit'

type TrayMenuIconTone = 'neutral' | 'danger'

const trayMenuIconCache = new Map<string, Electron.NativeImage>()

// Native Windows menus render these at a DPI-dependent physical size. Keeping
// the source vector-based gives every command the same rounded, 1.8px stroke.
const TRAY_MENU_ICON_PATHS: Record<TrayMenuIcon, string> = {
  showHide: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/>',
  refresh: '<path d="M20 8V4h-4"/><path d="M20 4a9 9 0 1 0 1.8 9.4"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  recentArticles: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16M8 13h8M8 16h5"/>',
  notifications: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.1-2.3 1.4-2.3 3"/><path d="M12 17h.01"/>',
  faq: '<path d="M5 5h14v11H9l-4 3z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 4.5 1.5c-.8.8-2 1-2 2.2M12 14.5h.01"/>',
  changelog: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h4M10 12h5M10 16h5"/>',
  homepage: '<path d="m3 11 9-7 9 7v9H3z"/><path d="M9 20v-5h6v5"/>',
  donate: '<path d="M20.8 8.1a5.1 5.1 0 0 0-8.8-3.5 5.1 5.1 0 0 0-8.8 3.5C3.2 14.5 12 20 12 20s8.8-5.5 8.8-11.9z"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  update: '<path d="M12 3v11M8 10l4 4 4-4M5 20h14"/>',
  suite: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  quit: '<path d="M12 3v9M7.1 5.6a8 8 0 1 0 9.8 0"/>'
}

function getTrayMenuIcon(name: TrayMenuIcon, tone: TrayMenuIconTone = 'neutral'): Electron.NativeImage {
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
  const cacheKey = `${name}:${tone}:${size}`
  const cached = trayMenuIconCache.get(cacheKey)
  if (cached) return cached

  const color = tone === 'danger' ? '#F07167' : '#B8C5D3'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TRAY_MENU_ICON_PATHS[name]}</svg>`
  const image = nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    .resize({ width: size, height: size, quality: 'best' })
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
  const iconShowHide = getTrayMenuIcon('showHide')
  const iconFetch = getTrayMenuIcon('refresh')
  const iconPause = getTrayMenuIcon('pause')
  const iconPlay = getTrayMenuIcon('play')
  const iconRecentArticles = getTrayMenuIcon('recentArticles')
  const iconNotifications = getTrayMenuIcon('notifications')
  const iconSettings = getTrayMenuIcon('settings')
  const iconHelp = getTrayMenuIcon('help')
  const iconFaq = getTrayMenuIcon('faq')
  const iconChangelog = getTrayMenuIcon('changelog')
  const iconHome = getTrayMenuIcon('homepage')
  const iconDonate = getTrayMenuIcon('donate')
  const iconAbout = getTrayMenuIcon('about')
  const iconUpdate = getTrayMenuIcon('update')
  const iconSuite = getTrayMenuIcon('suite')
  const iconQuit = getTrayMenuIcon('quit', 'danger')

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
