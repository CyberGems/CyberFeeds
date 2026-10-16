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

interface ChangelogItem {
  text: string
  isSubItem: boolean
}

const STARTS_WITH_EMOJI_REGEX =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F300}-\u{1FAFF}]|[\u2600-\u27BF])/u

export function extractReleaseSection(markdown: string, language: string): string {
  if (!markdown) return ''
  if (language === 'es') {
    const match = markdown.match(
      /<details>[\s\S]*?<summary>[\s\S]*?(?:español|spanish|ver notas)[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i
    )
    if (match?.[1]?.trim()) return match[1].trim()
    const anyDetails = markdown.match(
      /<details>[\s\S]*?<summary>[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i
    )
    if (anyDetails?.[1]?.trim()) return anyDetails[1].trim()
  }
  return markdown.replace(/<details>[\s\S]*?<\/details>/gi, '').trim()
}

export function normalizeReleaseContent(content: string): string {
  return content
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
}

function cleanItemText(raw: string): string {
  return raw
    .replace(/^[-*]\s+/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // strip bold
    .replace(/\*([^*]+)\*/g, '$1') // strip italics
    .replace(/`([^`]+)`/g, '$1') // strip code wrappers
    .replace(/~~([^~]+)~~/g, '$1') // strip strikethrough
    .replace(/:\s*$/, '') // strip trailing colons
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseChangelogPeek(
  markdown?: string,
  language: string = 'en'
): ChangelogItem[] {
  if (!markdown) return []
  const scoped = extractReleaseSection(markdown, language)
  const normalized = normalizeReleaseContent(scoped)
  const lines = normalized.split(/\r?\n/)

  const items: ChangelogItem[] = []
  let inHighlightsSection = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line) continue

    // Stop if we reach technical / checksums / download sections
    if (
      /^###?\s.*(?:downloads|packages|virustotal|assets|descargas|instrucciones|checksums)/i.test(
        line
      )
    ) {
      if (inHighlightsSection) break
      continue
    }

    // Match section headers
    if (
      /^###?\s.*(?:highlights|features|novedades|what's new|cambios|destacadas|changelog)/i.test(
        line
      )
    ) {
      inHighlightsSection = true
      continue
    }

    if (inHighlightsSection && (line.startsWith('- ') || line.startsWith('* '))) {
      const isSubItem = /^\s+[-*]\s+/.test(rawLine)
      const text = cleanItemText(line.replace(/^[-*]\s+/, ''))
      if (
        text &&
        !text.toLowerCase().includes('recommended installer') &&
        !text.toLowerCase().includes('setup installer')
      ) {
        items.push({ text, isSubItem })
      }
    }
  }

  // Fallback 1: if no highlights section was matched, extract any top-level bullets
  if (items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]
      const line = rawLine.trim()
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const isSubItem = /^\s+[-*]\s+/.test(rawLine)
        const text = cleanItemText(line.replace(/^[-*]\s+/, ''))
        if (
          text &&
          !text.toLowerCase().includes('recommended installer') &&
          !text.toLowerCase().includes('setup installer') &&
          !text.toLowerCase().includes('virustotal')
        ) {
          items.push({ text, isSubItem })
        }
      }
    }
  }

  // Fallback 2: if no bullets exist, grab first few descriptive sentences
  if (items.length === 0) {
    for (const raw of lines) {
      const line = raw.trim()
      if (line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('|')) {
        const text = cleanItemText(line)
        if (text.length > 15) {
          items.push({ text, isSubItem: false })
          if (items.length >= 4) break
        }
      }
    }
  }

  return items
}

export function UpdateNotificationModal({
  status,
  onClose,
  onSkip,
  onDownload,
  onInstall,
  isPortable
}: UpdateNotificationModalProps): JSX.Element {
  const { t, language } = useTranslation()
  const targetVersion = status.version || ''
  const [installedVersion, setInstalledVersion] = useState<string>('')

  const initialNotes = status.state === 'available' ? status.releaseNotes : undefined
  const [fetchedNotes, setFetchedNotes] = useState<string | undefined>(undefined)
  const [fetchedUrl, setFetchedUrl] = useState<string | undefined>(undefined)

  const releaseNotes = initialNotes || fetchedNotes
  const releaseUrl =
    status.state === 'available' && status.releaseUrl
      ? status.releaseUrl
      : fetchedUrl || `https://github.com/CyberGems/CyberFeeds/releases/tag/v${targetVersion}`

  // Fetch installed app version for side-by-side version indicator
  useEffect(() => {
    window.api
      ?.getVersions?.()
      .then((v: any) => {
        if (v?.app) setInstalledVersion(v.app)
      })
      .catch(() => {})
  }, [])

  // If initial release notes are missing or lack Spanish details when user is in ES,
  // fetch full markdown from GitHub API
  useEffect(() => {
    if (status.state === 'available' && status.version) {
      const needsFetch =
        !status.releaseNotes ||
        (language === 'es' && !status.releaseNotes.includes('<details>'))

      if (needsFetch) {
        fetch(`https://api.github.com/repos/CyberGems/CyberFeeds/releases/tags/v${status.version}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.body) setFetchedNotes(data.body)
            if (data?.html_url) setFetchedUrl(data.html_url)
          })
          .catch(() => {})
      }
    }
  }, [status, language])

  const parsedItems = useMemo(
    () => parseChangelogPeek(releaseNotes, language),
    [releaseNotes, language]
  )

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
              <div className="update-notification-version-tags">
                {installedVersion && (
                  <span
                    className="update-notification-badge-current"
                    title={language === 'es' ? 'Versión instalada' : 'Installed version'}
                  >
                    v{installedVersion}
                  </span>
                )}
                {installedVersion && targetVersion && (
                  <span className="update-notification-version-arrow">→</span>
                )}
                {targetVersion && (
                  <span
                    className="update-notification-badge"
                    title={language === 'es' ? 'Nueva versión disponible' : 'Available version'}
                  >
                    v{targetVersion}
                  </span>
                )}
              </div>
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

          {parsedItems.length > 0 ? (
            <div className="update-changelog-list">
              {parsedItems.map((item, idx) => {
                const hasLeadEmoji = STARTS_WITH_EMOJI_REGEX.test(item.text)
                if (item.isSubItem) {
                  return (
                    <div key={idx} className="update-changelog-item update-changelog-subitem">
                      <span className="update-changelog-bullet">•</span>
                      <span style={{ wordBreak: 'break-word' }}>{item.text}</span>
                    </div>
                  )
                }
                return (
                  <div key={idx} className="update-changelog-item update-changelog-mainitem">
                    {!hasLeadEmoji && <span className="update-changelog-bullet">•</span>}
                    <span style={{ wordBreak: 'break-word', fontWeight: 600 }}>{item.text}</span>
                  </div>
                )
              })}
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
                className="btn btn-secondary update-notification-btn"
                onClick={() => window.api.openExternal(releaseUrl)}
                title={t.about.viewReleaseNotes}
              >
                <ExternalLink size={12} />
                <span>{t.about.viewRelease}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary update-notification-btn"
                onClick={() => onSkip(targetVersion)}
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
              className="btn btn-secondary update-notification-btn"
              onClick={onClose}
            >
              {t.about.dismiss}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary update-notification-btn"
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
