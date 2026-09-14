import React, { useState, useEffect } from 'react'
import { X, Globe, ChevronDown, MessageCircle, Youtube, Newspaper, Rss, Github } from 'lucide-react'
import { useFeedsStore } from '../store/feeds.store'
import { useUIStore } from '../store/ui.store'
import { useTranslation } from '../hooks/useTranslation'
import { useOverlayDismiss } from '../hooks/useOverlayDismiss'
import { FeedFavicon } from './ArticleList'

type FeedExampleCategory = 'reddit' | 'youtube' | 'news' | 'rss' | 'cybergems'

const FEED_EXAMPLES: Array<{
  id: string
  category: FeedExampleCategory
  labelKey: 'redditTechnology' | 'redditProgramming' | 'youtubeTed' | 'hackerNews' | 'githubBlog' | 'cybergemsReleases'
  url: string
}> = [
  {
    id: 'cybergems-releases',
    category: 'cybergems',
    labelKey: 'cybergemsReleases',
    url: 'https://github.com/CyberGems/CyberFeeds/releases.atom'
  },
  {
    id: 'reddit-technology',
    category: 'reddit',
    labelKey: 'redditTechnology',
    url: 'https://www.reddit.com/r/technology'
  },
  {
    id: 'reddit-programming',
    category: 'reddit',
    labelKey: 'redditProgramming',
    url: 'https://www.reddit.com/r/programming'
  },
  {
    id: 'youtube-ted',
    category: 'youtube',
    labelKey: 'youtubeTed',
    url: 'https://www.youtube.com/@TED'
  },
  {
    id: 'hacker-news',
    category: 'news',
    labelKey: 'hackerNews',
    url: 'https://news.ycombinator.com/rss'
  },
  {
    id: 'github-blog',
    category: 'rss',
    labelKey: 'githubBlog',
    url: 'https://github.blog/feed/'
  }
]

function FeedExampleIcon({ category }: { category: FeedExampleCategory }): JSX.Element {
  if (category === 'cybergems') return <Github size={14} />
  if (category === 'reddit') return <MessageCircle size={14} />
  if (category === 'youtube') return <Youtube size={14} />
  if (category === 'news') return <Newspaper size={14} />
  return <Rss size={14} />
}

export default function AddFeedModal(): JSX.Element {
  const [url, setUrl] = useState('')
  const [folderId, setFolderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [error, setError] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const customTitleRef = React.useRef<HTMLInputElement>(null)
  const urlRef = React.useRef<HTMLInputElement>(null)
  const { t, language } = useTranslation()

  useEffect(() => { urlRef.current?.focus() }, [])
  const { folders, addFeed } = useFeedsStore()
  const { closePanel, selectFeed, setPendingFeedId } = useUIStore()
  const overlayDismiss = useOverlayDismiss(closePanel)

  const previewUrl = async (candidateUrl: string): Promise<void> => {
    if (!candidateUrl.trim()) return
    setPreviewing(true)
    setError('')
    try {
      const result = await window.api.previewFeed(candidateUrl)
      if (result.error) {
        setError(result.error)
        return
      }
      setPreview(result)
    } finally {
      setPreviewing(false)
    }
  }

  const handlePreview = async (): Promise<void> => {
    await previewUrl(url)
  }

  const handleExampleSelect = async (example: (typeof FEED_EXAMPLES)[number]): Promise<void> => {
    setUrl(example.url)
    setPreview(null)
    setError('')
    setShowExamples(false)
    await previewUrl(example.url)
  }

  const handleAdd = async (): Promise<void> => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    const finalTitle = customTitleRef.current?.value || ''
    const result = await addFeed(url, folderId, finalTitle)
    setLoading(true) // Keep loading spinner active until unmounted/closed
    if (result.error) {
      if (result.error === 'Feed already exists') {
        setError(language === 'es' ? 'El feed ya existe' : result.error)
      } else {
        setError(result.error)
      }
      setLoading(false)
      return
    }
    if (result.feed) {
      selectFeed(result.feed.id)
      setPendingFeedId(result.feed.id)
    }
    closePanel()
  }

  return (
    <div className="modal-overlay" {...overlayDismiss}>
      <div className="modal">
        <div className="modal-header">
          <Globe size={16} style={{ color: 'var(--accent)' }} />
          <h2>{t.addFeed.title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={closePanel}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t.addFeed.urlLabel}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={urlRef}
                className="form-input"
                style={{ flex: 1 }}
                placeholder={t.addFeed.urlPlaceholder || 'https://example.com/feed.xml'}
                value={url}
                onChange={e => { setUrl(e.target.value); setPreview(null); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handlePreview()}
              />
              <button className="btn btn-secondary" onClick={handlePreview} disabled={previewing || !url} style={{ flexShrink: 0 }}>
                {previewing ? <div className="spinner" style={{ width: 13, height: 13 }} /> : t.addFeed.previewBtn}
              </button>
            </div>
          </div>
          <div className="add-feed-examples">
            <button
              type="button"
              className="add-feed-examples-toggle"
              onClick={() => setShowExamples(value => !value)}
              aria-expanded={showExamples}
            >
              <span>{t.addFeed.examplesToggle}</span>
              <ChevronDown
                size={13}
                style={{ transform: showExamples ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
              />
            </button>
            {showExamples && (
              <div className="add-feed-examples-panel">
                <div className="add-feed-examples-hint">{t.addFeed.examplesHint}</div>
                <div className="add-feed-examples-grid">
                  {FEED_EXAMPLES.map(example => (
                    <button
                      key={example.id}
                      type="button"
                      className="add-feed-example"
                      onClick={() => void handleExampleSelect(example)}
                      disabled={previewing}
                    >
                      <span className="add-feed-example-icon">
                        <FeedExampleIcon category={example.category} />
                      </span>
                      <span className="add-feed-example-copy">
                        <span className="add-feed-example-label">{t.addFeed.examples[example.labelKey]}</span>
                        <span className="add-feed-example-category">
                          {t.addFeed.exampleCategories[example.category]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t.addFeed.folderLabel}</label>
            <select className="form-select" value={folderId} onChange={e => setFolderId(e.target.value)}>
              <option value="">{t.addFeed.noFolder}</option>
              {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

          {preview && (
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-1)'
                  }}
                  aria-hidden="true"
                >
                  <FeedFavicon icon={preview.icon} title={preview.title} size={26} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 0, marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 11, opacity: 0.7, color: 'var(--accent)' }}>{t.addFeed.editNameLabel}</label>
                  <input
                    ref={customTitleRef}
                    className="form-input"
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '8px 12px',
                      background: 'var(--bg-1)',
                      border: '1px solid var(--border)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
                    }}
                    defaultValue={preview.title || ''}
                    placeholder={t.addFeed.placeholderName}
                    autoComplete="off"
                    spellCheck="false"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </div>
              </div>
              {preview.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, opacity: 0.8 }}>{preview.description}</div>}
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>{t.addFeed.previewItemsLabel}</div>
              {preview.items?.map((item: any, i: number) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0', borderTop: i > 0 ? '1px solid var(--border-muted)' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  • {item.title}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={closePanel}>{t.sidebar.cancel}</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading || !url}>
            {loading ? <div className="spinner" style={{ width: 13, height: 13 }} /> : t.addFeed.title}
          </button>
        </div>
      </div>
    </div>
  )
}
