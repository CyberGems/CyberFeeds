import React, { memo, useRef, useCallback, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Star,
  Library,
  Mail,
  MailOpen,
  Search,
  ChevronDown,
  ArrowUp,
  Circle,
  CircleDot,
  Link2,
  Image,
  ExternalLink,
  Trash2,
  CheckCheck,
  RefreshCw,
  Pause,
  Play,
  X,
  Plus,
  Download,
  Clock
} from 'lucide-react'
import logoPng from '../../../../resources/icon.png'
import { useArticlesStore } from '../store/articles.store'
import { useUIStore } from '../store/ui.store'
import { useFeedsStore } from '../store/feeds.store'
import { useSettingsStore } from '../store/settings.store'
import { useConfirm } from '../hooks/useConfirm'
import ConfirmDialog from './ConfirmDialog'
import type { Article } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'
import { copyArticleImage, featuredThumbImg } from '../lib/copyImage'

function formatDate(ts: number, t: any): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = diffMs / 3600000
  const formatTimeAgo = (val: number, str: string): string =>
    str.includes('{num}') ? str.replace('{num}', String(val)) : `${val}${str}`

  if (diffH < 1)
    return formatTimeAgo(Math.max(1, Math.round(diffMs / 60000)), t.articleList.timeAgo.mAgo)
  if (diffH < 24) return formatTimeAgo(Math.round(diffH), t.articleList.timeAgo.hAgo)
  if (diffH < 48) return t.articleList.yesterday
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Feed favicon with graceful letter-avatar fallback */
const FeedFavicon = memo(function FeedFavicon({
  icon,
  title,
  size = 16
}: {
  icon?: string
  title?: string
  size?: number
}) {
  // Retry medicine: if the network is temporarily down, don't permanently fall back.
  const [, setAttempt] = React.useState(0)
  const [failed, setFailed] = React.useState(false)
  const [retryToken, setRetryToken] = React.useState(0)

  const retryTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const MAX_ATTEMPTS = 5
  const BACKOFF_MS = [10_000, 30_000, 90_000, 180_000, 300_000] // 10s/30s/1.5m/3m/5m

  React.useEffect(() => {
    // Reset when icon changes
    setAttempt(0)
    setFailed(false)
    setRetryToken(0)
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [icon])

  React.useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [])

  const letter = (title || '?').charAt(0).toUpperCase()
  const colors = [
    '#58a6ff',
    '#3fb950',
    '#d29922',
    '#f0883e',
    '#bc8cff',
    '#39d353',
    '#e3b341',
    '#ff7b72'
  ]
  const color = colors[letter.charCodeAt(0) % colors.length]

  const avatarStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 3,
    background: color,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.max(8, size * 0.6),
    fontWeight: 700,
    color: '#0d1117',
    flexShrink: 0,
    lineHeight: 1,
    userSelect: 'none'
  }

  const resolvedSrc = React.useMemo(() => {
    if (!icon) return undefined
    // Data URLs (e.g. bundled suite icons) must be used as-is: appending a
    // query string corrupts the base64 payload and breaks the image.
    if (icon.startsWith('data:')) return icon
    // Ensure retries don't get stuck on a cached failure: add a busting query using retryToken and timestamp.
    const sep = icon.includes('?') ? '&' : '?'
    const ts = Date.now()
    return `${icon}${sep}bb_retry=${retryToken}&t=${ts}`
  }, [icon, retryToken])

  const scheduleRetry = React.useCallback(
    (nextAttempt: number) => {
      if (!icon) return
      if (nextAttempt >= MAX_ATTEMPTS) return

      const delay =
        BACKOFF_MS[Math.min(nextAttempt - 1, BACKOFF_MS.length - 1)] ??
        BACKOFF_MS[BACKOFF_MS.length - 1]

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }

      retryTimeoutRef.current = setTimeout(() => {
        setFailed(false)
        setRetryToken((t) => t + 1)
      }, delay)
    },
    [icon]
  )

  if (!icon || failed) {
    // While retrying we show the letter avatar, but we will flip back to img on a successful later load.
    return <span style={avatarStyle}>{letter}</span>
  }

  return (
    <img
      src={resolvedSrc}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 3, objectFit: 'contain', flexShrink: 0, display: 'block' }}
      onError={() => {
        setAttempt((a) => {
          const next = a + 1
          setFailed(true)
          scheduleRetry(next)
          return next
        })
      }}
      onLoad={() => {
        // If it finally loads, stop falling back.
        setFailed(false)
        setAttempt(0)
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }
      }}
    />
  )
})

const formatNum = (val: number): string => String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const ArticleList = memo(function ArticleList(): JSX.Element {
  const {
    articles,
    totalCount,
    incomingCount,
    applyIncomingArticles,
    refresh: refreshArticles,
    loading,
    loadingMore,
    loadMore,
    deleteArticle,
    deleteAllFilteredArticles,
    restoreArticle,
    purgeArticle,
    emptyTrash,
    removeArticleFromList,
    markRead
  } = useArticlesStore()
  const {
    selectedArticleId,
    selectedFeedId,
    unreadOnly,
    readOnly,
    search,
    selectArticle,
    setUnreadOnly,
    setReadOnly,
    setSearch,
    isFetching,
    pendingFeedId,
    quickFilter,
    setQuickFilter
  } = useUIStore()
  const [ctx, setCtx] = React.useState<{ x: number; y: number; id: string } | null>(null)
  const [windowFocused, setWindowFocused] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : true
  )
  const {
    feeds,
    folders,
    unreadCounts,
    loading: feedsLoading,
    loadAll,
    fetchAll,
    fetchFeed,
    fetchFolder
  } = useFeedsStore()
  const { settings, togglePolling } = useSettingsStore()
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState(search)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [importingOpml, setImportingOpml] = useState(false)
  const [opmlMessage, setOpmlMessage] = useState('')
  const parentRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const prevSelectedId = useRef<string | null>(null)
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm()

  // Keep local search input synchronized when store's search resets (e.g. on feed switch)
  useEffect(() => {
    setSearchInput(search)
  }, [search])

  // Auto-remove articles that no longer match the active read-state filter
  // when moving to the next article.
  // Read latest articles from the store so this does not re-fire on every list mutation.
  useEffect(() => {
    if (
      (unreadOnly || readOnly) &&
      prevSelectedId.current &&
      prevSelectedId.current !== selectedArticleId
    ) {
      const prevId = prevSelectedId.current
      const art = useArticlesStore.getState().articles.find((a) => a.id === prevId)
      if (art && ((unreadOnly && art.read) || (readOnly && !art.read))) {
        removeArticleFromList(prevId)
      }
    }
    prevSelectedId.current = selectedArticleId
  }, [selectedArticleId, unreadOnly, readOnly, removeArticleFromList])

  const isTrash = selectedFeedId === 'trash'

  const deleteArticleAndAdvance = useCallback(async (id: string) => {
    const list = useArticlesStore.getState().articles
    const selected = useUIStore.getState().selectedArticleId
    const idx = list.findIndex((a) => a.id === id)
    if (idx < 0) return
    if (isTrash) {
      const article = list[idx]
      const confirmed = await confirm({
        title: t.articleList.dialogs.deletePermanentlyTitle,
        message: t.articleList.dialogs.deletePermanentlyMsg.replace('{title}', article.title),
        confirmText: t.articleList.dialogs.deletePermanentlyBtn,
        cancelText: t.sidebar.cancel,
        variant: 'danger'
      })
      if (!confirmed) return
    }
    const nextId = selected === id ? (list[idx + 1]?.id ?? list[idx - 1]?.id ?? null) : undefined
    void (isTrash ? purgeArticle(id) : deleteArticle(id))
    if (selected === id) useUIStore.getState().selectArticle(nextId ?? null)
  }, [confirm, deleteArticle, isTrash, purgeArticle, t])

  const restoreArticleAndAdvance = useCallback((id: string) => {
    const list = useArticlesStore.getState().articles
    const selected = useUIStore.getState().selectedArticleId
    const idx = list.findIndex((a) => a.id === id)
    if (idx < 0) return
    const nextId = selected === id ? (list[idx + 1]?.id ?? list[idx - 1]?.id ?? null) : undefined
    void restoreArticle(id)
    if (selected === id) useUIStore.getState().selectArticle(nextId ?? null)
  }, [restoreArticle])

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId)
  const selectedFolder = selectedFeedId?.startsWith('folder:')
    ? folders.find((folder) => folder.id === selectedFeedId.slice('folder:'.length))
    : undefined
  const isLoadingNewFeed = Boolean(pendingFeedId) && pendingFeedId === selectedFeedId && articles.length === 0
  const isEmptyLibrary = !feedsLoading && feeds.length === 0 && selectedFeedId === null
  const isAllArticles = selectedFeedId === null && !unreadOnly && !readOnly
  const isUnreadArticles = selectedFeedId === null && unreadOnly
  const isReadArticles = selectedFeedId === null && readOnly

  const handleImportOpml = useCallback(async (): Promise<void> => {
    setImportingOpml(true)
    setOpmlMessage('')
    try {
      const result = await window.api.importOpml()
      if (result.canceled) return

      await loadAll()
      setOpmlMessage(`✓ ${result.added} ${t.sidebar.feedsAdded}`)
      setTimeout(() => setOpmlMessage(''), 3000)
    } catch (error) {
      console.error('[Feeds] OPML import failed:', error)
      setOpmlMessage(t.sidebar.importFailed)
      setTimeout(() => setOpmlMessage(''), 3000)
    } finally {
      setImportingOpml(false)
    }
  }, [loadAll, t])

  const title =
    selectedFeedId === 'starred'
      ? t.articleList.favorites
      : isTrash
        ? t.articleList.trash
        : isUnreadArticles
          ? t.articleList.unreadArticles
          : isReadArticles
            ? t.articleList.readArticles
            : selectedFeed?.title || t.articleList.allFeeds
  const badgeScopeName =
    selectedFeed?.title ||
    selectedFolder?.name ||
    (isTrash
      ? t.articleList.trash
      : selectedFeedId === 'starred'
        ? t.articleList.favorites
        : t.articleList.allFeeds)
  const badgeCanToggle = !isTrash
  const badgeTooltip = badgeCanToggle
    ? selectedFeedId === null
      ? unreadOnly || readOnly
        ? t.articleList.showAllArticles
        : t.articleList.showAllUnreadArticles
      : (
          unreadOnly || readOnly ? t.articleList.showAllFor : t.articleList.showUnreadFor
        ).replace('{feed}', badgeScopeName)
    : t.articleList.showingFilter.replace('{filter}', badgeScopeName)
  const updatesHeldBack =
    settings.pollingEnabled && Boolean(settings.pollOnlyWhenUnfocused) && windowFocused
  const monitoringTooltip = !settings.pollingEnabled
    ? t.articleList.monitoringPaused
    : updatesHeldBack
      ? t.articleList.monitoringHeld
      : t.articleList.monitoringActive

  const handleRefresh = useCallback(async (): Promise<void> => {
    useUIStore.setState({ isFetching: true })
    try {
      if (selectedFolder) {
        await fetchFolder(selectedFolder.id)
      } else if (selectedFeed) {
        await fetchFeed(selectedFeed.id)
      } else {
        await fetchAll()
      }
      await refreshArticles()
    } finally {
      setTimeout(() => useUIStore.setState({ isFetching: false }), 800)
    }
  }, [selectedFolder, selectedFeed, fetchFolder, fetchFeed, fetchAll, refreshArticles])

  const refreshTooltip = React.useMemo(() => {
    if (selectedFolder) {
      return t.articleList.refreshFolder.replace('{folder}', selectedFolder.name)
    }
    if (selectedFeed) {
      return t.articleList.refreshFeed.replace('{feed}', selectedFeed.title)
    }
    return t.articleList.refreshAllFeeds || t.topBar.refreshAll
  }, [selectedFolder, selectedFeed, t])

  const unreadDisplayCount = React.useMemo(() => {
    if (selectedFeedId === 'starred' || isTrash) return totalCount
    if (selectedFeedId === null) {
      return Object.entries(unreadCounts)
        .filter(([k]) => k !== 'starred' && k !== 'all')
        .reduce((a, [, b]) => a + b, 0)
    }
    if (selectedFeedId.startsWith('folder:')) {
      const folderId = selectedFeedId.split(':')[1]
      const folderFeeds = feeds.filter((f) => f.folderId === folderId)
      return folderFeeds.reduce((sum, f) => sum + (unreadCounts[f.id] || 0), 0)
    }
    return unreadCounts[selectedFeedId || ''] || 0
  }, [selectedFeedId, unreadCounts, totalCount, feeds, isTrash])

  const viewingFolderId = selectedFeedId?.startsWith('folder:')
    ? selectedFeedId.slice('folder:'.length)
    : null
  const folderNameByFeedId = React.useMemo(() => {
    const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]))
    const map = new Map<string, string>()
    for (const feed of feeds) {
      if (!feed.folderId || feed.folderId === viewingFolderId) continue
      const name = folderNameById.get(feed.folderId)
      if (name) map.set(feed.id, name)
    }
    return map
  }, [feeds, folders, viewingFolderId])

  const ITEM_H = 120
  const ITEM_H_WITH_THUMB = 230

  const measuredHeightsRef = useRef<Map<string, number>>(new Map())

  const getItemKey = useCallback(
    (index: number) => articles[index]?.id ?? String(index),
    [articles]
  )

  const estimateSize = useCallback(
    (index: number) => {
      const article = articles[index]
      if (!article) return ITEM_H
      const cached = measuredHeightsRef.current.get(article.id)
      if (cached != null) return cached
      if (article.thumbnail && settings.showArticleThumbnails) return ITEM_H_WITH_THUMB
      return ITEM_H
    },
    [articles, settings.showArticleThumbnails]
  )

  const rowVirtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => parentRef.current,
    getItemKey,
    estimateSize,
    overscan: 8,
    // Never persist a 0px row. Hidden Electron windows can layout at height 0;
    // protect against zero measurements corrupting the item heights.
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height
      const index = Number(element.getAttribute('data-index'))
      const article = Number.isFinite(index) ? articles[index] : undefined

      if (height > 1) {
        const rounded = Math.round(height)
        if (article) measuredHeightsRef.current.set(article.id, rounded)
        return rounded
      }

      const cached = article ? measuredHeightsRef.current.get(article.id) : undefined
      if (cached != null) return cached
      if (article?.thumbnail && settings.showArticleThumbnails) return ITEM_H_WITH_THUMB
      return ITEM_H
    }
  })

  useEffect(() => {
    const handleFocusChange = (): void => {
      setWindowFocused(document.hasFocus())
    }
    const handleFocus = (): void => {
      setWindowFocused(true)
    }
    const handleBlur = (): void => {
      setWindowFocused(false)
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleFocusChange)
    window.addEventListener('resize', handleFocusChange)
    const unsubShown = window.api.onWindowShown(() => {
      setWindowFocused(document.hasFocus())
    })
    const unsubHidden = window.api.onWindowHidden(() => setWindowFocused(false))
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleFocusChange)
      window.removeEventListener('resize', handleFocusChange)
      unsubShown()
      unsubHidden()
    }
  }, [])

  // Keep keyboard/context-menu navigation visible when the selected article changes.
  // Only scroll when selectedArticleId changes to a new ID, NOT on background data refreshes!
  const prevSelectedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedArticleId || loading) {
      prevSelectedRef.current = selectedArticleId
      return
    }
    if (prevSelectedRef.current === selectedArticleId) return
    prevSelectedRef.current = selectedArticleId

    const index = articles.findIndex((article) => article.id === selectedArticleId)
    if (index < 0) return

    const scrollElement = parentRef.current
    if (!scrollElement) return

    const item = rowVirtualizer.getVirtualItems().find((virtualItem) => virtualItem.index === index)
    const viewportTop = scrollElement.scrollTop
    const viewportBottom = viewportTop + scrollElement.clientHeight
    if (!item || item.start < viewportTop || item.end > viewportBottom) {
      rowVirtualizer.scrollToIndex(index, { align: 'auto' })
    }
  }, [articles, loading, rowVirtualizer, selectedArticleId])

  // Count of articles below the current viewport, and whether to offer "back to top".
  const [belowCount, setBelowCount] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const rafRef = useRef<number | undefined>(undefined)

  const computeScrollState = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    const bottom = el.scrollTop + el.clientHeight
    let lastVisible = -1
    for (const it of rowVirtualizer.getVirtualItems()) {
      if (it.start < bottom) lastVisible = Math.max(lastVisible, it.index)
    }
    setBelowCount(lastVisible < 0 ? 0 : Math.max(0, totalCount - (lastVisible + 1)))
    setShowScrollTop(el.scrollTop > 400)
  }, [rowVirtualizer, totalCount])

  const handleListScroll = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = undefined
      computeScrollState()
    })
  }, [computeScrollState])

  const scrollToTop = useCallback(() => {
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleApplyIncoming = useCallback(async () => {
    scrollToTop()
    await applyIncomingArticles()
  }, [applyIncomingArticles, scrollToTop])

  const pillLabel =
    incomingCount === 1
      ? t.articleList.newArticlePill
      : t.articleList.newArticlesPill.replace('{count}', String(incomingCount))

  // Recompute when the dataset changes (feed switch, load-more, filter) — not per render.
  useEffect(() => {
    computeScrollState()
  }, [totalCount, articles.length, loading, computeScrollState])
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  const virtualItems = rowVirtualizer.getVirtualItems()
  const lastVirtualIndex =
    virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1

  // Trigger loadMore only when reaching the end of the loaded articles list.
  useEffect(() => {
    if (
      lastVirtualIndex >= 0 &&
      lastVirtualIndex >= articles.length - 10 &&
      !loadingMore &&
      totalCount > articles.length
    ) {
      loadMore()
    }
  }, [lastVirtualIndex, articles.length, loadingMore, totalCount, loadMore])

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearchInput(val)
      if (settings.instantSearch) {
        clearTimeout(searchRef.current)
        searchRef.current = setTimeout(() => setSearch(val), 300)
      }
    },
    [settings.instantSearch, setSearch]
  )

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        clearTimeout(searchRef.current)
        setSearch(searchInput.trim())
      } else if (e.key === 'Escape') {
        e.preventDefault()
        clearTimeout(searchRef.current)
        setSearchInput('')
        setSearch('')
        e.currentTarget.blur()
      }
    },
    [searchInput, setSearch]
  )

  const handleClearSearch = useCallback(() => {
    clearTimeout(searchRef.current)
    setSearchInput('')
    setSearch('')
  }, [setSearch])

  useEffect(() => {
    const handleUp = () => setCtx(null)
    const handleOtherMenu = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== 'articleList') setCtx(null)
    }
    window.addEventListener('click', handleUp)
    window.addEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    return () => {
      window.removeEventListener('click', handleUp)
      window.removeEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    }
  }, [])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    }

    const selectByIndex = (index: number): void => {
      const list = useArticlesStore.getState().articles
      const next = list[index]
      if (!next) return
      useUIStore.getState().selectArticle(next.id)
      if (!isTrash && !next.deletedAt && !next.read) {
        void markRead(next.id, true)
      }
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (useUIStore.getState().activePanel) return
      if (confirmState.isOpen) return

      const inArticleSearch =
        e.target instanceof HTMLElement && Boolean(e.target.closest('[data-article-search="true"]'))
      if (isEditableTarget(e.target) && !inArticleSearch) return
      if (inArticleSearch && e.key !== 'ArrowDown' && e.key !== 'Enter') return

      if (e.key === 'Delete') {
        if (e.repeat) return
        const id = useUIStore.getState().selectedArticleId
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        deleteArticleAndAdvance(id)
        return
      }

      const keyLower = e.key.toLowerCase()

      // Toggle read / unread with M
      if (keyLower === 'm') {
        if (e.repeat) return
        const selected = useUIStore.getState().selectedArticleId
        const list = useArticlesStore.getState().articles
        if (list.length === 0) return
        const targetId = selected || list[0]?.id
        if (!targetId) return
        const article = list.find((a) => a.id === targetId)
        if (!article) return

        e.preventDefault()
        e.stopPropagation()
        void markRead(targetId, !article.read)
        return
      }

      // Open / focus reading with Enter
      if (e.key === 'Enter') {
        if (e.repeat) return
        const list = useArticlesStore.getState().articles
        if (list.length === 0) return

        e.preventDefault()
        e.stopPropagation()

        if (inArticleSearch) {
          ;(e.target as HTMLElement).blur()
          selectByIndex(0)
          return
        }

        const selected = useUIStore.getState().selectedArticleId
        if (!selected) {
          selectByIndex(0)
          return
        }

        const article = list.find((a) => a.id === selected)
        if (article && !article.read && !isTrash) {
          void markRead(selected, true)
        }
        const reader = document.querySelector<HTMLElement>('.viewer-content, .reader-pane, .article-viewer')
        reader?.focus?.()
        return
      }

      const isNext = e.key === 'ArrowDown' || keyLower === 'j'
      const isPrev = e.key === 'ArrowUp' || keyLower === 'k'

      if (isNext || isPrev || e.key === 'Home' || e.key === 'End') {
        const list = useArticlesStore.getState().articles
        if (list.length === 0) return

        e.preventDefault()
        e.stopPropagation()

        if (inArticleSearch) {
          ;(e.target as HTMLElement).blur()
          selectByIndex(0)
          return
        }

        // Home → first article, End → last preloaded article
        if (e.key === 'Home') {
          selectByIndex(0)
          return
        }
        if (e.key === 'End') {
          selectByIndex(list.length - 1)
          return
        }

        const selected = useUIStore.getState().selectedArticleId
        const idx = selected ? list.findIndex((a) => a.id === selected) : -1
        if (idx < 0) {
          selectByIndex(0)
          return
        }
        const nextIdx = isNext ? idx + 1 : idx - 1
        if (nextIdx < 0 || nextIdx >= list.length) return
        selectByIndex(nextIdx)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [deleteArticleAndAdvance, confirmState.isOpen, isTrash, markRead])

  return (
    <div className="article-list-pane" onContextMenu={(e) => e.preventDefault()}>
      {/* Header */}
      <div className="article-list-header">
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
          {selectedFeedId === 'starred' ? (
            <Star size={16} fill="var(--star)" color="var(--star)" style={{ marginRight: 4 }} />
          ) : isTrash ? (
            <Trash2 size={16} color="var(--accent)" style={{ marginRight: 4 }} />
          ) : isUnreadArticles ? (
            <Mail size={16} color="var(--accent)" style={{ marginRight: 4 }} />
          ) : isReadArticles ? (
            <MailOpen size={16} color="var(--accent)" style={{ marginRight: 4 }} />
          ) : isAllArticles ? (
            <Library size={16} color="var(--accent)" style={{ marginRight: 4 }} />
          ) : (
            selectedFeed?.icon && (
              <FeedFavicon icon={selectedFeed.icon} title={selectedFeed.title} size={16} />
            )
          )}
          <h2
            style={{
              marginLeft:
                selectedFeedId === 'starred' ||
                isTrash ||
                isUnreadArticles ||
                isReadArticles ||
                isAllArticles ||
                selectedFeed?.icon
                  ? 4
                  : 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {title}
          </h2>
          <Tooltip label={monitoringTooltip} placement="bottom">
            <span
              aria-label={monitoringTooltip}
              style={{
                width: 7,
                height: 7,
                marginTop: 3,
                marginLeft: 8,
                borderRadius: '50%',
                background: !settings.pollingEnabled
                  ? '#444'
                  : updatesHeldBack
                    ? 'color-mix(in srgb, var(--accent) 42%, #555)'
                    : 'var(--accent)',
                boxShadow:
                  settings.pollingEnabled && !updatesHeldBack ? '0 0 6px var(--accent)' : 'none',
                animation:
                  settings.pollingEnabled && !updatesHeldBack ? 'pulse 2s infinite' : 'none',
                flexShrink: 0
              }}
            />
          </Tooltip>
        </div>
      </div>

      {/* Search & Actions Row */}
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Tooltip
            label={settings.instantSearch ? t.articleList.searchTooltipInstant : t.articleList.searchTooltipEnter}
            placement="bottom"
          >
            <div
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                zIndex: 2
              }}
              onClick={() => {
                clearTimeout(searchRef.current)
                setSearch(searchInput.trim())
              }}
            >
              <Search size={13} />
            </div>
          </Tooltip>
          <input
            className="search-input"
            data-article-search="true"
            style={{
              paddingLeft: 28,
              paddingRight: searchInput ? 26 : 10,
              width: '100%'
            }}
            placeholder={
              !settings.instantSearch && isSearchFocused
                ? t.articleList.searchFocusedPlaceholder
                : t.articleList.searchPlaceholder
            }
            value={searchInput}
            onChange={handleSearch}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
          {searchInput ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: 5,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: 0,
                width: 18,
                height: 18,
                minWidth: 18,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%'
              }}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <Tooltip
          label={badgeTooltip}
          placement="bottom"
        >
          <div
            className={`cyber-badge no-brackets article-filter-badge${badgeCanToggle ? '' : ' is-static'}`}
            onClick={() => {
              if (!badgeCanToggle) return
              if (unreadOnly || readOnly) {
                setUnreadOnly(false)
                setReadOnly(false)
              } else {
                setReadOnly(false)
                setUnreadOnly(true)
              }
            }}
            aria-label={badgeTooltip}
            aria-disabled={!badgeCanToggle}
            style={{
              cursor: badgeCanToggle ? 'pointer' : 'default',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              padding: '3px 8px',
              height: 24,
              color: unreadOnly || readOnly ? 'var(--accent)' : undefined,
              background: unreadOnly || readOnly ? 'var(--accent-subtle)' : undefined,
              border: unreadOnly || readOnly ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)' : '1px solid transparent'
            }}
          >
            <span style={{ opacity: 0.8 }}>
              [{unreadOnly || readOnly ? formatNum(totalCount) : `${formatNum(unreadDisplayCount)} / ${formatNum(totalCount)}`}]
            </span>
          </div>
        </Tooltip>

        <Tooltip label={refreshTooltip} placement="bottom">
          <button
            className="btn btn-ghost btn-icon"
            onClick={handleRefresh}
            disabled={isFetching}
            style={{
              flexShrink: 0,
              width: 24,
              height: 24
            }}
          >
            <RefreshCw
              size={14}
              className={isFetching ? 'spin-icon' : ''}
              style={isFetching ? { animation: 'spin 0.7s linear infinite' } : {}}
            />
          </button>
        </Tooltip>

        {isTrash && (
          <Tooltip label={t.articleList.emptyTrash} placement="bottom">
            <button
              className="btn btn-ghost btn-icon"
              onClick={async () => {
                if (totalCount === 0) return
                const confirmed = await confirm({
                  title: t.articleList.dialogs.emptyTrashTitle,
                  message: t.articleList.dialogs.emptyTrashMsg,
                  confirmText: t.articleList.dialogs.emptyTrashBtn,
                  cancelText: t.sidebar.cancel,
                  variant: 'danger'
                })
                if (confirmed) {
                  await emptyTrash()
                  selectArticle(null)
                }
              }}
              style={{ flexShrink: 0, width: 24, height: 24 }}
            >
              <Trash2 size={14} />
            </button>
          </Tooltip>
        )}

        <Tooltip
          label={
            settings.pollingEnabled
              ? t.articleList.pauseAutoUpdates
              : t.articleList.resumeAutoUpdates
          }
          placement="bottom"
        >
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => togglePolling()}
            style={{
              flexShrink: 0,
              width: 24,
              height: 24
            }}
          >
            {settings.pollingEnabled ? (
              <Pause size={14} />
            ) : (
              <Play size={14} style={{ color: '#50fa7b' }} />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Quick Filter Chips Bar */}
      {!isTrash && (
        <div className="article-filter-chips-bar">
          <div className="article-filter-chips-track">
            <button
              type="button"
              className={`article-filter-chip ${quickFilter === 'all' && !unreadOnly && !readOnly ? 'active' : ''}`}
              onClick={() => {
                setUnreadOnly(false)
                setReadOnly(false)
                setQuickFilter('all')
              }}
            >
              {t.articleList.quickFilters.all}
            </button>
            <button
              type="button"
              className={`article-filter-chip ${quickFilter === 'unread' || unreadOnly ? 'active' : ''}`}
              onClick={() => {
                setReadOnly(false)
                if (quickFilter === 'unread' || unreadOnly) {
                  setUnreadOnly(false)
                  setQuickFilter('all')
                } else {
                  setUnreadOnly(true)
                  setQuickFilter('unread')
                }
              }}
            >
              {t.articleList.quickFilters.unread}
            </button>
            <button
              type="button"
              className={`article-filter-chip ${quickFilter === 'today' ? 'active' : ''}`}
              onClick={() => {
                setUnreadOnly(false)
                setReadOnly(false)
                setQuickFilter(quickFilter === 'today' ? 'all' : 'today')
              }}
            >
              <Clock size={11} />
              <span>{t.articleList.quickFilters.today}</span>
            </button>
            <button
              type="button"
              className={`article-filter-chip ${quickFilter === 'priority' ? 'active' : ''}`}
              onClick={() => {
                setUnreadOnly(false)
                setReadOnly(false)
                setQuickFilter(quickFilter === 'priority' ? 'all' : 'priority')
              }}
            >
              <Star size={11} />
              <span>{t.articleList.quickFilters.priority}</span>
            </button>
            <button
              type="button"
              className={`article-filter-chip ${quickFilter === 'video' ? 'active' : ''}`}
              onClick={() => {
                setUnreadOnly(false)
                setReadOnly(false)
                setQuickFilter(quickFilter === 'video' ? 'all' : 'video')
              }}
            >
              <Play size={11} />
              <span>{t.articleList.quickFilters.videos}</span>
            </button>
          </div>
        </div>
      )}

      {/* Scrollable list container with floating top pill */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {incomingCount > 0 && (
          <button
            type="button"
            className="new-articles-pill"
            onClick={handleApplyIncoming}
            aria-label={pillLabel}
          >
            <ArrowUp size={12} className="pill-arrow" />
            <span>{pillLabel}</span>
          </button>
        )}

        {/* Virtual list */}
        <div className="article-list-scroll" ref={parentRef} onScroll={handleListScroll}>
        {isEmptyLibrary ? (
          <div
            style={{
              minHeight: 300,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '40px 24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                color: 'var(--accent)',
                background: '#0a1420',
                border: '1px solid var(--accent)'
              }}
              aria-hidden="true"
            >
              <img
                src={logoPng}
                alt=""
                width={32}
                height={32}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 600 }}>
              {t.articleList.emptyLibraryTitle}
            </div>
            <div style={{ maxWidth: 320, lineHeight: 1.5 }}>
              {t.articleList.emptyLibraryDescription}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 6
              }}
            >
              <button className="btn btn-primary" onClick={() => useUIStore.getState().openPanel('addFeed')}>
                <Plus size={14} />
                {t.sidebar.addFeed}
              </button>
              <button className="btn btn-secondary" onClick={handleImportOpml} disabled={importingOpml}>
                {importingOpml ? (
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  <Download size={14} />
                )}
                {t.sidebar.importOpml}
              </button>
            </div>
            {opmlMessage && (
              <div role="status" aria-live="polite" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                {opmlMessage}
              </div>
            )}
          </div>
        ) : loading || isLoadingNewFeed ? (
          <div className="feed-loading-state" role="status" aria-live="polite">
            <div className="feed-loading-orbit" aria-hidden="true">
              <div className="feed-loading-orbit-dot" />
            </div>
            <div className="feed-loading-label">
              {search ? t.articleList.searchingArticles : t.articleList.loadingFeed}
            </div>
            <div className="feed-loading-skeletons" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div
            style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}
          >
            {t.articleList.noArticles}
          </div>
        ) : (
          <div className="article-virtual-inner" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const article = articles[virtualRow.index]
              if (!article) return null
              return (
                <ArticleItem
                  key={virtualRow.key}
                  article={article}
                  folderName={folderNameByFeedId.get(article.feedId)}
                  isTrash={isTrash}
                  selected={selectedArticleId === article.id}
                  contextActive={ctx?.id === article.id}
                  onSelect={selectArticle}
                  onContextMenu={(e, id) => {
                    e.preventDefault()
                    window.dispatchEvent(
                      new CustomEvent('cyberfeeds:close-context-menus', { detail: 'articleList' })
                    )
                    setCtx({ x: e.clientX, y: e.clientY, id })
                  }}
                  measureRef={rowVirtualizer.measureElement}
                  dataIndex={virtualRow.index}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                />
              )
            })}
          </div>
        )}
        {loadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <div className="spinner" />
          </div>
        )}
        </div>
      </div>

      {/* Bottom fade overlay — elegant gradient when content exceeds the viewport */}
      {!loading && articles.length > 0 && belowCount > 0 && (
        <div className="article-list-fade" />
      )}

      {/* Floating "more below" indicator — mirrors the notifier popup pill */}
      {!loading && belowCount > 0 && (
        <div className="list-more-pill">
          <ChevronDown size={10} />
          {belowCount} {t.articleList.moreBelow}
        </div>
      )}

      {/* Back-to-top button — appears once scrolled down */}
      {!loading && showScrollTop && (
        <Tooltip label={t.articleList.backToTop} placement="bottom">
          <button
            className="scroll-top-fab"
            onClick={scrollToTop}
            aria-label={t.articleList.backToTop}
          >
            <ArrowUp size={16} />
          </button>
        </Tooltip>
      )}

      {ctx &&
        (() => {
          const article = articles.find((a) => a.id === ctx.id)
          return (
            <div
              className="ctx-menu"
              style={{ left: ctx.x, top: Math.min(ctx.y, window.innerHeight - 220) }}
              onClick={(e) => e.stopPropagation()}
            >
              {article && isTrash && (
                <>
                  <div
                    className="ctx-item"
                    onClick={() => {
                      restoreArticleAndAdvance(article.id)
                      setCtx(null)
                    }}
                  >
                    <RefreshCw size={14} />
                    {t.articleList.contextMenu.restoreArticle}
                  </div>
                  <div
                    className="ctx-item danger"
                    onClick={() => {
                      deleteArticleAndAdvance(article.id)
                      setCtx(null)
                    }}
                  >
                    <Trash2 size={14} />
                    {t.articleList.contextMenu.deletePermanently}
                  </div>
                  <div className="ctx-divider" />
                </>
              )}
              {article && !isTrash && !article.deletedAt && (
                <div
                  className="ctx-item"
                  onClick={() => {
                    markRead(article.id, !article.read)
                    setCtx(null)
                  }}
                >
                  {article.read ? <CircleDot size={14} /> : <Circle size={14} />}
                  {article.read
                    ? t.articleList.contextMenu.markAsUnread
                    : t.articleList.contextMenu.markAsRead}
                </div>
              )}
              {article && (
                <>
                  <div
                    className="ctx-item"
                    onClick={() => {
                      navigator.clipboard.writeText(article.link)
                      setCtx(null)
                    }}
                  >
                    <Link2 size={14} />
                    {t.articleList.contextMenu.copyLink}
                  </div>
                  {article.thumbnail && settings.showArticleThumbnails && (
                    <div
                      className="ctx-item"
                      onClick={() => {
                        const articleId = article.id
                        const url = article.thumbnail
                        setCtx(null)
                        void copyArticleImage({ img: featuredThumbImg(articleId), url })
                      }}
                    >
                      <Image size={14} />
                      {t.articleList.contextMenu.copyImage}
                    </div>
                  )}
                  <div
                    className="ctx-item"
                    onClick={() => {
                      window.api.openExternal(article.link)
                      setCtx(null)
                    }}
                  >
                    <ExternalLink size={14} />
                    {t.articleList.contextMenu.openInBrowser}
                  </div>
                </>
              )}
              {!isTrash && <div
                className="ctx-item"
                onClick={() => {
                  const unreadIds = articles.filter((a) => !a.read).map((a) => a.id)
                  if (unreadIds.length > 0) {
                    useArticlesStore.getState().markMultipleRead(unreadIds, true)
                  }
                  setCtx(null)
                }}
              >
                <CheckCheck size={14} />
                {t.articleList.contextMenu.markAllAsRead}
              </div>}
              {!isTrash && <div className="ctx-divider" />}
              {article && !isTrash && !article.deletedAt && (
                <div
                  className="ctx-item danger"
                  onClick={() => {
                    deleteArticleAndAdvance(article.id)
                    setCtx(null)
                  }}
                >
                  <Trash2 size={14} />
                  {t.articleList.contextMenu.deleteArticle}
                </div>
              )}
              <div
                className="ctx-item danger"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: isTrash ? t.articleList.dialogs.emptyTrashTitle : t.articleList.dialogs.deleteAllTitle,
                    message: isTrash ? t.articleList.dialogs.emptyTrashMsg : t.articleList.dialogs.deleteAllMsg,
                    confirmText: isTrash ? t.articleList.dialogs.emptyTrashBtn : t.articleList.dialogs.deleteAllBtn,
                    cancelText: t.sidebar.cancel,
                    variant: 'danger'
                  })
                  if (confirmed) {
                    if (isTrash) {
                      await emptyTrash()
                      selectArticle(null)
                    } else {
                      await deleteAllFilteredArticles()
                      selectArticle(null)
                    }
                  }
                  setCtx(null)
                }}
              >
                <Trash2 size={14} />
                {isTrash
                  ? t.articleList.contextMenu.emptyTrash
                  : t.sidebar.moveFeedArticlesToTrash.replace('{count}', formatNum(totalCount))}
              </div>
            </div>
          )
        })()}

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

interface ArticleItemProps {
  article: Article
  folderName?: string
  isTrash?: boolean
  selected: boolean
  contextActive?: boolean
  onSelect: (id: string | null) => void
  onContextMenu: (e: React.MouseEvent, id: string) => void
  style?: React.CSSProperties
  measureRef?: (el: HTMLElement | null) => void
  dataIndex?: number
}

const ArticleItem = memo(
  function ArticleItem({
    article,
    folderName,
    isTrash,
    selected,
    contextActive,
    onSelect,
    onContextMenu,
    style,
    measureRef,
    dataIndex
  }: ArticleItemProps) {
    const { markRead, starArticle } = useArticlesStore()
    const { settings } = useSettingsStore()
    const { t, language } = useTranslation()

    const handleClick = useCallback(() => {
      if (selected) {
        onSelect(null)
        return
      }
      onSelect(article.id)
      if (!isTrash && !article.deletedAt && !article.read) markRead(article.id, true)
    }, [article.id, article.read, isTrash, markRead, onSelect, selected])

    const handleStar = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        starArticle(article.id, !article.starred)
      },
      [article.id, article.starred]
    )

    const absoluteTime = new Date(article.pubDate).toLocaleString(
      language === 'es' ? 'es-ES' : 'en-US',
      { dateStyle: 'medium', timeStyle: 'short' }
    )
    const dateTooltipLabel = t.notifier.receivedAt.replace('{time}', absoluteTime)

    const priorityKeywords = settings.filters?.priorityKeywords ?? []
    const isPriority = React.useMemo(() => {
      if (priorityKeywords.length === 0) return false
      const titleLower = (article.title || '').toLowerCase()
      const snippetLower = (article.snippet || '').toLowerCase()
      return priorityKeywords.some((kw) => {
        const k = kw.trim().toLowerCase()
        return k && (titleLower.includes(k) || snippetLower.includes(k))
      })
    }, [priorityKeywords, article.title, article.snippet])

    return (
      <div
        ref={measureRef}
        data-index={dataIndex}
        className={`article-item ${selected ? 'active' : ''} ${contextActive ? 'context-active' : ''} ${article.read ? 'read' : ''} ${article.deletedAt ? 'deleted' : ''}`}
        data-article-id={article.id}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, article.id)}
        style={style}
      >
        {/* Thumbnail strip */}
        {article.thumbnail && settings.showArticleThumbnails && (
          <div className="article-thumbnail">
            <img
              src={article.thumbnail}
              alt=""
              loading="lazy"
              onError={(e) => {
                const thumbnail = e.currentTarget.parentElement
                if (!thumbnail) return
                thumbnail.style.display = 'none'
                const item = e.currentTarget.closest<HTMLElement>('.article-item')
                if (item) measureRef?.(item)
              }}
            />
          </div>
        )}

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ marginTop: 1, flexShrink: 0 }}>
            <FeedFavicon icon={article.feedIcon} title={article.feedTitle} size={16} />
          </div>
          <span className="article-title" style={{ flex: 1 }}>
            {article.title}
          </span>
          {isPriority && (
            <span className="article-priority-badge" title={t.articleList.relevantBadge}>
              <Star size={10} fill="var(--star)" color="var(--star)" />
              <span>{t.articleList.relevantBadge}</span>
            </span>
          )}
          {!isTrash && !article.deletedAt && (
            <Tooltip
              label={article.starred ? t.articleViewer.unstar : t.articleViewer.star}
              placement="bottom"
            >
              <button onClick={handleStar} className="article-item-star">
                <Star
                  size={13}
                  fill={article.starred ? 'var(--star)' : 'none'}
                  color={article.starred ? 'var(--star)' : 'var(--text-muted)'}
                />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Snippet */}
        <div className="article-snippet">{article.snippet}</div>

        {/* Meta: unread dot + feed name + author (left) ... timestamp (right) */}
        <div className="article-meta">
          {!article.read ? (
            <Tooltip label={t.articleList.unread} placement="bottom">
              <div className="unread-dot" style={{ flexShrink: 0 }} />
            </Tooltip>
          ) : (
            <div style={{ width: 6, height: 6, flexShrink: 0 }} />
          )}
          {article.feedTitle && (
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {article.feedTitle}
            </span>
          )}
          {article.author && article.author.trim().toLowerCase() !== article.feedTitle?.trim().toLowerCase() && (
            <>
              {article.feedTitle && <span style={{ flexShrink: 0 }}>·</span>}
              <span
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {article.author}
              </span>
            </>
          )}
          <span style={{ marginLeft: 'auto', flexShrink: 0 }} />
          {folderName && (
            <Tooltip label={t.articleList.feedFolder} placement="bottom">
              <span className="article-meta-folder">{folderName}</span>
            </Tooltip>
          )}
          <Tooltip label={dateTooltipLabel} placement="bottom">
            <span style={{ paddingLeft: folderName ? 0 : 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {formatDate(article.pubDate, t)}
            </span>
          </Tooltip>
        </div>
      </div>
    )
  },
  (prev, next) =>
    prev.article.id === next.article.id &&
    prev.folderName === next.folderName &&
    prev.isTrash === next.isTrash &&
    prev.article.read === next.article.read &&
    prev.article.starred === next.article.starred &&
    prev.article.deletedAt === next.article.deletedAt &&
    prev.selected === next.selected &&
    prev.contextActive === next.contextActive &&
    prev.dataIndex === next.dataIndex &&
    prev.style?.transform === next.style?.transform
)

export { FeedFavicon }
export default ArticleList
