import { create } from 'zustand'
import { useUIStore } from './ui.store'
import { useSettingsStore } from './settings.store'

export interface ArticleTab {
  id: string
  feedId?: string
  title: string
  feedTitle?: string
  feedIcon?: string
  url?: string
}

interface TabsSessionData {
  tabs: ArticleTab[]
  activeTabId: string | null
}

const TABS_SESSION_KEY = 'cyberfeeds_article_tabs_session'

interface TabsState {
  tabs: ArticleTab[]
  activeTabId: string | null

  openTab: (
    article: {
      id: string
      title?: string
      feedId?: string
      feedTitle?: string
      feedIcon?: string
      url?: string
      link?: string
    },
    activate?: boolean
  ) => void
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToTheRight: (id: string) => void
  closeAllTabs: () => void
  setActiveTab: (id: string) => void
  reorderTabs: (sourceIndex: number, destinationIndex: number) => void
  restoreSession: () => Promise<void>
}

function persistSession(tabs: ArticleTab[], activeTabId: string | null): void {
  try {
    const settings = useSettingsStore.getState().settings
    if (settings.articleTabsSession === 'clean') {
      localStorage.removeItem(TABS_SESSION_KEY)
      return
    }
    const data: TabsSessionData = { tabs, activeTabId }
    localStorage.setItem(TABS_SESSION_KEY, JSON.stringify(data))
  } catch {
    /* ignore storage errors */
  }
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (article, activate = true) => {
    const { tabs, activeTabId } = get()
    const title = article.title?.trim() || 'Untitled'
    const url = article.url || article.link || ''
    const existingIndex = tabs.findIndex((t) => t.id === article.id)

    let nextTabs: ArticleTab[]
    if (existingIndex >= 0) {
      // Update metadata in case feed info or title changed
      nextTabs = [...tabs]
      nextTabs[existingIndex] = {
        ...nextTabs[existingIndex],
        title: title || nextTabs[existingIndex].title,
        feedId: article.feedId || nextTabs[existingIndex].feedId,
        feedTitle: article.feedTitle || nextTabs[existingIndex].feedTitle,
        feedIcon: article.feedIcon || nextTabs[existingIndex].feedIcon,
        url: url || nextTabs[existingIndex].url
      }
    } else {
      const newTab: ArticleTab = {
        id: article.id,
        feedId: article.feedId,
        title,
        feedTitle: article.feedTitle,
        feedIcon: article.feedIcon,
        url
      }
      nextTabs = [...tabs, newTab]
    }

    const nextActiveId = activate ? article.id : activeTabId || article.id

    set({ tabs: nextTabs, activeTabId: nextActiveId })
    if (activate) {
      useUIStore.getState().selectArticle(article.id)
    }
    persistSession(nextTabs, nextActiveId)
  },

  closeTab: (id: string) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((t) => t.id === id)
    if (index === -1) return

    const nextTabs = tabs.filter((t) => t.id !== id)
    let nextActiveId = activeTabId

    if (activeTabId === id) {
      if (nextTabs.length === 0) {
        nextActiveId = null
      } else if (index < nextTabs.length) {
        // Tab to the right
        nextActiveId = nextTabs[index].id
      } else {
        // Tab to the left
        nextActiveId = nextTabs[nextTabs.length - 1].id
      }
    }

    set({ tabs: nextTabs, activeTabId: nextActiveId })
    useUIStore.getState().selectArticle(nextActiveId)
    persistSession(nextTabs, nextActiveId)
  },

  closeOtherTabs: (id: string) => {
    const { tabs } = get()
    const target = tabs.find((t) => t.id === id)
    if (!target) return

    const nextTabs = [target]
    set({ tabs: nextTabs, activeTabId: id })
    useUIStore.getState().selectArticle(id)
    persistSession(nextTabs, id)
  },

  closeTabsToTheRight: (id: string) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((t) => t.id === id)
    if (index === -1) return

    const nextTabs = tabs.slice(0, index + 1)
    const isCurrentActiveClosed = !nextTabs.some((t) => t.id === activeTabId)
    const nextActiveId = isCurrentActiveClosed ? id : activeTabId

    set({ tabs: nextTabs, activeTabId: nextActiveId })
    useUIStore.getState().selectArticle(nextActiveId)
    persistSession(nextTabs, nextActiveId)
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null })
    useUIStore.getState().selectArticle(null)
    persistSession([], null)
  },

  setActiveTab: (id: string) => {
    const { tabs } = get()
    if (!tabs.some((t) => t.id === id)) return

    set({ activeTabId: id })
    useUIStore.getState().selectArticle(id)
    persistSession(tabs, id)
  },

  reorderTabs: (sourceIndex: number, destinationIndex: number) => {
    const { tabs, activeTabId } = get()
    if (
      sourceIndex < 0 ||
      sourceIndex >= tabs.length ||
      destinationIndex < 0 ||
      destinationIndex >= tabs.length ||
      sourceIndex === destinationIndex
    ) {
      return
    }

    const next = [...tabs]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(destinationIndex, 0, moved)

    set({ tabs: next })
    persistSession(next, activeTabId)
  },

  restoreSession: async () => {
    const settings = useSettingsStore.getState().settings
    if (settings.articleTabsSession === 'clean') {
      localStorage.removeItem(TABS_SESSION_KEY)
      set({ tabs: [], activeTabId: null })
      return
    }

    try {
      const raw = localStorage.getItem(TABS_SESSION_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as TabsSessionData
      if (!Array.isArray(data.tabs) || data.tabs.length === 0) return

      // Validate articles still exist in the database
      const validTabs: ArticleTab[] = []
      for (const tab of data.tabs) {
        if (!tab?.id) continue
        try {
          const art = await window.api.getArticleById(tab.id)
          if (art && !art.deletedAt) {
            validTabs.push({
              id: art.id,
              feedId: art.feedId,
              title: art.title || tab.title || 'Untitled',
              feedTitle: art.feedTitle || tab.feedTitle,
              feedIcon: art.feedIcon || tab.feedIcon,
              url: art.link || tab.url
            })
          }
        } catch {
          /* ignore lookup errors */
        }
      }

      if (validTabs.length === 0) {
        localStorage.removeItem(TABS_SESSION_KEY)
        set({ tabs: [], activeTabId: null })
        return
      }

      const activeExists = validTabs.some((t) => t.id === data.activeTabId)
      const nextActiveId = activeExists ? data.activeTabId : validTabs[0].id

      set({ tabs: validTabs, activeTabId: nextActiveId })
      useUIStore.getState().selectArticle(nextActiveId)
      persistSession(validTabs, nextActiveId)
    } catch {
      localStorage.removeItem(TABS_SESSION_KEY)
    }
  }
}))
