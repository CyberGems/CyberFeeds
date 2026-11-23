import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Rocket, ExternalLink, RefreshCw, X } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'
import type { PendingUpdate } from '@shared/update'

interface UpdateNotificationModalProps {
  status: PendingUpdate
  noticeRef: (notice: HTMLDivElement | null) => void
  onClose: () => void
  onSkip: (version: string) => void
  onDownload: (version: string) => Promise<void>
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

    // The Before you install block is release-page furniture: the updater is
    // automatic, so the peek never includes SmartScreen guidance.
    if (/^###?\s.*(?:before you install|antes de instalar)/i.test(line)) {
      inHighlightsSection = false
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
          !text.toLowerCase().includes('virustotal') &&
          !/(?:not code-signed|no está firmada)/i.test(text)
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
        if (text.length > 15 && !/(?:not code-signed|no está firmada)/i.test(text)) {
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
  noticeRef,
  onClose,
  onSkip,
  onDownload
}: UpdateNotificationModalProps): JSX.Element {
  const { t, language } = useTranslation()
  const labels = t.updater
  const { version, releaseUrl, releaseNotes, notesLoading, portableUrl } = status.release
  const [installedVersion, setInstalledVersion] = useState('')
  const [actionError, setActionError] = useState<{ state: PendingUpdate['state']; message: string } | null>(null)

  useEffect(() => {
    let active = true
    void window.api.getVersions().then((versions) => {
      if (active && typeof versions?.app === 'string') setInstalledVersion(versions.app)
    }).catch((error) => console.warn('[Updater] Could not read the installed version:', error))
    return () => { active = false }
  }, [])

  const parsedItems = useMemo(
    () => parseChangelogPeek(releaseNotes, language),
    [releaseNotes, language]
  )
  const peekItems = parsedItems.slice(0, 4)
  const remainingCount = parsedItems.length - peekItems.length
  const title = {
    available: labels.available,
    downloading: status.state === 'downloading' && status.cancelling
      ? labels.cancelling
      : labels.downloading,
    downloaded: labels.downloaded,
    installing: labels.installing
  }[status.state]
  const downloading = status.state === 'downloading'
  const installing = status.state === 'installing'
  const failure =
    (actionError?.state === status.state && actionError.message) ||
    (status.state === 'available' && status.downloadFailed && labels.downloadFailed) ||
    (status.state === 'downloaded' && status.installFailed && labels.installFailed)

  const runAction = async (action: () => Promise<void>, message: string): Promise<void> => {
    setActionError(null)
    try {
      await action()
    } catch (error) {
      console.error('[Updater] Could not complete the requested action:', error)
      setActionError({ state: status.state, message })
    }
  }

  const formatSize = (bytes: number): string =>
    new Intl.NumberFormat(language, {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: 1
    }).format(bytes / 1_000_000)

  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      role="dialog"
      aria-labelledby="update-notification-title"
      className="update-notification-modal"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          if (!installing) onClose()
        }
      }}
    >
      <div className="update-notification-header">
        <span className="update-notification-icon" aria-hidden="true">
          {downloading || installing ? <RefreshCw size={15} className="spin" />
            : status.state === 'downloaded' ? <Rocket size={15} /> : <Sparkles size={15} />}
        </span>
        <div className="update-notification-title-group">
          <h2 className="update-notification-title" id="update-notification-title">{title}</h2>
          <div className="update-notification-version-tags">
            {installedVersion && (
              <>
                <span className="update-notification-badge-current" aria-label={labels.installedVersion.replace('{version}', installedVersion)}>
                  v{installedVersion}
                </span>
                <span className="update-notification-version-arrow" aria-hidden="true">→</span>
              </>
            )}
            <span className="update-notification-badge" aria-label={labels.availableVersion.replace('{version}', version)}>
              v{version}
            </span>
          </div>
        </div>

        <Tooltip label={downloading ? labels.background : labels.dismiss} placement="left">
          <button
            type="button"
            className="btn btn-ghost btn-icon update-notification-close"
            onClick={onClose}
            disabled={installing}
            aria-label={downloading ? labels.background : labels.dismiss}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <section className="update-changelog-box" aria-label={labels.whatsNew}>
        <h3 className="update-changelog-header">{labels.whatsNew}</h3>
        {peekItems.length ? (
          <>
            <ul className="update-changelog-list">
              {peekItems.map((item, index) => (
                <li
                  key={index}
                  className={`update-changelog-item ${item.isSubItem ? 'update-changelog-subitem' : 'update-changelog-mainitem'}`}
                >
                  {(item.isSubItem || !STARTS_WITH_EMOJI_REGEX.test(item.text)) && (
                    <span className="update-changelog-bullet" aria-hidden="true">•</span>
                  )}
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            {remainingCount > 0 && (
              <p className="update-notification-hint">
                {labels.moreInFullNotes.replace('{count}', String(remainingCount))}
              </p>
            )}
          </>
        ) : (
          <p className="update-notification-hint">
            {notesLoading ? labels.notesLoading : labels.notesUnavailable}
          </p>
        )}
      </section>

      {downloading && (
        <div className="update-progress">
          <div className="update-progress-label">
            <span id="update-progress-label">{labels.progress}</span>
            <span>
              {status.transferred !== undefined && status.total
                ? `${formatSize(status.transferred)} / ${formatSize(status.total)}`
                : `${status.percent}%`}
            </span>
          </div>
          <progress className="update-progress-track" max={100} value={status.percent} aria-labelledby="update-progress-label" />
        </div>
      )}

      {portableUrl && <p className="update-notification-hint">{labels.portableHint}</p>}
      {failure && <p className="update-notification-error" role="alert">{failure}</p>}

      <div className="update-notification-footer">
        {status.state === 'available' && (
          <>
            <button type="button" className="btn btn-ghost update-notification-btn" onClick={() => {
              void runAction(() => window.api.openExternal(releaseUrl), labels.openFailed)
            }}>
              <ExternalLink size={13} aria-hidden="true" />
              {labels.viewRelease}
            </button>
            <button type="button" className="btn btn-ghost update-notification-btn" onClick={() => onSkip(version)}>
              {labels.skip}
            </button>
            <button type="button" className="btn btn-ghost update-notification-btn" onClick={onClose}>
              {labels.later}
            </button>
            <button type="button" className="btn btn-primary update-notification-btn" onClick={() => {
              if (portableUrl) {
                void runAction(() => window.api.openExternal(portableUrl), labels.openFailed)
              } else {
                void runAction(() => onDownload(version), labels.downloadFailed)
              }
            }}>
              {portableUrl ? labels.downloadPortable : labels.updateNow}
            </button>
          </>
        )}
        {downloading && (
          <>
            <button type="button" className="btn btn-ghost update-notification-btn" onClick={onClose}>
              {labels.background}
            </button>
            <button type="button" className="btn btn-secondary update-notification-btn" disabled={status.cancelling} onClick={() => {
              void runAction(() => window.api.cancelUpdateDownload(version), labels.cancelFailed)
            }}>
              {labels.cancel}
            </button>
          </>
        )}
        {status.state === 'downloaded' && (
          <>
            <button type="button" className="btn btn-ghost update-notification-btn" onClick={onClose}>
              {labels.later}
            </button>
            <button type="button" className="btn btn-primary update-notification-btn" onClick={() => {
              void runAction(() => window.api.installUpdate(version), labels.installFailed)
            }}>
              {labels.restart}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
