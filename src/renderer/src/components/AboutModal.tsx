import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react'
import {
  X, RefreshCw, Download, CheckCircle2,
  Bug, Tag, ClipboardCopy, Check, Gem, BookOpen, Heart, Github
} from 'lucide-react'
import { useUIStore } from '../store/ui.store'
import { useSettingsStore } from '../store/settings.store'
import { useTranslation } from '../hooks/useTranslation'
import { useOverlayDismiss } from '../hooks/useOverlayDismiss'
import Tooltip from './Tooltip'

import logoPng from '../../../../resources/icon.png'
import suiteClockPng from '../../../../resources/suite/cyberclock.png'
import suiteLauncherPng from '../../../../resources/suite/cyberlauncher.png'
import suiteManagerPng from '../../../../resources/suite/cybermanager.png'
import suiteNotesPng from '../../../../resources/suite/cybernotes.png'
import suitePastePng from '../../../../resources/suite/cyberpaste.png'
import suiteSnapPng from '../../../../resources/suite/cybersnap.png'
import suiteTrayPng from '../../../../resources/suite/cybertray.png'
import suiteViewerPng from '../../../../resources/suite/cyberviewer.png'
import suiteWallPng from '../../../../resources/suite/cyberwall.png'

const REPO_URL = 'https://github.com/CyberGems/CyberFeeds'
const WIKI_URL = `${REPO_URL}/wiki`
const DONATE_URL = `${REPO_URL}#%EF%B8%8F-donate`
const DONATE_HEART = '#F43F5E'
const SITE_URL = 'https://cybergems.org'
const SUITE_URL = `${SITE_URL}/#apps`

type AppVersions = {
  app: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  osRelease: string
  osType: string
  isPortable?: boolean
}

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string; releaseUrl?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }
  | { state: 'restarting' }

function platformLabel(platform: string): string {
  if (platform === 'win32') return 'Windows'
  if (platform === 'darwin') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return platform
}

export default function AboutModal(): JSX.Element {
  const { closePanel, aboutAutoCheck, setAboutAutoCheck } = useUIStore()
  const { settings, update } = useSettingsStore()
  const [versions, setVersions] = useState<AppVersions | null>(null)
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [isRestarting, setIsRestarting] = useState(false)
  const [diagCopied, setDiagCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { t, language } = useTranslation()

  const appVersion = versions?.app || ''

  const handleCheck = useCallback(async (): Promise<void> => {
    setStatus({ state: 'checking' })
    try {
      const res = await window.api.checkForUpdates()
      if (!res?.ok) {
        setStatus({ state: 'error', message: res?.error || 'Update check failed' })
        return
      }
      setStatus(prev =>
        prev.state === 'checking'
          ? { state: 'not-available', version: res.version || appVersion }
          : prev
      )
    } catch (e) {
      setStatus({ state: 'error', message: String((e as Error)?.message || e) })
    }
  }, [appVersion])

  useEffect(() => {
    window.api.getVersions().then((v) => setVersions(v as AppVersions))
    const off = window.api.onUpdateStatus((s) => setStatus(s as UpdateStatus))
    return () => {
      off()
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    }
  }, [])

  useEffect(() => {
    if (aboutAutoCheck) {
      setAboutAutoCheck(false)
      handleCheck()
    }
  }, [aboutAutoCheck, handleCheck, setAboutAutoCheck])

  const handleDownload = async (): Promise<void> => {
    if (versions?.isPortable) {
      const url = status.state === 'available' && status.releaseUrl ? status.releaseUrl : `${REPO_URL}/releases`
      window.api.openExternal(url)
      return
    }
    try {
      localStorage.removeItem('cyberfeeds_skipped_update_version')
    } catch {
      /* ignore */
    }
    setStatus({ state: 'downloading', percent: 0 })
    await window.api.downloadUpdate()
  }

  const handleInstall = (): void => {
    setIsRestarting(true)
    setStatus({ state: 'restarting' })
    window.api.installUpdate()
  }

  const handleClose = (e?: MouseEvent): void => {
    e?.stopPropagation()
    closePanel()
  }
  const overlayDismiss = useOverlayDismiss(() => handleClose())

  const handleCopyDiagnostics = useCallback(async () => {
    if (!versions) return
    const lines = [
      `CyberFeeds ${versions.app}${versions.isPortable ? ' (Portable)' : ''}`,
      `Electron: ${versions.electron}`,
      `Chrome: ${versions.chrome}`,
      `Node: ${versions.node}`,
      `OS: ${platformLabel(versions.platform)} ${versions.osRelease} (${versions.arch})`,
      `Portable: ${versions.isPortable ? 'Yes' : 'No'}`,
      `Locale: ${language}`
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setDiagCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setDiagCopied(false), 1800)
    } catch {
      /* ignore clipboard errors */
    }
  }, [versions, language])

  // Tira "Suite": iconos en copias LOCALES (resources/suite/) porque la app es
  // offline y no descarga nada en runtime. Cada apertura sortea 4 de las otras apps.
  const suitePool = [
    { slug: 'cyberclock', icon: suiteClockPng, pitch: t.about.suiteClock },
    { slug: 'cyberlauncher', icon: suiteLauncherPng, pitch: t.about.suiteLauncher },
    { slug: 'cybermanager', icon: suiteManagerPng, pitch: t.about.suiteManager },
    { slug: 'cybernotes', icon: suiteNotesPng, pitch: t.about.suiteNotes },
    { slug: 'cyberpaste', icon: suitePastePng, pitch: t.about.suitePaste },
    { slug: 'cybersnap', icon: suiteSnapPng, pitch: t.about.suiteSnap },
    { slug: 'cybertray', icon: suiteTrayPng, pitch: t.about.suiteTray },
    { slug: 'cyberviewer', icon: suiteViewerPng, pitch: t.about.suiteViewer },
    { slug: 'cyberwall', icon: suiteWallPng, pitch: t.about.suiteWall }
  ]
  const [suitePick] = useState<string[]>(() => {
    const pool = suitePool.map((a) => a.slug)
    const picks: string[] = []
    while (picks.length < 4 && pool.length > 0) {
      const [slug] = pool.splice(Math.floor(Math.random() * pool.length), 1)
      if (slug) picks.push(slug)
    }
    return picks
  })
  const suiteApps = suitePick.flatMap((slug) => suitePool.filter((a) => a.slug === slug))

  return (
    <div className="modal-overlay" {...overlayDismiss}>
      <div
        className="modal about-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.about.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          position: 'relative',
          maxHeight: 'min(90vh, 640px)',
          background: 'linear-gradient(160deg, var(--bg-1), var(--bg-0))',
          border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border))',
          overflow: 'hidden',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        {/* Glass decorativo: brillos tras el contenido, sin tocar legibilidad. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -80,
              left: -70,
              width: 210,
              height: 210,
              borderRadius: '50%',
              background: 'var(--accent)',
              opacity: 0.13,
              filter: 'blur(60px)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -50,
              right: -80,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: '#7c3aed',
              opacity: 0.11,
              filter: 'blur(60px)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '8%',
              right: '8%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)'
            }}
          />
        </div>

        <div className="modal-header" style={{ border: 'none', padding: '16px 16px 0', flexShrink: 0 }}>
          <div style={{ flex: 1 }} />
          <Tooltip label={t.about.close} placement="left">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={handleClose}
              aria-label={t.about.close}
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        <div className="modal-body about-modal-body" style={{ textAlign: 'center', padding: '0 28px 16px', overflowY: 'auto' }}>
          <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
            <img
              src={logoPng}
              alt="CyberFeeds"
              style={{
                width: 72,
                height: 72,
                display: 'block'
              }}
            />
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            Cyber<span style={{ color: 'var(--accent)' }}>Feeds</span>
          </h1>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 14,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7
            }}
          >
            <span>{t.about.version.replace('{version}', appVersion || '…')}</span>
            {versions?.isPortable && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'rgba(0, 216, 241, 0.12)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(0, 216, 241, 0.35)',
                  lineHeight: '1.2'
                }}
              >
                {t.about.portableBadge}
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 24 }}>
            {t.about.desc}
          </p>

          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
              {t.about.maintenance}
              <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
            </div>

            <UpdateStatusLine status={status} t={t} language={language} />

            <div className="about-maintenance">
              {status.state === 'available' ? (
                <button type="button" className="btn btn-primary about-action-btn" onClick={handleDownload}>
                  <Download size={14} />
                  <span>{versions?.isPortable ? t.about.downloadPortableUpdate : t.about.downloadBtn}</span>
                </button>
              ) : status.state === 'downloaded' || (status as any).state === 'restarting' ? (
                <button
                  type="button"
                  className="btn btn-primary about-action-btn"
                  onClick={handleInstall}
                  disabled={isRestarting}
                >
                  {isRestarting ? (
                    <RefreshCw size={14} className="spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>{isRestarting ? t.about.statuses.restarting : t.about.installBtn}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost about-action-btn"
                  onClick={handleCheck}
                  disabled={status.state === 'checking' || status.state === 'downloading'}
                >
                  <RefreshCw size={14} className={status.state === 'checking' ? 'spin' : ''} />
                  <span>{t.about.checkUpdates}</span>
                </button>
              )}

              <button
                type="button"
                className="about-auto-update"
                role="switch"
                aria-checked={settings.autoUpdate}
                aria-label={t.about.autoUpdates}
                onClick={() => update({ autoUpdate: !settings.autoUpdate })}
              >
                <span aria-hidden="true" className={`custom-switch ${settings.autoUpdate ? 'active' : ''}`} />
                <span>{t.about.autoUpdates}</span>
              </button>
              {t.about.autoUpdatesHint && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4, marginTop: 2, padding: '0 4px' }}>
                  {t.about.autoUpdatesHint}
                </div>
              )}
            </div>
          </div>

          {settings.showSuitePromo !== false && (
            <div style={{ textAlign: 'left', marginTop: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
                {t.about.suiteTitle}
                <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {suiteApps.map((app) => (
                  <Tooltip key={app.slug} label={app.pitch} placement="top">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon suite-app-btn"
                      style={{ width: 40, height: 40, borderRadius: 10 }}
                      onClick={() => window.api.openExternal(`${SITE_URL}/apps/${app.slug}/`)}
                      aria-label={app.pitch}
                    >
                      <img src={app.icon} alt="" style={{ width: 26, height: 26, borderRadius: 6, display: 'block' }} />
                    </button>
                  </Tooltip>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '3px 10px', fontSize: 11, height: 26 }}
                  onClick={() => window.api.openExternal(SUITE_URL)}
                >
                  {t.about.suiteMore} →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="about-modal-footer">
          <Tooltip label={t.about.websiteTooltip} placement="top">
            <button
              type="button"
              className="about-footer-brand"
              onClick={() => window.api.openExternal(SITE_URL)}
              aria-label={t.about.websiteTooltip}
            >
              © CyberGems • 2026
            </button>
          </Tooltip>
          <div className="about-footer-links">
            <Tooltip label={t.about.websiteTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={() => window.api.openExternal(SITE_URL)}
                aria-label={t.about.websiteTooltip}
              >
                <Gem size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.docsTooltip || t.about.wikiTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={() => window.api.openExternal(WIKI_URL)}
                aria-label={t.about.docsTooltip || t.about.wikiTooltip}
              >
                <BookOpen size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.githubTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={() => window.api.openExternal(REPO_URL)}
                aria-label={t.about.githubTooltip}
              >
                <Github size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.issuesTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={() => window.api.openExternal(`${REPO_URL}/issues`)}
                aria-label={t.about.issuesTooltip}
              >
                <Bug size={14} />
              </button>
            </Tooltip>
            <Tooltip label={diagCopied ? t.about.diagnosticsCopied : t.about.copyDiagnostics} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={handleCopyDiagnostics}
                aria-label={diagCopied ? t.about.diagnosticsCopied : t.about.copyDiagnostics}
                disabled={!versions}
              >
                {diagCopied ? <Check size={14} /> : <ClipboardCopy size={14} />}
              </button>
            </Tooltip>
            <Tooltip label={t.about.releasesTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 28, height: 28 }}
                onClick={() => window.api.openExternal(`${REPO_URL}/releases`)}
                aria-label={t.about.releasesTooltip}
              >
                <Tag size={14} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.donateTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon donate-btn"
                style={{ width: 28, height: 28 }}
                onClick={() => window.api.openExternal(DONATE_URL)}
                aria-label={t.about.donateTooltip}
              >
                <Heart size={14} color={DONATE_HEART} fill={DONATE_HEART} stroke="none" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

function UpdateStatusLine({
  status,
  t,
  language
}: {
  status: UpdateStatus
  t: any
  language: string
}): JSX.Element | null {
  const [showDetails, setShowDetails] = useState(false)
  if (status.state === 'idle') return null
  if (status.state === 'downloading') {
    return (
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {t.about.statuses.downloading.replace('{percent}', String(status.percent))}
      </div>
    )
  }

  const map: Record<string, { text: string; color: string }> = {
    checking: { text: t.about.statuses.checking, color: 'var(--text-secondary)' },
    'not-available': { text: t.about.statuses.latest, color: 'var(--green)' },
    available: { text: t.about.statuses.available, color: 'var(--accent)' },
    downloaded: { text: t.about.statuses.downloaded, color: 'var(--green)' },
    restarting: { text: t.about.statuses.restarting, color: 'var(--accent)' },
    error: { text: t.about.statuses.error, color: 'var(--text-secondary)' }
  }
  const info = map[status.state]
  if (!info) return null

  return (
    <div style={{ textAlign: 'center', fontSize: 12, color: info.color, marginBottom: 10 }}>
      <div>{info.text}</div>
      {status.state === 'error' && (status as any).message && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowDetails(prev => !prev)}
            style={{
              padding: '2px 8px',
              fontSize: 10.5,
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              margin: '0 auto'
            }}
          >
            {showDetails
              ? (language === 'es' ? 'Ocultar detalles' : 'Hide details')
              : (language === 'es' ? 'Detalles' : 'Details')}
          </button>
          {showDetails && (
            <div
              style={{
                marginTop: 6,
                padding: '6px 8px',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                fontSize: 10,
                color: 'var(--text-muted)',
                wordBreak: 'break-word',
                maxHeight: 80,
                overflowY: 'auto',
                textAlign: 'left'
              }}
            >
              {(status as any).message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
