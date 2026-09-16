import React, { useEffect, useCallback, useState } from 'react'
import { useFeedsStore } from './store/feeds.store'
import { useArticlesStore } from './store/articles.store'
import { useUIStore } from './store/ui.store'
import { useSettingsStore } from './store/settings.store'
import { DEFAULT_SETTINGS, type ArticleQuery } from './types'
import { useColumnResize } from './hooks/useColumnResize'
import { useRowResize } from './hooks/useRowResize'
import { useOverlayDismiss } from './hooks/useOverlayDismiss'
import { useTranslation } from './hooks/useTranslation'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import ArticleList from './components/ArticleList'
import ArticleViewer from './components/ArticleViewer'
import SettingsPanel from './components/SettingsPanel'
import AddFeedModal from './components/AddFeedModal'
import EditFeedModal from './components/EditFeedModal'
import AddFolderModal from './components/AddFolderModal'
import EditFolderModal from './components/EditFolderModal'
import InboxPanel from './components/InboxPanel'
import NotificationHistoryPanel from './components/NotificationHistoryPanel'
import AboutModal from './components/AboutModal'
import DoctorPanel from './components/DoctorPanel'
import Tooltip from './components/Tooltip'
import { UpdateNotificationModal, ActiveUpdateStatus } from './components/UpdateNotificationModal'

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string; releaseUrl?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; version?: string; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export default function App(): JSX.Element {
  const { loadAll, refreshUnreadCounts } = useFeedsStore()
  const { load, refresh } = useArticlesStore()
  const {
    selectedFeedId,
    selectedArticleId,
    activePanel,
    layout,
    unreadOnly,
    readOnly,
    search,
    pendingFeedId,
    closePanel,
    quickFilter
  } = useUIStore()
  const { load: loadSettings, settings } = useSettingsStore()
  const { t } = useTranslation()
  const dismissInbox = useOverlayDismiss(closePanel)
  const dismissHistory = useOverlayDismiss(closePanel)

  const [isSettingsClosing, setIsSettingsClosing] = useState(false)
  const handleCloseSettings = useCallback(() => {
    setIsSettingsClosing(true)
    setTimeout(() => {
      closePanel()
      setIsSettingsClosing(false)
    }, 200)
  }, [closePanel])
  const dismissSettings = useOverlayDismiss(handleCloseSettings)

  const [updateStatus, setUpdateStatus] = useState<ActiveUpdateStatus | null>(null)

  // ── Resize hooks — MUST be at top level, before any conditionals ──────────
  const [sidebarDragging, setSidebarDragging] = useState(false)
  const [listDragging, setListDragging] = useState(false)
  const [listRowDragging, setListRowDragging] = useState(false)
  const { startDrag: startSidebarDrag } = useColumnResize('sidebar', 220, 260, 480)
  const { startDrag: startListDrag } = useColumnResize('articleList', 320, 180, 620)
  const { startDrag: startListRowDrag } = useRowResize('articleList', 320, 160, 600)

  // Bootstrap
  useEffect(() => {
    loadSettings()
    loadAll()
    load({ limit: 60, offset: 0 })

    // Load unseen notifications count
    const lastChecked = Number(localStorage.getItem('lastCheckedNotificationsTime') || 0)
    // Seed main-process DB so the notifier badge computes the same unseen count.
    window.api.markNotificationsChecked(lastChecked)
    window.api.getNotificationHistory().then((history) => {
      const unseen = history.filter((h) => h.createdAt > lastChecked).length
      useUIStore.setState({ unseenNotificationsCount: unseen })
    })

    // Detect system username for welcoming greetings
    window.api.getUserInfo?.().then((info) => {
      if (info?.username) {
        useUIStore.getState().setDetectedUserName(info.username)
      }
    }).catch(() => {})

    const offUpdates = window.api.onUpdateStatus((raw) => {
      const s = raw as UpdateStatus
      if (s.state === 'available') {
        const skipped = localStorage.getItem('cyberfeeds_skipped_update_version')
        if (skipped === s.version) {
          return
        }
        setUpdateStatus(s)
      } else if (s.state === 'downloading' || s.state === 'downloaded') {
        setUpdateStatus(s)
      } else {
        setUpdateStatus(null)
      }
    })
    return () => {
      offUpdates()
    }
  }, [])

  // Keep the new-feed loading state visible while the first poll is in flight.
  // A timeout also handles feeds that respond successfully without any articles.
  useEffect(() => {
    if (!pendingFeedId) return
    const timeout = window.setTimeout(() => {
      useUIStore.getState().setPendingFeedId(null)
    }, 15_000)
    return () => window.clearTimeout(timeout)
  }, [pendingFeedId])

  // Apply layout + font sizes from saved settings as CSS vars
  useEffect(() => {
    if (settings.layout) useUIStore.setState({ layout: settings.layout })
    if (settings.unreadOnly) useUIStore.setState({ unreadOnly: settings.unreadOnly })
    if (settings.sidebarFontSize) {
      document.documentElement.style.setProperty(
        '--sidebar-font-size',
        `${settings.sidebarFontSize}px`
      )
    }
    if (settings.listFontSize) {
      document.documentElement.style.setProperty('--list-font-size', `${settings.listFontSize}px`)
    }
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark')
    try {
      localStorage.setItem('cyberfeeds-theme', settings.theme || 'dark')
    } catch {
      /* ignore */
    }
  }, [
    settings.layout,
    settings.unreadOnly,
    settings.sidebarFontSize,
    settings.listFontSize,
    settings.theme
  ])

  // React to feed/filter changes
  useEffect(() => {
    const query: ArticleQuery = { limit: 60, offset: 0 }
    if (selectedFeedId === 'trash') {
      query.trashOnly = true
    } else if (selectedFeedId === 'starred') {
      query.starredOnly = true
    } else if (selectedFeedId) {
      query.feedId = selectedFeedId
    }

    if (selectedFeedId !== 'trash') {
      if (quickFilter === 'unread' || unreadOnly) {
        query.unreadOnly = true
      } else if (readOnly) {
        query.readOnly = true
      }

      if (quickFilter === 'today') {
        query.timeRange = 'today'
      } else if (quickFilter === 'video') {
        query.hasVideo = true
      } else if (quickFilter === 'priority') {
        const pKw = settings.filters?.priorityKeywords ?? []
        if (pKw.length > 0) {
          query.priorityKeywords = pKw
        } else {
          query.starredOnly = true
        }
      }

      if (settings.filters?.muteAction === 'hide' && (settings.filters?.muteKeywords ?? []).length > 0) {
        query.muteKeywords = settings.filters.muteKeywords
      }
    }

    if (search) query.search = search
    load(query)
  }, [selectedFeedId, unreadOnly, readOnly, search, quickFilter, settings.filters])

  // Listen for new articles from main process
  useEffect(() => {
    let checkTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleArticleCheck = (): void => {
      if (checkTimer) return
      checkTimer = setTimeout(async () => {
        checkTimer = null
        void refreshUnreadCounts()

        const { articles, totalCount, currentQuery } = useArticlesStore.getState()
        if (Object.keys(currentQuery).length === 0) return

        // If list is empty (e.g. initial view), load directly
        if (articles.length === 0) {
          void refresh()
          return
        }

        // List is active: check if new articles arrived for the current query
        try {
          const newTotal = await window.api.getArticleCount(currentQuery)
          if (newTotal > totalCount) {
            useArticlesStore.getState().setIncomingCount(newTotal - totalCount)
          }
        } catch (err) {
          console.error('[App] Failed to check for incoming articles:', err)
        }
      }, 300)
    }

    const unsub = window.api.onArticlesUpdated((data) => {
      if (data.feedId === useUIStore.getState().pendingFeedId) {
        useUIStore.getState().setPendingFeedId(null)
      }
      scheduleArticleCheck()
    })
    return () => {
      unsub()
      if (checkTimer) clearTimeout(checkTimer)
    }
  }, [refresh, refreshUnreadCounts])

  // Listen for open article requests (e.g. from notifier click or tray menu)
  useEffect(() => {
    const unsub = window.api.onOpenArticle((feedId, articleId) => {
      useUIStore.setState({
        selectedFeedId: !feedId || feedId === 'all' ? null : feedId,
        selectedArticleId: articleId || null,
        unreadOnly: false,
        readOnly: false,
        search: '',
        activePanel: null
      })
    })
    return unsub
  }, [])

  // Listen for open settings requests (e.g. from tray menu or notifier)
  useEffect(() => {
    const unsub = window.api.onOpenSettings((tab) => {
      useUIStore.setState({
        activePanel: 'settings',
        settingsInitialTab: tab || null
      })
    })
    return unsub
  }, [])

  // Listen for open about requests (e.g. from tray branding, like CyberViewer)
  useEffect(() => {
    const unsub = window.api.onOpenAbout((opts) => {
      useUIStore.setState({ activePanel: 'about', aboutAutoCheck: !!opts?.checkUpdates })
    })
    return unsub
  }, [])

  // Listen for real-time notifications to update unseen badge count
  useEffect(() => {
    const unsubBatch = window.api.onNewNotificationBatch
      ? window.api.onNewNotificationBatch((items) => {
          useUIStore.setState((s) => ({
            unseenNotificationsCount: s.unseenNotificationsCount + items.length
          }))
        })
      : undefined

    const unsubNew = window.api.onNewNotification(() => {
      if (!unsubBatch) {
        useUIStore.setState((s) => ({ unseenNotificationsCount: s.unseenNotificationsCount + 1 }))
      }
    })

    return () => {
      unsubBatch?.()
      unsubNew()
    }
  }, [])

  // Listen for opening notification history from the notifier sub-app
  useEffect(() => {
    const unsub = window.api.onOpenHistory(() => {
      useUIStore.setState({ activePanel: 'history' })
    })
    return unsub
  }, [])

  // Listen for polling toggled requests from tray context menu
  useEffect(() => {
    const unsub = window.api.onPollingToggled((pollingEnabled) => {
      useSettingsStore.getState().update({ pollingEnabled })
    })
    return unsub
  }, [])

  // Settings mutated from the main process (e.g. mute-feed from a notification card)
  useEffect(() => {
    const unsub = window.api.onSettingsChanged((raw) => {
      const incoming = raw as typeof DEFAULT_SETTINGS
      const current = useSettingsStore.getState().settings
      useSettingsStore.setState({
        settings: {
          ...DEFAULT_SETTINGS,
          ...current,
          ...incoming,
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...current.notifications,
            ...incoming.notifications
          }
        }
      })
    })
    return unsub
  }, [])

  // Native text context menu for editable fields (modals, settings, search, etc.)
  useEffect(() => {
    const isEditableTextField = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false
      const el = target.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null
      if (!el || el.disabled || el.readOnly) return false
      if (el instanceof HTMLTextAreaElement) return true
      const type = (el.type || 'text').toLowerCase()
      return ['text', 'search', 'url', 'email', 'password', 'tel', 'number'].includes(type)
    }

    const onContextMenu = (e: MouseEvent): void => {
      if (!isEditableTextField(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      window.api.showInputContextMenu()
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    return () => document.removeEventListener('contextmenu', onContextMenu, true)
  }, [])

  // Keyboard shortcuts
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePanel) {
        if (activePanel === 'settings') {
          handleCloseSettings()
        } else {
          closePanel()
        }
      }
    },
    [activePanel, handleCloseSettings, closePanel]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Drag handlers (track active state for .active class on handle)
  const handleSidebarDrag = useCallback(
    (e: React.MouseEvent) => {
      setSidebarDragging(true)
      startSidebarDrag(e)
      const onUp = (): void => {
        setSidebarDragging(false)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mouseup', onUp)
    },
    [startSidebarDrag]
  )

  const handleListDrag = useCallback(
    (e: React.MouseEvent) => {
      setListDragging(true)
      startListDrag(e)
      const onUp = (): void => {
        setListDragging(false)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mouseup', onUp)
    },
    [startListDrag]
  )

  const handleListRowDrag = useCallback(
    (e: React.MouseEvent) => {
      setListRowDragging(true)
      startListRowDrag(e)
      const onUp = (): void => {
        setListRowDragging(false)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mouseup', onUp)
    },
    [startListRowDrag]
  )

  const showArticleList = layout !== 'one-panel'
  const showSidebar = layout === 'three-panel' || layout === 'horizontal-split'
  const isHorizontalSplit = layout === 'horizontal-split'

  return (
    <div id="root">
      <TopBar />
      <div className="app-layout">
        {showSidebar && <Sidebar />}
        {showSidebar && (
          <Tooltip label={t.common.resizeSidebar} placement="right">
            <div
              className={`resize-handle${sidebarDragging ? ' active' : ''}`}
              onMouseDown={handleSidebarDrag}
            />
          </Tooltip>
        )}
        <div className={`main-area${isHorizontalSplit ? ' horizontal-split' : ''}`}>
          {showArticleList && <ArticleList />}
          {showArticleList && (
            <Tooltip
              label={
                isHorizontalSplit ? t.common.resizeArticleListVertical : t.common.resizeArticleList
              }
              placement={isHorizontalSplit ? 'bottom' : 'right'}
            >
              <div
                className={`resize-handle${isHorizontalSplit ? ' resize-handle-horizontal' : ''}${(isHorizontalSplit ? listRowDragging : listDragging) ? ' active' : ''}`}
                onMouseDown={isHorizontalSplit ? handleListRowDrag : handleListDrag}
              />
            </Tooltip>
          )}
          <ArticleViewer key={selectedArticleId} />
        </div>
      </div>

      {/* Panels */}
      {(activePanel === 'settings' || isSettingsClosing) && (
        <div className={`panel-overlay ${isSettingsClosing ? 'closing' : ''}`} {...dismissSettings}>
          <SettingsPanel onClose={handleCloseSettings} />
        </div>
      )}
      {activePanel === 'inbox' && (
        <div className="panel-overlay" {...dismissInbox}>
          <InboxPanel />
        </div>
      )}
      {activePanel === 'history' && (
        <div className="panel-overlay" {...dismissHistory}>
          <NotificationHistoryPanel />
        </div>
      )}
      {activePanel === 'addFeed' && <AddFeedModal />}
      {activePanel === 'editFeed' && <EditFeedModal />}
      {activePanel === 'addFolder' && <AddFolderModal />}
      {activePanel === 'editFolder' && <EditFolderModal />}
      {activePanel === 'about' && <AboutModal />}
      {activePanel === 'doctor' && <DoctorPanel />}

      {/* Rich Notification Modal for Updates */}
      {updateStatus && (
        <UpdateNotificationModal
          status={updateStatus}
          onClose={() => setUpdateStatus(null)}
          onSkip={(version) => {
            try {
              localStorage.setItem('cyberfeeds_skipped_update_version', version)
            } catch {
              /* ignore */
            }
            setUpdateStatus(null)
          }}
          onDownload={async () => {
            const currentVer = updateStatus.version
            try {
              localStorage.removeItem('cyberfeeds_skipped_update_version')
            } catch {
              /* ignore */
            }
            setUpdateStatus({ state: 'downloading', version: currentVer, percent: 0 })
            await window.api.downloadUpdate()
          }}
          onInstall={() => {
            window.api.installUpdate()
          }}
        />
      )}
    </div>
  )
}
