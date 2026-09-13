import { create } from 'zustand'
import type { Feed, Folder } from '../types'
import { useSettingsStore } from './settings.store'

interface FeedsState {
  feeds: Feed[]
  folders: Folder[]
  unreadCounts: Record<string, number>
  articleCounts: Record<string, number>
  trashCount: number
  loading: boolean

  loadAll: () => Promise<void>
  addFeed: (url: string, folderId: string, customTitle?: string) => Promise<{ error?: string; feed?: Feed }>
  updateFeed: (id: string, changes: Partial<Feed>) => Promise<void>
  deleteFeed: (id: string) => Promise<void>
  addFolder: (name: string) => Promise<Folder>
  updateFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  reorderFolders: (ids: string[]) => Promise<void>
  refreshUnreadCounts: () => Promise<void>
  fetchFeed: (id: string) => Promise<void>
  fetchFolder: (id: string) => Promise<void>
  fetchAll: () => Promise<void>
  togglePauseFeed: (id: string) => Promise<void>
  togglePauseFolder: (id: string) => Promise<void>
}

export const useFeedsStore = create<FeedsState>((set, get) => ({
  feeds: [],
  folders: [],
  unreadCounts: {},
  articleCounts: {},
  trashCount: 0,
  loading: true,

  loadAll: async () => {
    set({ loading: true })
    const [feeds, folders, counts, trashCount] = await Promise.all([
      window.api.getFeeds(),
      window.api.getFolders(),
      window.api.getUnreadCounts(),
      window.api.getTrashCount()
    ])
    set({
      feeds,
      folders,
      unreadCounts: { ...counts.unread, starred: counts.starred, all: counts.all },
      articleCounts: counts.total,
      trashCount,
      loading: false
    })
  },

  addFeed: async (url, folderId, customTitle) => {
    const result = await window.api.addFeed(url, folderId, customTitle)
    if (!result.error) {
      const feeds = await window.api.getFeeds()
      set({ feeds })
      get().refreshUnreadCounts()
    }
    return result
  },

  updateFeed: async (id, changes) => {
    await window.api.updateFeed(id, changes)
    const feeds = await window.api.getFeeds()
    set({ feeds })
  },

  deleteFeed: async (id) => {
    await window.api.deleteFeed(id)
    set(s => ({ feeds: s.feeds.filter(f => f.id !== id) }))
    get().refreshUnreadCounts()
    const { settings } = useSettingsStore.getState()
    const filters = settings.notifications.feedFilters ?? []
    if (filters.includes(id)) {
      useSettingsStore.setState({
        settings: {
          ...settings,
          notifications: {
            ...settings.notifications,
            feedFilters: filters.filter((fid) => fid !== id)
          }
        }
      })
    }
  },

  addFolder: async (name) => {
    const folder = await window.api.addFolder(name)
    set(s => ({ folders: [...s.folders, folder] }))
    return folder
  },

  updateFolder: async (id, name) => {
    await window.api.updateFolder(id, name)
    set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, name } : f) }))
  },

  deleteFolder: async (id) => {
    await window.api.deleteFolder(id)
    set(s => ({ folders: s.folders.filter(f => f.id !== id) }))
    const feeds = await window.api.getFeeds()
    set({ feeds })
  },

  reorderFolders: async (ids) => {
    await window.api.reorderFolders(ids)
    set(s => ({
      folders: [...s.folders].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    }))
  },

  refreshUnreadCounts: async () => {
    const counts = await window.api.getUnreadCounts()
    const trashCount = await window.api.getTrashCount()
    set({
      unreadCounts: { ...counts.unread, starred: counts.starred, all: counts.all },
      articleCounts: counts.total,
      trashCount
    })
  },

  fetchFeed: async (id) => {
    await window.api.fetchFeed(id)
    get().refreshUnreadCounts()
  },

  fetchFolder: async (id) => {
    await window.api.fetchFolder(id)
    get().refreshUnreadCounts()
  },

  fetchAll: async () => {
    await window.api.fetchAllFeeds()
    get().refreshUnreadCounts()
  },

  togglePauseFeed: async (id) => {
    await window.api.togglePauseFeed(id)
    const feeds = await window.api.getFeeds()
    set({ feeds })
  },

  togglePauseFolder: async (id) => {
    await window.api.togglePauseFolder(id)
    const feeds = await window.api.getFeeds()
    set({ feeds })
  }
}))
