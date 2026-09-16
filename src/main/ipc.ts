import { ipcMain, shell, dialog, screen, Menu, MenuItemConstructorOptions, BrowserWindow, clipboard, nativeImage, net, Session, WebContents } from 'electron'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { Worker } from 'worker_threads'
import { app } from 'electron'
import * as db from './db'
import * as polling from './polling'
import { importOpml, exportOpml } from './opml'
import { updateNotifierSettings, pruneFeedFilter } from './notifications'
import { setAutoUpdate } from './updater'
import { rebuildTrayMenu, rebuildGlobalShortcuts } from './tray'
import { translations } from '../shared/translations'
import { DEFAULT_SETTINGS } from '../shared/types'
import { normalizeFeedUrl } from '../shared/reddit'
import { isYouTubeUrl, resolveYouTubeFeedUrl } from '../shared/youtube'
import { robustParse } from './feed-parse'
import type { Feed, Folder } from './types'

/**
 * Official icons for CyberGems suite release feeds.
 *
 * When a user adds a suite release feed (e.g. CyberFeeds releases.atom),
 * the generic Google S2 favicon for github.com would be misleading, so we
 * serve the app official icon instead as an inline data URL (no network,
 * works offline, identical in dev and in the packaged installer).
 *
 * To cover more suite apps later, extend SUITE_RELEASE_ICON_FILES with
 * lowercase "owner/repo" keys pointing at each app icon file.
 */

const SUITE_RELEASE_ICON_FILES: Record<string, string> = {
  'cybergems/cyberfeeds': 'icon.png'
}

let cachedSuiteIcons: Record<string, string> | null = null

function loadSuiteReleaseIcons(): Record<string, string> {
  if (cachedSuiteIcons) return cachedSuiteIcons
  const loaded: Record<string, string> = {}
  // resources dir sits next to the project root both in dev (out/main/..)
  // and in the packaged app (app.asar.unpacked/resources or Resources).
  const candidates = [
    path.join(app.getAppPath(), 'resources'),
    path.join(process.resourcesPath, 'resources'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'resources')
  ]
  for (const [key, file] of Object.entries(SUITE_RELEASE_ICON_FILES)) {
    for (const dir of candidates) {
      try {
        const buf = fs.readFileSync(path.join(dir, file))
        loaded[key] = `data:image/png;base64,${buf.toString('base64')}`
        break
      } catch { /* try next candidate */ }
    }
  }
  cachedSuiteIcons = loaded
  return loaded
}

/**
 * Returns the official suite icon for a release feed URL, if it belongs
 * to a known CyberGems repo (github.com/owner/repo/releases.atom).
 */
function getSuiteReleaseIcon(feedUrl: string): string | undefined {
  let parsed: URL
  try {
    const trimmed = feedUrl.trim()
    parsed = new URL(trimmed.toLowerCase().startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return undefined
  }
  if (!/^(www\.)?github\.com$/i.test(parsed.hostname)) return undefined
  const m = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/releases\.atom\/?$/i)
  if (!m) return undefined
  return loadSuiteReleaseIcons()[`${m[1].toLowerCase()}/${m[2].toLowerCase()}`]
}

/**
 * Sync the Windows login item with the current settings. When the app is set
 * to both start with Windows and start minimized, the login item is registered
 * with a `--hidden` arg so the startup launch can be told apart from a manual
 * one (which should always show the window).
 */
export function setAutoStart(autoStart: boolean, startMinimized: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: autoStart,
      args: autoStart && startMinimized ? ['--hidden'] : []
    })
  } catch { /* ignore */ }
}

function uuid(): string { return crypto.randomUUID() }

// Content extractor worker (persistent, reused across requests)
let extractorWorker: Worker | null = null
let pendingExtractions = new Map<string, (result: { html?: string; error?: string }) => void>()

function getExtractorWorker(): Worker {
  if (extractorWorker) return extractorWorker

  const workerPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'out', 'main', 'content-extractor.worker.js')
    : path.join(app.getAppPath(), 'out', 'main', 'content-extractor.worker.js')

  extractorWorker = new Worker(workerPath)
  extractorWorker.on('message', (result: { reqId: string; html?: string; error?: string }) => {
    const resolve = pendingExtractions.get(result.reqId)
    if (resolve) {
      pendingExtractions.delete(result.reqId)
      resolve(result)
    }
  })
  extractorWorker.on('error', () => { extractorWorker = null })
  extractorWorker.on('exit', () => { extractorWorker = null })
  return extractorWorker
}

function extractContent(url: string): Promise<{ html?: string; error?: string }> {
  return new Promise(resolve => {
    const reqId = uuid()
    pendingExtractions.set(reqId, resolve)
    getExtractorWorker().postMessage({ reqId, url })
    // Timeout safety
    setTimeout(() => {
      if (pendingExtractions.has(reqId)) {
        pendingExtractions.delete(reqId)
        resolve({ error: 'Timeout' })
      }
    }, 15000)
  })
}

export function registerIpc(): void {
  // ─── Feeds ───────────────────────────────────────────────────────────────

  ipcMain.handle('feeds:getAll', () => db.getFeeds())

  ipcMain.handle('feeds:add', async (_, url: string, folderId: string, customTitle?: string) => {
    try {
      let feedUrl = normalizeFeedUrl(url)
      let channelPageUrl: string | undefined

      if (isYouTubeUrl(feedUrl)) {
        if (!feedUrl.includes('youtube.com/feeds/videos.xml')) {
          channelPageUrl = feedUrl.startsWith('http') ? feedUrl : `https://${feedUrl}`
        }
        const ytFeed = await resolveYouTubeFeedUrl(feedUrl)
        if (ytFeed) feedUrl = ytFeed
      }

      // Check for duplicate (including alternate Reddit and YouTube URL forms)
      const existing = db.getFeeds().find(f => normalizeFeedUrl(f.url) === feedUrl || f.url === feedUrl)
      if (existing) return { error: 'Feed already exists' }

      // Parse to get title (using robust fallback)
      const parsed = await robustParse(feedUrl)
      const title = customTitle || parsed.title || feedUrl

      // Favicon from Google API
      let icon: string | undefined
      const suiteIcon = getSuiteReleaseIcon(feedUrl)
      if (suiteIcon) {
        icon = suiteIcon
      } else try {
        const feedLink = parsed.link || channelPageUrl || feedUrl
        const domain = new URL(feedLink).hostname
        icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      } catch { /* no icon */ }

      const feed: Feed = {
        id: uuid(),
        title,
        url: feedUrl,
        link: parsed.link || channelPageUrl,
        folderId,
        icon,
        errorCount: 0
      }
      db.addFeed(feed)

      // Immediately fetch articles for new feed
      polling.pollFeeds([feed])

      return { feed }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('feeds:preview', async (_, url: string) => {
    try {
      let previewUrl = normalizeFeedUrl(url)
      let channelPageUrl: string | undefined
      if (isYouTubeUrl(previewUrl)) {
        if (!previewUrl.includes('youtube.com/feeds/videos.xml')) {
          channelPageUrl = previewUrl.startsWith('http') ? previewUrl : `https://${previewUrl}`
        }
        const ytFeed = await resolveYouTubeFeedUrl(previewUrl)
        if (ytFeed) previewUrl = ytFeed
      }
      const parsed = await robustParse(previewUrl)
      let icon: string | undefined
      const suitePreviewIcon = getSuiteReleaseIcon(previewUrl)
      if (suitePreviewIcon) {
        icon = suitePreviewIcon
      } else try {
        const feedLink = parsed.link || channelPageUrl || previewUrl
        const domain = new URL(feedLink).hostname
        icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      } catch { /* no icon */ }

      return {
        title: parsed.title,
        description: parsed.description,
        link: parsed.link,
        icon,
        items: (parsed.items || []).slice(0, 5).map(i => ({ title: i.title, pubDate: i.pubDate, link: i.link }))
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('feeds:update', (_, id: string, changes: Partial<Feed>) => {
    db.updateFeed({ id, ...changes })
    rebuildTrayMenu()
    return db.getFeedById(id)
  })

  ipcMain.handle('feeds:delete', (_, id: string) => {
    db.deleteFeed(id)
    pruneFeedFilter(id)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('feeds:deleteAll', () => {
    // Stop an in-flight sync before removing its feed rows. Any already queued
    // poll is allowed to settle harmlessly against an empty feed list.
    polling.cancelActivePoll()
    const deleted = db.deleteAllFeeds()
    const current = db.getSettings()
    if ((current.notifications.feedFilters ?? []).length > 0) {
      const notifications = { ...current.notifications, feedFilters: [] }
      db.saveSettings({ ...current, notifications })
      updateNotifierSettings(notifications)
    }
    rebuildTrayMenu()
    return { ok: true, deleted }
  })

  ipcMain.handle('feeds:fetchOne', async (_, id: string) => {
    const feed = db.getFeedById(id)
    if (!feed) return { error: 'Feed not found' }
    await polling.pollFeedsAndWait([feed])
    return { ok: true }
  })

  ipcMain.handle('feeds:fetchAll', async () => {
    await polling.pollFeedsAndWait()
    return { ok: true }
  })

  ipcMain.handle('feeds:fetchFolder', async (_, folderId: string) => {
    const feeds = db.getFeeds().filter(f => f.folderId === folderId)
    if (feeds.length > 0) {
      await polling.pollFeedsAndWait(feeds)
    }
    return { ok: true }
  })

  ipcMain.handle('feeds:togglePause', (_, id: string) => {
    const feed = db.getFeedById(id)
    if (feed) {
      const disabled = !feed.disabled
      db.updateFeed({ id, disabled })
      return { ok: true, disabled }
    }
    return { error: 'Feed not found' }
  })

  ipcMain.handle('feeds:togglePauseFolder', (_, folderId: string) => {
    const feeds = db.getFeeds().filter(f => f.folderId === folderId)
    if (feeds.length === 0) return { ok: true }
    
    // Toggle based on the first feed's state
    const targetState = !feeds[0].disabled
    for (const f of feeds) {
      db.updateFeed({ id: f.id, disabled: targetState })
    }
    return { ok: true, disabled: targetState }
  })

  // ─── Folders ─────────────────────────────────────────────────────────────

  ipcMain.handle('folders:getAll', () => db.getFolders())

  ipcMain.handle('folders:add', (_, name: string) => {
    const folders = db.getFolders()
    const folder: Folder = { id: uuid(), name, sortOrder: folders.length }
    db.addFolder(folder)
    return folder
  })

  ipcMain.handle('settings:togglePolling', (event) => {
    const settings = db.getSettings()
    const pollingEnabled = !settings.pollingEnabled
    db.saveSettings({ ...settings, pollingEnabled })
    if (!pollingEnabled) {
      polling.cancelActivePoll()
    }
    rebuildTrayMenu()
    // Notify all renderer windows (the sender already refreshes, but this
    // keeps the same event-driven pattern the tray toggle uses).
    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    if (win && !win.isDestroyed()) {
      win.webContents.send('settings:pollingToggled', pollingEnabled)
    }
    return { ok: true, pollingEnabled }
  })

  ipcMain.handle('folders:update', (_, id: string, name: string) => {
    db.updateFolder(id, name)
    return { ok: true }
  })

  ipcMain.handle('folders:delete', (_, id: string) => {
    db.deleteFolder(id)
    return { ok: true }
  })

  ipcMain.handle('folders:reorder', (_, ids: string[]) => {
    db.reorderFolders(ids)
    return { ok: true }
  })

  // ─── Articles ─────────────────────────────────────────────────────────────

  ipcMain.handle('articles:get', (_, query) => {
    return db.getArticles(query)
  })

  ipcMain.handle('articles:getCount', (_, query) => {
    return db.getArticleCount(query)
  })

  ipcMain.handle('articles:getTrashCount', () => {
    return db.getTrashCount()
  })

  ipcMain.handle('articles:getUnreadCounts', () => {
    return db.getUnreadCountByFeed()
  })

  ipcMain.handle('articles:getToday', () => {
    return db.getTodayArticles()
  })

  ipcMain.handle('articles:markRead', (_, id: string, read: boolean) => {
    db.markArticleRead(id, read)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:markAllRead', (_, feedId?: string) => {
    db.markAllRead(feedId)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:markAllFilteredRead', (_, starredOnly?: boolean) => {
    db.markAllFilteredRead(Boolean(starredOnly))
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:deleteAllActive', (_, starredOnly?: boolean) => {
    db.deleteAllActiveArticles(Boolean(starredOnly))
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:deleteAllFiltered', (_, query?: db.ArticleQuery) => {
    db.deleteAllFilteredArticles(query || {})
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:unstarAll', () => {
    db.unstarAllArticles()
    return { ok: true }
  })

  ipcMain.handle('articles:star', (_, id: string, starred: boolean) => {
    db.starArticle(id, starred)
    return { ok: true }
  })

  ipcMain.handle('articles:delete', (_, id: string) => {
    db.deleteArticle(id)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:deleteMultiple', (_, ids: string[]) => {
    db.deleteArticles(ids)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:restore', (_, id: string) => {
    db.restoreArticle(id)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:restoreMultiple', (_, ids: string[]) => {
    db.restoreArticles(ids)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:restoreAllTrash', () => {
    db.restoreAllTrash()
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:purge', (_, id: string) => {
    db.purgeArticle(id)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:purgeMultiple', (_, ids: string[]) => {
    db.purgeArticles(ids)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:emptyTrash', () => {
    db.emptyTrash()
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('articles:fetchContent', async (_, articleId: string) => {
    const article = db.getArticleById(articleId)
    if (!article) return { error: 'Article not found' }
    const result = await extractContent(article.link)
    return result
  })

  ipcMain.handle('articles:getById', (_, id: string) => {
    return db.getArticleById(id)
  })

  // ─── Settings ─────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', () => db.getSettings())

  ipcMain.handle('settings:save', (_, settings) => {
    const current = db.getSettings()

    // Normalize payload to avoid structured-clone issues and ensure full shape.
    // This prevents Electron IPC conversion failures on complex objects.
    const normalized = { ...DEFAULT_SETTINGS, ...settings }
    db.saveSettings(normalized)

    updateNotifierSettings(settings.notifications)
    if (settings.pollingInterval !== current.pollingInterval) {
      polling.restartPolling(settings.pollingInterval)
    }

    // Auto-start
    setAutoStart(settings.autoStart, settings.startMinimized)

    // Auto-update toggle
    setAutoUpdate(settings.autoUpdate)

    // Rebuild tray menu and global shortcuts
    rebuildTrayMenu()
    if (settings.shortcuts !== current.shortcuts) {
      rebuildGlobalShortcuts()
    }

    return { ok: true }
  })

  // ─── Notification History ─────────────────────────────────────────────────

  ipcMain.handle('notifications:getHistory', (_e, limit?: number) => db.getNotificationHistory(limit))
  ipcMain.handle('notifications:getTotalCount', () => db.getNotificationHistoryTotalCount())

  ipcMain.handle('notifications:clearHistory', () => {
    db.clearNotificationHistory()
    rebuildTrayMenu()
    return { ok: true }
  })

  // Renderer tells main the history was just opened/seen, so the notifier badge
  // can compute the same unseen count as the main-window badge.
  ipcMain.handle('notifications:markChecked', (_e, ts?: number) => {
    db.setNotificationsLastChecked(typeof ts === 'number' ? ts : Date.now())
    rebuildTrayMenu()
    return { ok: true }
  })

  // ─── OPML ─────────────────────────────────────────────────────────────────

  ipcMain.handle('opml:import', async (event) => {
    const win = event.sender ? require('electron').BrowserWindow.fromWebContents(event.sender) : null
    const result = await dialog.showOpenDialog(win || undefined, {
      filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const imported = importOpml(result.filePaths[0])
    const existingUrls = new Set(db.getFeeds().map(feed => normalizeFeedUrl(feed.url)))
    const folders = db.getFolders()
    const foldersByName = new Map(folders.map(folder => [folder.name, folder]))
    const newFeeds: Feed[] = []

    for (const item of imported.feeds) {
      const feedUrl = normalizeFeedUrl(item.url)
      if (existingUrls.has(feedUrl)) continue

      // Find or create each imported folder once, instead of querying SQLite
      // for every outline in the OPML document.
      let folderId = ''
      if (item.folderName) {
        const existingFolder = foldersByName.get(item.folderName)
        if (existingFolder) {
          folderId = existingFolder.id
        } else {
          const newFolder: Folder = {
            id: uuid(),
            name: item.folderName,
            sortOrder: foldersByName.size
          }
          db.addFolder(newFolder)
          foldersByName.set(item.folderName, newFolder)
          folderId = newFolder.id
        }
      }

      try {
        let icon: string | undefined
        try {
          const domain = new URL(item.link || feedUrl).hostname
          icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } catch { /* no icon */ }

        newFeeds.push({
          id: uuid(),
          title: item.title,
          url: feedUrl,
          link: item.link,
          folderId,
          icon,
          errorCount: 0
        })
        existingUrls.add(feedUrl)
      } catch { /* skip malformed entry */ }
    }

    db.addFeeds(newFeeds)
    rebuildTrayMenu()

    // Initial OPML sync is deliberately silent and throttled. Imported feeds
    // often contain a historical backlog that should not become hundreds of
    // desktop notifications or parallel image downloads.
    if (newFeeds.length > 0) {
      void polling.pollFeeds(newFeeds, undefined, { suppressNotifications: true, concurrency: 2 })
        .catch(error => console.error('[OPML] Initial sync failed:', error))
    }

    return { added: newFeeds.length, total: imported.feeds.length }
  })

  ipcMain.handle('opml:export', async (event) => {
    const win = event.sender ? require('electron').BrowserWindow.fromWebContents(event.sender) : null
    const result = await dialog.showSaveDialog(win || undefined, {
      defaultPath: 'cybersfeeds-export.opml',
      filters: [{ name: 'OPML', extensions: ['opml'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }

    const feeds = db.getFeeds()
    const folders = db.getFolders()
    const xml = exportOpml(feeds, folders)
    fs.writeFileSync(result.filePath, xml, 'utf-8')
    return { ok: true, path: result.filePath }
  })

  // ─── Shell ────────────────────────────────────────────────────────────────

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    let targetUrl = url
    if (typeof targetUrl === 'string' && targetUrl.includes('old.reddit.com/')) {
      targetUrl = targetUrl.replace('https://old.reddit.com/', 'https://www.reddit.com/')
                           .replace('http://old.reddit.com/', 'https://www.reddit.com/')
    }
    const settings = db.getSettings()
    if (settings.customBrowserPath) {
      const { execFile } = require('child_process')
      return new Promise<void>((resolve) => {
        execFile(settings.customBrowserPath, [targetUrl], () => resolve())
      })
    }
    return shell.openExternal(targetUrl)
  })

  ipcMain.handle('app:pickBrowser', async () => {
    const win = BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win || undefined, {
      title: 'Select browser executable',
      filters: [
        { name: 'Executables', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  // ─── Displays ─────────────────────────────────────────────────────────────

  ipcMain.handle('displays:getAll', () => {
    const primaryId = screen.getPrimaryDisplay().id
    const all = screen.getAllDisplays()

    // Sort: primary first, rest in original order
    const sorted = [
      ...all.filter(d => d.id === primaryId),
      ...all.filter(d => d.id !== primaryId)
    ]

    return sorted.map((d, i) => ({
      id: d.id,
      index: i + 1,
      isPrimary: d.id === primaryId,
      label: `Display ${i + 1} — ${d.bounds.width}×${d.bounds.height}${d.id === primaryId ? ' (Primary)' : ''}`,
      bounds: d.bounds,
      workArea: d.workArea
    }))
  })

  // ─── App ──────────────────────────────────────────────────────────────────

  ipcMain.handle('app:getVersions', () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osType: os.type(),
    isPortable: Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
  }))

  ipcMain.handle('app:openDataFolder', () => {
    shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('app:scanFeeds', async () => {
    const feeds = db.getFeeds()
    const results: Array<{ id: string; title: string; status: 'ok' | 'error'; error?: string }> = []
    
    for (const feed of feeds) {
      try {
        await robustParse(feed.url)
        results.push({ id: feed.id, title: feed.title, status: 'ok' })
      } catch (err) {
        results.push({ id: feed.id, title: feed.title, status: 'error', error: String(err) })
      }
    }
    return results
  })

  ipcMain.handle('app:cleanup', (_, days: number) => {
    db.cleanupOldArticles(days)
    db.purgeOldTrash(db.TRASH_RETENTION_DAYS)
    rebuildTrayMenu()
    return { ok: true }
  })

  ipcMain.handle('app:exportBackup', async (event) => {
    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Global Backup',
      defaultPath: 'cybersfeeds-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    const data = db.getBackupData()
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
    return { ok: true }
  })

  ipcMain.handle('app:importBackup', async (event) => {
    const win = event.sender ? BrowserWindow.fromWebContents(event.sender) : null
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import Global Backup',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(content)
      db.restoreBackupData(data)
      return { ok: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ─── Sound File Picker ───────────────────────────────────────────────────
  ipcMain.handle('notifications:pickSoundFile', async () => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Notification Sound',
      filters: [
        { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ─── Clipboard: copy image to clipboard ─────────────────────────────────

  // Network fallback: Chromium session fetch (same HTTP cache as <img> tags).
  async function fetchImageToClipboard(
    imageUrl: string,
    ses?: Session
  ): Promise<{ ok: boolean; error?: string }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const init = {
        signal: controller.signal,
        cache: 'force-cache' as RequestCache,
        redirect: 'follow' as RequestRedirect
      }
      const res = ses ? await ses.fetch(imageUrl, init) : await net.fetch(imageUrl, init as any)
      if (!res.ok) return { ok: false, error: `http-${res.status}` }
      const buf = Buffer.from(await res.arrayBuffer())
      const image = nativeImage.createFromBuffer(buf)
      if (image.isEmpty()) return { ok: false, error: 'empty-image' }
      clipboard.writeImage(image)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    } finally {
      clearTimeout(timeout)
    }
  }

  // Fast path: Chromium copyImageAt copies the original decoded image at a
  // viewport point (same as Chrome's "Copy Image") — no re-download.
  function copyImageAtPoint(wc: WebContents, x: number, y: number): { ok: boolean; error?: string } {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: 'bad-point' }
    wc.copyImageAt(Math.round(x), Math.round(y))
    return { ok: true }
  }

  // Prefer a loaded <img> in `scopeSelector`, else session-cached fetch.
  async function copyImageFromPage(
    wc: WebContents,
    imageUrl: string,
    scopeSelector?: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const point = await wc.executeJavaScript(
        `(() => {
          const url = ${JSON.stringify(imageUrl)};
          const root = ${scopeSelector ? `document.querySelector(${JSON.stringify(scopeSelector)}) || document` : 'document'};
          const imgs = root.querySelectorAll('img');
          for (const img of imgs) {
            if (img.src !== url && img.currentSrc !== url) continue;
            if (!img.complete || img.naturalWidth === 0) continue;
            const r = img.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          }
          return null;
        })()`
      )
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        return copyImageAtPoint(wc, point.x, point.y)
      }
    } catch (err) {
      console.error('[CopyImage] DOM lookup failed:', err)
    }
    return fetchImageToClipboard(imageUrl, wc.session)
  }

  ipcMain.handle('clipboard:copyImage', async (event, imageUrl?: string | null) => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return { ok: false, error: 'no-image' }
    }
    return fetchImageToClipboard(imageUrl, event.sender.session)
  })

  ipcMain.handle('clipboard:copyImageAt', (event, x: number, y: number) => {
    return copyImageAtPoint(event.sender, x, y)
  })

  // Accept raw image bytes from the renderer (already fetched via browser cache)
  ipcMain.handle('clipboard:writeImageBuffer', async (_, buffer: ArrayBuffer) => {
    try {
      const buf = Buffer.from(buffer)
      const image = nativeImage.createFromBuffer(buf)
      if (image.isEmpty()) return { ok: false, error: 'empty-image' }
      clipboard.writeImage(image)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  function openInConfiguredBrowser(url: string): void {
    const settings = db.getSettings()
    if (settings.customBrowserPath) {
      const { execFile } = require('child_process')
      execFile(settings.customBrowserPath, [url], (err) => {
        if (err) console.error('Failed to open custom browser:', err)
      })
    } else {
      shell.openExternal(url)
    }
  }

  // ─── Native Context Menu ─────────────────────────────────────────────────
  ipcMain.handle('showInputContextMenu', () => {
    const lang = db.getSettings().language || 'en'
    const t = translations[lang].mainProcess.webviewCtx
    const template: MenuItemConstructorOptions[] = [
      { role: 'cut', label: t.cut },
      { role: 'copy', label: t.copy },
      { role: 'paste', label: t.paste },
      { role: 'delete', label: t.delete },
      { type: 'separator' },
      { role: 'selectAll', label: t.selectAll }
    ]
    const menu = Menu.buildFromTemplate(template)
    menu.popup()
  })

  ipcMain.handle('showReadOnlyContextMenu', (event, linkUrl?: string, selectedText?: string, imageUrl?: string, titleText?: string) => {
    const lang = db.getSettings().language || 'en'
    const t = translations[lang].mainProcess.webviewCtx
    const wc = event.sender
    const template: MenuItemConstructorOptions[] = []
    const query = typeof selectedText === 'string' ? selectedText.trim() : ''
    const hasSelection = query.length > 0
    const title = typeof titleText === 'string' ? titleText.trim() : ''

    if (title) {
      template.push({
        label: t.copyTitle,
        click: () => {
          clipboard.writeText(title)
        }
      })
    }

    if (linkUrl) {
      if (template.length > 0) template.push({ type: 'separator' })
      template.push(
        {
          label: t.openLink,
          click: () => openInConfiguredBrowser(linkUrl)
        },
        {
          label: t.copyLinkAddress,
          click: () => {
            clipboard.writeText(linkUrl)
          }
        }
      )

      if (hasSelection) {
        template.push(
          { type: 'separator' },
          { role: 'copy', label: t.copy }
        )
      }
    } else if (hasSelection) {
      template.push({ role: 'copy', label: t.copy })
    }

    if (hasSelection) {
      template.push({
        label: t.searchGoogle,
        click: () => {
          const q = encodeURIComponent(query.slice(0, 500))
          openInConfiguredBrowser(`https://www.google.com/search?q=${q}`)
        }
      })
    }

    // "Copy image" option when right-clicking on an <img>
    if (imageUrl) {
      if (template.length > 0) template.push({ type: 'separator' })
      template.push({
        label: t.copyImage,
        click: () => {
          copyImageFromPage(wc, imageUrl, '.viewer-content').catch((err) =>
            console.error('[CopyImage] Failed:', err)
          )
        }
      })
    }

    if (template.length > 0) {
      template.push({ type: 'separator' })
    }

    template.push(
      { role: 'selectAll', label: t.selectAll }
    )
    const menu = Menu.buildFromTemplate(template)
    menu.popup()
  })

  // ─── Keyboard Shortcuts ─────────────────────────────────────────────────────

  ipcMain.handle('shortcuts:update', (_, shortcuts) => {
    const settings = db.getSettings()
    db.saveSettings({ ...settings, shortcuts })
    rebuildTrayMenu()
    rebuildGlobalShortcuts()
    return { ok: true }
  })

  ipcMain.handle('shortcuts:reset', () => {
    // Always read latest settings from DB; do not rely on cached defaults.
    const settings = db.getSettings()


    // Explicit reset payload to guarantee expected defaults even if the
    // main-process build has stale DEFAULT_SETTINGS cached.
    const RESET_SHORTCUTS = {
      showHide: { enabled: true, accelerator: 'Alt+Shift+S', global: true },
      notifications: { enabled: false, accelerator: '', global: false },
      settings: { enabled: false, accelerator: '', global: false },
      fetch: { enabled: false, accelerator: '', global: false }
    }

    // Overwrite shortcuts deterministically (avoid depending on current DB value shape/merge).
    // Also spreads DEFAULT_SETTINGS to guarantee we keep the rest of the app settings intact.
    db.saveSettings({
      ...DEFAULT_SETTINGS,
      ...settings,
      shortcuts: RESET_SHORTCUTS
    })

    rebuildTrayMenu()
    rebuildGlobalShortcuts()
    return { ok: true, shortcuts: RESET_SHORTCUTS }
  })

  // ─── Text Translation ───────────────────────────────────────────────────────

  ipcMain.handle('text:translate', async (_, text: string, targetLang = 'es') => {
    if (!text || typeof text !== 'string') return null
    const trimmed = text.trim()
    if (!trimmed) return null

    const tl = targetLang.toLowerCase().startsWith('en') ? 'en' : 'es'

    // 1. Google Translate client endpoint (dict-chrome-ex)
    try {
      const googleUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(trimmed)}`
      const resp = await fetch(googleUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
      })
      if (resp.ok) {
        const data = await resp.json()
        if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'string') {
          const translated = data
            .map((item) => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
            .join('')
          const src = String(data[0][1] || 'auto').toLowerCase()
          if (src === tl) {
            const alternateTl = tl === 'es' ? 'en' : 'es'
            const altUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(alternateTl)}&q=${encodeURIComponent(trimmed)}`
            const altResp = await fetch(altUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            })
            if (altResp.ok) {
              const altData = await altResp.json()
              if (Array.isArray(altData) && Array.isArray(altData[0]) && typeof altData[0][0] === 'string') {
                const altTranslated = altData
                  .map((item) => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
                  .join('')
                return {
                  translation: altTranslated,
                  sourceLang: src,
                  targetLang: alternateTl
                }
              }
            }
          }
          return {
            translation: translated,
            sourceLang: src,
            targetLang: tl
          }
        }
      }
    } catch (err) {
      console.warn('[Translate] Google translate client failed:', err)
    }

    // 2. Fallback to MyMemory translation API
    try {
      const fallbackSource = tl === 'es' ? 'en' : 'es'
      const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${fallbackSource}|${encodeURIComponent(tl)}`
      const resp = await fetch(myMemoryUrl)
      if (resp.ok) {
        const data = await resp.json()
        const status = Number(data?.responseStatus)
        if (status === 200 && data?.responseData?.translatedText) {
          return {
            translation: String(data.responseData.translatedText),
            sourceLang: fallbackSource,
            targetLang: tl
          }
        }
      }
    } catch (err) {
      console.warn('[Translate] MyMemory fallback failed:', err)
    }

    return null
  })

  // ─── System / User Info ───────────────────────────────────────────────────
  ipcMain.handle('system:getUserInfo', () => {
    try {
      const username = os.userInfo().username || process.env.USERNAME || process.env.USER || ''
      return { username }
    } catch {
      return { username: process.env.USERNAME || process.env.USER || '' }
    }
  })
}

