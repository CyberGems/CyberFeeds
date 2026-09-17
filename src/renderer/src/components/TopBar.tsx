import { memo, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, type ReactNode } from 'react'
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
import { getTimeOfDay, getEffectiveUserName, getGreetingText } from '@shared/welcome'

const DONATE_URL = 'https://github.com/CyberGems/CyberFeeds#%EF%B8%8F-donate'
const WIKI_URL = 'https://github.com/CyberGems/CyberFeeds/wiki'
const FAQ_URL = 'https://github.com/CyberGems/CyberFeeds/wiki/FAQ'
const CHANGELOG_URL = 'https://github.com/CyberGems/CyberFeeds/releases'
const HOMEPAGE_URL = 'https://cybergems.org'

function withShortcut(label: string, shortcut: string): ReactNode {
  return (
    <>
      <span>{label}</span>
      <kbd className="tooltip-shortcut">{shortcut}</kbd>
    </>
  )
}

const TopBar = memo(function TopBar(): JSX.Element {
  const {
    openPanel,
    setLayout,
    layout,
    unseenNotificationsCount,
    detectedUserName,
    setTopbarMenuOpen
  } = useUIStore()
  const { settings, update } = useSettingsStore()
  const { t } = useTranslation()
  const [maximized, setMaximized] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuKeyboardIndex, setMenuKeyboardIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const timeOfDay = useMemo(() => getTimeOfDay(), [])
  const effectiveName = useMemo(
    () => getEffectiveUserName(settings.userName, detectedUserName),
    [settings.userName, detectedUserName]
  )
  const greeting = useMemo(
    () => getGreetingText(timeOfDay, effectiveName, t.welcome),
    [timeOfDay, effectiveName, t.welcome]
  )

  const historyLimit = settings.notifications?.historyLimit ?? 1000
  const isHistoryLimitReached = historyLimit > 0 && unseenNotificationsCount >= historyLimit
  const notificationTooltip = isHistoryLimitReached
    ? `${t.topBar.notificationHistory} (${t.topBar.limitReached})`
    : t.topBar.notificationHistory

  const getMenuItems = useCallback(() => {
    return Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.topbar-menu-item') ?? [])
  }, [])

  const focusMenuItem = useCallback((index: number): boolean => {
    const items = getMenuItems()
    if (items.length === 0) return false

    const nextIndex = (index + items.length) % items.length
    setMenuKeyboardIndex(nextIndex)
    items[nextIndex]?.focus()
    return true
  }, [getMenuItems])

  const moveMenuFocus = useCallback((key: string): boolean => {
    const items = getMenuItems()
    if (items.length === 0) return false

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const baseIndex = currentIndex < 0 ? menuKeyboardIndex : currentIndex
    let nextIndex: number | null = null
    if (key === 'ArrowDown') nextIndex = (baseIndex + 1) % items.length
    if (key === 'ArrowUp') nextIndex = (baseIndex - 1 + items.length) % items.length
    if (key === 'Home') nextIndex = 0
    if (key === 'End') nextIndex = items.length - 1

    if (nextIndex === null) return false
    return focusMenuItem(nextIndex)
  }, [focusMenuItem, getMenuItems, menuKeyboardIndex])

  useEffect(() => {
    setTopbarMenuOpen(menuOpen)
    return () => setTopbarMenuOpen(false)
  }, [menuOpen, setTopbarMenuOpen])

  useLayoutEffect(() => {
    if (!menuOpen) return
    focusMenuItem(0)
  }, [focusMenuItem, menuOpen])

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
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const handleMenuKeyboardNavigation = (e: KeyboardEvent): void => {
      if (moveMenuFocus(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if (e.key === 'Enter' || e.key === ' ') {
        const item = getMenuItems()[menuKeyboardIndex]
        if (!item) return
        e.preventDefault()
        e.stopPropagation()
        item.click()
      }
    }

    document.addEventListener('keydown', handleMenuKeyboardNavigation, true)
    return () => document.removeEventListener('keydown', handleMenuKeyboardNavigation, true)
  }, [getMenuItems, menuKeyboardIndex, menuOpen, moveMenuFocus])

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setMenuOpen(false)
      menuButtonRef.current?.focus()
      return
    }

    if (moveMenuFocus(e.key)) {
      e.preventDefault()
    }
  }

  const cycleLayout = useCallback((): void => {
    const layouts: Array<'three-panel' | 'two-panel' | 'one-panel' | 'horizontal-split'> = [
      'three-panel',
      'two-panel',
      'one-panel',
      'horizontal-split'
    ]
    const next = layouts[(layouts.indexOf(layout) + 1) % layouts.length]
    setLayout(next)
    update({ layout: next })
  }, [layout, setLayout, update])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    }

    const handleTitlebarShortcut = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target) || useUIStore.getState().activePanel) return

      if (menuOpen && moveMenuFocus(e.key)) {
        e.preventDefault()
        return
      }

      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === 'F1') {
          e.preventDefault()
          openPanel('about')
        } else if (e.key === 'F10') {
          e.preventDefault()
          const nextOpen = !menuOpen
          setTopbarMenuOpen(nextOpen)
          setMenuKeyboardIndex(0)
          setMenuOpen(nextOpen)
        }
        return
      }

      if (!e.ctrlKey || e.altKey || e.metaKey) return

      const key = e.key.toLowerCase()
      if (key === 'h') {
        e.preventDefault()
        openPanel('history')
      } else if (key === 'i') {
        e.preventDefault()
        openPanel('inbox')
      } else if (key === 'l') {
        e.preventDefault()
        cycleLayout()
      } else if (key === ',') {
        e.preventDefault()
        openPanel('settings')
      } else if (key === 'm') {
        e.preventDefault()
        if (e.shiftKey) {
          void window.api.windowMaximize()
        } else {
          void window.api.windowMinimize()
        }
      } else if (key === 'w' && !e.shiftKey) {
        e.preventDefault()
        void window.api.windowClose()
      }
    }

    window.addEventListener('keydown', handleTitlebarShortcut)
    return () => window.removeEventListener('keydown', handleTitlebarShortcut)
  }, [cycleLayout, menuOpen, moveMenuFocus, openPanel, setTopbarMenuOpen])

  const handleTogglePolling = async (): Promise<void> => {
    setMenuOpen(false)
    const res = await window.api.togglePolling()
    if (res?.ok && typeof res.pollingEnabled === 'boolean') {
      update({ pollingEnabled: res.pollingEnabled })
    }
  }

  return (
    <div className="topbar">
      <Tooltip label={withShortcut(t.topBar.about, 'F1')} placement="bottom">
        <button
          className="topbar-brand"
          onClick={() => openPanel('about')}
          aria-label={t.topBar.about}
        >
          <img src={logoPng} alt="CyberFeeds" style={{ width: 16, height: 16, objectFit: 'contain', marginRight: 6 }} />
          <span>Cyber<span className="brand-feeds">Feeds</span></span>
        </button>
      </Tooltip>
      <div className="topbar-drag">
        {settings.showWelcomeGreeting !== false && (
          <div className="topbar-welcome" aria-label={greeting}>
            <span className="topbar-welcome-dot" aria-hidden="true" />
            <span className="topbar-welcome-text">{greeting}</span>
          </div>
        )}
      </div>

      <Tooltip label={withShortcut(notificationTooltip, 'Ctrl+H')} placement="bottom">
        <button
          className="btn btn-ghost btn-icon no-drag"
          onClick={() => {
            openPanel('history')
          }}
          style={{ position: 'relative' }}
          aria-label={notificationTooltip}
        >
          <Bell size={15} />
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
                border: '1px solid var(--bg-0)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
                pointerEvents: 'none',
                lineHeight: 1
              }}
            >
              {unseenNotificationsCount}
            </span>
          )}
        </button>
      </Tooltip>
      <Tooltip label={withShortcut(t.topBar.inboxToday, 'Ctrl+I')} placement="bottom">
        <button className="btn btn-ghost btn-icon no-drag" onClick={() => openPanel('inbox')}>
          <Inbox size={15} />
        </button>
      </Tooltip>
      <Tooltip label={withShortcut(t.topBar.toggleLayout, 'Ctrl+L')} placement="bottom">
        <button className="btn btn-ghost btn-icon no-drag" onClick={cycleLayout}>
          <LayoutTemplate size={15} />
        </button>
      </Tooltip>
      <Tooltip label={withShortcut(t.topBar.settings, 'Ctrl+,')} placement="bottom">
        <button className="btn btn-ghost btn-icon no-drag" onClick={() => openPanel('settings')}>
          <Settings size={15} />
        </button>
      </Tooltip>

      {/* More Options Menu Dropdown */}
      <div className="topbar-menu-wrapper" ref={menuRef}>
        <Tooltip label={menuOpen ? '' : withShortcut(t.topBar.more, 'F10')} placement="bottom">
          <button
            ref={menuButtonRef}
            className={`btn btn-ghost btn-icon no-drag ${menuOpen ? 'active' : ''}`}
            onClick={() => {
              const nextOpen = !menuOpen
              setTopbarMenuOpen(nextOpen)
              setMenuKeyboardIndex(0)
              setMenuOpen(nextOpen)
            }}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={15} />
          </button>
        </Tooltip>

        {menuOpen && (
          <div className="topbar-dropdown-menu" role="menu" onKeyDown={handleMenuKeyDown}>
            <button
              className={`topbar-menu-item donate${menuKeyboardIndex === 0 ? ' keyboard-active' : ''}`}
              role="menuitem"
              autoFocus
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
              className={`topbar-menu-item${menuKeyboardIndex === 1 ? ' keyboard-active' : ''}`}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                window.api.fetchAllFeeds()
              }}
            >
              <RefreshCw size={14} />
              <span>{t.topBar.moreMenu.refreshAll}</span>
            </button>

            <button
              className={`topbar-menu-item${menuKeyboardIndex === 2 ? ' keyboard-active' : ''}`}
              role="menuitem"
              onClick={handleTogglePolling}
            >
              {settings.pollingEnabled ? <Pause size={14} /> : <Play size={14} />}
              <span>{settings.pollingEnabled ? t.topBar.moreMenu.pauseFeeds : t.topBar.moreMenu.resumeFeeds}</span>
            </button>

            <button
              className={`topbar-menu-item${menuKeyboardIndex === 3 ? ' keyboard-active' : ''}`}
              role="menuitem"
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
              className={`topbar-menu-item${menuKeyboardIndex === 4 ? ' keyboard-active' : ''}`}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(WIKI_URL)
              }}
            >
              <Book size={14} />
              <span>{t.topBar.moreMenu.docs}</span>
            </button>

            <button
              className={`topbar-menu-item${menuKeyboardIndex === 5 ? ' keyboard-active' : ''}`}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(FAQ_URL)
              }}
            >
              <HelpCircle size={14} />
              <span>{t.topBar.moreMenu.faq}</span>
            </button>

            <button
              className={`topbar-menu-item${menuKeyboardIndex === 6 ? ' keyboard-active' : ''}`}
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                window.api.openExternal(CHANGELOG_URL)
              }}
            >
              <Tag size={14} />
              <span>{t.topBar.moreMenu.changelog}</span>
            </button>

            <button
              className={`topbar-menu-item${menuKeyboardIndex === 7 ? ' keyboard-active' : ''}`}
              role="menuitem"
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
              className={`topbar-menu-item${menuKeyboardIndex === 8 ? ' keyboard-active' : ''}`}
              role="menuitem"
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
        <Tooltip label={withShortcut(t.topBar.minimize, 'Ctrl+M')} placement="bottom">
          <button className="win-btn" onClick={() => window.api.windowMinimize()}>
            <Minus size={13} />
          </button>
        </Tooltip>
        <Tooltip
          label={withShortcut(maximized ? t.topBar.restore : t.topBar.maximize, 'Ctrl+Shift+M')}
          placement="bottom"
        >
          <button className="win-btn" onClick={() => window.api.windowMaximize()}>
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </Tooltip>
        <Tooltip
          label={withShortcut(settings.minimizeToTray ? t.topBar.minimizeToTray : t.topBar.close, 'Ctrl+W')}
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
