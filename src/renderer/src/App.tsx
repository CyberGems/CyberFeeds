import React, { useEffect, useCallback, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useFeedsStore } from './store/feeds.store'
import { useArticlesStore } from './store/articles.store'
import { useUIStore } from './store/ui.store'
import { useSettingsStore } from './store/settings.store'
import { DEFAULT_SETTINGS } from './types'
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

type UpdateStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
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
    closePanel
  } = useUIStore()
  const { load: loadSettings, settings } = useSettingsStore()
  const { t, language } = useTranslation()
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
  
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

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

    const offUpdates = window.api.onUpdateStatus((raw) => {
      const s = raw as UpdateStatus
      if (s.state === 'available' || s.state === 'downloading' || s.state === 'downloaded') {
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
    const query: Record<string, unknown> = { limit: 60, offset: 0 }
    if (selectedFeedId === 'trash') {
      query.trashOnly = true
    } else if (selectedFeedId === 'starred') {
      query.starredOnly = true
    } else if (selectedFeedId) {
      query.feedId = selectedFeedId
    }
    if (unreadOnly && selectedFeedId !== 'trash') query.unreadOnly = true
    if (readOnly && selectedFeedId !== 'trash') query.readOnly = true
    if (search) query.search = search
    load(query)
  }, [selectedFeedId, unreadOnly, readOnly, search])

  // Listen for new articles from main process
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = (): void => {
      if (refreshTimer) return
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        void refresh()
        void refreshUnreadCounts()
      }, 200)
    }

    const unsub = window.api.onArticlesUpdated((data) => {
      if (data.feedId === useUIStore.getState().pendingFeedId) {
        useUIStore.getState().setPendingFeedId(null)
      }
      scheduleRefresh()
    })
    return () => {
      unsub()
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [])

  // Listen for open article requests (e.g. from notifier click)
  useEffect(() => {
    const unsub = window.api.onOpenArticle((feedId, articleId) => {
      useUIStore.setState({
        selectedFeedId: feedId,
        selectedArticleId: articleId || null,
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
    const unsub = window.api.onNewNotification(() => {
      const state = useUIStore.getState()
      if (state.activePanel !== 'history') {
        useUIStore.setState({ unseenNotificationsCount: state.unseenNotificationsCount + 1 })
      }
    })
    return unsub
  }, [])

  // Listen for background auto-update status to show visual toast
  useEffect(() => {
    const off = window.api.onUpdateStatus((s) => {
      const status = s as UpdateStatus
      if (status.state === 'available' || status.state === 'downloaded') {
        setUpdateStatus(status)
      }
    })
    return off
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

      {/* Toast Notification for Updates */}
      {updateStatus && (
        <div
          className="cyber-toast"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            background: 'linear-gradient(135deg, var(--bg-1), var(--bg-0))',
            border: '1px solid var(--accent)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px var(--accent-subtle)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 360,
            animation: 'slideUp 0.3s ease'
          }}
        >
          <Bell size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--text-primary)' }}>
            {updateStatus.state === 'available' ? (
              <div>
                <strong style={{ fontWeight: 600 }}>{t.about.statuses.available}</strong>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Version {updateStatus.version}
                </div>
              </div>
            ) : updateStatus.state === 'downloading' ? (
              <div style={{ minWidth: 160 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {language === 'es' ? 'Descargando…' : 'Downloading…'}
                  </strong>
                  <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                    {updateStatus.percent}%
                  </span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(2, Math.min(100, updateStatus.percent))}%`,
                      background: 'linear-gradient(90deg, var(--accent), #38bdf8)',
                      borderRadius: 999,
                      transition: 'width 0.2s ease-out'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <strong style={{ fontWeight: 600 }}>{t.about.statuses.downloaded}</strong>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-accent)',
                    marginTop: 2,
                    fontWeight: 500
                  }}
                >
                  {language === 'es'
                    ? 'Haz clic para reiniciar y aplicar'
                    : 'Click to restart and apply'}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {updateStatus.state === 'available' ? (
              <button
                className="btn btn-primary"
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={async () => {
                  setUpdateStatus({ state: 'downloading', percent: 0 })
                  await window.api.downloadUpdate()
                }}
              >
                {t.about.downloadBtn}
              </button>
            ) : updateStatus.state === 'downloading' ? null : (
              <button
                className="btn btn-primary"
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={() => {
                  window.api.installUpdate()
                }}
              >
                {language === 'es' ? 'Reiniciar' : 'Restart'}
              </button>
            )}
            <button
              className="btn btn-ghost btn-icon"
              style={{ width: 22, height: 22 }}
              onClick={() => setUpdateStatus(null)}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
