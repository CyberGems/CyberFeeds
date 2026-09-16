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
  isPortable?: boolean
}

const STARTS_WITH_EMOJI_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])/u

function cleanItemText(raw: string): string {
  return raw
    .replace(/^[-*]\s+/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/<[^>]+>/g, '') // strip html tags
    .replace(/\*\*([^*]+)\*\*/g, '$1') // strip bold
    .replace(/\*([^*]+)\*/g, '$1') // strip italics
    .replace(/`([^`]+)`/g, '$1') // strip code wrappers
    .replace(/~~([^~]+)~~/g, '$1') // strip strikethrough
    .replace(/:\s*$/, '') // strip trailing colons
    .trim()
}

function parseChangelogPeek(markdown?: string): { items: string[]; totalCount: number } {
  if (!markdown) return { items: [], totalCount: 0 }
  const lines = markdown.split(/\r?\n/)
  const allHighlights: string[] = []
  let inHighlightsSection = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()

    // Match section headers
    if (/^###?\s.*(?:highlights|features|novedades|what's new|cambios|changelog)/i.test(line)) {
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
    if (inHighlightsSection && (rawLine.startsWith('- ') || rawLine.startsWith('* '))) {
      const cleaned = cleanItemText(rawLine)
      if (
        cleaned &&
        !cleaned.toLowerCase().includes('recommended installer') &&
        !cleaned.toLowerCase().includes('setup installer')
      ) {
        allHighlights.push(cleaned)
      }
    }
  }

  // Fallback 1: if no highlights section was found, check all bullets
  if (allHighlights.length === 0) {
    for (const raw of lines) {
      const line = raw.trim()
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const cleaned = cleanItemText(line)
        if (
          cleaned &&
          !cleaned.toLowerCase().includes('recommended installer') &&
          !cleaned.toLowerCase().includes('setup installer') &&
          !cleaned.toLowerCase().includes('virustotal')
        ) {
          allHighlights.push(cleaned)
        }
      }
    }
  }

  // Fallback 2: if no bullets exist, grab first few descriptive sentences
  if (allHighlights.length === 0) {
    for (const raw of lines) {
      const line = raw.trim()
      if (line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('|')) {
        const cleaned = cleanItemText(line)
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
  onInstall,
  isPortable
}: UpdateNotificationModalProps): JSX.Element {
  const { t } = useTranslation()
  const currentVersion = status.version || ''

  const initialNotes = status.state === 'available' ? status.releaseNotes : undefined
  const [fetchedNotes, setFetchedNotes] = useState<string | undefined>(undefined)
  const [fetchedUrl, setFetchedUrl] = useState<string | undefined>(undefined)

  const releaseNotes = initialNotes || fetchedNotes
  const releaseUrl =
    status.state === 'available' && status.releaseUrl
      ? status.releaseUrl
      : fetchedUrl || `https://github.com/CyberGems/CyberFeeds/releases/tag/v${currentVersion}`

  useEffect(() => {
    if (status.state === 'available' && !status.releaseNotes && status.version) {
      fetch(`https://api.github.com/repos/CyberGems/CyberFeeds/releases/tags/v${status.version}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.body) setFetchedNotes(data.body)
          if (data?.html_url) setFetchedUrl(data.html_url)
        })
        .catch(() => {
          /* ignore network error */
        })
    }
  }, [status])

  const { items: peekItems, totalCount } = useMemo(
    () => parseChangelogPeek(releaseNotes),
    [releaseNotes]
  )

  const remainingCount = Math.max(0, totalCount - peekItems.length)

  const rawTitle =
    status.state === 'available'
      ? t.about.statuses.available
      : status.state === 'downloading'
        ? t.about.statuses.downloading.replace('… {percent}%', '…').replace('{percent}%', '')
        : t.about.statuses.downloaded

  // Clean trailing period so header doesn't render awkward sentence period before version tag
  const titleText = rawTitle.replace(/\.$/, '')

  return (
    <div role="dialog" aria-label="Update notification" className="update-notification-modal">
      {/* Header Row */}
      <div className="update-notification-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div className="update-notification-icon">
            <Sparkles size={15} />
          </div>
          <div>
            <div className="update-notification-title-group">
              <span className="update-notification-title">{titleText}</span>
              {currentVersion && (
                <span className="update-notification-badge">v{currentVersion}</span>
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
        <div className="update-changelog-box">
          <div className="update-changelog-header">{t.about.whatsNew}</div>

          {peekItems.length > 0 ? (
            <div className="update-changelog-list">
              {peekItems.map((item, idx) => {
                const hasLeadEmoji = STARTS_WITH_EMOJI_REGEX.test(item)
                return (
                  <div key={idx} className="update-changelog-item">
                    {!hasLeadEmoji && <span className="update-changelog-bullet">•</span>}
                    <span style={{ wordBreak: 'break-word' }}>{item}</span>
                  </div>
                )
              })}

              {remainingCount > 0 && (
                <div className="update-changelog-more">
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
          <div className="update-progress-track">
            <div
              className="update-progress-bar"
              style={{
                width: `${Math.max(2, Math.min(100, status.percent))}%`
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
      <div className="update-notification-footer">
        {status.state === 'available' ? (
          <>
            <div className="update-notification-footer-actions">
              <button
                type="button"
                className="btn btn-ghost update-notification-btn"
                onClick={() => window.api.openExternal(releaseUrl)}
                title={t.about.viewReleaseNotes}
              >
                <ExternalLink size={12} />
                <span>{t.about.viewRelease}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost update-notification-btn"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => onSkip(currentVersion)}
                title={t.about.skipUpdate}
              >
                <SkipForward size={12} />
                <span>{t.about.skipUpdate}</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary update-notification-btn"
              style={{ fontWeight: 600 }}
              onClick={() => {
                if (isPortable) {
                  window.api.openExternal(releaseUrl)
                  onClose()
                } else {
                  onDownload()
                }
              }}
            >
              <Download size={13} />
              <span>{isPortable ? t.about.downloadPortableUpdate : t.about.downloadBtn}</span>
            </button>
          </>
        ) : status.state === 'downloading' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost update-notification-btn"
              onClick={onClose}
            >
              {t.about.dismiss}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost update-notification-btn"
              onClick={onClose}
            >
              {t.about.dismiss}
            </button>
            <button
              type="button"
              className="btn btn-primary update-notification-btn"
              style={{ fontWeight: 600 }}
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
