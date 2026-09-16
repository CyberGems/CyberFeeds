import { memo, useState, useEffect, useRef } from 'react'
import logoPng from '../../../../resources/icon.png'
import {
  Inbox,
  Bell,
  Settings,
  Minus,
  Maximize2,
  Minimize2,
  X,
  LayoutTemplate,
  MoreHorizontal,
  Heart,
  RefreshCw,
  Pause,
  Play,
  Stethoscope,
  Book,
  HelpCircle,
  Tag,
  Globe,
  Info
} from 'lucide-react'
import { useUIStore } from '../store/ui.store'
import { useSettingsStore } from '../store/settings.store'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'

const DONATE_URL = 'https://github.com/CyberGems/CyberFeeds#%EF%B8%8F-donate'
const WIKI_URL = 'https://github.com/CyberGems/CyberFeeds/wiki'
const FAQ_URL = 'https://github.com/CyberGems/CyberFeeds/wiki/FAQ'
const CHANGELOG_URL = 'https://github.com/CyberGems/CyberFeeds/releases'
const HOMEPAGE_URL = 'https://cybergems.org'

const TopBar = memo(function TopBar(): JSX.Element {
  const { openPanel, setLayout, layout, unseenNotificationsCount } = useUIStore()
  const { settings, update } = useSettingsStore()
  const { t } = useTranslation()
  const [maximized, setMaximized] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const historyLimit = settings.notifications?.historyLimit ?? 1000
  const isHistoryLimitReached = historyLimit > 0 && unseenNotificationsCount >= historyLimit
  const notificationTooltip = isHistoryLimitReached
    ? `${t.topBar.notificationHistory} (${t.topBar.limitReached})`
    : t.topBar.notificationHistory

  useEffect(() => {
    window.api.isMaximized().then(setMaximized)
    const cleanup = window.api.onMaximizedChange(setMaximized)
    return cleanup
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const cycleLayout = (): void => {
    const layouts: Array<'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split'> = [
      'three-panel',
      'two-panel',
      'one-panel',
      'horizontal-split'
    ]
    const next = layouts[(layouts.indexOf(layout) + 1) % layouts.length]
    setLayout(next)
    update({ layout: next })
  }

  const handleTogglePolling = async (): Promise<void> => {
    setMenuOpen(false)
    const res = await window.api.togglePolling()
    if (res?.ok && typeof res.pollingEnabled === 'boolean') {
      update({ pollingEnabled: res.pollingEnabled })
    }
  }

  return (
    <div className="topbar">
      <Tooltip label={t.topBar.about} placement="bottom">
        <button
          className="topbar-brand"
          onClick={() => openPanel('about')}
          aria-label={t.topBar.about}
        >
          <img src={logoPng} alt="CyberFeeds" style={{ width: 16, height: 16, objectFit: 'contain', marginRight: 6 }} />
          <span>Cyber<span className="brand-feeds">Feeds</span></span>
        </button>
      </Tooltip>
      <div className="topbar-drag" />

      <Tooltip label={notificationTooltip} placement="bottom">
        <button
          className="btn btn-ghost btn-icon no-drag"
          onClick={() => {
            openPanel('history')
          }}
          style={{ position: 'relative' }}
          aria-label={notificationTooltip}
        >
          <Bell size={15} style={{ color: isHistoryLimitReached ? 'var(--red, #f85149)' : undefined }} />
          {unseenNotificationsCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 1,
                right: unseenNotificationsCount >= 100 ? -4 : 1,
                background: isHistoryLimitReached ? 'var(--red, #f85149)' : 'var(--accent)',
                color: '#ffffff',
                textShadow: '0 0.5px 1.5px rgba(0,0,0,0.4)',
                borderRadius: 8,
                minWidth: 15,
                height: 15,
                padding: '0 3.5px',
                fontSize: unseenNotificationsCount >= 1000 ? 8 : 9,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isHistoryLimitReached ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid var(--bg-0)',
                boxShadow: isHistoryLimitReached
                  ? '0 0 6px rgba(248, 81, 73, 0.7)'
                  : '0 0 4px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
                lineHeight: 1
              }}
            >
              {unseenNotificationsCount}
            </span>
          )}
        </button>
      </Tooltip>
      <Tooltip label={t.topBar.inboxToday} placement="bottom">
        <button className="btn btn-ghost btn-icon no-drag" onClick={() => openPanel('inbox')}>
          <Inbox size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t.topBar.toggleLayout} placement="bottom">
        <button className="btn btn-ghost btn-icon no-drag" onClick={cycleLayout}>
          <LayoutTemplate size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t.topBar.settings} placement="bottom">
        <button className="btn btn-ghost btn-icon no-drag" onClick={() => openPanel('settings')}>
          <Settings size={15} />
        </button>
      </Tooltip>

      {/* More Options Menu Dropdown */}
      <div className="topbar-menu-wrapper" ref={menuRef}>
        <Tooltip label={menuOpen ? '' : t.topBar.more} placement="bottom">
          <button
            className={`btn btn-ghost btn-icon no-drag ${menuOpen ? 'active' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={15} />
          </button>
        </Tooltip>

        {menuOpen && (
          <div className="topbar-dropdown-menu" role="menu">
            <button
              className="topbar-menu-item donate"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(DONATE_URL)
              }}
            >
              <Heart size={14} />
              <span>{t.topBar.moreMenu.donate}</span>
            </button>

            <div className="topbar-menu-divider" />

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                window.api.fetchAllFeeds()
              }}
            >
              <RefreshCw size={14} />
              <span>{t.topBar.moreMenu.refreshAll}</span>
            </button>

            <button className="topbar-menu-item" onClick={handleTogglePolling}>
              {settings.pollingEnabled ? <Pause size={14} /> : <Play size={14} />}
              <span>{settings.pollingEnabled ? t.topBar.moreMenu.pauseFeeds : t.topBar.moreMenu.resumeFeeds}</span>
            </button>

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                openPanel('doctor')
              }}
            >
              <Stethoscope size={14} />
              <span>{t.topBar.moreMenu.feedsDoctor}</span>
            </button>

            <div className="topbar-menu-divider" />

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(WIKI_URL)
              }}
            >
              <Book size={14} />
              <span>{t.topBar.moreMenu.docs}</span>
            </button>

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(FAQ_URL)
              }}
            >
              <HelpCircle size={14} />
              <span>{t.topBar.moreMenu.faq}</span>
            </button>

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(CHANGELOG_URL)
              }}
            >
              <Tag size={14} />
              <span>{t.topBar.moreMenu.changelog}</span>
            </button>

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(HOMEPAGE_URL)
              }}
            >
              <Globe size={14} />
              <span>{t.topBar.moreMenu.website}</span>
            </button>

            <div className="topbar-menu-divider" />

            <button
              className="topbar-menu-item"
              onClick={() => {
                setMenuOpen(false)
                openPanel('about')
              }}
            >
              <Info size={14} />
              <span>{t.topBar.moreMenu.about}</span>
            </button>
          </div>
        )}
      </div>

      <div className="divider" style={{ width: 1, height: 18, margin: '0 4px' }} />

      <div className="win-controls">
        <Tooltip label={t.topBar.minimize} placement="bottom">
          <button className="win-btn" onClick={() => window.api.windowMinimize()}>
            <Minus size={13} />
          </button>
        </Tooltip>
        <Tooltip label={maximized ? t.topBar.restore : t.topBar.maximize} placement="bottom">
          <button className="win-btn" onClick={() => window.api.windowMaximize()}>
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </Tooltip>
        <Tooltip
          label={settings.minimizeToTray ? t.topBar.minimizeToTray : t.topBar.close}
          placement="bottom"
        >
          <button className="win-btn close" onClick={() => window.api.windowClose()}>
            <X size={13} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
})

export default TopBar
