import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Download, ExternalLink, SkipForward, RefreshCw, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

export type ActiveUpdateStatus =
  | { state: 'available'; version: string; releaseNotes?: string; releaseUrl?: string }
  | { state: 'downloading'; version?: string; percent: number }
  | { state: 'downloaded'; version: string }

interface UpdateNotificationModalProps {
  status: ActiveUpdateStatus
  onClose: () => void
  onSkip: (version: string) => void
  onDownload: () => void
  onInstall: () => void
}

export function parseChangelogPeek(markdown?: string): { items: string[]; totalCount: number } {
  if (!markdown) return { items: [], totalCount: 0 }
  const lines = markdown.split(/\r?\n/)
  const allHighlights: string[] = []
  let inHighlightsSection = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()

    // Match section headers
    if (/^###?\s.*(?:highlights|features|novedades|what's new|cambios)/i.test(line)) {
      inHighlightsSection = true
      continue
    }

    // Stop if we reach downloads, virustotal, packages, or other technical sections
    if (
      inHighlightsSection &&
      /^###?\s.*(?:downloads|packages|virustotal|assets|descargas|instrucciones)/i.test(line)
    ) {
      break
    }

    // Top-level bullet items (not indented sub-bullets)
    if (rawLine.startsWith('- ') || rawLine.startsWith('* ')) {
      const text = rawLine.replace(/^[-*]\s+/, '').trim()
      // Strip markdown bold/code/italics wrapper around the headline
      const cleaned = text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/:\s*$/, '')
        .trim()

      if (
        cleaned &&
        !cleaned.toLowerCase().includes('recommended installer') &&
        !cleaned.toLowerCase().includes('setup installer')
      ) {
        allHighlights.push(cleaned)
      }
    }
  }

  // Fallback: if no highlights section was found, check all bullets
  if (allHighlights.length === 0) {
    for (const raw of lines) {
      const line = raw.trim()
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const cleaned = line
          .replace(/^[-*]\s+/, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/:\s*$/, '')
          .trim()
        if (
          cleaned &&
          !cleaned.toLowerCase().includes('recommended installer') &&
          !cleaned.toLowerCase().includes('setup installer')
        ) {
          allHighlights.push(cleaned)
        }
      }
    }
  }

  // Secondary fallback: if no bullets exist, grab first few descriptive sentences
  if (allHighlights.length === 0) {
    for (const raw of lines) {
      const line = raw.trim()
      if (line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('|')) {
        const cleaned = line
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .trim()
        if (cleaned.length > 10) {
          allHighlights.push(cleaned)
          if (allHighlights.length >= 2) break
        }
      }
    }
  }

  return {
    items: allHighlights.slice(0, 4),
    totalCount: allHighlights.length
  }
}

export function UpdateNotificationModal({
  status,
  onClose,
  onSkip,
  onDownload,
  onInstall
}: UpdateNotificationModalProps): JSX.Element {
  const { t } = useTranslation()
  const currentVersion = status.version || ''

  const [releaseNotes, setReleaseNotes] = useState<string | undefined>(
    status.state === 'available' ? status.releaseNotes : undefined
  )
  const [releaseUrl, setReleaseUrl] = useState<string>(
    status.state === 'available' && status.releaseUrl
      ? status.releaseUrl
      : `https://github.com/CyberGems/CyberFeeds/releases/tag/v${currentVersion}`
  )

  useEffect(() => {
    if (status.state === 'available') {
      if (status.releaseNotes) {
        setReleaseNotes(status.releaseNotes)
      } else if (status.version) {
        fetch(`https://api.github.com/repos/CyberGems/CyberFeeds/releases/tags/v${status.version}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.body) setReleaseNotes(data.body)
            if (data?.html_url) setReleaseUrl(data.html_url)
          })
          .catch(() => {
            /* ignore network error */
          })
      }
      if (status.releaseUrl) {
        setReleaseUrl(status.releaseUrl)
      }
    }
  }, [status])

  const { items: peekItems, totalCount } = useMemo(
    () => parseChangelogPeek(releaseNotes),
    [releaseNotes]
  )

  const remainingCount = Math.max(0, totalCount - peekItems.length)

  return (
    <div
      role="dialog"
      aria-label="Update notification"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 390,
        maxWidth: 'calc(100vw - 48px)',
        background: 'linear-gradient(145deg, var(--bg-1), var(--bg-0))',
        border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border-subtle))',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.55), 0 0 16px var(--accent-subtle)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0
            }}
          >
            <Sparkles size={15} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                {status.state === 'available'
                  ? t.about.statuses.available
                  : status.state === 'downloading'
                    ? t.about.statuses.downloading
                        .replace('… {percent}%', '…')
                        .replace('{percent}%', '')
                    : t.about.statuses.downloaded}
              </span>
              {currentVersion && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    lineHeight: '16px'
                  }}
                >
                  v{currentVersion}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-icon"
          style={{ width: 24, height: 24, borderRadius: 6 }}
          onClick={onClose}
          title={t.about.dismiss}
        >
          <X size={13} />
        </button>
      </div>

      {/* Body: Available State with Changelog Peek */}
      {status.state === 'available' && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--bg-2) 80%, black)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '9px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)'
            }}
          >
            {t.about.whatsNew}
          </div>

          {peekItems.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxHeight: 125,
                overflowY: 'auto'
              }}
            >
              {peekItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 11.5,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4
                  }}
                >
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontSize: 10,
                      lineHeight: '17px',
                      userSelect: 'none'
                    }}
                  >
                    •
                  </span>
                  <span style={{ wordBreak: 'break-word' }}>{item}</span>
                </div>
              ))}

              {remainingCount > 0 && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    marginTop: 2
                  }}
                >
                  {t.about.moreInFullNotes.replace('{count}', String(remainingCount))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t.about.releasesTooltip}
            </div>
          )}
        </div>
      )}

      {/* Body: Downloading Progress State */}
      {status.state === 'downloading' && (
        <div style={{ padding: '4px 0' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              marginBottom: 6
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{t.about.downloadBtn}...</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
              {status.percent}%
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 5,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 999,
              overflow: 'hidden'
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
      )}

      {/* Body: Downloaded State */}
      {status.state === 'downloaded' && (
        <div style={{ fontSize: 11.5, color: 'var(--text-accent)', fontWeight: 500 }}>
          {t.about.restartAndApply}
        </div>
      )}

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
          gap: 6
        }}
      >
        {status.state === 'available' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => window.api.openExternal(releaseUrl)}
                title={t.about.viewReleaseNotes}
              >
                <ExternalLink size={12} />
                <span>{t.about.viewRelease}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--text-muted)'
                }}
                onClick={() => onSkip(currentVersion)}
                title={t.about.skipUpdate}
              >
                <SkipForward size={12} />
                <span>{t.about.skipUpdate}</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '4px 12px',
                fontSize: 11,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 600
              }}
              onClick={onDownload}
            >
              <Download size={13} />
              <span>{t.about.downloadBtn}</span>
            </button>
          </>
        ) : status.state === 'downloading' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '3px 8px', fontSize: 11, height: 24 }}
              onClick={onClose}
            >
              {t.about.dismiss}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '3px 8px', fontSize: 11, height: 26 }}
              onClick={onClose}
            >
              {t.about.dismiss}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                padding: '4px 12px',
                fontSize: 11,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 600
              }}
              onClick={onInstall}
            >
              <RefreshCw size={13} />
              <span>{t.about.installBtn}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
