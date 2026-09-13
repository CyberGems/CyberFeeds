import React, { memo, useState, useCallback } from 'react'
import {
  FolderPlus,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  Plus,
  Upload,
  Download,
  Stethoscope,
  Library,
  Mail,
  MailOpen,
  Star,
  RefreshCw,
  Pencil,
  Pause,
  Play,
  Bell,
  BellOff,
  CheckCheck,
  Trash2
} from 'lucide-react'
import { useFeedsStore } from '../store/feeds.store'
import { useArticlesStore } from '../store/articles.store'
import { useUIStore } from '../store/ui.store'
import { useSettingsStore } from '../store/settings.store'
import { FeedFavicon } from './ArticleList'
import { useConfirm } from '../hooks/useConfirm'
import ConfirmDialog from './ConfirmDialog'
import type { Feed, Folder } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'

const formatNum = (val: number): string => String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function formatCountBreakdown(
  unread: number,
  total: number,
  t: { sidebar: { unreadCount: string; readCountOne: string; readCountMany: string } }
): string {
  const read = Math.max(0, total - unread)
  const readWord = read === 1 ? t.sidebar.readCountOne : t.sidebar.readCountMany
  return `${formatNum(unread)} ${t.sidebar.unreadCount} ⋅ ${formatNum(read)} ${readWord}`
}

const MIN_REFRESH_INDICATOR_MS = 700

async function waitForMinimumRefreshTime(startedAt: number): Promise<void> {
  const remaining = MIN_REFRESH_INDICATOR_MS - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining))
  }
}

const COLLAPSED_FOLDERS_STORAGE_KEY = 'cyberfeeds:collapsed_folders'

function loadCollapsedFolders(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_FOLDERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return new Set(parsed)
    }
  } catch {
    /* ignore */
  }
  return new Set()
}

function saveCollapsedFolders(set: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_FOLDERS_STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    /* ignore */
  }
}

const Sidebar = memo(function Sidebar(): JSX.Element {
  const {
    feeds,
    folders,
    unreadCounts,
    articleCounts,
    trashCount,
    loadAll,
    deleteFeed,
    fetchFeed,
    fetchFolder,
    fetchAll,
    togglePauseFeed,
    togglePauseFolder,
    deleteFolder
  } = useFeedsStore()
  const { selectedFeedId, unreadOnly, readOnly, selectFeed, openPanel } = useUIStore()
  const [collapsed, setCollapsedState] = useState<Set<string>>(() => loadCollapsedFolders())

  const setCollapsed = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setCollapsedState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveCollapsedFolders(next)
      return next
    })
  }, [])
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [refreshingFeedIds, setRefreshingFeedIds] = useState<Set<string>>(new Set())
  const [refreshingFolderIds, setRefreshingFolderIds] = useState<Set<string>>(new Set())
  const [ctx, setCtx] = React.useState<{
    x: number
    y: number
    type: 'feed' | 'folder' | 'trash' | 'smart'
    id: string
  } | null>(null)
  const ctxMenuRef = React.useRef<HTMLDivElement>(null)
  const [ctxMenuPosition, setCtxMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm()
  const {
    restoreAllTrash,
    emptyTrash,
    markAllFilteredRead,
    deleteAllActiveArticles,
    deleteAllFilteredArticles,
    unstarAllArticles
  } = useArticlesStore()
  const { t } = useTranslation()
  const feedFilters = useSettingsStore((s) => s.settings.notifications.feedFilters ?? [])
  const setFeedNotificationMuted = useSettingsStore((s) => s.setFeedNotificationMuted)
  const mutedIds = React.useMemo(() => new Set(feedFilters), [feedFilters])

  React.useEffect(() => {
    const handleUp = () => setCtx(null)
    const handleOtherMenu = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== 'sidebar') setCtx(null)
    }
    window.addEventListener('click', handleUp)
    window.addEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    return () => {
      window.removeEventListener('click', handleUp)
      window.removeEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    }
  }, [])

  React.useLayoutEffect(() => {
    if (!ctx || !ctxMenuRef.current) {
      setCtxMenuPosition(null)
      return
    }

    const margin = 8
    const menu = ctxMenuRef.current
    setCtxMenuPosition({
      left: Math.max(margin, Math.min(ctx.x, window.innerWidth - menu.offsetWidth - margin)),
      top: Math.max(margin, Math.min(ctx.y, window.innerHeight - menu.offsetHeight - margin))
    })
  }, [ctx])

  const totalAll = unreadCounts['all'] || 0
  const totalUnread = Object.entries(unreadCounts)
    .filter(([k]) => k !== 'starred' && k !== 'all')
    .reduce((sum, [, count]) => sum + count, 0)
  const totalRead = Math.max(0, totalAll - totalUnread)

  const totalStarred = unreadCounts['starred'] || 0

  const toggleFolder = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => setCollapsed(new Set(folders.map((f) => f.id))), [folders])

  const toggleAll = useCallback(() => {
    if (collapsed.size > 0) expandAll()
    else collapseAll()
  }, [collapsed.size, expandAll, collapseAll])

  const handleAddFolder = useCallback(() => {
    openPanel('addFolder')
  }, [openPanel])

  const openSmartContextMenu = useCallback(
    (e: React.MouseEvent, id: 'all' | 'unread' | 'read' | 'starred') => {
      e.preventDefault()
      window.dispatchEvent(
        new CustomEvent('cyberfeeds:close-context-menus', { detail: 'sidebar' })
      )
      setCtx({ x: e.clientX, y: e.clientY, type: 'smart', id })
    },
    []
  )

  const handleImportOpml = useCallback(async () => {
    setImporting(true)
    setImportMsg('')
    try {
      const result = await window.api.importOpml()
      if (result.canceled) {
        setImporting(false)
        return
      }
      await loadAll()
      setImportMsg(`✓ ${result.added} ${t.sidebar.feedsAdded}`)
      setTimeout(() => setImportMsg(''), 3000)
    } catch {
      setImportMsg(t.sidebar.importFailed)
      setTimeout(() => setImportMsg(''), 3000)
    }
    setImporting(false)
  }, [loadAll, t])

  const handleRefreshFeed = useCallback(async (id: string) => {
    const startedAt = Date.now()
    setRefreshingFeedIds((prev) => new Set(prev).add(id))
    try {
      await fetchFeed(id)
    } finally {
      await waitForMinimumRefreshTime(startedAt)
      setRefreshingFeedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [fetchFeed])

  const handleRefreshFolder = useCallback(async (id: string) => {
    const startedAt = Date.now()
    setRefreshingFolderIds((prev) => new Set(prev).add(id))
    try {
      await fetchFolder(id)
    } finally {
      await waitForMinimumRefreshTime(startedAt)
      setRefreshingFolderIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [fetchFolder])

  const sortedFolders = React.useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  )
  const sortedFeeds = React.useMemo(
    () => [...feeds].sort((a, b) => a.title.localeCompare(b.title)),
    [feeds]
  )

  const unfiledFeeds = sortedFeeds.filter((f) => !f.folderId || f.folderId === '')

  return (
    <div className="sidebar" onContextMenu={(e) => e.preventDefault()}>
      <div className="sidebar-scroll">
        {/* All Articles */}
        <div
          className={`sidebar-item ${selectedFeedId === null && !unreadOnly && !readOnly ? 'active' : ''} ${ctx?.type === 'smart' && ctx.id === 'all' ? 'context-active' : ''}`}
          onClick={() => selectFeed(null, { unreadOnly: false, readOnly: false })}
          onContextMenu={(e) => openSmartContextMenu(e, 'all')}
        >
          <Library size={15} className="smart-nav-icon" />
          <span className="item-label">{t.sidebar.allFeeds}</span>
          {totalAll > 0 && (
            <Tooltip label={formatCountBreakdown(totalUnread, totalAll, t)} placement="right">
              <div className="cyber-badge folder-badge">
                {formatNum(totalAll)}
              </div>
            </Tooltip>
          )}
        </div>

        <div
          className={`sidebar-item ${selectedFeedId === null && unreadOnly ? 'active' : ''} ${ctx?.type === 'smart' && ctx.id === 'unread' ? 'context-active' : ''}`}
          onClick={() => selectFeed(null, { unreadOnly: true, readOnly: false })}
          onContextMenu={(e) => openSmartContextMenu(e, 'unread')}
        >
          <Mail size={15} className="smart-nav-icon" />
          <span className="item-label">{t.sidebar.unreadArticles}</span>
          {totalUnread > 0 && (
            <Tooltip label={formatCountBreakdown(totalUnread, totalAll, t)} placement="right">
              <div className="cyber-badge" style={{ fontSize: 9, padding: '1px 4px' }}>
                {formatNum(totalUnread)}
              </div>
            </Tooltip>
          )}
        </div>

        <div
          className={`sidebar-item ${selectedFeedId === null && readOnly ? 'active' : ''} ${ctx?.type === 'smart' && ctx.id === 'read' ? 'context-active' : ''}`}
          onClick={() => selectFeed(null, { unreadOnly: false, readOnly: true })}
          onContextMenu={(e) => openSmartContextMenu(e, 'read')}
        >
          <MailOpen size={15} className="smart-nav-icon" />
          <span className="item-label">{t.sidebar.readArticles}</span>
          {totalRead > 0 && (
            <Tooltip label={formatCountBreakdown(0, totalRead, t)} placement="right">
              <div className="cyber-badge" style={{ fontSize: 9, padding: '1px 4px' }}>
                {formatNum(totalRead)}
              </div>
            </Tooltip>
          )}
        </div>

        <div
          className={`sidebar-item ${selectedFeedId === 'starred' ? 'active' : ''} ${ctx?.type === 'smart' && ctx.id === 'starred' ? 'context-active' : ''}`}
          onClick={() => selectFeed('starred')}
          onContextMenu={(e) => openSmartContextMenu(e, 'starred')}
        >
          <Star size={15} className="smart-nav-icon star-icon" />
          <span className="item-label">{t.sidebar.favorites}</span>
          {totalStarred > 0 && (
            <div className="cyber-badge" style={{ fontSize: 9, padding: '1px 4px' }}>
              {formatNum(totalStarred)}
            </div>
          )}
        </div>

        <div
          className={`sidebar-item ${selectedFeedId === 'trash' ? 'active' : ''} ${ctx?.type === 'trash' ? 'context-active' : ''}`}
          onClick={() => selectFeed('trash')}
          onContextMenu={(e) => {
            e.preventDefault()
            window.dispatchEvent(
              new CustomEvent('cyberfeeds:close-context-menus', { detail: 'sidebar' })
            )
            setCtx({ x: e.clientX, y: e.clientY, type: 'trash', id: 'trash' })
          }}
        >
          <Trash2 size={15} className="smart-nav-icon" />
          <span className="item-label">{t.sidebar.trash}</span>
          {trashCount > 0 && (
            <div className="cyber-badge trash-badge" style={{ fontSize: 9, padding: '1px 4px' }}>
              {formatNum(trashCount)}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Folders */}
        {sortedFolders.map((folder) => (
          <React.Fragment key={folder.id}>
            <FolderSection
              folder={folder}
              feeds={sortedFeeds.filter((f) => f.folderId === folder.id)}
              collapsed={collapsed.has(folder.id)}
              onToggle={toggleFolder}
              selectedFeedId={selectedFeedId}
              contextActive={ctx?.type === 'folder' && ctx.id === folder.id}
              contextFeedId={ctx?.type === 'feed' ? ctx.id : null}
              refreshingFolder={refreshingFolderIds.has(folder.id)}
              refreshingFeedIds={refreshingFeedIds}
              onSelect={selectFeed}
              unreadCounts={unreadCounts}
              articleCounts={articleCounts}
              onContextMenu={(e, type, id) => {
                e.preventDefault()
                window.dispatchEvent(
                  new CustomEvent('cyberfeeds:close-context-menus', { detail: 'sidebar' })
                )
                setCtx({ x: e.clientX, y: e.clientY, type, id })
              }}
            />
          </React.Fragment>
        ))}

        {/* Unfiled */}
        {unfiledFeeds.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {unfiledFeeds.map((feed) => (
              <FeedItem
                key={feed.id}
                feed={feed}
                selected={selectedFeedId === feed.id}
                contextActive={ctx?.type === 'feed' && ctx.id === feed.id}
                refreshing={refreshingFeedIds.has(feed.id)}
                onSelect={selectFeed}
                unread={unreadCounts[feed.id] || 0}
                total={articleCounts[feed.id] || 0}
                onContextMenu={(e, id) => {
                  e.preventDefault()
                  window.dispatchEvent(
                    new CustomEvent('cyberfeeds:close-context-menus', { detail: 'sidebar' })
                  )
                  setCtx({ x: e.clientX, y: e.clientY, type: 'feed', id })
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions — single row */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border-muted)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Toggle All Expand/Collapse */}
          <Tooltip
            label={collapsed.size > 0 ? t.sidebar.expandAll : t.sidebar.collapseAll}
            placement="top"
          >
            <button
              className="add-feed-btn"
              style={{ flex: 0, padding: '6px 8px' }}
              onClick={toggleAll}
            >
              {collapsed.size > 0 ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
            </button>
          </Tooltip>

          <Tooltip label={t.sidebar.newFolder} placement="top">
            <button
              className="add-feed-btn"
              style={{ flex: 0, padding: '6px 8px' }}
              onClick={handleAddFolder}
            >
              <FolderPlus size={13} />
            </button>
          </Tooltip>

          <button className="add-feed-btn sidebar-add-feed" style={{ flex: 1 }} onClick={() => openPanel('addFeed')}>
            <Plus size={13} />
            <span>{t.sidebar.addFeed}</span>
          </button>
          <Tooltip label={t.sidebar.importOpml} placement="top">
            <button
              className="add-feed-btn"
              style={{ flex: 0, padding: '6px 8px' }}
              onClick={handleImportOpml}
              disabled={importing}
            >
              {importing ? (
                <div className="spinner" style={{ width: 12, height: 12 }} />
              ) : (
                <Download size={13} />
              )}
            </button>
          </Tooltip>
          <Tooltip label={t.sidebar.exportOpml} placement="top">
            <button
              className="add-feed-btn"
              style={{ flex: 0, padding: '6px 8px' }}
              onClick={() => window.api.exportOpml()}
            >
              <Upload size={13} />
            </button>
          </Tooltip>
          <Tooltip label={t.sidebar.feedsDoctor} placement="top">
            <button
              className="add-feed-btn"
              style={{ flex: 0, padding: '6px 8px' }}
              onClick={() => openPanel('doctor')}
            >
              <Stethoscope size={13} />
            </button>
          </Tooltip>
        </div>

        {importMsg && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--green)',
              textAlign: 'center',
              padding: '4px 0',
              marginTop: 2
            }}
          >
            {importMsg}
          </div>
        )}
      </div>

      {ctx && (
        <div
          ref={ctxMenuRef}
          className="ctx-menu"
          style={{
            left: ctxMenuPosition?.left ?? ctx.x,
            top: ctxMenuPosition?.top ?? ctx.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctx.type === 'smart' ? (
            <>
              {(ctx.id === 'all' || ctx.id === 'unread' || ctx.id === 'read') && (
                <div
                  className="ctx-item"
                  onClick={() => {
                    void fetchAll()
                    setCtx(null)
                  }}
                >
                  <RefreshCw size={14} />
                  {t.topBar.refreshAll}
                </div>
              )}
              {ctx.id !== 'read' && (
                <div
                  className="ctx-item"
                  onClick={() => {
                    void markAllFilteredRead(ctx.id === 'starred')
                    setCtx(null)
                  }}
                >
                  <CheckCheck size={14} />
                  {t.articleList.contextMenu.markAllAsRead}
                </div>
              )}
              {ctx.id === 'starred' && (
                <>
                  <div
                    className="ctx-item"
                    onClick={async () => {
                      const confirmed = await confirm({
                        title: t.articleList.dialogs.removeAllFavoritesTitle,
                        message: t.articleList.dialogs.removeAllFavoritesMsg,
                        confirmText: t.articleList.dialogs.removeAllFavoritesBtn,
                        cancelText: t.sidebar.cancel,
                        variant: 'warning'
                      })
                      if (confirmed) {
                        await unstarAllArticles()
                      }
                      setCtx(null)
                    }}
                  >
                    <Star size={14} />
                    {t.articleList.contextMenu.removeAllFavorites}
                  </div>
                  <div className="ctx-divider" />
                </>
              )}
              {(ctx.id === 'all' || ctx.id === 'starred') && (
                <div
                  className="ctx-item danger"
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: t.articleList.dialogs.deleteAllTitle,
                      message: t.articleList.dialogs.deleteAllMsg,
                      confirmText: t.articleList.dialogs.deleteAllBtn,
                      cancelText: t.sidebar.cancel,
                      variant: 'danger'
                    })
                    if (confirmed) {
                      await deleteAllActiveArticles(ctx.id === 'starred')
                    }
                    setCtx(null)
                  }}
                >
                  <Trash2 size={14} />
                  {t.articleList.contextMenu.deleteAllArticles}
                </div>
              )}
            </>
          ) : ctx.type === 'trash' ? (
            <>
              <div
                className="ctx-item"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: t.articleList.dialogs.restoreAllTrashTitle,
                    message: t.articleList.dialogs.restoreAllTrashMsg,
                    confirmText: t.articleList.dialogs.restoreAllTrashBtn,
                    cancelText: t.sidebar.cancel,
                    variant: 'warning'
                  })
                  if (confirmed) {
                    await restoreAllTrash()
                  }
                  setCtx(null)
                }}
              >
                <RefreshCw size={14} />
                {t.articleList.contextMenu.restoreAllTrash}
              </div>
              <div
                className="ctx-item danger"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: t.articleList.dialogs.emptyTrashTitle,
                    message: t.articleList.dialogs.emptyTrashMsg,
                    confirmText: t.articleList.dialogs.emptyTrashBtn,
                    cancelText: t.sidebar.cancel,
                    variant: 'danger'
                  })
                  if (confirmed) {
                    await emptyTrash()
                  }
                  setCtx(null)
                }}
              >
                <Trash2 size={14} />
                {t.articleList.contextMenu.emptyTrash}
              </div>
            </>
          ) : ctx.type === 'feed' ? (
            <>
              <div
                className="ctx-item"
                onClick={() => {
                  void handleRefreshFeed(ctx.id)
                  setCtx(null)
                }}
              >
                <RefreshCw size={14} />
                {t.sidebar.refreshFeed}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  openPanel('editFeed', ctx.id)
                  setCtx(null)
                }}
              >
                <Pencil size={14} />
                {t.sidebar.editFeed}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  togglePauseFeed(ctx.id)
                  setCtx(null)
                }}
              >
                {feeds.find((f) => f.id === ctx.id)?.disabled ? (
                  <>
                    <Play size={14} />
                    {t.sidebar.resumeFeed}
                  </>
                ) : (
                  <>
                    <Pause size={14} />
                    {t.sidebar.pauseFeed}
                  </>
                )}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  const muted = mutedIds.has(ctx.id)
                  setFeedNotificationMuted([ctx.id], !muted)
                  setCtx(null)
                }}
              >
                {mutedIds.has(ctx.id) ? (
                  <>
                    <Bell size={14} />
                    {t.sidebar.unmuteFeed}
                  </>
                ) : (
                  <>
                    <BellOff size={14} />
                    {t.sidebar.muteFeed}
                  </>
                )}
              </div>
              {(articleCounts[ctx.id] || 0) > 0 && (
                <div
                  className="ctx-item danger"
                  onClick={async () => {
                    const feed = feeds.find((f) => f.id === ctx.id)
                    const count = articleCounts[ctx.id] || 0
                    if (feed) {
                      const confirmed = await confirm({
                        title: t.sidebar.moveFeedArticlesTitle,
                        message: t.sidebar.moveFeedArticlesMsg
                          .replace('{count}', formatNum(count))
                          .replace('{title}', feed.title),
                        confirmText: t.sidebar.moveFeedArticlesBtn,
                        cancelText: t.sidebar.cancel,
                        variant: 'danger'
                      })
                      if (confirmed) {
                        await deleteAllFilteredArticles({ feedId: ctx.id })
                      }
                    }
                    setCtx(null)
                  }}
                >
                  <Trash2 size={14} />
                  {t.sidebar.moveFeedArticlesToTrash.replace(
                    '{count}',
                    formatNum(articleCounts[ctx.id] || 0)
                  )}
                </div>
              )}
              <div className="ctx-divider" />
              <div
                className="ctx-item danger"
                onClick={async () => {
                  const feed = feeds.find((f) => f.id === ctx.id)
                  if (feed) {
                    const confirmed = await confirm({
                      title: t.sidebar.deleteFeedTitle,
                      message: t.sidebar.deleteFeedMsg.replace('{title}', feed.title),
                      confirmText: t.sidebar.delete,
                      cancelText: t.sidebar.cancel,
                      variant: 'danger'
                    })
                    if (confirmed) {
                      await deleteFeed(ctx.id)
                    }
                  }
                  setCtx(null)
                }}
              >
                <Trash2 size={14} />
                {t.sidebar.deleteFeed}
              </div>
            </>
          ) : (
            <>
              <div
                className="ctx-item"
                onClick={() => {
                  void handleRefreshFolder(ctx.id)
                  setCtx(null)
                }}
              >
                <RefreshCw size={14} />
                {t.sidebar.refreshFolder}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  openPanel('editFolder', ctx.id)
                  setCtx(null)
                }}
              >
                <Pencil size={14} />
                {t.sidebar.renameFolder}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  togglePauseFolder(ctx.id)
                  setCtx(null)
                }}
              >
                {feeds.filter((f) => f.folderId === ctx.id)[0]?.disabled ? (
                  <>
                    <Play size={14} />
                    {t.sidebar.resumeFolder}
                  </>
                ) : (
                  <>
                    <Pause size={14} />
                    {t.sidebar.pauseFolder}
                  </>
                )}
              </div>
              {feeds.filter((f) => f.folderId === ctx.id).length > 0 && (
                <div
                  className="ctx-item"
                  onClick={() => {
                    const folderFeeds = feeds.filter((f) => f.folderId === ctx.id)
                    const allMuted = folderFeeds.every((f) => mutedIds.has(f.id))
                    setFeedNotificationMuted(folderFeeds.map((f) => f.id), !allMuted)
                    setCtx(null)
                  }}
                >
                  {feeds.filter((f) => f.folderId === ctx.id).every((f) => mutedIds.has(f.id)) ? (
                    <>
                      <Bell size={14} />
                      {t.sidebar.unmuteFolder}
                    </>
                  ) : (
                    <>
                      <BellOff size={14} />
                      {t.sidebar.muteFolder}
                    </>
                  )}
                </div>
              )}
              <div className="ctx-divider" />
              <div
                className="ctx-item danger"
                onClick={async () => {
                  const folder = folders.find((f) => f.id === ctx.id)
                  if (folder) {
                    const confirmed = await confirm({
                      title: t.sidebar.deleteFolderTitle,
                      message: t.sidebar.deleteFolderMsg.replace('{name}', folder.name),
                      confirmText: t.sidebar.delete,
                      cancelText: t.sidebar.cancel,
                      variant: 'danger'
                    })
                    if (confirmed) {
                      await deleteFolder(ctx.id)
                    }
                  }
                  setCtx(null)
                }}
              >
                <Trash2 size={14} />
                {t.sidebar.deleteFolder}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
})

interface FolderSectionProps {
  folder: Folder
  feeds: Feed[]
  collapsed: boolean
  onToggle: (id: string) => void
  selectedFeedId: string | null
  contextActive: boolean
  contextFeedId: string | null
  refreshingFolder: boolean
  refreshingFeedIds: Set<string>
  onSelect: (id: string | null) => void
  unreadCounts: Record<string, number>
  articleCounts: Record<string, number>
  onContextMenu: (e: React.MouseEvent, type: 'feed' | 'folder', id: string) => void
}

const FolderSection = memo(function FolderSection({
  folder,
  feeds,
  collapsed,
  onToggle,
  selectedFeedId,
  contextActive,
  contextFeedId,
  refreshingFolder,
  refreshingFeedIds,
  onSelect,
  unreadCounts,
  articleCounts,
  onContextMenu
}: FolderSectionProps) {
  const { t } = useTranslation()
  const folderUnread = feeds.reduce((sum, f) => sum + (unreadCounts[f.id] || 0), 0)
  const folderTotal = feeds.reduce((sum, f) => sum + (articleCounts[f.id] || 0), 0)

  return (
    <div>
      <div
        className={`folder-header ${contextActive ? 'context-active' : ''}`}
        onClick={() => onToggle(folder.id)}
        onContextMenu={(e) => onContextMenu(e, 'folder', folder.id)}
      >
        {refreshingFolder ? (
          <RefreshCw className="feed-refresh-icon" size={14} />
        ) : collapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
        <span className="folder-name">{folder.name}</span>
        {folderUnread > 0 && (
          <Tooltip label={formatCountBreakdown(folderUnread, folderTotal, t)} placement="right">
            <div className="cyber-badge folder-badge">{formatNum(folderUnread)}</div>
          </Tooltip>
        )}
      </div>
      {!collapsed &&
        feeds.map((feed) => (
          <FeedItem
            key={feed.id}
            feed={feed}
            selected={selectedFeedId === feed.id}
            contextActive={contextFeedId === feed.id}
            refreshing={refreshingFolder || refreshingFeedIds.has(feed.id)}
            onSelect={onSelect}
            unread={unreadCounts[feed.id] || 0}
            total={articleCounts[feed.id] || 0}
            onContextMenu={(e, id) => onContextMenu(e, 'feed', id)}
            indent
          />
        ))}
    </div>
  )
})

interface FeedItemProps {
  feed: Feed
  selected: boolean
  contextActive: boolean
  refreshing: boolean
  onSelect: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, feedId: string) => void
  unread: number
  total: number
  indent?: boolean
}

const FeedItem = memo(function FeedItem({
  feed,
  selected,
  contextActive,
  refreshing,
  onSelect,
  onContextMenu,
  unread,
  total,
  indent
}: FeedItemProps) {
  const { t } = useTranslation()
  const muted = useSettingsStore((s) => (s.settings.notifications.feedFilters ?? []).includes(feed.id))
  const extras = [
    feed.disabled ? t.articleList.paused.toLowerCase() : '',
    muted ? t.sidebar.muted : ''
  ].filter(Boolean)
  return (
    <Tooltip
      label={feed.title + (extras.length ? ` (${extras.join(', ')})` : '')}
      placement="right"
    >
      <div
        className={`sidebar-item ${selected ? 'active' : ''} ${contextActive ? 'context-active' : ''} ${feed.disabled ? 'paused' : ''}`}
        style={indent ? { paddingLeft: 24 } : undefined}
        onClick={() => onSelect(feed.id)}
        onContextMenu={(e) => onContextMenu?.(e, feed.id)}
      >
        {/* Favicon BEFORE title, with colored letter fallback */}
        <div style={{ opacity: feed.disabled ? 0.5 : 1 }}>
          {refreshing ? (
            <RefreshCw className="feed-refresh-icon" size={15} />
          ) : (
            <FeedFavicon icon={feed.icon} title={feed.title} size={15} />
          )}
        </div>
        <span
          className="item-label"
          style={{
            fontStyle: feed.disabled ? 'italic' : 'normal',
            opacity: feed.disabled ? 0.6 : 1
          }}
        >
          {feed.title}
        </span>
        {muted && (
          <BellOff size={12} className="feed-mute-icon" />
        )}
        {unread > 0 && (
          <Tooltip label={formatCountBreakdown(unread, total, t)} placement="right">
            <div
              className="cyber-badge"
              style={{ fontSize: 9, padding: '1px 4px', opacity: feed.disabled ? 0.5 : 1 }}
            >
              {formatNum(unread)}
            </div>
          </Tooltip>
        )}
      </div>
    </Tooltip>
  )
})

export default Sidebar
