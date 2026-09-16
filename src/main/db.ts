import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type { Folder, Feed, Article, AppSettings, NotificationHistoryItem, WindowState } from './types'
import { DEFAULT_SETTINGS } from './types'

let db: Database.Database

export const TRASH_RETENTION_DAYS = 30

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'cybersfeeds.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -32000') // 32MB cache
  db.pragma('foreign_keys = ON')
  createSchema()
  migrate()
  purgeOldTrash(TRASH_RETENTION_DAYS)
}

function migrate(): void {
  try { db.exec('ALTER TABLE articles ADD COLUMN thumbnail TEXT') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE articles ADD COLUMN deletedAt INTEGER') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE notification_history ADD COLUMN thumbnail TEXT') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE feeds ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0') } catch { /* already exists */ }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_articles_deleted ON articles(deletedAt)') } catch { /* already exists */ }
  try {
    // Deduplicate any existing duplicate articles (keeping the earliest)
    db.exec(`
      DELETE FROM articles
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM articles
        GROUP BY feedId, CASE 
          WHEN link LIKE '%youtube.com/watch?v=%' THEN SUBSTR(link, INSTR(link, 'v=') + 2, 11)
          WHEN link LIKE '%youtu.be/%' THEN SUBSTR(link, INSTR(link, 'youtu.be/') + 9, 11)
          WHEN link != '' THEN link
          ELSE title
        END
      );
    `)
  } catch { /* ignore */ }
  try {
    // Deduplicate notification history
    db.exec(`
      DELETE FROM notification_history
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM notification_history
        GROUP BY feedName, link, title
      );
    `)
  } catch { /* ignore */ }
  try {
    const { DEFAULT_SETTINGS } = require('../shared/types')
    const shortcuts = JSON.stringify(DEFAULT_SETTINGS.shortcuts)
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('shortcuts', shortcuts)
  } catch { /* already exists */ }
  try {
    const mig = db.prepare('SELECT value FROM settings WHERE key = ?').get('mig_poll_unfocused_v2')
    if (!mig) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app') as { value: string } | undefined
      if (row) {
        const parsed = JSON.parse(row.value)
        parsed.pollOnlyWhenUnfocused = false
        db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(parsed), 'app')
      }
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('mig_poll_unfocused_v2', '1')
    }
  } catch { /* ignore */ }
}

function createSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      link TEXT,
      folderId TEXT NOT NULL DEFAULT '',
      icon TEXT,
      lastFetched INTEGER,
      errorCount INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      feedId TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      pubDate INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '',
      author TEXT,
      thumbnail TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER,
      guid TEXT NOT NULL,
      UNIQUE(guid),
      FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notification_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT NOT NULL,
      feedName TEXT NOT NULL,
      icon TEXT,
      thumbnail TEXT,
      articleId TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS window_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      x INTEGER,
      y INTEGER,
      width INTEGER NOT NULL DEFAULT 1280,
      height INTEGER NOT NULL DEFAULT 800,
      maximized INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feedId);
    CREATE INDEX IF NOT EXISTS idx_articles_date ON articles(pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_unread ON articles(read, pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_starred ON articles(starred, pubDate DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_guid ON articles(guid);

    INSERT OR IGNORE INTO window_state (id, width, height, maximized) VALUES (1, 1280, 800, 0);
  `)

  // Mixed-DPI restore: remember which monitor the window was on
  try { db.exec('ALTER TABLE window_state ADD COLUMN displayId INTEGER') } catch { /* already exists */ }

  // Seed default settings if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c
  if (count === 0) {
    const settingsStr = JSON.stringify(DEFAULT_SETTINGS)
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('app', settingsStr)
  }
}

// ─── Folders ───────────────────────────────────────────────────────────────

export function getFolders(): Folder[] {
  return db.prepare('SELECT * FROM folders ORDER BY sortOrder ASC').all() as Folder[]
}

export function addFolder(folder: Folder): void {
  db.prepare('INSERT INTO folders (id, name, sortOrder) VALUES (?, ?, ?)').run(
    folder.id, folder.name, folder.sortOrder
  )
}

export function updateFolder(id: string, name: string): void {
  db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
}

export function deleteFolder(id: string): void {
  db.transaction(() => {
    db.prepare("UPDATE feeds SET folderId = '' WHERE folderId = ?").run(id)
    db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  })()
}

export function reorderFolders(ids: string[]): void {
  const stmt = db.prepare('UPDATE folders SET sortOrder = ? WHERE id = ?')
  db.transaction(() => {
    ids.forEach((id, i) => stmt.run(i, id))
  })()
}

// ─── Feeds ─────────────────────────────────────────────────────────────────

export function getFeeds(): Feed[] {
  return db.prepare('SELECT * FROM feeds').all().map((f: any) => ({
    ...f,
    disabled: f.disabled === 1
  })) as Feed[]
}

export function addFeed(feed: Feed): void {
  db.prepare(`
    INSERT INTO feeds (id, title, url, link, folderId, icon, lastFetched, errorCount, disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(feed.id, feed.title, feed.url, feed.link ?? null, feed.folderId, feed.icon ?? null, feed.lastFetched ?? null, feed.errorCount, feed.disabled ? 1 : 0)
}

export function addFeeds(feeds: Feed[]): void {
  if (feeds.length === 0) return

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO feeds (id, title, url, link, folderId, icon, lastFetched, errorCount, disabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const feed of feeds) {
      stmt.run(
        feed.id,
        feed.title,
        feed.url,
        feed.link ?? null,
        feed.folderId,
        feed.icon ?? null,
        feed.lastFetched ?? null,
        feed.errorCount,
        feed.disabled ? 1 : 0
      )
    }
  })()
}

export function updateFeed(feed: Partial<Feed> & { id: string }): void {
  const sets: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(feed)) {
    if (key === 'id') continue
    sets.push(`${key} = ?`)
    values.push(key === 'disabled' ? (value ? 1 : 0) : (value ?? null))
  }

  if (sets.length === 0) return

  values.push(feed.id)
  db.prepare(`UPDATE feeds SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteFeed(id: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM articles WHERE feedId = ?').run(id)
    db.prepare('DELETE FROM feeds WHERE id = ?').run(id)
  })()
}

/** Delete every feed and its articles while keeping the user's folders intact. */
export function deleteAllFeeds(): number {
  const count = (db.prepare('SELECT COUNT(*) as c FROM feeds').get() as { c: number }).c
  db.transaction(() => {
    db.prepare('DELETE FROM articles').run()
    db.prepare('DELETE FROM feeds').run()
  })()
  return count
}

export function getFeedById(id: string): Feed | undefined {
  return db.prepare('SELECT * FROM feeds WHERE id = ?').get(id) as Feed | undefined
}

/**
 * For every feed with no icon, derive a Google S2 favicon URL from the feed's
 * link/url and persist it. Called once on startup — SQLite only, no HTTP.
 * The browser will resolve the actual favicon images lazily.
 */
export function backfillFavicons(): void {
  const feeds = db.prepare('SELECT id, url, link FROM feeds WHERE icon IS NULL OR icon = ?').all('') as Feed[]
  if (feeds.length === 0) return

  const stmt = db.prepare('UPDATE feeds SET icon = ? WHERE id = ?')
  const update = db.transaction(() => {
    for (const feed of feeds) {
      try {
        const base = feed.link || feed.url
        const domain = new URL(base).hostname
        const icon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        stmt.run(icon, feed.id)
      } catch { /* skip invalid URLs */ }
    }
  })
  update()
  console.log(`[DB] Backfilled favicons for ${feeds.length} feeds`)
}

// ─── Articles ──────────────────────────────────────────────────────────────

export interface ArticleQuery {
  feedId?: string
  unreadOnly?: boolean
  readOnly?: boolean
  starredOnly?: boolean
  trashOnly?: boolean
  search?: string
  limit?: number
  offset?: number
}

export function getArticles(query: ArticleQuery = {}): Article[] {
  const { feedId, unreadOnly, readOnly, starredOnly, trashOnly, search, limit = 100, offset = 0 } = query
  let sql = `
    SELECT a.*, f.title as feedTitle, f.icon as feedIcon
    FROM articles a
    LEFT JOIN feeds f ON a.feedId = f.id
    WHERE 1=1
  `
  const params: (string | number)[] = []

  sql += trashOnly ? ' AND a.deletedAt IS NOT NULL' : ' AND a.deletedAt IS NULL'
  if (feedId) { sql += ' AND a.feedId = ?'; params.push(feedId) }
  if (unreadOnly) { sql += ' AND a.read = 0' }
  if (readOnly) { sql += ' AND a.read = 1' }
  if (starredOnly) { sql += ' AND a.starred = 1' }
  if (search) {
    sql += ' AND (a.title LIKE ? OR a.snippet LIKE ? OR a.author LIKE ?)'
    const term = `%${search}%`
    params.push(term, term, term)
  }

  sql += ' ORDER BY a.pubDate DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  return db.prepare(sql).all(...params) as Article[]
}

export function getArticleCount(query: Omit<ArticleQuery, 'limit' | 'offset'> = {}): number {
  const { feedId, unreadOnly, readOnly, starredOnly, trashOnly, search } = query
  let sql = 'SELECT COUNT(*) as c FROM articles a WHERE 1=1'
  const params: (string | number)[] = []
  sql += trashOnly ? ' AND a.deletedAt IS NOT NULL' : ' AND a.deletedAt IS NULL'
  if (feedId) { sql += ' AND a.feedId = ?'; params.push(feedId) }
  if (unreadOnly) { sql += ' AND a.read = 0' }
  if (readOnly) { sql += ' AND a.read = 1' }
  if (starredOnly) { sql += ' AND a.starred = 1' }
  if (search) {
    sql += ' AND (a.title LIKE ? OR a.snippet LIKE ? OR a.author LIKE ?)'
    const term = `%${search}%`
    params.push(term, term, term)
  }
  return ((db.prepare(sql).get(...params) as { c: number }).c)
}

export interface FeedArticleCounts {
  unread: Record<string, number>
  total: Record<string, number>
  starred: number
  all: number
}

export function getUnreadCountByFeed(): FeedArticleCounts {
  const rows = db.prepare(`
    SELECT feedId,
           COUNT(*) as total,
           SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
    FROM articles
    WHERE deletedAt IS NULL
    GROUP BY feedId
  `).all() as { feedId: string; total: number; unread: number }[]

  const unread: Record<string, number> = {}
  const total: Record<string, number> = {}
  for (const row of rows) {
    unread[row.feedId] = row.unread
    total[row.feedId] = row.total
  }

  const starredRow = db.prepare('SELECT COUNT(*) as c FROM articles WHERE starred=1 AND deletedAt IS NULL').get() as { c: number }
  const allRow = db.prepare('SELECT COUNT(*) as c FROM articles WHERE deletedAt IS NULL').get() as { c: number }

  return {
    unread,
    total,
    starred: starredRow.c,
    all: allRow.c
  }
}

export function insertArticles(articles: Omit<Article, 'feedTitle' | 'feedIcon'>[]): Omit<Article, 'feedTitle' | 'feedIcon'>[] {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO articles (id, feedId, title, link, pubDate, content, snippet, author, thumbnail, read, starred, guid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `)
  const inserted: Omit<Article, 'feedTitle' | 'feedIcon'>[] = []
  db.transaction(() => {
    for (const a of articles) {
      try {
        const result = stmt.run(a.id, a.feedId, a.title, a.link, a.pubDate, a.content, a.snippet, a.author ?? null, a.thumbnail ?? null, a.guid)
        if (result.changes > 0) inserted.push(a)
      } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          console.warn(`[DB] Skipping article ${a.id}: feed ${a.feedId} no longer exists`)
        } else {
          throw err
        }
      }
    }
  })()
  return inserted
}

export function markArticleRead(id: string, read: boolean): void {
  db.prepare('UPDATE articles SET read = ? WHERE id = ? AND deletedAt IS NULL').run(read ? 1 : 0, id)
}

export function deleteArticle(id: string): void {
  db.prepare('UPDATE articles SET deletedAt = ? WHERE id = ? AND deletedAt IS NULL').run(Date.now(), id)
}

export function deleteArticles(ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  db.prepare(`UPDATE articles SET deletedAt = ? WHERE id IN (${placeholders}) AND deletedAt IS NULL`).run(Date.now(), ...ids)
}

export function restoreArticle(id: string): void {
  db.prepare('UPDATE articles SET deletedAt = NULL WHERE id = ? AND deletedAt IS NOT NULL').run(id)
}

export function restoreArticles(ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  db.prepare(`UPDATE articles SET deletedAt = NULL WHERE id IN (${placeholders}) AND deletedAt IS NOT NULL`).run(...ids)
}

export function restoreAllTrash(): void {
  db.prepare('UPDATE articles SET deletedAt = NULL WHERE deletedAt IS NOT NULL').run()
}

export function purgeArticle(id: string): void {
  db.prepare('DELETE FROM articles WHERE id = ? AND deletedAt IS NOT NULL').run(id)
}

export function purgeArticles(ids: string[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  db.prepare(`DELETE FROM articles WHERE id IN (${placeholders}) AND deletedAt IS NOT NULL`).run(...ids)
}

export function emptyTrash(): void {
  db.prepare('DELETE FROM articles WHERE deletedAt IS NOT NULL').run()
}

export function getTrashCount(): number {
  return (db.prepare('SELECT COUNT(*) as c FROM articles WHERE deletedAt IS NOT NULL').get() as { c: number }).c
}

export function markAllRead(feedId?: string): void {
  if (feedId) {
    db.prepare('UPDATE articles SET read = 1 WHERE feedId = ? AND deletedAt IS NULL').run(feedId)
  } else {
    db.prepare('UPDATE articles SET read = 1 WHERE deletedAt IS NULL').run()
  }
}

export function markAllFilteredRead(starredOnly = false): void {
  const sql = starredOnly
    ? 'UPDATE articles SET read = 1 WHERE deletedAt IS NULL AND starred = 1'
    : 'UPDATE articles SET read = 1 WHERE deletedAt IS NULL'
  db.prepare(sql).run()
}

export function deleteAllActiveArticles(starredOnly = false): void {
  const sql = starredOnly
    ? 'UPDATE articles SET deletedAt = ? WHERE deletedAt IS NULL AND starred = 1'
    : 'UPDATE articles SET deletedAt = ? WHERE deletedAt IS NULL'
  db.prepare(sql).run(Date.now())
}

export function deleteAllFilteredArticles(query: ArticleQuery = {}): void {
  const { feedId, unreadOnly, readOnly, starredOnly, trashOnly, search } = query
  let sql = 'UPDATE articles SET deletedAt = ? WHERE 1=1'
  const params: (string | number)[] = [Date.now()]

  sql += trashOnly ? ' AND deletedAt IS NOT NULL' : ' AND deletedAt IS NULL'
  if (feedId) {
    sql += ' AND feedId = ?'
    params.push(feedId)
  }
  if (unreadOnly) sql += ' AND read = 0'
  if (readOnly) sql += ' AND read = 1'
  if (starredOnly) sql += ' AND starred = 1'
  if (search) {
    sql += ' AND (title LIKE ? OR snippet LIKE ? OR author LIKE ?)'
    const term = `%${search}%`
    params.push(term, term, term)
  }

  db.prepare(sql).run(...params)
}

export function unstarAllArticles(): void {
  db.prepare('UPDATE articles SET starred = 0 WHERE deletedAt IS NULL AND starred = 1').run()
}

export function starArticle(id: string, starred: boolean): void {
  db.prepare('UPDATE articles SET starred = ? WHERE id = ? AND deletedAt IS NULL').run(starred ? 1 : 0, id)
}

export function getArticleById(id: string): Article | undefined {
  return db.prepare(`
    SELECT a.*, f.title as feedTitle, f.icon as feedIcon
    FROM articles a LEFT JOIN feeds f ON a.feedId = f.id
    WHERE a.id = ?
  `).get(id) as Article | undefined
}

export function cleanupOldArticles(days: number): void {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  db.prepare('DELETE FROM articles WHERE deletedAt IS NULL AND read = 1 AND starred = 0 AND pubDate < ?').run(cutoff)
}

export function purgeOldTrash(days: number): void {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  db.prepare('DELETE FROM articles WHERE deletedAt IS NOT NULL AND deletedAt < ?').run(cutoff)
}

export function getTodayArticles(): Article[] {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return db.prepare(`
    SELECT a.*, f.title as feedTitle, f.icon as feedIcon
    FROM articles a LEFT JOIN feeds f ON a.feedId = f.id
    WHERE a.deletedAt IS NULL AND a.pubDate >= ?
    ORDER BY a.pubDate DESC
  `).all(startOfDay.getTime()) as Article[]
}

// ─── Notification History ──────────────────────────────────────────────────

export function getNotificationHistory(limit?: number): NotificationHistoryItem[] {
  const effectiveLimit =
    typeof limit === 'number' ? limit : (getSettings().notifications?.historyLimit ?? 1000)
  if (effectiveLimit === 0) {
    return db.prepare('SELECT * FROM notification_history ORDER BY createdAt DESC').all() as NotificationHistoryItem[]
  }
  return db.prepare('SELECT * FROM notification_history ORDER BY createdAt DESC LIMIT ?').all(effectiveLimit) as NotificationHistoryItem[]
}

export function getNotificationHistoryTotalCount(): number {
  const row = db.prepare('SELECT COUNT(*) as c FROM notification_history').get() as { c: number }
  return row ? row.c : 0
}

export function getRecentNotifications(limit = 15): (NotificationHistoryItem & { feedId?: string })[] {
  return db.prepare(`
    SELECT nh.*, COALESCE(a.feedId, '') as feedId, COALESCE(nh.icon, f.icon, '') as icon
    FROM notification_history nh
    LEFT JOIN articles a ON nh.articleId = a.id
    LEFT JOIN feeds f ON a.feedId = f.id
    ORDER BY nh.createdAt DESC
    LIMIT ?
  `).all(limit) as (NotificationHistoryItem & { feedId?: string })[]
}

export function pruneNotificationHistory(limit: number): void {
  if (limit <= 0) return
  const totalRow = db.prepare('SELECT COUNT(*) as c FROM notification_history').get() as { c: number }
  const total = totalRow ? totalRow.c : 0
  if (total > limit) {
    const excess = total - limit
    const lastChecked = getNotificationsLastChecked()
    // First try deleting oldest seen notifications so unseen ones stay intact
    const deletedSeen = db.prepare(`
      DELETE FROM notification_history
      WHERE id IN (
        SELECT id FROM notification_history
        WHERE createdAt <= ?
        ORDER BY createdAt ASC
        LIMIT ?
      )
    `).run(lastChecked, excess).changes

    const remainingExcess = excess - deletedSeen
    if (remainingExcess > 0) {
      // If there were not enough seen notifications, prune oldest overall to respect the hard limit
      db.prepare(`
        DELETE FROM notification_history WHERE id NOT IN (
          SELECT id FROM notification_history ORDER BY createdAt DESC LIMIT ?
        )
      `).run(limit)
    }
  }
}

export function addNotificationHistory(item: NotificationHistoryItem): void {
  addNotificationHistoryBatch([item])
}

export function addNotificationHistoryBatch(items: NotificationHistoryItem[]): void {
  if (items.length === 0) return
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO notification_history (id, title, body, link, feedName, icon, thumbnail, articleId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const item of items) {
      stmt.run(
        item.id,
        item.title,
        item.body,
        item.link,
        item.feedName,
        item.icon ?? null,
        item.thumbnail ?? null,
        item.articleId ?? null,
        item.createdAt
      )
    }
  })()
  const limit = getSettings().notifications?.historyLimit ?? 1000
  if (limit > 0) {
    pruneNotificationHistory(limit)
  }
}

export function clearNotificationHistory(): void {
  db.prepare('DELETE FROM notification_history').run()
}

/** Timestamp the user last opened the notification history (mirrors the main-window badge). */
export function getNotificationsLastChecked(): number {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('notificationsLastChecked') as { value: string } | undefined
  return row ? Number(row.value) || 0 : 0
}

export function setNotificationsLastChecked(ts: number): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('notificationsLastChecked', String(ts))
}

/** Count of notifications newer than the last "checked" time, same number as the top-bar badge. */
export function getUnseenNotificationCount(): number {
  const lastChecked = getNotificationsLastChecked()
  const row = db.prepare('SELECT COUNT(*) as c FROM notification_history WHERE createdAt > ?').get(lastChecked) as { c: number }
  return row ? row.c : 0
}

// ─── Settings ──────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('app') as { value: string } | undefined
  if (!row) return DEFAULT_SETTINGS
  try {
    const parsed = JSON.parse(row.value) as Partial<AppSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...parsed.shortcuts }
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app', JSON.stringify(settings))
  if (typeof settings.notifications?.historyLimit === 'number' && settings.notifications.historyLimit > 0) {
    pruneNotificationHistory(settings.notifications.historyLimit)
  }
}

// ─── Window State ──────────────────────────────────────────────────────────

export function getWindowState(): WindowState {
  const row = db.prepare('SELECT * FROM window_state WHERE id = 1').get() as any
  if (!row) return { width: 1280, height: 800, maximized: true }
  return {
    x: row.x ?? undefined,
    y: row.y ?? undefined,
    width: row.width,
    height: row.height,
    maximized: row.maximized === 1,
    displayId: row.displayId ?? null
  }
}

export function saveWindowState(state: WindowState): void {
  db.prepare(`
    UPDATE window_state SET x=?, y=?, width=?, height=?, maximized=?, displayId=? WHERE id=1
  `).run(
    state.x ?? null,
    state.y ?? null,
    state.width,
    state.height,
    state.maximized ? 1 : 0,
    state.displayId ?? null
  )
}

export function getDb(): Database.Database {
  return db
}

// ─── Backup & Restore ──────────────────────────────────────────────────────

export function getBackupData(): any {
  return {
    version: 2,
    settings: getSettings(),
    folders: getFolders(),
    feeds: getFeeds(),
    starredArticles: db.prepare('SELECT * FROM articles WHERE starred = 1 AND deletedAt IS NULL').all()
  }
}

export function restoreBackupData(data: any): void {
  db.transaction(() => {
    // Clear current data
    db.prepare('DELETE FROM feeds').run()
    db.prepare('DELETE FROM folders').run()
    db.prepare('DELETE FROM articles').run()

    // Restore folders
    if (Array.isArray(data.folders)) {
      for (const f of data.folders) {
        db.prepare('INSERT INTO folders (id, name, sortOrder) VALUES (?, ?, ?)').run(f.id, f.name, f.sortOrder)
      }
    }

    // Restore feeds
    if (Array.isArray(data.feeds)) {
      for (const f of data.feeds) {
        db.prepare(`
          INSERT INTO feeds (id, title, url, link, folderId, icon, lastFetched, errorCount, disabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(f.id, f.title, f.url, f.link, f.folderId, f.icon, f.lastFetched, f.errorCount, f.disabled ? 1 : 0)
      }
    }

    // Restore starred articles
    if (Array.isArray(data.starredArticles)) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO articles (id, feedId, title, link, pubDate, content, snippet, author, thumbnail, read, starred, guid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const a of data.starredArticles) {
        stmt.run(a.id, a.feedId, a.title, a.link, a.pubDate, a.content, a.snippet, a.author, a.thumbnail, a.read, a.starred, a.guid)
      }
    }

    // Restore settings
    if (data.settings) {
      saveSettings(data.settings)
    }
  })()
}
