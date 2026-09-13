import { create } from 'zustand'
import type { Article } from '../types'
import { useFeedsStore } from './feeds.store'

interface ArticleQuery {
  feedId?: string
  unreadOnly?: boolean
  readOnly?: boolean
  starredOnly?: boolean
  trashOnly?: boolean
  search?: string
  limit?: number
  offset?: number
}

interface ArticlesState {
  articles: Article[]
  totalCount: number
  incomingCount: number
  loading: boolean
  loadingMore: boolean
  currentQuery: ArticleQuery

  load: (query: ArticleQuery) => Promise<void>
  loadMore: () => Promise<void>
  setIncomingCount: (count: number) => void
  applyIncomingArticles: () => Promise<void>
  markRead: (id: string, read: boolean) => Promise<void>
  markAllRead: (feedId?: string) => Promise<void>
  markAllFilteredRead: (starredOnly?: boolean) => Promise<void>
  markMultipleRead: (ids: string[], read: boolean) => Promise<void>
  starArticle: (id: string, starred: boolean) => Promise<void>
  deleteArticle: (id: string) => Promise<void>
  deleteMultiple: (ids: string[]) => Promise<void>
  deleteAllActiveArticles: (starredOnly?: boolean) => Promise<void>
  deleteAllFilteredArticles: (query?: ArticleQuery) => Promise<void>
  unstarAllArticles: () => Promise<void>
  restoreArticle: (id: string) => Promise<void>
  restoreAllTrash: () => Promise<void>
  purgeArticle: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  removeArticleFromList: (id: string) => void
  refresh: () => Promise<void>
}

const PAGE_SIZE = 60
const ARTICLE_LOAD_TIMEOUT_MS = 15_000

let latestLoadRequest = 0

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Article loading timed out after ${timeoutMs}ms`)), timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const useArticlesStore = create<ArticlesState>((set, get) => ({
  articles: [],
  totalCount: 0,
  incomingCount: 0,
  loading: false,
  loadingMore: false,
  currentQuery: {},

  load: async (query) => {
    const requestId = ++latestLoadRequest
    set({ loading: true, currentQuery: query, articles: [], totalCount: 0, incomingCount: 0 })
    const q = { ...query, limit: PAGE_SIZE, offset: 0 }
    try {
      const [articles, totalCount] = await withTimeout(
        Promise.all([window.api.getArticles(q), window.api.getArticleCount(query)]),
        ARTICLE_LOAD_TIMEOUT_MS
      )
      if (requestId !== latestLoadRequest) return
      set({ articles, totalCount })
    } catch (error) {
      if (requestId !== latestLoadRequest) return
      console.error('[Articles] Failed to load articles:', error)
      set({ articles: [], totalCount: 0 })
    } finally {
      if (requestId === latestLoadRequest) set({ loading: false })
    }
  },

  loadMore: async () => {
    const { articles, totalCount, loadingMore, currentQuery } = get()
    if (loadingMore || articles.length >= totalCount) return
    set({ loadingMore: true })
    const more = await window.api.getArticles({ ...currentQuery, limit: PAGE_SIZE, offset: articles.length })
    set(s => ({ articles: [...s.articles, ...more], loadingMore: false }))
  },

  markRead: async (id, read) => {
    if (get().articles.find(a => a.id === id)?.deletedAt) return
    // Optimistic update
    set(s => ({ articles: s.articles.map(a => a.id === id ? { ...a, read: read ? 1 : 0 } : a) }))
    await window.api.markRead(id, read)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  markAllRead: async (feedId) => {
    set(s => ({
      articles: s.articles.map(a => (!feedId || a.feedId === feedId) ? { ...a, read: 1 } : a)
    }))
    await window.api.markAllRead(feedId)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  markAllFilteredRead: async (starredOnly = false) => {
    await window.api.markAllFilteredRead(starredOnly)
    await get().refresh()
    useFeedsStore.getState().refreshUnreadCounts()
  },

  starArticle: async (id, starred) => {
    if (get().articles.find(a => a.id === id)?.deletedAt) return
    set(s => ({ articles: s.articles.map(a => a.id === id ? { ...a, starred: starred ? 1 : 0 } : a) }))
    await window.api.starArticle(id, starred)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  deleteArticle: async (id) => {
    set(s => {
      if (!s.articles.some(a => a.id === id && !a.deletedAt)) return s
      return {
        articles: s.articles.map(a => a.id === id ? { ...a, deletedAt: Date.now() } : a)
      }
    })
    await window.api.deleteArticle(id)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  removeArticleFromList: (id) => {
    set(s => {
      const exists = s.articles.some(a => a.id === id)
      if (!exists) return s
      return {
        articles: s.articles.filter(a => a.id !== id),
        totalCount: Math.max(0, s.totalCount - 1)
      }
    })
  },

  deleteMultiple: async (ids) => {
    const activeIds = get().articles
      .filter(a => ids.includes(a.id) && !a.deletedAt)
      .map(a => a.id)
    const deletedAt = Date.now()
    set(s => ({
      articles: s.articles.map(a =>
        activeIds.includes(a.id) ? { ...a, deletedAt } : a
      )
    }))
    await window.api.deleteMultipleArticles(activeIds)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  deleteAllActiveArticles: async (starredOnly = false) => {
    await window.api.deleteAllActiveArticles(starredOnly)
    await get().refresh()
    useFeedsStore.getState().refreshUnreadCounts()
  },

  deleteAllFilteredArticles: async (query) => {
    await window.api.deleteAllFilteredArticles(query ?? get().currentQuery)
    await get().refresh()
    useFeedsStore.getState().refreshUnreadCounts()
  },

  unstarAllArticles: async () => {
    await window.api.unstarAllArticles()
    await get().refresh()
    useFeedsStore.getState().refreshUnreadCounts()
  },

  restoreArticle: async (id) => {
    set(s => {
      if (!s.articles.some(a => a.id === id)) return s
      return {
        articles: s.articles.filter(a => a.id !== id),
        totalCount: Math.max(0, s.totalCount - 1)
      }
    })
    await window.api.restoreArticle(id)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  restoreAllTrash: async () => {
    const wasViewingTrash = Boolean(get().currentQuery.trashOnly)
    if (wasViewingTrash) {
      set({ articles: [], totalCount: 0 })
    }
    await window.api.restoreAllTrash()
    if (!wasViewingTrash) {
      await get().refresh()
    }
    useFeedsStore.getState().refreshUnreadCounts()
  },

  purgeArticle: async (id) => {
    set(s => {
      if (!s.articles.some(a => a.id === id)) return s
      return {
        articles: s.articles.filter(a => a.id !== id),
        totalCount: Math.max(0, s.totalCount - 1)
      }
    })
    await window.api.purgeArticle(id)
    useFeedsStore.getState().refreshUnreadCounts()
  },

  emptyTrash: async () => {
    if (get().currentQuery.trashOnly) {
      set({ articles: [], totalCount: 0 })
    }
    await window.api.emptyTrash()
    useFeedsStore.getState().refreshUnreadCounts()
  },

  markMultipleRead: async (ids, read) => {
    set(s => ({
      articles: s.articles.map(a => ids.includes(a.id) ? { ...a, read: read ? 1 : 0 } : a)
    }))
    await Promise.all(ids.map(id => window.api.markRead(id, read)))
    useFeedsStore.getState().refreshUnreadCounts()
  },

  refresh: async () => {
    const { currentQuery, articles: currentArticles } = get()
    if (Object.keys(currentQuery).length === 0) return
    const q = { ...currentQuery, limit: Math.max(PAGE_SIZE, currentArticles.length), offset: 0 }
    const [articles, totalCount] = await Promise.all([
      window.api.getArticles(q),
      window.api.getArticleCount(currentQuery)
    ])
    set({ articles, totalCount, incomingCount: 0 })
  },

  setIncomingCount: (incomingCount) => set({ incomingCount }),

  applyIncomingArticles: async () => {
    set({ incomingCount: 0 })
    await get().refresh()
  }
}))
