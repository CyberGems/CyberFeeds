import { create } from 'zustand'
import type { AppSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

interface SettingsState {
  settings: AppSettings
  loaded: boolean

  load: () => Promise<void>
  save: (s: AppSettings) => Promise<void>
  update: (partial: Partial<AppSettings>) => void
  togglePolling: () => Promise<void>
  setFeedNotificationMuted: (feedIds: string[], muted: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const settings = await window.api.getSettings()
    set({ settings: { ...DEFAULT_SETTINGS, ...settings }, loaded: true })
  },

  save: async (s) => {
    set({ settings: s })
    await window.api.saveSettings(s)
  },

  update: (partial) => {
    const updated = { ...get().settings, ...partial }
    set({ settings: updated })
    window.api.saveSettings(updated)
  },

  togglePolling: async () => {
    const res = await window.api.togglePolling()
    if (res?.ok && typeof res.pollingEnabled === 'boolean') {
      set((s) => ({ settings: { ...s.settings, pollingEnabled: res.pollingEnabled } }))
    }
  },

  setFeedNotificationMuted: (feedIds, muted) => {
    if (feedIds.length === 0) return
    const s = get().settings
    const next = new Set(s.notifications.feedFilters ?? [])
    for (const id of feedIds) {
      if (muted) next.add(id)
      else next.delete(id)
    }
    get().update({
      notifications: { ...s.notifications, feedFilters: [...next] }
    })
  }
}))
