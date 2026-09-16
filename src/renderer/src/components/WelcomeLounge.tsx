import { memo, useMemo } from 'react'
import {
  Sun,
  Sunrise,
  Moon,
  Sparkles,
  CheckCircle2,
  Keyboard,
  Rss
} from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import { useSettingsStore } from '../store/settings.store'
import { useUIStore } from '../store/ui.store'
import { useFeedsStore } from '../store/feeds.store'
import {
  getTimeOfDay,
  getEffectiveUserName,
  getGreetingText,
  formatWelcomeDate
} from '@shared/welcome'
import logoPng from '../../../../resources/icon.png'

const WelcomeLounge = memo(function WelcomeLounge(): JSX.Element {
  const { t, language } = useTranslation()
  const { settings } = useSettingsStore()
  const { detectedUserName } = useUIStore()
  const { unreadCounts, feeds } = useFeedsStore()

  const timeOfDay = useMemo(() => getTimeOfDay(), [])
  const effectiveName = useMemo(
    () => getEffectiveUserName(settings.userName, detectedUserName),
    [settings.userName, detectedUserName]
  )

  const greeting = useMemo(
    () => getGreetingText(timeOfDay, effectiveName, t.welcome),
    [timeOfDay, effectiveName, t.welcome]
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

  const TimeIcon = useMemo(() => {
    if (timeOfDay === 'morning') return Sunrise
    if (timeOfDay === 'afternoon') return Sun
    return Moon
  }, [timeOfDay])

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
          <span className="welcome-greeting-text">{greeting}</span>
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
                <p className="welcome-card-main-text">
                  {totalUnread === 1
                    ? t.welcome.oneUnreadArticle
                    : t.welcome.unreadArticlesCount.replace('{count}', String(totalUnread))}
                </p>
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
                    <kbd className="welcome-kbd">J</kbd>
                    <span className="welcome-kbd-sep">/</span>
                    <kbd className="welcome-kbd">K</kbd>
                  </div>
                  <span className="welcome-shortcut-desc">
                    {language === 'es' ? 'Navegar artículos' : 'Navigate articles'}
                  </span>
                </div>
                <div className="welcome-shortcut-item">
                  <kbd className="welcome-kbd">Enter</kbd>
                  <span className="welcome-shortcut-desc">
                    {language === 'es' ? 'Abrir lectura' : 'Open & read'}
                  </span>
                </div>
                <div className="welcome-shortcut-item">
                  <kbd className="welcome-kbd">M</kbd>
                  <span className="welcome-shortcut-desc">
                    {language === 'es' ? 'Marcar leído' : 'Mark as read'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default WelcomeLounge
