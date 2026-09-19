import { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react'
import { X, Bell, Trash2, ExternalLink, Check, Eye, CheckCheck } from 'lucide-react'
import { useUIStore } from '../store/ui.store'
import { useSettingsStore } from '../store/settings.store'
import { useArticlesStore } from '../store/articles.store'
import type { NotificationHistoryItem } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'

import { translations } from '@shared/translations'

function timeAgo(ts: number, t: typeof translations.en): string {
  const d = (Date.now() - ts) / 1000
  const formatTimeAgo = (val: number, str: string): string =>
    str.includes('{num}') ? str.replace('{num}', String(val)) : `${val}${str}`

  if (d < 60) return t.articleList.timeAgo.justNow
  if (d < 3600) return formatTimeAgo(Math.round(d / 60), t.articleList.timeAgo.mAgo)
  if (d < 86400) return formatTimeAgo(Math.round(d / 3600), t.articleList.timeAgo.hAgo)
  return formatTimeAgo(Math.round(d / 86400), t.articleList.timeAgo.dAgo)
}

function formatAbsoluteTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale === 'es' ? 'es' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

// ── Batch size for incremental rendering ────────────────────────────────────
const RENDER_BATCH = 50
const MAX_PENDING_NOTIFICATIONS = 200

// ── Memoized notification card to avoid re-rendering all items on state change
interface NotifCardProps {
  item: NotificationHistoryItem
  isNew: boolean
  openBehavior: string
  showThumbnails: boolean
  onSelectFeed: (id: string) => void
  onSelectArticle: (id: string) => void
  onClosePanel: () => void
  onMarkRead: (id: string, read: boolean) => void
  t: typeof translations.en
  language: string
}

const NotifCard = memo(function NotifCard({
  item,
  isNew,
  openBehavior,
  showThumbnails,
  onSelectFeed,
  onSelectArticle,
  onClosePanel,
  onMarkRead,
  t,
  language
}: NotifCardProps): JSX.Element {
  return (
    <div
      className="notif-card"
      style={{
        opacity: isNew ? 1 : 0.65,
        cursor: 'pointer',
        transition: 'opacity 0.2s, border-color 0.15s',
        marginBottom: 8
      }}
      onClick={() => {
        if (openBehavior === 'browser') {
          if (item.link) window.api.openExternal(item.link)
        } else {
          if (item.feedId) onSelectFeed(item.feedId)
          if (item.articleId) onSelectArticle(item.articleId)
          onClosePanel()
        }
      }}
    >
      {item.thumbnail && showThumbnails && (
        <div className="notif-thumbnail">
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).parentElement!.style.display = 'none'
            }}
          />
        </div>
      )}
      <div className="notif-header">
        {item.icon ? (
          <img
            src={item.icon}
            alt=""
            style={{
              width: 15,
              height: 15,
              borderRadius: 3,
              objectFit: 'contain',
              flexShrink: 0
            }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span
            style={{
              width: 15,
              height: 15,
              borderRadius: 3,
              background: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              color: '#0d1117',
              flexShrink: 0
            }}
          >
            {(item.feedName || 'F').charAt(0).toUpperCase()}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'inline-flex' }}>
          <Tooltip label={item.feedName} placement="top">
            <span className="notif-feed" style={{ flex: '0 1 auto' }}>
              {item.feedName}
            </span>
          </Tooltip>
        </div>
      </div>
      <div className="notif-content-wrap">
        <div className="notif-title" style={{ fontSize: 13, fontWeight: 600 }}>
          {item.title}
        </div>
        {item.body && (
          <div className="notif-body">
            {item.body}
          </div>
        )}
      </div>
      <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
        {item.articleId && (
          <Tooltip label={t.notifier.markReadTooltip} placement="bottom">
            <button
              className="notif-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                onMarkRead(item.articleId!, true)
              }}
            >
              <Check size={11} />
              {t.notifier.markRead}
            </button>
          </Tooltip>
        )}
        {item.feedId && (
          <Tooltip label={t.notifier.viewTooltip} placement="bottom">
            <button
              className="notif-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                if (item.feedId) onSelectFeed(item.feedId)
                if (item.articleId) onSelectArticle(item.articleId)
                onClosePanel()
              }}
            >
              <Eye size={11} />
              {t.notifier.view}
            </button>
          </Tooltip>
        )}
        {item.link && (
          <Tooltip label={t.notifier.openTooltip} placement="bottom">
            <button
              className="notif-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => window.api.openExternal(item.link)}
            >
              <ExternalLink size={11} />
              {t.notifier.open}
            </button>
          </Tooltip>
        )}
        <Tooltip
          label={t.notifier.receivedAt.replace(
            '{time}',
            formatAbsoluteTime(item.createdAt, language)
          )}
          placement="bottom"
        >
          <span className="notif-time">{timeAgo(item.createdAt, t)}</span>
        </Tooltip>
      </div>
    </div>
  )
})

export default function NotificationHistoryPanel(): JSX.Element {
  const { closePanel, selectArticle, selectFeed } = useUIStore()
  const { settings } = useSettingsStore()
  const { markRead } = useArticlesStore()
  const [history, setHistory] = useState<NotificationHistoryItem[]>([])
  const [lastCheckedTime, setLastCheckedTime] = useState(0)
  const { t, language } = useTranslation()

  // ── Incremental rendering: only render `visibleCount` items ──────────────
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset visible count when history changes significantly (e.g. clear)
  const prevLenRef = useRef(0)
  useEffect(() => {
    if (history.length === 0 && prevLenRef.current > 0) {
      setVisibleCount(RENDER_BATCH)
    }
    prevLenRef.current = history.length
  }, [history.length])

  // IntersectionObserver to progressively load more items
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => prev + RENDER_BATCH)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [history.length > 0]) // re-attach when items appear/disappear

  // ── Load initial data ───────────────────────────────────────────────────
  useEffect(() => {
    window.api.getNotificationHistory().then(setHistory)
    const rawChecked = localStorage.getItem('lastCheckedNotificationsTime')
    const prevChecked = Number(rawChecked || 0)
    setLastCheckedTime(prevChecked)
  }, [])

  // ── Throttled incoming notification listener ────────────────────────────
  // Batches incoming notifications to avoid per-item re-renders
  // when a feed poll returns many new articles at once, and caps transient
  // state before it reaches the configured history limit.
  useEffect(() => {
    let pending: NotificationHistoryItem[] = []
    let timer: ReturnType<typeof setTimeout> | null = null

    const limit = settings.notifications?.historyLimit ?? 1000

    const flush = (): void => {
      timer = null
      if (pending.length === 0) return
      const batch = pending
      pending = []
      setHistory((prev) => {
        const ids = new Set(batch.map((b) => b.id))
        const merged = [...batch, ...prev.filter((x) => !ids.has(x.id))]
        return limit > 0 ? merged.slice(0, limit) : merged
      })
    }

    const unsubBatch = window.api.onNewNotificationBatch
      ? window.api.onNewNotificationBatch((payload) => {
          pending.push(...payload.items)
          if (pending.length > MAX_PENDING_NOTIFICATIONS) {
            pending = pending.slice(-MAX_PENDING_NOTIFICATIONS)
          }
          if (!timer) timer = setTimeout(flush, 300)
        })
      : undefined

    const unsubNew = window.api.onNewNotification((item) => {
      if (!unsubBatch) {
        pending.push(item)
        if (!timer) timer = setTimeout(flush, 300)
      }
    })

    return () => {
      unsubBatch?.()
      unsubNew()
      if (timer) clearTimeout(timer)
      if (pending.length > 0) flush()
    }
  }, [settings.notifications?.historyLimit])

  const handleMarkAllSeen = useCallback(async (): Promise<void> => {
    const now = Date.now()
    setLastCheckedTime(now)
    localStorage.setItem('lastCheckedNotificationsTime', String(now))
    await window.api.markNotificationsChecked(now)
    useUIStore.setState({ unseenNotificationsCount: 0 })
  }, [])

  const handleClear = useCallback(async (): Promise<void> => {
    await window.api.clearNotificationHistory()
    setHistory([])
    const now = Date.now()
    setLastCheckedTime(now)
    localStorage.setItem('lastCheckedNotificationsTime', String(now))
    await window.api.markNotificationsChecked(now)
    useUIStore.setState({ unseenNotificationsCount: 0 })
  }, [])

  // ── Memoized partitioning ───────────────────────────────────────────────
  const { newNotifications, seenNotifications } = useMemo(() => {
    const newItems: NotificationHistoryItem[] = []
    const seenItems: NotificationHistoryItem[] = []
    for (const item of history) {
      if (item.createdAt > lastCheckedTime) newItems.push(item)
      else seenItems.push(item)
    }
    return { newNotifications: newItems, seenNotifications: seenItems }
  }, [history, lastCheckedTime])

  const historyLimit = settings.notifications?.historyLimit ?? 1000
  const isLimitReached = historyLimit > 0 && history.length >= historyLimit

  // ── Compute the visible slice across new + seen ─────────────────────────
  const visibleNew = newNotifications.slice(0, visibleCount)
  const remainingSlots = Math.max(0, visibleCount - newNotifications.length)
  const visibleSeen = remainingSlots > 0 ? seenNotifications.slice(0, remainingSlots) : []
  const totalItems = newNotifications.length + seenNotifications.length
  const hasMore = visibleCount < totalItems

  // Stable callback refs for NotifCard
  const openBehavior = settings.notifications.openBehavior
  const showThumbnails = settings.showArticleThumbnails

  return (
    <div className="panel">
      <div className="panel-header">
        <Bell size={16} style={{ color: 'var(--accent)' }} />
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.topBar.notificationHistory}
          {newNotifications.length > 0 && (
            <span className="cyber-badge" style={{ fontSize: 10, padding: '2px 6px' }}>
              {newNotifications.length} {t.notificationHistory.newCount}
            </span>
          )}
          {isLimitReached && (
            <Tooltip
              label={t.notificationHistory.limitNotice.replace('{limit}', String(historyLimit))}
              placement="bottom"
            >
              <span
                className="cyber-badge"
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  color: 'var(--red, #f85149)',
                  borderColor: 'var(--red, #f85149)',
                  background: 'rgba(248, 81, 73, 0.12)',
                  cursor: 'help'
                }}
              >
                {t.notificationHistory.historyFullBadge
                  .replace('{count}', String(history.length))
                  .replace('{limit}', String(historyLimit))}
              </span>
            </Tooltip>
          )}
        </h2>
        {newNotifications.length > 0 && (
          <Tooltip label={t.notificationHistory.markAllSeen} placement="bottom">
            <button
              className="btn btn-ghost btn-icon no-drag"
              onClick={handleMarkAllSeen}
              aria-label={t.notificationHistory.markAllSeen}
            >
              <CheckCheck size={15} style={{ color: 'var(--accent)' }} />
            </button>
          </Tooltip>
        )}
        <Tooltip label={t.notificationHistory.clearAll} placement="bottom">
          <button
            className="btn btn-ghost btn-icon no-drag"
            onClick={handleClear}
            aria-label={t.notificationHistory.clearAll}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
        <button
          className="btn btn-ghost btn-icon no-drag"
          onClick={closePanel}
          aria-label={t.topBar.close}
        >
          <X size={15} />
        </button>
      </div>
      <div className="panel-body">
        {isLimitReached && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 'var(--radius, 6px)',
              background: 'rgba(248, 81, 73, 0.08)',
              border: '1px solid rgba(248, 81, 73, 0.3)',
              fontSize: 12,
              color: 'var(--red, #f85149)',
              lineHeight: 1.4
            }}
          >
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ flex: 1 }}>
              {t.notificationHistory.limitNotice.replace('{limit}', String(historyLimit))}
            </span>
          </div>
        )}
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
            {t.notificationHistory.empty}
          </div>
        ) : (
          <>
            {visibleNew.map((item) => (
              <NotifCard
                key={item.id}
                item={item}
                isNew={true}
                openBehavior={openBehavior}
                showThumbnails={showThumbnails}
                onSelectFeed={selectFeed}
                onSelectArticle={selectArticle}
                onClosePanel={closePanel}
                onMarkRead={markRead}
                t={t}
                language={language}
              />
            ))}
            {visibleNew.length > 0 && visibleSeen.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '16px 0 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em'
                }}
              >
                <div style={{ height: 1, flex: 1, background: 'var(--border-muted)' }} />
                {t.notificationHistory.alreadySeen}
                <div style={{ height: 1, flex: 1, background: 'var(--border-muted)' }} />
              </div>
            )}
            {visibleSeen.map((item) => (
              <NotifCard
                key={item.id}
                item={item}
                isNew={false}
                openBehavior={openBehavior}
                showThumbnails={showThumbnails}
                onSelectFeed={selectFeed}
                onSelectArticle={selectArticle}
                onClosePanel={closePanel}
                onMarkRead={markRead}
                t={t}
                language={language}
              />
            ))}
            {/* Sentinel for progressive loading */}
            {hasMore && (
              <div
                ref={sentinelRef}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: 16,
                  color: 'var(--text-muted)',
                  fontSize: 11
                }}
              >
                <div className="spinner" style={{ width: 16, height: 16 }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
