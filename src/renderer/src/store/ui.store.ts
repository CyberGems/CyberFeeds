import { create } from 'zustand'

export type Panel = 'settings' | 'inbox' | 'history' | 'addFeed' | 'editFeed' | 'addFolder' | 'editFolder' | 'about' | 'doctor' | null
export type QuickFilter = 'all' | 'unread' | 'today' | 'priority' | 'video'
export type SettingsFocusField = 'userName' | null

interface UIState {
  selectedFeedId: string | null    // null = All Feeds
  selectedArticleId: string | null
  activePanel: Panel
  settingsInitialTab: string | null
  settingsFocusField: SettingsFocusField
  editFeedId: string | null
  editFolderId: string | null
  unseenNotificationsCount: number
  unreadOnly: boolean
  readOnly: boolean
  quickFilter: QuickFilter
  search: string
  layout: 'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split'
  isFetching: boolean
  pendingFeedId: string | null
  aboutAutoCheck: boolean
  detectedUserName: string
  topbarMenuOpen: boolean

  selectFeed: (id: string | null, options?: { unreadOnly?: boolean; readOnly?: boolean }) => void
  selectArticle: (id: string | null) => void
  openPanel: (panel: Panel, id?: string) => void
  openSettingsTab: (tab: string) => void
  openUserNameSettings: () => void
  closePanel: () => void
  setUnreadOnly: (v: boolean) => void
  setReadOnly: (v: boolean) => void
  setQuickFilter: (v: QuickFilter) => void
  setSearch: (v: string) => void
  setLayout: (v: 'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split') => void
  setFetching: (v: boolean) => void
  setPendingFeedId: (id: string | null) => void
  setAboutAutoCheck: (v: boolean) => void
  setDetectedUserName: (v: string) => void
  setTopbarMenuOpen: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedFeedId: null,
  selectedArticleId: null,
  activePanel: null,
  settingsInitialTab: null,
  settingsFocusField: null,
  editFeedId: null,
  editFolderId: null,
  unseenNotificationsCount: 0,
  unreadOnly: false,
  readOnly: false,
  quickFilter: 'all',
  search: '',
  layout: 'three-panel',
  isFetching: false,
  pendingFeedId: null,
  aboutAutoCheck: false,
  detectedUserName: '',
  topbarMenuOpen: false,

  setDetectedUserName: (name) => set({ detectedUserName: name }),
  setTopbarMenuOpen: (open) => set({ topbarMenuOpen: open }),
  setQuickFilter: (filter) => set({ quickFilter: filter }),

  selectFeed: (id, options) =>
    set((state) => ({
      selectedFeedId: id,
      selectedArticleId: null,
      search: '',
      quickFilter: 'all',
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
    settingsFocusField: null,
    editFeedId: panel === 'editFeed' ? (id || null) : null,
    editFolderId: panel === 'editFolder' ? (id || null) : null
  })),
  openSettingsTab: (tab) => set({
    activePanel: 'settings',
    settingsInitialTab: tab,
    settingsFocusField: null,
    editFeedId: null,
    editFolderId: null
  }),
  openUserNameSettings: () => set({
    activePanel: 'settings',
    settingsInitialTab: 'general',
    settingsFocusField: 'userName',
    editFeedId: null,
    editFolderId: null
  }),
  closePanel: () => set({
    activePanel: null,
    settingsInitialTab: null,
    settingsFocusField: null,
    editFeedId: null,
    editFolderId: null,
    aboutAutoCheck: false
  }),
  setUnreadOnly: (v) => set({ unreadOnly: v }),
  setReadOnly: (v) => set(v ? { readOnly: true, unreadOnly: false } : { readOnly: false }),
  setSearch: (v) => set({ search: v }),
  setLayout: (v) => set({ layout: v }),
  setFetching: (v) => set({ isFetching: v }),
  setPendingFeedId: (id) => set({ pendingFeedId: id }),
  setAboutAutoCheck: (v) => set({ aboutAutoCheck: v })
}))
