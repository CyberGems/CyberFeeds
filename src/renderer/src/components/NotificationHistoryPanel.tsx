import { useEffect, useState } from 'react'
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

export default function NotificationHistoryPanel(): JSX.Element {
  const { closePanel, selectArticle, selectFeed } = useUIStore()
  const { settings } = useSettingsStore()
  const { markRead } = useArticlesStore()
  const [history, setHistory] = useState<NotificationHistoryItem[]>([])
  const [lastCheckedTime, setLastCheckedTime] = useState(0)
  const { t, language } = useTranslation()

  useEffect(() => {
    window.api.getNotificationHistory().then(setHistory)
    const rawChecked = localStorage.getItem('lastCheckedNotificationsTime')
    const prevChecked = Number(rawChecked || 0)
    setLastCheckedTime(prevChecked)
  }, [])

  useEffect(() => {
    const unsub = window.api.onNewNotification((item) => {
      setHistory((prev) => [item, ...prev.filter((x) => x.id !== item.id)])
    })
    return unsub
  }, [])

  const handleMarkAllSeen = async (): Promise<void> => {
    const now = Date.now()
    setLastCheckedTime(now)
    localStorage.setItem('lastCheckedNotificationsTime', String(now))
    await window.api.markNotificationsChecked(now)
    useUIStore.setState({ unseenNotificationsCount: 0 })
  }

  const handleClear = async (): Promise<void> => {
    await window.api.clearNotificationHistory()
    setHistory([])
    const now = Date.now()
    setLastCheckedTime(now)
    localStorage.setItem('lastCheckedNotificationsTime', String(now))
    await window.api.markNotificationsChecked(now)
    useUIStore.setState({ unseenNotificationsCount: 0 })
  }

  // Partition into new and seen notifications
  const newNotifications = history.filter((item) => item.createdAt > lastCheckedTime)
  const seenNotifications = history.filter((item) => item.createdAt <= lastCheckedTime)
  const historyLimit = settings.notifications?.historyLimit ?? 1000
  const isLimitReached = historyLimit > 0 && history.length >= historyLimit

  const renderItem = (item: NotificationHistoryItem, isNew: boolean): JSX.Element => (
    <div
      key={item.id}
      className="notif-card"
      style={{
        opacity: isNew ? 1 : 0.65,
        cursor: 'pointer',
        transition: 'opacity 0.2s, border-color 0.15s',
        marginBottom: 8
      }}
      onClick={() => {
        if (settings.notifications.openBehavior === 'browser') {
          if (item.link) window.api.openExternal(item.link)
        } else {
          if (item.feedId) selectFeed(item.feedId)
          if (item.articleId) selectArticle(item.articleId)
          closePanel()
        }
      }}
    >
      {item.thumbnail && settings.showArticleThumbnails && (
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
                markRead(item.articleId!, true)
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
                if (item.feedId) selectFeed(item.feedId)
                if (item.articleId) selectArticle(item.articleId)
                closePanel()
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
            {newNotifications.map((item) => renderItem(item, true))}
            {newNotifications.length > 0 && seenNotifications.length > 0 && (
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
            {seenNotifications.map((item) => renderItem(item, false))}
          </>
        )}
      </div>
    </div>
  )
}
