import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Bug,
  ChevronRight,
  Eye,
  EyeOff,
  Gem,
  Globe,
  Heart,
  HelpCircle,
  Info,
  Pause,
  Play,
  Power,
  RefreshCw,
  ScrollText,
  Settings
} from 'lucide-react'
import { translations } from '../../shared/translations'
import type { TrayMenuSnapshot } from '../../shared/types'

import suiteClockPng from '../../../resources/suite/cyberclock.png'
import suiteLauncherPng from '../../../resources/suite/cyberlauncher.png'
import suiteManagerPng from '../../../resources/suite/cybermanager.png'
import suiteNotesPng from '../../../resources/suite/cybernotes.png'
import suitePastePng from '../../../resources/suite/cyberpaste.png'
import suiteSnapPng from '../../../resources/suite/cybersnap.png'
import suiteTrayPng from '../../../resources/suite/cybertray.png'
import suiteViewerPng from '../../../resources/suite/cyberviewer.png'
import suiteWallPng from '../../../resources/suite/cyberwall.png'
import brandIconPng from '../../../resources/icon.png'

type TrayFlyoutId = 'help' | 'suite'

const INITIAL_SNAPSHOT: TrayMenuSnapshot = {
  version: '1.28.0',
  windowState: 'hidden',
  hotkey: null,
  fetchHotkey: null,
  settingsHotkey: null,
  pollingEnabled: true,
  isPolling: false,
  language: 'es',
  theme: 'dark',
  showSuitePromo: true,
  flyoutSide: 'left',
  verticalAlign: 'bottom'
}

const HELP_URLS = {
  docs: 'https://github.com/CyberGems/CyberFeeds/wiki',
  faq: 'https://github.com/CyberGems/CyberFeeds/wiki/FAQ',
  changelog: 'https://github.com/CyberGems/CyberFeeds/releases',
  website: 'https://cybergems.org',
  donate: 'https://github.com/CyberGems/CyberFeeds#%EF%B8%8F-donate',
  issues: 'https://github.com/CyberGems/CyberFeeds/issues',
  suite: 'https://cybergems.org/#apps'
}

const SUITE_APPS = [
  {
    slug: 'cyberclock',
    name: 'CyberClock',
    icon: suiteClockPng,
    site: 'https://cybergems.org/apps/cyberclock/',
    short: { es: 'Reloj de escritorio', en: 'Desktop Clock' }
  },
  {
    slug: 'cyberlauncher',
    name: 'CyberLauncher',
    icon: suiteLauncherPng,
    site: 'https://cybergems.org/apps/cyberlauncher/',
    short: { es: 'Lanzador de apps', en: 'App Launcher' }
  },
  {
    slug: 'cybermanager',
    name: 'CyberManager',
    icon: suiteManagerPng,
    site: 'https://cybergems.org/apps/cybermanager/',
    short: { es: 'Administrador de tareas', en: 'Task Manager' }
  },
  {
    slug: 'cybernotes',
    name: 'CyberNotes',
    icon: suiteNotesPng,
    site: 'https://cybergems.org/apps/cybernotes/',
    short: { es: 'Notas rápidas', en: 'Fast Note Taking' }
  },
  {
    slug: 'cyberpaste',
    name: 'CyberPaste',
    icon: suitePastePng,
    site: 'https://cybergems.org/apps/cyberpaste/',
    short: { es: 'Portapapeles', en: 'Clipboard Manager' }
  },
  {
    slug: 'cybersnap',
    name: 'CyberSnap',
    icon: suiteSnapPng,
    site: 'https://cybergems.org/apps/cybersnap/',
    short: { es: 'Captura de pantalla', en: 'Screen Capture' }
  },
  {
    slug: 'cybertray',
    name: 'CyberTray',
    icon: suiteTrayPng,
    site: 'https://cybergems.org/apps/cybertray/',
    short: { es: 'Accesos directos', en: 'Shortcut Manager' }
  },
  {
    slug: 'cyberviewer',
    name: 'CyberViewer',
    icon: suiteViewerPng,
    site: 'https://cybergems.org/apps/cyberviewer/',
    short: { es: 'Visor de imágenes', en: 'Image Viewer' }
  },
  {
    slug: 'cyberwall',
    name: 'CyberWall',
    icon: suiteWallPng,
    site: 'https://cybergems.org/apps/cyberwall/',
    short: { es: 'Firewall', en: 'Firewall' }
  }
]

export function TrayMenu(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<TrayMenuSnapshot>(INITIAL_SNAPSHOT)
  const [activeFlyout, setActiveFlyout] = useState<TrayFlyoutId | null>(null)
  const activeFlyoutRef = useRef<TrayFlyoutId | null>(null)
  activeFlyoutRef.current = activeFlyout
  const cardRef = useRef<HTMLDivElement>(null)
  const helpFlyoutRef = useRef<HTMLDivElement>(null)
  const suiteFlyoutRef = useRef<HTMLDivElement>(null)
  const flyoutTimersRef = useRef<{ open: number | null; close: number | null }>({
    open: null,
    close: null
  })

  const lang = snapshot.language === 'en' ? 'en' : 'es'
  const t = translations[lang].mainProcess.tray
  const flyoutSide = snapshot.flyoutSide === 'right' ? 'right' : 'left'
  const verticalAlign = snapshot.verticalAlign === 'top' ? 'top' : 'bottom'

  const isVisible = snapshot.windowState === 'visible'
  const isMinimized = snapshot.windowState === 'minimized'

  const statusLabel = isVisible ? t.statusVisible : isMinimized ? t.statusMinimized : t.statusHidden

  const statusTone = isVisible ? '' : isMinimized ? 'is-minimized' : 'is-hidden'

  const cancelFlyoutTimers = useCallback(() => {
    if (flyoutTimersRef.current.open !== null) window.clearTimeout(flyoutTimersRef.current.open)
    if (flyoutTimersRef.current.close !== null) window.clearTimeout(flyoutTimersRef.current.close)
    flyoutTimersRef.current = { open: null, close: null }
  }, [])

  const scheduleFlyoutOpen = useCallback(
    (target: TrayFlyoutId) => {
      cancelFlyoutTimers()
      if (activeFlyoutRef.current === target) return
      const delay = activeFlyoutRef.current !== null ? 60 : 120
      flyoutTimersRef.current.open = window.setTimeout(() => {
        flyoutTimersRef.current.open = null
        setActiveFlyout(target)
      }, delay)
    },
    [cancelFlyoutTimers]
  )

  const scheduleFlyoutClose = useCallback(() => {
    cancelFlyoutTimers()
    if (activeFlyoutRef.current === null) return
    flyoutTimersRef.current.close = window.setTimeout(() => {
      flyoutTimersRef.current.close = null
      setActiveFlyout(null)
    }, 220)
  }, [cancelFlyoutTimers])

  const getFlyoutElement = (target: TrayFlyoutId | null): HTMLDivElement | null => {
    if (target === 'help') return helpFlyoutRef.current
    if (target === 'suite') return suiteFlyoutRef.current
    return null
  }

  const openFlyoutAndFocusFirst = useCallback(
    (target: TrayFlyoutId) => {
      cancelFlyoutTimers()
      setActiveFlyout(target)
      window.requestAnimationFrame(() => {
        getFlyoutElement(target)
          ?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
          ?.focus()
      })
    },
    [cancelFlyoutTimers]
  )

  const closeFlyoutAndReturnFocus = useCallback(() => {
    const previous = activeFlyoutRef.current
    cancelFlyoutTimers()
    setActiveFlyout(null)
    if (previous && cardRef.current) {
      cardRef.current.querySelector<HTMLButtonElement>(`[data-flyout-trigger="${previous}"]`)?.focus()
    }
  }, [cancelFlyoutTimers])

  const measureCardHeight = (el: HTMLDivElement | null): number => {
    if (!el) return 0
    const borderY = el.offsetHeight - el.clientHeight
    return Math.ceil(el.scrollHeight + borderY + 28)
  }

  const reportSize = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    const width = 568
    const height = Math.max(
      measureCardHeight(card),
      measureCardHeight(helpFlyoutRef.current),
      snapshot.showSuitePromo ? measureCardHeight(suiteFlyoutRef.current) : 0
    )
    if (width < 10 || height < 10) return
    void window.api.trayMenu.reportSize({ width, height })
  }, [snapshot.showSuitePromo])

  const applySnapshot = useCallback((next: TrayMenuSnapshot) => {
    setSnapshot(next)
    const theme = next.theme || 'dark'
    document.documentElement.dataset.theme =
      theme === 'grayscale' ? 'grayscale' : theme === 'light' ? 'light' : 'dark'
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.trayMenu.getState()
      applySnapshot(next)
    } catch {
      // fallback
    }
  }, [applySnapshot])

  const runAction = (action: string): void => {
    cancelFlyoutTimers()
    setActiveFlyout(null)
    void window.api.trayMenu.action(action)
  }

  const openExternal = (url: string): void => {
    cancelFlyoutTimers()
    setActiveFlyout(null)
    try {
      if (typeof window.api?.openExternal === 'function') {
        void window.api.openExternal(url)
      } else if (typeof window.api?.trayMenu?.openExternal === 'function') {
        void window.api.trayMenu.openExternal(url)
      }
    } catch (e) {
      console.error('Failed to open external URL:', e)
    }
    void window.api?.trayMenu?.hide()
  }

  useEffect(() => {
    let active = true
    window.api.trayMenu
      .getState()
      .then((next) => {
        if (!active) return
        applySnapshot(next)
        window.requestAnimationFrame(() => window.requestAnimationFrame(reportSize))
      })
      .catch(() => {})

    const removeListener = window.api.trayMenu.onShow((snap) => {
      if (snap) {
        applySnapshot(snap)
      } else {
        void refresh()
      }
      cancelFlyoutTimers()
      setActiveFlyout(null)
    })
    return () => {
      active = false
      cancelFlyoutTimers()
      removeListener()
    }
  }, [applySnapshot, cancelFlyoutTimers, refresh, reportSize])

  useEffect(() => {
    reportSize()
    const rafId = window.requestAnimationFrame(() => {
      reportSize()
      window.requestAnimationFrame(reportSize)
    })
    const timer = setTimeout(reportSize, 50)
    return () => {
      window.cancelAnimationFrame(rafId)
      clearTimeout(timer)
    }
  }, [snapshot.language, snapshot.showSuitePromo, reportSize])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const openFlyoutEl = getFlyoutElement(activeFlyoutRef.current)
      const activeEl = document.activeElement as HTMLElement | null
      const inFlyout = Boolean(openFlyoutEl && activeEl && openFlyoutEl.contains(activeEl))
      const openKey = flyoutSide === 'left' ? 'ArrowLeft' : 'ArrowRight'
      const closeKey = flyoutSide === 'left' ? 'ArrowRight' : 'ArrowLeft'

      if (event.key === 'Escape') {
        event.preventDefault()
        if (activeFlyoutRef.current !== null) {
          closeFlyoutAndReturnFocus()
        } else {
          void window.api.trayMenu.hide()
        }
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const scope = inFlyout && openFlyoutEl ? openFlyoutEl : cardRef.current
        if (!scope) return
        const buttons = Array.from(
          scope.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')
        )
        if (buttons.length === 0) return
        event.preventDefault()
        const idx = activeEl ? buttons.indexOf(activeEl as HTMLButtonElement) : -1
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const nextIdx =
          idx === -1
            ? delta > 0
              ? 0
              : buttons.length - 1
            : (idx + delta + buttons.length) % buttons.length
        buttons[nextIdx]?.focus()
        return
      }

      if (event.key === openKey || (!inFlyout && event.key === closeKey)) {
        const triggerTarget = activeEl?.dataset?.flyoutTrigger as TrayFlyoutId | undefined
        if (!inFlyout && triggerTarget) {
          event.preventDefault()
          openFlyoutAndFocusFirst(triggerTarget)
          return
        }
      }

      if (event.key === closeKey && activeFlyoutRef.current !== null) {
        event.preventDefault()
        closeFlyoutAndReturnFocus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeFlyoutAndReturnFocus, flyoutSide, openFlyoutAndFocusFirst])

  return (
    <div
      className="tray-root"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => {
        const target = e.target as Node
        if (cardRef.current?.contains(target)) return
        if (getFlyoutElement(activeFlyout)?.contains(target)) return
        cancelFlyoutTimers()
        setActiveFlyout(null)
        void window.api.trayMenu.hide()
      }}
    >
      <div
        className="tray-stage"
        data-flyout-side={flyoutSide}
        data-vertical-align={verticalAlign}
      >
        {/* Main Card */}
        <div
          className="tray-card"
          role="menu"
          aria-label="CyberFeeds"
          ref={cardRef}
          onMouseLeave={() => scheduleFlyoutClose()}
        >
          <button
            type="button"
            className="tray-header"
            title={t.headerTooltip}
            onMouseEnter={() => scheduleFlyoutClose()}
            onClick={() => runAction('about')}
          >
            <img className="tray-header-icon" src={brandIconPng} alt="" />
            <span className="tray-header-name">
              Cyber<span className="tray-header-accent">Feeds</span>
            </span>
            <span className="tray-header-version">v{snapshot.version}</span>
          </button>

          <div className="tray-divider" />

          {/* Window state indicator & Toggle */}
          <div className="tray-group">
            <div
              className={`tray-status ${statusTone}`}
              role="status"
              onMouseEnter={() => scheduleFlyoutClose()}
            >
              <span className="tray-status-dot" aria-hidden="true" />
              <span className="tray-status-text">{statusLabel}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              className="tray-item"
              onMouseEnter={() => scheduleFlyoutClose()}
              onClick={() => runAction('toggle')}
            >
              <span className="tray-item-icon">
                {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </span>
              <span className="tray-item-label">{isVisible ? t.hide : t.show}</span>
              {snapshot.hotkey && <span className="tray-item-hotkey">{snapshot.hotkey}</span>}
            </button>
          </div>

          <div className="tray-divider" />

          {/* Feeds operations */}
          <div className="tray-group">
            <button
              type="button"
              role="menuitem"
              className="tray-item"
              onMouseEnter={() => scheduleFlyoutClose()}
              onClick={() => runAction('poll')}
            >
              <span className="tray-item-icon">
                <RefreshCw size={16} className={snapshot.isPolling ? 'lucide-spin' : ''} />
              </span>
              <span className="tray-item-label">{t.updateFeeds}</span>
              {snapshot.fetchHotkey && (
                <span className="tray-item-hotkey">{snapshot.fetchHotkey}</span>
              )}
            </button>
            <button
              type="button"
              role="menuitem"
              className="tray-item"
              onMouseEnter={() => scheduleFlyoutClose()}
              onClick={() => runAction('togglePolling')}
            >
              <span className="tray-item-icon">
                {snapshot.pollingEnabled ? <Pause size={16} /> : <Play size={16} />}
              </span>
              <span className="tray-item-label">
                {snapshot.pollingEnabled ? t.pauseFeeds : t.resumeFeeds}
              </span>
            </button>
          </div>

          <div className="tray-divider" />

          {/* Navigation & settings */}
          <div className="tray-group">
            <button
              type="button"
              role="menuitem"
              className="tray-item"
              onMouseEnter={() => scheduleFlyoutClose()}
              onClick={() => runAction('settings')}
            >
              <span className="tray-item-icon">
                <Settings size={16} />
              </span>
              <span className="tray-item-label">{t.settings}</span>
              {snapshot.settingsHotkey && (
                <span className="tray-item-hotkey">{snapshot.settingsHotkey}</span>
              )}
            </button>
            <button
              type="button"
              role="menuitem"
              data-flyout-trigger="help"
              aria-haspopup="menu"
              aria-expanded={activeFlyout === 'help'}
              className={`tray-item tray-nav-item${activeFlyout === 'help' ? ' is-flyout-open' : ''}`}
              onMouseEnter={() => scheduleFlyoutOpen('help')}
              onClick={() => {
                cancelFlyoutTimers()
                setActiveFlyout((prev) => (prev === 'help' ? null : 'help'))
              }}
            >
              <span className="tray-item-icon">
                <HelpCircle size={16} />
              </span>
              <span className="tray-item-label">{t.help}</span>
              <span className="tray-nav-arrow">
                <ChevronRight size={14} />
              </span>
            </button>
            {snapshot.showSuitePromo && (
              <button
                type="button"
                role="menuitem"
                data-flyout-trigger="suite"
                aria-haspopup="menu"
                aria-expanded={activeFlyout === 'suite'}
                className={`tray-item tray-nav-item${activeFlyout === 'suite' ? ' is-flyout-open' : ''}`}
                onMouseEnter={() => scheduleFlyoutOpen('suite')}
                onClick={() => {
                  cancelFlyoutTimers()
                  setActiveFlyout((prev) => (prev === 'suite' ? null : 'suite'))
                }}
              >
                <span className="tray-item-icon">
                  <Gem size={16} />
                </span>
                <span className="tray-item-label">{t.suite}</span>
                <span className="tray-nav-arrow">
                  <ChevronRight size={14} />
                </span>
              </button>
            )}
          </div>

          <div className="tray-divider" />

          {/* Exit */}
          <div className="tray-group">
            <button
              type="button"
              role="menuitem"
              className="tray-item tray-item-exit"
              onMouseEnter={() => scheduleFlyoutClose()}
              onClick={() => runAction('quit')}
            >
              <span className="tray-item-icon">
                <Power size={16} />
              </span>
              <span className="tray-item-label">{t.quit}</span>
            </button>
          </div>
        </div>

        {/* Flyout Submenus Slot */}
        <div className="tray-flyout-slot">
          {/* Help Flyout */}
          <div
            ref={helpFlyoutRef}
            role="menu"
            aria-hidden={activeFlyout !== 'help'}
            className={`tray-card tray-flyout${activeFlyout === 'help' ? ' is-open' : ''}`}
            onMouseEnter={() => cancelFlyoutTimers()}
            onMouseLeave={() => scheduleFlyoutClose()}
          >
            <div className="tray-flyout-head">
              <span className="tray-flyout-title">
                <span className="tray-flyout-title-icon">
                  <HelpCircle size={13} />
                </span>
                <span>{t.help}</span>
              </span>
            </div>

            <div className="tray-divider" />

            <div className="tray-group">
              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => openExternal(HELP_URLS.docs)}
              >
                <span className="tray-item-icon">
                  <BookOpen size={14} />
                </span>
                <span className="tray-item-label">{t.docs}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => openExternal(HELP_URLS.faq)}
              >
                <span className="tray-item-icon">
                  <HelpCircle size={14} />
                </span>
                <span className="tray-item-label">{t.faq}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => openExternal(HELP_URLS.changelog)}
              >
                <span className="tray-item-icon">
                  <ScrollText size={14} />
                </span>
                <span className="tray-item-label">{t.changelog}</span>
              </button>

              <div className="tray-sub-sep" />

              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => openExternal(HELP_URLS.website)}
              >
                <span className="tray-item-icon">
                  <Globe size={14} />
                </span>
                <span className="tray-item-label">{t.website}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => openExternal(HELP_URLS.donate)}
              >
                <span className="tray-item-icon tray-item-icon-heart">
                  <Heart size={14} />
                </span>
                <span className="tray-item-label">{t.donate}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => openExternal(HELP_URLS.issues)}
              >
                <span className="tray-item-icon">
                  <Bug size={14} />
                </span>
                <span className="tray-item-label">{t.issues}</span>
              </button>

              <div className="tray-sub-sep" />

              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => runAction('checkUpdates')}
              >
                <span className="tray-item-icon">
                  <RefreshCw size={14} />
                </span>
                <span className="tray-item-label">{t.checkUpdates}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="tray-item tray-sub-item"
                onClick={() => runAction('about')}
              >
                <span className="tray-item-icon">
                  <Info size={14} />
                </span>
                <span className="tray-item-label">{t.about}</span>
              </button>
            </div>
          </div>

          {/* Suite Flyout */}
          {snapshot.showSuitePromo && (
            <div
              ref={suiteFlyoutRef}
              role="menu"
              aria-hidden={activeFlyout !== 'suite'}
              className={`tray-card tray-flyout${activeFlyout === 'suite' ? ' is-open' : ''}`}
              onMouseEnter={() => cancelFlyoutTimers()}
              onMouseLeave={() => scheduleFlyoutClose()}
            >
              <div className="tray-flyout-head">
                <span className="tray-flyout-title">
                  <span className="tray-flyout-title-icon">
                    <Gem size={13} />
                  </span>
                  <span>{t.suite}</span>
                </span>
                <button
                  type="button"
                  className="tray-brand-link"
                  aria-label="CyberGems"
                  onClick={() => openExternal(HELP_URLS.website)}
                >
                  <Gem size={15} className="tray-brand-mark" />
                  <span className="tray-brand-name">CyberGems</span>
                </button>
              </div>

              <div className="tray-divider" />

              <div className="tray-group tray-suite-list">
                {SUITE_APPS.map((app) => (
                  <button
                    key={app.slug}
                    type="button"
                    role="menuitem"
                    className="tray-item tray-suite-item"
                    onClick={() => openExternal(app.site)}
                  >
                    <span className="tray-suite-icon">
                      <img src={app.icon} alt="" />
                    </span>
                    <span className="tray-suite-copy">
                      <span className="tray-suite-name">{app.name}</span>
                      <span className="tray-suite-short">{app.short[lang]}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="tray-divider" />

              <div className="tray-group">
                <button
                  type="button"
                  role="menuitem"
                  className="tray-item tray-suite-all-btn"
                  onClick={() => openExternal(HELP_URLS.suite)}
                >
                  <span className="tray-item-icon">
                    <ArrowRight size={13} />
                  </span>
                  <span className="tray-item-label">{t.suiteAll}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
