// Shared types — used by both main process and renderer
// This file intentionally has no Electron/Node imports

export interface Folder {
  id: string
  name: string
  sortOrder: number
}

export interface Feed {
  id: string
  title: string
  url: string
  link?: string
  folderId: string
  icon?: string
  lastFetched?: number
  errorCount: number
  disabled?: boolean
}

export interface Article {
  id: string
  feedId: string
  feedTitle?: string
  feedIcon?: string
  title: string
  link: string
  pubDate: number
  content: string
  snippet: string
  author?: string
  read: number // 0 | 1
  starred: number // 0 | 1
  deletedAt?: number | null
  guid: string
  thumbnail?: string
}

export interface NotificationHistoryItem {
  id: string
  title: string
  body: string
  link: string
  feedName: string
  icon?: string
  thumbnail?: string
  articleId?: string
  feedId?: string
  createdAt: number
}

export interface AppSettings {
  theme: 'dark' | 'grayscale' | 'light' | 'dracula' | 'nord' | 'monokai'
  layout: 'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split'
  language: 'en' | 'es'
  pollingInterval: number
  autoStart: boolean
  startMinimized: boolean
  autoUpdate: boolean
  minimizeToTray: boolean
  showArticleThumbnails: boolean
  customBrowserPath: string
  unreadOnly: boolean
  compactArticleList: boolean
  cleanupReadDays: number
  autoCleanup: boolean
  readerFallback: boolean
  readingFontSize: number
  readingLineHeight: number
  readingMaxWidth: number
  readingTheme: 'default' | 'sepia' | 'dark'
  sidebarFontSize: number   // px — controls sidebar items font size
  listFontSize: number       // px — controls article list font size
  notifications: NotificationSettings
  pollingEnabled: boolean
  fetchOnStartup: boolean
  fetchOnStartupDelay: number
  pollOnlyWhenUnfocused: boolean
  shortcuts: KeyboardShortcuts
  autoFetchFullContent: boolean
  instantSearch: boolean
}

export type NotificationDisplayMode = 'automatic' | 'detailed' | 'compact'

export interface NotificationSettings {
  enabled: boolean
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  displayId: number
  displayBounds?: { x: number; y: number; width: number; height: number }  // For stable display matching
  marginX: number
  marginY: number
  maxWidth: number
  /** Maximum popup height as a percentage of the selected display work area. */
  maxHeight: number
  duration: number
  fontSize: number
  opacity: number
  soundEnabled: boolean
  soundFile: string | null
  maxStack: number
  feedFilters: string[]
  keywordFilters: string[]
  snoozedUntil: number | null
  /** Minutes applied by the single snooze button on notification cards. */
  snoozeMinutes: number
  openBehavior: 'browser' | 'app'
  /** How notification cards choose between full and compact presentation. */
  displayMode: NotificationDisplayMode
  showThumbnails: boolean
  preloadImages: boolean
  disableOnFullscreen: boolean
  closeOnViewInApp: boolean
}

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
  /** Last display the window lived on (mixed-DPI restore). */
  displayId?: number | null
}

export interface NotifierPatch {
  add?: NotificationHistoryItem[]
  remove?: string[]
}

export interface KeyboardShortcut {
  enabled: boolean
  accelerator: string
  global: boolean
}

export interface KeyboardShortcuts {
  showHide: KeyboardShortcut
  notifications: KeyboardShortcut
  settings: KeyboardShortcut
  fetch: KeyboardShortcut
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  layout: 'three-panel',
  language: 'en',
  pollingInterval: 15,
  autoStart: false,
  startMinimized: false,
  autoUpdate: true,
  minimizeToTray: true,
  showArticleThumbnails: true,
  customBrowserPath: '',
  unreadOnly: false,
  compactArticleList: false,
  cleanupReadDays: 30,
  autoCleanup: false,
  readerFallback: true,
  readingFontSize: 16,
  readingLineHeight: 1.7,
  readingMaxWidth: 720,
  readingTheme: 'default',
  sidebarFontSize: 13,
  listFontSize: 13,
  notifications: {
    enabled: true,
    position: 'bottom-left',
    displayId: -1,
    marginX: 16,
    marginY: 16,
    maxWidth: 360,
    // Percentage of the display work area reserved for the popup.
    maxHeight: 65,
    duration: 6000,
    fontSize: 13,
    opacity: 0.97,
    soundEnabled: true,
    soundFile: null,
    maxStack: 2,
    feedFilters: [],
    keywordFilters: [],
    snoozedUntil: null,
    snoozeMinutes: 30,
    openBehavior: 'app',
    displayMode: 'automatic',
    showThumbnails: true,
    preloadImages: true,
    disableOnFullscreen: true,
    closeOnViewInApp: false
  },
  pollingEnabled: true,
  fetchOnStartup: true,
  fetchOnStartupDelay: 15,
  pollOnlyWhenUnfocused: true,
  shortcuts: {
    // Default: only one hotkey enabled by default.
    // Show/Hide (tray + global shortcut): Alt+Shift+S
    showHide: { enabled: true, accelerator: 'Alt+Shift+S', global: true },

    // Disabled by default — no accelerators so they don't appear unless the user sets them.
    notifications: { enabled: false, accelerator: '', global: false },
    settings: { enabled: false, accelerator: '', global: false },
    fetch: { enabled: false, accelerator: '', global: false }
  },
  autoFetchFullContent: true,
  instantSearch: false
}
