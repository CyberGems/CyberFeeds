import { useState, useEffect, useRef, useCallback, type MouseEvent } from 'react'
import {
  X, Folder, RefreshCw, Download,
  Tag, ClipboardCopy, Check,
  Globe, BookOpen, Bug
} from 'lucide-react'
import { useUIStore } from '../store/ui.store'
import { useSettingsStore } from '../store/settings.store'
import { useTranslation } from '../hooks/useTranslation'
import { useOverlayDismiss } from '../hooks/useOverlayDismiss'
import Tooltip from './Tooltip'

import logoPng from '../../../../resources/icon.png'
import suiteNotesPng from '../../../../resources/suite/cybernotes.png'
import suitePastePng from '../../../../resources/suite/cyberpaste.png'
import suiteSnapPng from '../../../../resources/suite/cybersnap.png'
import suiteViewerPng from '../../../../resources/suite/cyberviewer.png'

const REPO_URL = 'https://github.com/CyberGems/CyberFeeds'
const HOMEPAGE_URL = 'https://cybergems.org'
const DONATE_URL = 'https://github.com/CyberGems/CyberFeeds#%EF%B8%8F-donate'
const SITE_URL = 'https://cybergems.org'
const SUITE_URL = `${SITE_URL}/#apps`

// Tira "Suite": iconos en copias LOCALES (resources/suite/) porque la app es
// offline y no descarga nada en runtime. Si una hermana actualiza su icono,
// copiarlo de nuevo desde su repo y reconstruir; lo peor de no hacerlo es un
// icono desactualizado, los links siguen válidos.
const SUITE_APPS = [
  { slug: 'cybernotes', icon: suiteNotesPng },
  { slug: 'cyberpaste', icon: suitePastePng },
  { slug: 'cybersnap', icon: suiteSnapPng },
  { slug: 'cyberviewer', icon: suiteViewerPng }
] as const

function GithubIcon({ size = 15 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function HeartIcon({ size = 15, color = '#F43F5E' }: { size?: number; color?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

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

  const suitePitches: Record<string, string> = {
    cybernotes: t.about.suiteNotes,
    cyberpaste: t.about.suitePaste,
    cybersnap: t.about.suiteSnap,
    cyberviewer: t.about.suiteViewer
  }

  const handleCheck = useCallback(async (): Promise<void> => {
    setStatus({ state: 'checking' })
    try {
      const res = await window.api.checkForUpdates()
      if (!res?.ok) {
        setStatus({ state: 'error', message: res?.error || 'Update check failed' })
        return
      }
      // Safety net: if no update-available / update-not-available event settled the
      // UI, don't leave it spinning on "Checking…" forever.
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
    setStatus({ state: 'restarting' as any })
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

  return (
    <div className="modal-overlay" {...overlayDismiss}>
      <div
        className="modal about-modal"
        style={{
          width: 440,
          maxHeight: 'min(90vh, 648px)',
          background: 'linear-gradient(160deg, var(--bg-1), var(--bg-0))',
          border: '1px solid var(--accent-subtle)',
          overflow: 'hidden'
        }}
      >
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

        <div className="modal-body about-modal-body" style={{ textAlign: 'center', padding: '16px 28px 20px', overflowY: 'auto' }}>
          <div style={{ position: 'relative', width: 72, height: 72, margin: '8px auto 16px' }}>
            <div style={{
              position: 'absolute', inset: -4,
              background: 'rgba(0, 216, 241, 0.2)',
              borderRadius: '50%',
              filter: 'blur(12px)'
            }} />
            <img
              src={logoPng}
              alt="CyberFeeds"
              style={{
                position: 'relative',
                width: 72,
                height: 72,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 8px rgba(0, 216, 241, 0.6)) drop-shadow(0 0 16px rgba(0, 216, 241, 0.25))'
              }}
            />
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Cyber<span className="brand-feeds">Feeds</span>
          </h1>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7
          }}>
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
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)',
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
              {t.about.maintenance}
              <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
            </div>

            <UpdateStatusLine status={status} t={t} />

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
                  <RefreshCw size={14} className={isRestarting ? 'spin' : ''} />
                  <span>{isRestarting ? t.about.statuses.restarting : t.about.installBtn}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary about-action-btn"
                  onClick={handleCheck}
                  disabled={status.state === 'checking' || status.state === 'downloading'}
                >
                  <RefreshCw size={14} className={status.state === 'checking' ? 'spin' : ''} />
                  <span>{t.about.checkUpdates}</span>
                </button>
              )}

              <button type="button" className="btn btn-secondary about-action-btn" onClick={() => window.api.openDataFolder()}>
                <Folder size={14} />
                <span>{t.about.openFolder}</span>
              </button>

              <Tooltip label={diagCopied ? t.about.diagnosticsCopied : t.about.copyDiagnostics} placement="bottom">
                <button
                  type="button"
                  className={`btn btn-secondary about-action-btn about-diag-btn${diagCopied ? ' is-copied' : ''}`}
                  onClick={handleCopyDiagnostics}
                  disabled={!versions}
                >
                  {diagCopied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                  <span>{diagCopied ? t.about.diagnosticsCopied : t.about.copyDiagnostics}</span>
                </button>
              </Tooltip>

              <label className="toggle about-auto-update">
                <div
                  className={`toggle-track ${settings.autoUpdate ? 'on' : ''}`}
                  onClick={() => update({ autoUpdate: !settings.autoUpdate })}
                >
                  <div className="toggle-thumb" />
                </div>
                <span>{t.about.autoUpdates}</span>
              </label>
            </div>
          </div>

          {settings.showSuitePromo !== false && (
            <div style={{ textAlign: 'left', marginTop: 10 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)',
                marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
                {t.about.suiteTitle}
                <div style={{ height: 1, flex: 1, background: 'var(--accent-subtle)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {SUITE_APPS.map((app) => (
                  <Tooltip key={app.slug} label={suitePitches[app.slug]} placement="top">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      style={{ width: 40, height: 40, borderRadius: 10 }}
                      onClick={() => window.api.openExternal(`${SITE_URL}/apps/${app.slug}/`)}
                      aria-label={suitePitches[app.slug]}
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
              className="about-footer-copyright"
              onClick={() => window.api.openExternal(HOMEPAGE_URL)}
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
                onClick={() => window.api.openExternal(HOMEPAGE_URL)}
                aria-label={t.about.websiteTooltip}
              >
                <Globe size={15} strokeWidth={1.7} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.wikiTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => window.api.openExternal(`${REPO_URL}/wiki`)}
                aria-label={t.about.wikiTooltip}
              >
                <BookOpen size={15} strokeWidth={1.7} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.githubTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => window.api.openExternal(REPO_URL)}
                aria-label={t.about.githubTooltip}
              >
                <GithubIcon size={15} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.issuesTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => window.api.openExternal(`${REPO_URL}/issues`)}
                aria-label={t.about.issuesTooltip}
              >
                <Bug size={15} strokeWidth={1.7} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.releasesTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => window.api.openExternal(`${REPO_URL}/releases`)}
                aria-label={t.about.releasesTooltip}
              >
                <Tag size={15} strokeWidth={1.7} />
              </button>
            </Tooltip>
            <Tooltip label={t.about.donateTooltip} placement="top">
              <button
                type="button"
                className="btn btn-ghost btn-icon donate-btn"
                onClick={() => window.api.openExternal(DONATE_URL)}
                aria-label={t.about.donateTooltip}
              >
                <HeartIcon size={15} color="#F43F5E" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </div>
  )
}

function UpdateStatusLine({ status, t }: { status: UpdateStatus; t: any }): JSX.Element | null {
  const map: Record<string, { text: string; color: string }> = {
    idle: { text: '', color: 'var(--text-muted)' },
    checking: { text: t.about.statuses.checking, color: 'var(--text-secondary)' },
    'not-available': { text: t.about.statuses.latest, color: 'var(--green)' },
    available: { text: t.about.statuses.available, color: 'var(--accent)' },
    downloaded: { text: t.about.statuses.downloaded, color: 'var(--green)' },
    restarting: { text: t.about.statuses.restarting, color: 'var(--accent)' },
    error: { text: t.about.statuses.error, color: 'var(--red)' }
  }
  if (status.state === 'idle') return null
  if (status.state === 'downloading') {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <span style={{ fontWeight: 500 }}>
            {t.about.statuses.downloading.replace('… {percent}%', '…').replace('{percent}%', '')}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
            {status.percent}%
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'var(--bg-3)',
            borderRadius: 999,
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(2, Math.min(100, status.percent))}%`,
              background: 'linear-gradient(90deg, var(--accent), #38bdf8)',
              borderRadius: 999,
              transition: 'width 0.2s ease-out'
            }}
          />
        </div>
      </div>
    )
  }
  const info = map[status.state] || { text: '', color: 'var(--text-muted)' }
  return (
    <div style={{ textAlign: 'center', fontSize: 12, color: info.color, marginBottom: 10 }}>
      {info.text}
      {status.state === 'error' && (status as any).message && (
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
          {(status as any).message}
        </div>
      )}
    </div>
  )
}
