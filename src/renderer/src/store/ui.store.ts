import { create } from 'zustand'

export type Panel = 'settings' | 'inbox' | 'history' | 'addFeed' | 'editFeed' | 'addFolder' | 'editFolder' | 'about' | 'doctor' | null

interface UIState {
  selectedFeedId: string | null    // null = All Feeds
  selectedArticleId: string | null
  activePanel: Panel
  settingsInitialTab: string | null
  editFeedId: string | null
  editFolderId: string | null
  unseenNotificationsCount: number
  unreadOnly: boolean
  readOnly: boolean
  search: string
  layout: 'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split'
  isFetching: boolean
  pendingFeedId: string | null
  aboutAutoCheck: boolean
  detectedUserName: string

  selectFeed: (id: string | null, options?: { unreadOnly?: boolean; readOnly?: boolean }) => void
  selectArticle: (id: string | null) => void
  openPanel: (panel: Panel, id?: string) => void
  closePanel: () => void
  setUnreadOnly: (v: boolean) => void
  setReadOnly: (v: boolean) => void
  setSearch: (v: string) => void
  setLayout: (v: 'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split') => void
  setFetching: (v: boolean) => void
  setPendingFeedId: (id: string | null) => void
  setAboutAutoCheck: (v: boolean) => void
  setDetectedUserName: (v: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedFeedId: null,
  selectedArticleId: null,
  activePanel: null,
  settingsInitialTab: null,
  editFeedId: null,
  editFolderId: null,
  unseenNotificationsCount: 0,
  unreadOnly: false,
  readOnly: false,
  search: '',
  layout: 'three-panel',
  isFetching: false,
  pendingFeedId: null,
  aboutAutoCheck: false,
  detectedUserName: '',

  setDetectedUserName: (name) => set({ detectedUserName: name }),

  selectFeed: (id, options) =>
    set((state) => ({
      selectedFeedId: id,
      selectedArticleId: null,
      search: '',
      pendingFeedId: null,
      unreadOnly:
        id === 'trash' || id === 'starred'
          ? false
          : (options?.unreadOnly ?? state.unreadOnly),
      readOnly:
        id === 'trash' || id === 'starred' ? false : (options?.readOnly ?? false)
    })),
  selectArticle: (id) => set({ selectedArticleId: id }),
  openPanel: (panel, id) => set(() => ({
    activePanel: panel,
    editFeedId: panel === 'editFeed' ? (id || null) : null,
    editFolderId: panel === 'editFolder' ? (id || null) : null
  })),
  closePanel: () => set({ activePanel: null, editFeedId: null, editFolderId: null, aboutAutoCheck: false }),
  setUnreadOnly: (v) => set({ unreadOnly: v }),
  setReadOnly: (v) => set(v ? { readOnly: true, unreadOnly: false } : { readOnly: false }),
  setSearch: (v) => set({ search: v }),
  setLayout: (v) => set({ layout: v }),
  setFetching: (v) => set({ isFetching: v }),
  setPendingFeedId: (id) => set({ pendingFeedId: id }),
  setAboutAutoCheck: (v) => set({ aboutAutoCheck: v })
}))
