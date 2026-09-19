import { memo, useCallback, useMemo } from 'react'
import {
  Sun,
  Moon,
  Coffee,
  Sparkles,
  CheckCircle2,
  Keyboard,
  Rss,
  ArrowRight,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import type { Article } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { useSettingsStore } from '../store/settings.store'
import { useUIStore } from '../store/ui.store'
import { useFeedsStore } from '../store/feeds.store'
import { useArticlesStore } from '../store/articles.store'
import {
  getTimeOfDay,
  getEffectiveUserName,
  getGreetingText,
  formatWelcomeDate
} from '@shared/welcome'
import {
  INTERFACE_SCALE_MAX,
  INTERFACE_SCALE_MIN,
  INTERFACE_SCALE_STEP,
  normalizeInterfaceScale
} from '@shared/interface-scale'
import logoPng from '../../../../resources/icon.png'

const WelcomeLounge = memo(function WelcomeLounge(): JSX.Element {
  const { t, language } = useTranslation()
  const { settings, update } = useSettingsStore()
  const {
    detectedUserName,
    openUserNameSettings,
    openSettingsTab,
    selectFeed,
    selectArticle
  } = useUIStore()
  const { unreadCounts, feeds } = useFeedsStore()
  const { markRead } = useArticlesStore()

  const timeOfDay = useMemo(() => getTimeOfDay(), [])
  const effectiveName = useMemo(
    () => getEffectiveUserName(settings.userName, detectedUserName),
    [settings.userName, detectedUserName]
  )

  const greeting = useMemo(
    () => getGreetingText(timeOfDay, effectiveName, t.welcome),
    [timeOfDay, effectiveName, t.welcome]
  )

  const greetingPrefix = useMemo(
    () => getGreetingText(timeOfDay, '', t.welcome),
    [timeOfDay, t.welcome]
  )

  const formattedDate = useMemo(
    () => formatWelcomeDate(new Date(), language),
    [language]
  )

  const totalUnread = useMemo(() => {
    return Object.entries(unreadCounts)
      .filter(([k]) => k !== 'starred' && k !== 'all')
      .reduce((sum, [, count]) => sum + count, 0)
  }, [unreadCounts])

  const totalFeeds = feeds.length
  const formattedUnreadTotal = useMemo(
    () => new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US').format(totalUnread),
    [language, totalUnread]
  )

  const openFirstUnreadArticle = useCallback(async (): Promise<void> => {
    const articles = await window.api.getArticles({ unreadOnly: true, limit: 1, offset: 0 }) as Article[]
    const firstUnread = articles[0]
    if (!firstUnread) return

    selectFeed(null, { unreadOnly: true })
    selectArticle(firstUnread.id)
    void markRead(firstUnread.id, true)
  }, [markRead, selectArticle, selectFeed])

  const TimeIcon = useMemo(() => {
    if (timeOfDay === 'morning') return Coffee
    if (timeOfDay === 'afternoon') return Sun
    return Moon
  }, [timeOfDay])

  const interfaceScale = normalizeInterfaceScale(settings.interfaceScale)
  const adjustInterfaceScale = useCallback((amount: number): void => {
    update({ interfaceScale: normalizeInterfaceScale(interfaceScale + amount) })
  }, [interfaceScale, update])

  return (
    <div className="welcome-lounge" role="region" aria-label={greeting}>
      <div className="welcome-lounge-glow" aria-hidden="true" />

      <div className="welcome-lounge-content">
        {/* Ambient watermark logo */}
        <div className="welcome-lounge-watermark" aria-hidden="true">
          <img src={logoPng} alt="" />
        </div>

        {/* Header pill with greeting and time icon */}
        <div className="welcome-greeting-badge">
          <span className={`welcome-time-icon ${timeOfDay}`}>
            <TimeIcon size={16} />
          </span>
          <span className="welcome-greeting-text">
            {greetingPrefix}
            {effectiveName && ', '}
          </span>
          {effectiveName && (
            <button
              type="button"
              className="welcome-greeting-name"
              onClick={openUserNameSettings}
              aria-label={t.welcome.editName}
              title={t.welcome.editName}
            >
              {effectiveName}
            </button>
          )}
        </div>

        {/* Date and Welcoming titles */}
        <p className="welcome-date">{formattedDate}</p>
        <h1 className="welcome-title">{t.welcome.emptyTitle}</h1>
        <p className="welcome-subtitle">{t.welcome.emptySubtitle}</p>

        {/* Dashboard pulse cards */}
        <div className="welcome-cards-grid">
          {/* Status / Feed pulse card */}
          <div className="welcome-card welcome-card-pulse">
            <div className="welcome-card-header">
              {totalUnread > 0 ? (
                <div className="welcome-card-icon unread">
                  <Sparkles size={18} />
                </div>
              ) : (
                <div className="welcome-card-icon caught-up">
                  <CheckCircle2 size={18} />
                </div>
              )}
              <span className="welcome-card-label">
                {totalUnread > 0 ? t.sidebar.unreadArticles : t.welcome.allCaughtUp}
              </span>
            </div>
            <div className="welcome-card-body">
              {totalUnread > 0 ? (
                <>
                  <div className="welcome-unread-summary">
                    <span className="welcome-unread-count">{formattedUnreadTotal}</span>
                    <span className="welcome-unread-label">
                      {totalUnread === 1
                        ? t.welcome.unreadArticleLabel
                        : t.welcome.unreadArticlesLabel}
                    </span>
                  </div>
                </>
              ) : (
                <p className="welcome-card-main-text caught-up-text">
                  {t.welcome.allCaughtUpDesc}
                </p>
              )}
              {totalFeeds > 0 && (
                <span className="welcome-card-meta">
                  <Rss size={12} />
                  {t.welcome.activeFeeds.replace('{count}', String(totalFeeds))}
                </span>
              )}
              {totalUnread > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary welcome-open-unread"
                  onClick={() => void openFirstUnreadArticle()}
                >
                  {t.welcome.openFirstUnread}
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Quick shortcuts / tips card */}
          <div className="welcome-card welcome-card-tips">
            <div className="welcome-card-header">
              <div className="welcome-card-icon shortcuts">
                <Keyboard size={18} />
              </div>
              <span className="welcome-card-label">{t.welcome.quickActions}</span>
            </div>
            <div className="welcome-card-body">
              <div className="welcome-shortcuts-list">
                <div className="welcome-shortcut-item">
                  <div className="welcome-key-group">
                    <kbd className="welcome-kbd" aria-label={t.welcome.previousArticle}>↑</kbd>
                    <span className="welcome-kbd-sep">/</span>
                    <kbd className="welcome-kbd" aria-label={t.welcome.nextArticle}>↓</kbd>
                    <span className="welcome-kbd-sep">·</span>
                    <kbd className="welcome-kbd">J</kbd>
                    <span className="welcome-kbd-sep">/</span>
                    <kbd className="welcome-kbd">K</kbd>
                  </div>
                  <span className="welcome-shortcut-desc">
                    {t.welcome.navigateArticles}
                  </span>
                </div>
                <div className="welcome-shortcut-item">
                  <kbd className="welcome-kbd">Enter</kbd>
                  <span className="welcome-shortcut-desc">
                    {t.welcome.openAndRead}
                  </span>
                </div>
                <div className="welcome-shortcut-item">
                  <kbd className="welcome-kbd">M</kbd>
                  <span className="welcome-shortcut-desc">
                    {t.welcome.markAsRead}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="welcome-shortcuts-link"
                onClick={() => openSettingsTab('keyboard')}
              >
                {t.welcome.manageShortcuts}
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="welcome-interface-scale" role="group" aria-label={t.welcome.interfaceScale}>
          <span className="welcome-interface-scale-label">{t.welcome.interfaceScale}</span>
          <button
            type="button"
            className="welcome-interface-scale-btn"
            onClick={() => adjustInterfaceScale(-INTERFACE_SCALE_STEP)}
            disabled={interfaceScale <= INTERFACE_SCALE_MIN}
            aria-label={t.welcome.decreaseInterfaceScale}
            title={t.welcome.decreaseInterfaceScale}
          >
            <ZoomOut size={13} />
          </button>
          <output className="welcome-interface-scale-value">{interfaceScale}%</output>
          <button
            type="button"
            className="welcome-interface-scale-btn"
            onClick={() => adjustInterfaceScale(INTERFACE_SCALE_STEP)}
            disabled={interfaceScale >= INTERFACE_SCALE_MAX}
            aria-label={t.welcome.increaseInterfaceScale}
            title={t.welcome.increaseInterfaceScale}
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </div>
  )
})

export default WelcomeLounge
