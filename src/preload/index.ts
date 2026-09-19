import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { NotificationHistoryItem } from '../shared/types'

type NotificationBatchPayload = {
  items: NotificationHistoryItem[]
  totalCount: number
}

const api = {
  // Feeds
  getFeeds: () => ipcRenderer.invoke('feeds:getAll'),
  addFeed: (url: string, folderId: string, customTitle?: string) => ipcRenderer.invoke('feeds:add', url, folderId, customTitle),
  deleteAllFeeds: () => ipcRenderer.invoke('feeds:deleteAll'),
  previewFeed: (url: string) => ipcRenderer.invoke('feeds:preview', url),
  updateFeed: (id: string, changes: object) => ipcRenderer.invoke('feeds:update', id, changes),
  deleteFeed: (id: string) => ipcRenderer.invoke('feeds:delete', id),
  fetchFeed: (id: string) => ipcRenderer.invoke('feeds:fetchOne', id),
  fetchAllFeeds: () => ipcRenderer.invoke('feeds:fetchAll'),
  fetchFolder: (id: string) => ipcRenderer.invoke('feeds:fetchFolder', id),
  togglePauseFeed: (id: string) => ipcRenderer.invoke('feeds:togglePause', id),
  togglePauseFolder: (id: string) => ipcRenderer.invoke('feeds:togglePauseFolder', id),

  // Folders
  getFolders: () => ipcRenderer.invoke('folders:getAll'),
  addFolder: (name: string) => ipcRenderer.invoke('folders:add', name),
  updateFolder: (id: string, name: string) => ipcRenderer.invoke('folders:update', id, name),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),
  reorderFolders: (ids: string[]) => ipcRenderer.invoke('folders:reorder', ids),

  // Articles
  getArticles: (query: object) => ipcRenderer.invoke('articles:get', query),
  getArticleCount: (query: object) => ipcRenderer.invoke('articles:getCount', query),
  getTrashCount: () => ipcRenderer.invoke('articles:getTrashCount'),
  getUnreadCounts: () => ipcRenderer.invoke('articles:getUnreadCounts') as Promise<{
    unread: Record<string, number>
    total: Record<string, number>
    starred: number
    all: number
  }>,
  getTodayArticles: () => ipcRenderer.invoke('articles:getToday'),
  markRead: (id: string, read: boolean) => ipcRenderer.invoke('articles:markRead', id, read),
  markAllRead: (feedId?: string) => ipcRenderer.invoke('articles:markAllRead', feedId),
  markAllFilteredRead: (starredOnly?: boolean) => ipcRenderer.invoke('articles:markAllFilteredRead', starredOnly),
  deleteAllActiveArticles: (starredOnly?: boolean) => ipcRenderer.invoke('articles:deleteAllActive', starredOnly),
  deleteAllFilteredArticles: (query?: object) => ipcRenderer.invoke('articles:deleteAllFiltered', query),
  unstarAllArticles: () => ipcRenderer.invoke('articles:unstarAll'),
  starArticle: (id: string, starred: boolean) => ipcRenderer.invoke('articles:star', id, starred),
  deleteArticle: (id: string) => ipcRenderer.invoke('articles:delete', id),
  deleteMultipleArticles: (ids: string[]) => ipcRenderer.invoke('articles:deleteMultiple', ids),
  restoreArticle: (id: string) => ipcRenderer.invoke('articles:restore', id),
  restoreMultipleArticles: (ids: string[]) => ipcRenderer.invoke('articles:restoreMultiple', ids),
  restoreAllTrash: () => ipcRenderer.invoke('articles:restoreAllTrash'),
  purgeArticle: (id: string) => ipcRenderer.invoke('articles:purge', id),
  purgeMultipleArticles: (ids: string[]) => ipcRenderer.invoke('articles:purgeMultiple', ids),
  emptyTrash: () => ipcRenderer.invoke('articles:emptyTrash'),
  fetchArticleContent: (id: string) => ipcRenderer.invoke('articles:fetchContent', id),
  getArticleById: (id: string) => ipcRenderer.invoke('articles:getById', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: object) => ipcRenderer.invoke('settings:save', s),
  togglePolling: () => ipcRenderer.invoke('settings:togglePolling'),

  // Keyboard Shortcuts
  updateShortcuts: (shortcuts: object) => ipcRenderer.invoke('shortcuts:update', shortcuts),
  resetShortcuts: () => ipcRenderer.invoke('shortcuts:reset'),

  // Notifications
  getNotificationHistory: (limit?: number) => ipcRenderer.invoke('notifications:getHistory', limit),
  getNotificationHistoryCount: () => ipcRenderer.invoke('notifications:getTotalCount') as Promise<number>,
  clearNotificationHistory: () => ipcRenderer.invoke('notifications:clearHistory'),
  markNotificationsChecked: (ts?: number) => ipcRenderer.invoke('notifications:markChecked', ts),
  previewNotification: (notifSettings?: object, playSound?: boolean) =>
    ipcRenderer.invoke('notifier:preview', notifSettings, playSound),

  // OPML
  importOpml: () => ipcRenderer.invoke('opml:import'),
  exportOpml: () => ipcRenderer.invoke('opml:export'),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  copyImageToClipboard: (imageUrl: string) => ipcRenderer.invoke('clipboard:copyImage', imageUrl),
  copyImageAt: (x: number, y: number) => ipcRenderer.invoke('clipboard:copyImageAt', x, y),
  writeImageBuffer: (buffer: ArrayBuffer) => ipcRenderer.invoke('clipboard:writeImageBuffer', buffer),
  pickBrowser: () => ipcRenderer.invoke('app:pickBrowser'),

  // Displays
  getDisplays: () => ipcRenderer.invoke('displays:getAll'),

  // App
  getVersions: () => ipcRenderer.invoke('app:getVersions'),
  cleanup: (days: number) => ipcRenderer.invoke('app:cleanup', days),
  exportBackup: () => ipcRenderer.invoke('app:exportBackup'),
  importBackup: () => ipcRenderer.invoke('app:importBackup'),
  runAutoBackup: () => ipcRenderer.invoke('autoBackup:runNow') as Promise<{ ok: boolean; filePath?: string; error?: string }>,
  listAutoBackups: () => ipcRenderer.invoke('autoBackup:list') as Promise<import('../shared/types').AutoBackupFileInfo[]>,
  pickBackupFolder: () => ipcRenderer.invoke('autoBackup:pickFolder') as Promise<string | null>,
  openBackupFolder: () => ipcRenderer.invoke('autoBackup:openFolder') as Promise<{ ok: boolean; path?: string }>,
  restoreAutoBackup: (filePath: string) => ipcRenderer.invoke('autoBackup:restore', filePath) as Promise<{ ok: boolean; error?: string }>,
  deleteAutoBackup: (filePath: string) => ipcRenderer.invoke('autoBackup:delete', filePath) as Promise<{ ok: boolean; error?: string }>,
  showInputContextMenu: () => ipcRenderer.invoke('showInputContextMenu'),
  showReadOnlyContextMenu: (linkUrl?: string, selectedText?: string, imageUrl?: string, titleText?: string) => ipcRenderer.invoke('showReadOnlyContextMenu', linkUrl, selectedText, imageUrl, titleText),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  scanFeeds: () => ipcRenderer.invoke('app:scanFeeds'),

  // Event listeners
  onArticlesUpdated: (cb: (data: { feedId: string; count: number }) => void) => {
    const handler = (_: unknown, data: { feedId: string; count: number }) => cb(data)
    ipcRenderer.on('articles:updated', handler)
    return () => { ipcRenderer.removeListener('articles:updated', handler) }
  },
  onOpenArticle: (cb: (feedId: string, articleId: string) => void) => {
    const handler = (_: unknown, data: { feedId: string; articleId: string }) => cb(data.feedId, data.articleId)
    ipcRenderer.on('app:openArticle', handler)
    return () => { ipcRenderer.removeListener('app:openArticle', handler) }
  },
  onOpenSettings: (cb: (tab?: string) => void) => {
    const handler = (_: unknown, tab?: string) => cb(tab)
    ipcRenderer.on('app:openSettings', handler)
    return () => { ipcRenderer.removeListener('app:openSettings', handler) }
  },
  onOpenAbout: (cb: (opts?: { checkUpdates?: boolean }) => void) => {
    const handler = (_: unknown, opts?: { checkUpdates?: boolean }): void => cb(opts)
    ipcRenderer.on('app:openAbout', handler)
    return () => { ipcRenderer.removeListener('app:openAbout', handler) }
  },
  onNewNotification: (cb: (item: any) => void) => {
    const handler = (_: unknown, item: any) => cb(item)
    ipcRenderer.on('notifications:new', handler)
    return () => { ipcRenderer.removeListener('notifications:new', handler) }
  },
  onNewNotificationBatch: (cb: (payload: NotificationBatchPayload) => void) => {
    const handler = (_: unknown, payload: NotificationBatchPayload) => cb(payload)
    ipcRenderer.on('notifications:batch', handler)
    return () => { ipcRenderer.removeListener('notifications:batch', handler) }
  },
  onOpenHistory: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('app:openHistory', handler)
    return () => { ipcRenderer.removeListener('app:openHistory', handler) }
  },
  onPollingToggled: (cb: (pollingEnabled: boolean) => void) => {
    const handler = (_: unknown, pollingEnabled: boolean) => cb(pollingEnabled)
    ipcRenderer.on('settings:pollingToggled', handler)
    return () => { ipcRenderer.removeListener('settings:pollingToggled', handler) }
  },
  onSettingsChanged: (cb: (settings: object) => void) => {
    const handler = (_: unknown, settings: object) => cb(settings)
    ipcRenderer.on('settings:changed', handler)
    return () => { ipcRenderer.removeListener('settings:changed', handler) }
  },

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb: (status: object) => void) => {
    const handler = (_: unknown, status: object): void => cb(status)
    ipcRenderer.on('update:status', handler)
    return () => { ipcRenderer.removeListener('update:status', handler) }
  },

  // Notifier specific
  dismissNotification: (id: string) => ipcRenderer.send('notifier:dismiss', id),
  clearAllNotifications: () => ipcRenderer.send('notifier:clearAll'),
  markNotificationRead: (articleId: string) => ipcRenderer.send('notifier:markRead', articleId),
  snoozeNotifications: (minutes: number) => ipcRenderer.send('notifier:snooze', minutes),
  muteFeedNotifications: (feedId: string) => ipcRenderer.send('notifier:muteFeed', feedId),
  openInApp: (feedId: string, articleId: string) => ipcRenderer.send('notifier:openInApp', feedId, articleId),
  openHistoryInApp: () => ipcRenderer.send('notifier:openHistory'),
  openSettingsInApp: (tab?: string) => ipcRenderer.send('notifier:openSettings', tab),
  resizeNotifier: (height: number) => ipcRenderer.send('notifier:resize', height),
  setHover: (isHovering: boolean) => ipcRenderer.send('notifier:hover', isHovering),
  pickSoundFile: () => ipcRenderer.invoke('notifications:pickSoundFile'),
  onNotifierStack: (cb: (stack: object[], settings: object, language?: string, unseenCount?: number, displayMode?: string) => void) => {
    const handler = (_: unknown, stack: object[], settings: object, language?: string, unseenCount?: number, displayMode?: string) => cb(stack, settings, language, unseenCount, displayMode)
    ipcRenderer.on('notifier:stack', handler)
    return () => { ipcRenderer.removeListener('notifier:stack', handler) }
  },

  // Window controls (for custom titlebar)
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (cb: (maximized: boolean) => void) => {
    const handler = (_: unknown, val: boolean) => cb(val)
    ipcRenderer.on('window:maximized-change', handler)
    return () => {
      ipcRenderer.removeListener('window:maximized-change', handler)
    }
  },
  onWindowShown: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('window:shown', handler)
    return () => {
      ipcRenderer.removeListener('window:shown', handler)
    }
  },
  onWindowHidden: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('window:hidden', handler)
    return () => {
      ipcRenderer.removeListener('window:hidden', handler)
    }
  },

  // First paint ack — main waits for this before showing (avoids white flash)
  uiReady: () => ipcRenderer.send('ui-ready'),

  // Text translation
  translateText: (text: string, targetLang?: string) =>
    ipcRenderer.invoke('text:translate', text, targetLang) as Promise<{
      translation: string
      sourceLang: string
      targetLang: string
    } | null>,

  // Picture-in-Picture
  pip: {
    open: (payload: import('../shared/types').PipVideoPayload) =>
      ipcRenderer.invoke('pip:open', payload) as Promise<{ ok: boolean }>,
    close: () => ipcRenderer.invoke('pip:close') as Promise<{ ok: boolean }>,
    togglePin: () => ipcRenderer.invoke('pip:togglePin') as Promise<boolean>,
    returnToReader: () => ipcRenderer.invoke('pip:returnToReader') as Promise<{ ok: boolean }>,
    getData: () =>
      ipcRenderer.invoke('pip:getData') as Promise<import('../shared/types').PipVideoPayload | null>,
    getStatus: () =>
      ipcRenderer.invoke('pip:getStatus') as Promise<{ active: boolean; articleId?: string; isPinned: boolean }>,
    onStatusChange: (cb: (data: { active: boolean; articleId?: string }) => void) => {
      const handler = (_: unknown, data: { active: boolean; articleId?: string }) => cb(data)
      ipcRenderer.on('pip:status-changed', handler)
      return () => {
        ipcRenderer.removeListener('pip:status-changed', handler)
      }
    },
    onUpdateData: (cb: (payload: import('../shared/types').PipVideoPayload) => void) => {
      const handler = (_: unknown, payload: import('../shared/types').PipVideoPayload) => cb(payload)
      ipcRenderer.on('pip:update-data', handler)
      return () => {
        ipcRenderer.removeListener('pip:update-data', handler)
      }
    }
  },

  // System
  getUserInfo: () => ipcRenderer.invoke('system:getUserInfo') as Promise<{ username: string }>
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as any).electron = electronAPI
  ;(window as any).api = api
}

export type API = typeof api
