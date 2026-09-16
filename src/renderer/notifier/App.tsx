import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { X, ExternalLink, ChevronDown, Bell, BellOff, Clock, Check, Eye, Settings } from 'lucide-react'
import type { NotificationDisplayMode, NotificationHistoryItem, NotificationSettings } from '@shared/types'
import { translations } from '@shared/translations'
import Tooltip from '../src/components/Tooltip'

const SNOOZE_LABELS: Record<number, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  240: '4h',
  480: '8h',
  1440: '24h'
}
const AUTO_HIDE_BUFFER_MS = 500

function formatSnoozeLabel(minutes: number): string {
  return SNOOZE_LABELS[minutes] ?? `${minutes}m`
}

/** Relative reception time — same rules as the main article list. */
function formatReceivedAt(ts: number, t: typeof translations.en): string {
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

function formatAbsoluteTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale === 'es' ? 'es' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function FeedIcon({ icon, feedName }: { icon?: string | null; feedName?: string }): JSX.Element {
  const [imgError, setImgError] = useState(false)
  if (icon && !imgError) {
    return (
      <img
        src={icon}
        alt=""
        style={{
          width: 15,
          height: 15,
          borderRadius: 3,
          objectFit: 'contain',
          flexShrink: 0
        }}
        onError={() => setImgError(true)}
      />
    )
  }
  return (
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
      {(feedName || 'F').charAt(0).toUpperCase()}
    </span>
  )
}

interface State {
  stack: NotificationHistoryItem[]
  settings: NotificationSettings | null
  unseenCount: number
  displayMode: NotificationDisplayMode
}

type Action =
  | {
      type: 'SET_STACK'
      stack: NotificationHistoryItem[]
      settings: NotificationSettings
      unseenCount: number
      displayMode: NotificationDisplayMode
    }
  | { type: 'DISMISS'; id: string }
  | { type: 'CLEAR' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STACK':
      return {
        stack: action.stack,
        settings: action.settings,
        unseenCount: action.unseenCount,
        displayMode: action.displayMode
      }
    case 'DISMISS':
      return { ...state, stack: state.stack.filter((n) => n.id !== action.id) }
    case 'CLEAR':
      return { ...state, stack: [] }
    default:
      return state
  }
}

export default function NotifierApp(): JSX.Element {
  const [state, dispatch] = useReducer(reducer, {
    stack: [],
    settings: null,
    unseenCount: 0,
    displayMode: 'automatic'
  })
  const [lang, setLang] = useState<'en' | 'es'>('en')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [belowCount, setBelowCount] = useState(0)
  const [scrollbarW, setScrollbarW] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)
  const hoverOffTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHovering = useRef(false)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownEnd = useRef<number | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState(0)
  const [historyHovered, setHistoryHovered] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const t = translations[lang] || translations.en

  const stopCountdown = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current)
      countdownTimer.current = null
    }
    countdownEnd.current = null
  }, [])

  const startCountdown = useCallback(
    (durationMs: number) => {
      stopCountdown()
      const end = Date.now() + Math.max(0, durationMs)
      countdownEnd.current = end
      const nominalSecs = Math.max(1, Math.round((state.settings?.duration ?? durationMs) / 1000))
      setCountdownSeconds(nominalSecs)

      countdownTimer.current = setInterval(() => {
        if (!countdownEnd.current) return
        const remaining = countdownEnd.current - Date.now()
        if (remaining <= 0) {
          stopCountdown()
          setCountdownSeconds(0)
          dispatch({ type: 'CLEAR' })
          window.api.clearAllNotifications()
        } else {
          const secs = Math.max(
            1,
            Math.min(nominalSecs, Math.ceil((remaining - AUTO_HIDE_BUFFER_MS) / 1000))
          )
          setCountdownSeconds(secs)
        }
      }, 250)
    },
    [stopCountdown, state.settings?.duration]
  )

  const handleMouseEnter = (): void => {
    if (hoverOffTimer.current) {
      clearTimeout(hoverOffTimer.current)
      hoverOffTimer.current = null
    }
    isHovering.current = true
    setIsHovered(true)
    stopCountdown()
    const nominalSecs = Math.max(1, Math.round((Number(state.settings?.duration) || 6000) / 1000))
    setCountdownSeconds(nominalSecs)
    window.api.setHover(true)
  }

  const handleMouseLeave = (): void => {
    isHovering.current = false
    setIsHovered(false)
    window.api.setHover(false)
    if (state.stack.length > 0 && state.settings) {
      startCountdown(state.settings.duration + AUTO_HIDE_BUFFER_MS)
    }
  }

  const [confirmMuteFeedId, setConfirmMuteFeedId] = useState<string | null>(null)
  const confirmMuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMuteClick = (feedId: string): void => {
    if (confirmMuteFeedId !== feedId) {
      if (confirmMuteTimerRef.current) clearTimeout(confirmMuteTimerRef.current)
      setConfirmMuteFeedId(feedId)
      confirmMuteTimerRef.current = setTimeout(() => {
        setConfirmMuteFeedId(null)
      }, 3500)
    } else {
      if (confirmMuteTimerRef.current) clearTimeout(confirmMuteTimerRef.current)
      setConfirmMuteFeedId(null)
      window.api.muteFeedNotifications(feedId)
    }
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (hoverOffTimer.current) clearTimeout(hoverOffTimer.current)
      if (confirmMuteTimerRef.current) clearTimeout(confirmMuteTimerRef.current)
      stopCountdown()
    }
  }, [stopCountdown])

  useEffect(() => {
    const unsub = window.api.onNotifierStack(
      (
        stack: object[],
        settingsPayload: object,
        language?: string,
        unseenCount?: number,
        resolvedDisplayMode?: string
      ) => {
        const payloadSettings = settingsPayload as NotificationSettings
        const displayMode: NotificationDisplayMode =
          resolvedDisplayMode === 'compact' || resolvedDisplayMode === 'detailed'
            ? resolvedDisplayMode
            : payloadSettings.displayMode === 'compact' || payloadSettings.displayMode === 'detailed'
              ? payloadSettings.displayMode
              : 'detailed'
        dispatch({
          type: 'SET_STACK',
          stack: stack as NotificationHistoryItem[],
          settings: payloadSettings,
          unseenCount: Number(unseenCount) || 0,
          displayMode
        })
        if (!isHovering.current) {
          const duration = Number((settingsPayload as NotificationSettings)?.duration) || 6000
          startCountdown(duration + AUTO_HIDE_BUFFER_MS)
        }
        if (language === 'en' || language === 'es') setLang(language)
      }
    )
    return unsub
  }, [startCountdown])

  // When the popup window is hidden (auto-hide, dismiss-all, snooze, open-in-app,
  // open-history, ...) the main process clears its displayStack but never sends
  // an empty stack here (pushToWindow() early-returns on empty). The renderer
  // would otherwise keep the previous batch painted and briefly flash it again
  // the next time the window is shown, before the new stack arrives. Reset our
  // local stack as soon as the window becomes hidden so the next showing always
  // starts from a clean (transparent) state.
  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        dispatch({ type: 'CLEAR' })
        stopCountdown()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [stopCountdown])

  const computeBelowCount = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const cards = el.querySelectorAll<HTMLElement>('.notif-card:not(.dismissing)')
    if (cards.length === 0) {
      setBelowCount(0)
      return
    }
    const clientH = el.clientHeight
    if (clientH === 0) {
      const maxStack = Math.max(1, Number(state.settings?.maxStack) || 2)
      setBelowCount(Math.max(0, state.stack.length - maxStack))
      return
    }
    // If all cards fit in viewport without scroll, or user is scrolled to bottom:
    const atBottom = el.scrollHeight - el.scrollTop - clientH < 10
    const noScrollNeeded = el.scrollHeight <= clientH + 10
    if (atBottom || noScrollNeeded) {
      setBelowCount(0)
      return
    }
    const bottom = el.scrollTop + clientH
    let lastVisibleIndex = -1
    cards.forEach((card, idx) => {
      if (card.offsetTop + 20 < bottom) {
        lastVisibleIndex = Math.max(lastVisibleIndex, idx)
      }
    })
    const remaining = lastVisibleIndex < 0 ? 0 : Math.max(0, cards.length - (lastVisibleIndex + 1))
    setBelowCount(remaining)
  }, [state.settings?.maxStack, state.stack.length])

  const handleScroll = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = undefined
      computeBelowCount()
    })
  }, [computeBelowCount])

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [])

  const measureAndResize = useCallback(() => {
    const el = scrollRef.current
    if (!el || state.stack.length === 0) return
    const maxStack = Math.max(1, Number(state.settings?.maxStack) || 2)
    const cards = el.querySelectorAll<HTMLElement>('.notif-card:not(.dismissing)')
    if (cards.length === 0) return
    let cardsH = 0
    const count = Math.min(cards.length, maxStack)
    for (let i = 0; i < count; i++) {
      cardsH += cards[i].offsetHeight + (i > 0 ? 6 : 0)
    }
    const hasMore = state.stack.length > maxStack
    const peekH = hasMore ? 44 : 0
    // 16px root padding + 34px topbar + 4px scrollRef paddingTop + 8px bottom safety + peekH
    const totalH = cardsH + 16 + 34 + 4 + 8 + peekH
    window.api.resizeNotifier?.(totalH)
  }, [state.stack, state.settings?.maxStack])

  // Keep the top bar gutter aligned with the cards' right edge, track belowCount, and size window.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollbarW(el.offsetWidth - el.clientWidth)
    computeBelowCount()
    measureAndResize()
    const timer1 = requestAnimationFrame(() => {
      computeBelowCount()
      measureAndResize()
    })
    const timer2 = setTimeout(() => {
      computeBelowCount()
      measureAndResize()
    }, 60)
    const timer3 = setTimeout(() => {
      computeBelowCount()
      measureAndResize()
    }, 200)
    return () => {
      cancelAnimationFrame(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [state.stack, state.settings?.maxStack, state.displayMode, computeBelowCount, measureAndResize])

  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set())

  const handleDismiss = useCallback((id: string, onAfterDismiss?: () => void): void => {
    setDismissingIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })

    setTimeout(() => {
      dispatch({ type: 'DISMISS', id })
      setDismissingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (state.stack.length <= 1) {
        isHovering.current = false
        setIsHovered(false)
        stopCountdown()
        window.api.setHover(false)
      }
      window.api.dismissNotification(id)
      onAfterDismiss?.()
    }, 200)
  }, [state.stack.length, stopCountdown])

  const handleViewInApp = (item: NotificationHistoryItem): void => {
    if (item.feedId) {
      window.api.openInApp(item.feedId, item.articleId || '')
    }
    handleDismiss(item.id)
  }

  const handleOpenInBrowser = (item: NotificationHistoryItem): void => {
    if (item.link) {
      window.api.openExternal(item.link)
    }
    handleDismiss(item.id)
  }

  const handleOpen = (item: NotificationHistoryItem): void => {
    if (state.settings?.openBehavior === 'browser') {
      handleOpenInBrowser(item)
    } else {
      handleViewInApp(item)
    }
  }

  if (state.stack.length === 0) return <div />

  const showMoreIndicator = belowCount > 0
  const snoozeMinutes = state.settings?.snoozeMinutes ?? 30
  const snoozeLabel = formatSnoozeLabel(snoozeMinutes)
  const snoozeText = t.notifier.snooze.replace('{time}', snoozeLabel)
  const snoozeTooltip = t.notifier.snoozeTooltip.replace('{time}', snoozeLabel)
  const cardOpenTooltip =
    state.settings?.openBehavior === 'browser' ? t.notifier.openTooltip : t.notifier.viewTooltip
  const isCompact = state.displayMode === 'compact'
  const historyLimit = Number(state.settings?.historyLimit) || 0
  const isLimitReached = historyLimit > 0 && state.unseenCount >= historyLimit
  const historyTooltip = isLimitReached
    ? `${t.notifier.historyTooltip} (${t.topBar.limitReached})`
    : t.notifier.historyTooltip

  return (
    <div
      className="notifier-root"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(0,0,0,0.01)'
      }}
    >
      {/* Clear & See History — fixed at top, always accessible */}
      {state.stack.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 4,
            paddingRight: Math.max(scrollbarW, 16) + 4,
            paddingBottom: 4,
            flexShrink: 0
          }}
        >
          <Tooltip label={historyTooltip} placement="bottom">
            <button
              className="clear-all-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: historyHovered ? 'var(--accent, #58a6ff)' : 'var(--bg-1, #161b22)',
                borderColor: isLimitReached
                  ? 'var(--red, #f85149)'
                  : historyHovered
                    ? 'var(--accent, #58a6ff)'
                    : 'var(--border, #30363d)',
                color: historyHovered ? '#0d1117' : 'var(--text-primary, #e6edf3)'
              }}
              onMouseEnter={() => setHistoryHovered(true)}
              onMouseLeave={() => setHistoryHovered(false)}
              onClick={(e) => {
                e.stopPropagation()
                window.api.openHistoryInApp()
              }}
            >
              <Bell
                size={12}
                style={{
                  flexShrink: 0,
                  color: isLimitReached && !historyHovered ? 'var(--red, #f85149)' : undefined
                }}
              />
              {t.notifier.history}
              {state.unseenCount > 0 && (
                <span
                  style={{
                    fontWeight: 700,
                    color: historyHovered
                      ? '#0d1117'
                      : isLimitReached
                        ? 'var(--red, #f85149)'
                        : 'var(--accent, #58a6ff)'
                  }}
                >
                  {state.unseenCount}
                </span>
              )}
            </button>
          </Tooltip>
          <Tooltip label={snoozeTooltip} placement="bottom">
            <button
              className="clear-all-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              onClick={(e) => {
                e.stopPropagation()
                window.api.snoozeNotifications(snoozeMinutes)
              }}
            >
              <Clock size={12} style={{ flexShrink: 0 }} />
              {snoozeText}
            </button>
          </Tooltip>

          {/* Right: Settings button + Separator + Countdown / Close button */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Tooltip label={t.notifier.settingsTooltip} placement="bottom">
              <button
                className="clear-all-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 8px'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  window.api.openSettingsInApp('notifications')
                }}
              >
                <Settings size={12} style={{ flexShrink: 0 }} />
              </button>
            </Tooltip>

            <div
              style={{
                width: 1,
                height: 14,
                backgroundColor: 'var(--border, #30363d)',
                opacity: 0.6
              }}
            />

            <Tooltip
              label={state.stack.length > 1 ? t.notifier.closeAllTooltip : t.notifier.closeTooltip}
              placement="bottom"
            >
              <button
                className="clear-all-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={(e) => {
                  e.stopPropagation()
                  isHovering.current = false
                  setIsHovered(false)
                  stopCountdown()
                  window.api.setHover(false)
                  window.api.clearAllNotifications()
                }}
              >
                <span
                  className={`notif-countdown-num ${!isHovered && countdownSeconds > 0 ? 'breathing' : ''}`}
                  style={{
                    minWidth: 12,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {countdownSeconds}
                </span>
                <X size={12} style={{ flexShrink: 0 }} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Scrollable notification list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingTop: 4,
          // Keep card right edge aligned whether or not the scrollbar is visible
          paddingRight: scrollbarW > 0 ? 0 : 16,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.15) transparent'
        }}
      >
        {state.stack.map((item) => (
          <div
            key={item.id}
            data-notif-item="true"
            className={`notif-card ${isCompact ? 'is-compact' : ''} ${dismissingIds.has(item.id) ? 'dismissing' : ''}`}
            onClick={() => handleOpen(item)}
          >
            {!isCompact && item.thumbnail && state.settings?.showThumbnails && (
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
              <FeedIcon icon={item.icon} feedName={item.feedName} />
              <div style={{ flex: 1, minWidth: 0, display: 'inline-flex' }}>
                <Tooltip label={item.feedName} placement="top">
                  <span className="notif-feed" style={{ flex: '0 1 auto' }}>
                    {item.feedName}
                  </span>
                </Tooltip>
              </div>
              <Tooltip label={t.notifier.dismissTooltip} placement="bottom">
                <button
                  className="notif-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDismiss(item.id)
                  }}
                >
                  <X size={12} />
                </button>
              </Tooltip>
            </div>
            <Tooltip label={cardOpenTooltip} placement="bottom">
              <div className="notif-content-wrap">
                <div className="notif-title-row">
                  <div className="notif-title">{item.title}</div>
                </div>
                {!isCompact && item.body && (
                  <div className="notif-body">
                    {item.body}
                  </div>
                )}
              </div>
            </Tooltip>
            <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
              <Tooltip label={t.notifier.markReadTooltip} placement="bottom">
                <button
                  className={`notif-btn${isCompact ? ' notif-btn-compact' : ''}`}
                  aria-label={t.notifier.markRead}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    window.api.markNotificationRead(item.articleId || '')
                    handleDismiss(item.id)
                  }}
                >
                  <Check size={11} />
                  <span className="notif-action-label">{t.notifier.markRead}</span>
                </button>
              </Tooltip>
              {item.feedId && (
                <Tooltip
                  label={
                    confirmMuteFeedId === item.feedId
                      ? t.notifier.confirmMuteTooltip
                      : t.notifier.muteTooltip
                  }
                  placement="bottom"
                >
                  <button
                    className={`notif-btn${isCompact ? ' notif-btn-compact' : ''}`}
                    aria-label={
                      confirmMuteFeedId === item.feedId ? t.notifier.confirmMute : t.notifier.mute
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      ...(confirmMuteFeedId === item.feedId
                        ? {
                            borderColor: '#e3b341',
                            color: '#e3b341',
                            background: 'rgba(227, 179, 65, 0.15)',
                            fontWeight: 600
                          }
                        : {})
                    }}
                    onClick={() => handleMuteClick(item.feedId!)}
                  >
                    <BellOff size={11} />
                    <span className="notif-action-label">
                      {confirmMuteFeedId === item.feedId ? t.notifier.confirmMute : t.notifier.mute}
                    </span>
                  </button>
                </Tooltip>
              )}
              {item.feedId && (
                <Tooltip label={t.notifier.viewTooltip} placement="bottom">
                  <button
                    className={`notif-btn${isCompact ? ' notif-btn-compact' : ''}`}
                    aria-label={t.notifier.view}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => handleViewInApp(item)}
                  >
                    <Eye size={11} />
                    <span className="notif-action-label">{t.notifier.view}</span>
                  </button>
                </Tooltip>
              )}
              {item.link && (
                <Tooltip label={t.notifier.openTooltip} placement="bottom">
                  <button
                    className={`notif-btn${isCompact ? ' notif-btn-compact' : ''}`}
                    aria-label={t.notifier.open}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => handleOpenInBrowser(item)}
                  >
                    <ExternalLink size={11} />
                    <span className="notif-action-label">{t.notifier.open}</span>
                  </button>
                </Tooltip>
              )}
              <Tooltip
                label={t.notifier.receivedAt.replace(
                  '{time}',
                  formatAbsoluteTime(item.createdAt, lang)
                )}
                placement="bottom"
              >
                <span className="notif-time">{formatReceivedAt(item.createdAt, t)}</span>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
      {/* "More" floating indicator with gradient fade over the peek area */}
      {showMoreIndicator && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            height: 48,
            background:
              'linear-gradient(to top, rgba(13, 17, 23, 0.96) 0%, rgba(13, 17, 23, 0.8) 45%, rgba(13, 17, 23, 0.25) 80%, transparent 100%)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 4,
            borderRadius: '0 0 8px 8px',
            zIndex: 10
          }}
        >
          <Tooltip label={t.notifier.moreTooltip} placement="top">
            <div
              onClick={scrollToBottom}
              style={{
                pointerEvents: 'auto',
                background: 'var(--accent, #00D8F1)',
                color: '#0d1117',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 12,
                padding: '3px 12px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                transition: 'opacity 0.2s ease, transform 0.15s ease'
              }}
            >
              <ChevronDown size={11} strokeWidth={2.5} />
              {belowCount} {t.notifier.more}
            </div>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
