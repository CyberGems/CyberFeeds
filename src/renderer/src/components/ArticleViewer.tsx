import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { ExternalLink, Star, FileText, Share2, Check, ArrowUp, BookOpen, Play, X } from 'lucide-react'
import { useUIStore } from '../store/ui.store'
import { useArticlesStore } from '../store/articles.store'
import { useSettingsStore } from '../store/settings.store'
import { FeedFavicon } from './ArticleList'
import Tooltip from './Tooltip'
import SelectionFlyout from './SelectionFlyout'
import WelcomeLounge from './WelcomeLounge'
import type { Article } from '../types'
import { useTranslation } from '../hooks/useTranslation'
import { isYouTubeUrl, extractYouTubeVideoId, getYouTubeThumbnailUrl } from '@shared/youtube'

function formatFullDate(ts: number, lang: string): string {
  return new Date(ts).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function makeSummary(title: string, content: string): string {
  const text = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = title
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 30)
  const scored = sentences.map((s) => {
    const sl = s.toLowerCase()
    const score = words.filter((w) => sl.includes(w)).length
    return { s, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return (
    scored
      .slice(0, 3)
      .map((x) => x.s.trim())
      .join('. ') + '.'
  )
}

function normalizeImageUrl(value: string, baseUrl: string): URL | null {
  try {
    const url = new URL(value.trim(), baseUrl)
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function imageUrlsMatch(left: string, right: string, baseUrl: string): boolean {
  const leftUrl = normalizeImageUrl(left, baseUrl)
  const rightUrl = normalizeImageUrl(right, baseUrl)
  if (!leftUrl || !rightUrl) return false
  if (leftUrl.href === rightUrl.href) return true

  // Treat a URL with or without a transformation query as the same source image.
  return (
    leftUrl.origin === rightUrl.origin &&
    leftUrl.pathname === rightUrl.pathname &&
    (!leftUrl.search || !rightUrl.search)
  )
}

function removeDuplicateFeaturedImage(html: string, thumbnail: string, baseUrl: string): string {
  if (!html || !thumbnail) return html

  const document = new DOMParser().parseFromString(html, 'text/html')
  Array.from(document.querySelectorAll('img')).forEach((image) => {
    const sources = [
      image.getAttribute('src'),
      image.getAttribute('data-src'),
      image.getAttribute('data-lazy-src'),
      image.getAttribute('data-original'),
      ...(image.getAttribute('srcset') || image.getAttribute('data-srcset') || '')
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/)[0])
    ].filter((source): source is string => Boolean(source))

    if (!sources.some((source) => imageUrlsMatch(source, thumbnail, baseUrl))) return

    const figure = image.closest('figure')
    if (figure && figure.querySelectorAll('img').length === 1 && !figure.textContent?.trim()) {
      figure.remove()
    } else {
      image.remove()
    }
  })

  return document.body.innerHTML
}

const VIDEO_PLACEHOLDER_TEXT =
  /^(play video content|play video|loading video|video loading|click to play|tap to play video)$/i

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value, 'https://invalid.invalid')
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function videoHasPlayableSource(video: Element): boolean {
  const src = video.getAttribute('src') || ''
  if (isHttpUrl(src)) return true
  return Array.from(video.querySelectorAll('source')).some((source) =>
    isHttpUrl(source.getAttribute('src') || '')
  )
}

/** Drop player shells that cannot play in the in-app viewer (no src, leftover loading UI). */
function stripUnplayableMedia(html: string): string {
  if (!html) return html
  const document = new DOMParser().parseFromString(html, 'text/html')

  for (const video of Array.from(document.querySelectorAll('video'))) {
    if (videoHasPlayableSource(video)) {
      video.setAttribute('controls', '')
      continue
    }
    const wrapper = video.parentElement
    video.remove()
    if (
      wrapper &&
      !wrapper.querySelector('img, video, a, p, li') &&
      !(wrapper.textContent || '').trim()
    ) {
      wrapper.remove()
    }
  }

  for (const el of Array.from(document.querySelectorAll('div, span, p, section, figure'))) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (!VIDEO_PLACEHOLDER_TEXT.test(text)) continue
    if (el.querySelector('img, a, video')) continue
    el.remove()
  }

  for (const el of Array.from(
    document.querySelectorAll('.spinner, [class*="loading-spinner"], [class*="video-loading"]')
  )) {
    el.remove()
  }

  return document.body.innerHTML
}

const ArticleViewer = memo(function ArticleViewer(): JSX.Element {
  const { selectedArticleId } = useUIStore()
  const { articles, starArticle } = useArticlesStore()
  const { settings, update } = useSettingsStore()
  const { t, language } = useTranslation()
  const [article, setArticle] = useState<Article | null>(null)
  const [fullHtml, setFullHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [summary, setSummary] = useState('')
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isPlayingVideo, setIsPlayingVideo] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRaf = useRef<number | undefined>(undefined)
  const pendingFullHtmlRef = useRef<string | null>(null)
  const ytVideoId = (article && isYouTubeUrl(article.link)) ? extractYouTubeVideoId(article.link) : null
  const isYt = Boolean(ytVideoId || (article && isYouTubeUrl(article.link)))

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current)
    }
  }, [])

  // Load article when selection changes
  useEffect(() => {
    if (!selectedArticleId) {
      setArticle(null)
      return
    }
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    setLinkCopied(false)
    setShowScrollTop(false)
    setIsPlayingVideo(false)
    if (contentRef.current) contentRef.current.scrollTop = 0
    const found = articles.find((a) => a.id === selectedArticleId)
    if (found) {
      setArticle(found)
      setFullHtml(null)
      pendingFullHtmlRef.current = null
      setShowSummary(false)
      setSummary('')
      const isYtFound = isYouTubeUrl(found.link)
      setIsPlayingVideo(Boolean(isYtFound && settings.autoPlayYouTube))
    } else {
      window.api.getArticleById(selectedArticleId).then((a) => {
        if (a) {
          setArticle(a)
          const isYtFound = isYouTubeUrl(a.link)
          setIsPlayingVideo(Boolean(isYtFound && settings.autoPlayYouTube))
        }
      })
    }
  }, [selectedArticleId, settings.autoPlayYouTube])

  // If user turns on autoPlayYouTube while viewing a YouTube video, activate player
  useEffect(() => {
    if (ytVideoId && settings.autoPlayYouTube) {
      setIsPlayingVideo(true)
    }
  }, [settings.autoPlayYouTube, ytVideoId])

  // Sync specific properties (like starred) if they change in the global store
  useEffect(() => {
    if (!article) return
    const found = articles.find((a) => a.id === article.id)
    if (found && found.starred !== article.starred) {
      setArticle((prev) => (prev ? { ...prev, starred: found.starred } : found))
    }
  }, [articles])

  const fetchFullContent = useCallback(() => {
    if (!article) return
    setLoading(true)
    setFullHtml(null)

    window.api
      .fetchArticleContent(article.id)
      .then((result) => {
        setLoading(false)
        if (result?.html) {
          const textOnly = result.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          const minLength = Math.max(120, (article.snippet || '').length)
          if (textOnly.length >= minLength) {
            setFullHtml(result.html)
          } else {
            console.log('Extracted content is too short, falling back to original')
          }
        }
      })
      .catch((err) => {
        setLoading(false)
        console.error('Failed to fetch full article content:', err)
      })
  }, [article])

  // Automatically fetch full article content when article changes
  useEffect(() => {
    if (!article) {
      setFullHtml(null)
      return
    }

    if (!settings.autoFetchFullContent) {
      setFullHtml(null)
      return
    }

    let active = true
    setLoading(true)
    setFullHtml(null)
    pendingFullHtmlRef.current = null

    window.api
      .fetchArticleContent(article.id)
      .then((result) => {
        if (!active) return
        setLoading(false)
        if (result?.html) {
          const textOnly = result.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          const minLength = Math.max(120, (article.snippet || '').length)
          if (textOnly.length >= minLength) {
            const sel = window.getSelection()
            const hasActiveSelection = Boolean(
              sel && !sel.isCollapsed && contentRef.current && contentRef.current.contains(sel.anchorNode)
            )
            if (hasActiveSelection) {
              pendingFullHtmlRef.current = result.html
            } else {
              setFullHtml(result.html)
            }
          } else {
            console.log('Extracted content is too short, falling back to original')
          }
        }
      })
      .catch((err) => {
        if (!active) return
        setLoading(false)
        console.error('Failed to fetch full article content:', err)
      })

    return () => {
      active = false
    }
  }, [article?.id, settings.autoFetchFullContent])

  // Apply deferred full content when user finishes / clears their active selection
  useEffect(() => {
    const handleSelectionChange = (): void => {
      if (!pendingFullHtmlRef.current) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        const nextHtml = pendingFullHtmlRef.current
        pendingFullHtmlRef.current = null
        setFullHtml(nextHtml)
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  // Hide <video> tags that error or never produce data (CORS / DRM / dead URLs).
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const readerBody = root.querySelector('.reader-body')
    if (!readerBody) return
    const videos = Array.from(readerBody.querySelectorAll('video'))
    const timers: number[] = []

    for (const video of videos) {
      const hide = (): void => {
        if (readerBody.contains(video)) {
          video.style.display = 'none'
        }
      }
      video.addEventListener('error', hide)
      for (const source of Array.from(video.querySelectorAll('source'))) {
        source.addEventListener('error', hide)
      }
      timers.push(
        window.setTimeout(() => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) hide()
        }, 5000)
      )
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [article?.id, fullHtml, article?.content])

  // Hide broken <img> tags inside article content that fail to load or error (CORS / 404 / dead URLs).
  // Uses non-destructive display:none so React's DOM tree is never mutated.
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const handleImgError = (e: Event): void => {
      const target = e.target as HTMLElement
      if (target && target.tagName === 'IMG') {
        const readerBody = root.querySelector('.reader-body')
        if (readerBody && readerBody.contains(target)) {
          target.style.display = 'none'
          const figure = target.closest('figure')
          if (figure && figure.querySelectorAll('img:not([style*="display: none"])').length === 0 && !figure.textContent?.trim()) {
            figure.style.display = 'none'
          }
        }
      }
    }
    root.addEventListener('error', handleImgError, true)
    return () => {
      root.removeEventListener('error', handleImgError, true)
    }
  }, [article?.id, fullHtml, article?.content])

  const handleContentScroll = useCallback(() => {
    if (scrollRaf.current != null) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = undefined
      const el = contentRef.current
      if (!el) return
      setShowScrollTop(el.scrollTop > 400)
    })
  }, [])

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleSummary = useCallback(() => {
    if (!article) return
    const content = fullHtml || article.content || article.snippet
    setSummary(makeSummary(article.title, content))
    setShowSummary(true)
  }, [article, fullHtml])

  const handleShare = useCallback(async () => {
    if (!article?.link) return
    try {
      await navigator.clipboard.writeText(article.link)
      setLinkCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      /* ignore clipboard errors */
    }
  }, [article])

  const isReddit = Boolean(article && (article.link?.includes('reddit.com') || (article as any).feedUrl?.includes('reddit.com')))
  const ytThumbnail = ytVideoId ? (article?.thumbnail || getYouTubeThumbnailUrl(ytVideoId)) : null
  const rawHtml = article ? (fullHtml || article.content || `<p>${article.snippet}</p>`) : ''
  const cleanedHtml = ytVideoId
    ? rawHtml.replace(/<div\s+class=["']yt-player-container["'][\s\S]*?<\/div>/gi, '')
    : rawHtml
  const effectiveThumb = article ? (ytThumbnail || article.thumbnail) : null
  const bodyHtml = effectiveThumb && article
    ? removeDuplicateFeaturedImage(cleanedHtml, effectiveThumb, article.link)
    : cleanedHtml

  const safeHtml = useMemo(() => {
    if (!bodyHtml) return ''
    return stripUnplayableMedia(DOMPurify.sanitize(bodyHtml, {
      ALLOWED_TAGS: [
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'strong',
        'em',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'code',
        'img',
        'figure',
        'figcaption',
        'video',
        'source',
        'picture',
        'iframe',
        'br',
        'hr',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'span',
        'div',
        'section',
        'article'
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'srcset',
        'alt',
        'title',
        'class',
        'id',
        'width',
        'height',
        'controls',
        'type',
        'media',
        'allow',
        'allowfullscreen',
        'frameborder',
        'sandbox',
        'referrerpolicy'
      ],
      FORCE_BODY: true
    }))
  }, [bodyHtml])

  if (!article) {
    return (
      <div className="article-viewer">
        <WelcomeLounge />
      </div>
    )
  }

  return (
    <div className="article-viewer">
      <div className="viewer-toolbar">
        <Tooltip label={t.articleViewer.quickSummary} placement="bottom">
          <button
            className="btn btn-ghost has-label"
            style={{ fontSize: 12 }}
            onClick={handleSummary}
          >
            <FileText size={13} />
            <span className="viewer-toolbar-label">{t.articleViewer.summary}</span>
          </button>
        </Tooltip>
        {!isYt && !isReddit && (
          <Tooltip label={t.articleViewer.autoFetchTooltip} placement="bottom">
            <button
              className="btn btn-ghost has-label"
              style={{
                fontSize: 12,
                color: settings.autoFetchFullContent ? 'var(--accent)' : 'inherit'
              }}
              onClick={() => update({ autoFetchFullContent: !settings.autoFetchFullContent })}
            >
              <BookOpen size={13} />
              <span className="viewer-toolbar-label">{t.articleViewer.autoFetch}</span>
            </button>
          </Tooltip>
        )}
        {isYt && (
          <Tooltip label={t.articleViewer.autoPlayYouTubeTooltip} placement="bottom">
            <button
              className={`btn btn-ghost has-label ${settings.autoPlayYouTube ? 'is-active' : ''}`}
              style={{
                fontSize: 12,
                color: settings.autoPlayYouTube ? 'var(--accent)' : 'inherit'
              }}
              onClick={() => {
                const next = !settings.autoPlayYouTube
                update({ autoPlayYouTube: next })
                setIsPlayingVideo(next)
              }}
            >
              <Play size={13} fill={settings.autoPlayYouTube ? 'currentColor' : 'none'} />
              <span className="viewer-toolbar-label">{t.articleViewer.autoPlayYouTube}</span>
            </button>
          </Tooltip>
        )}
        {loading && (
          <div
            className="viewer-toolbar-loading"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              color: 'var(--text-muted)',
              fontSize: 11
            }}
          >
            <div className="spinner" style={{ width: 11, height: 11 }} />
            <span>{t.articleViewer.loadingFull}</span>
          </div>
        )}
        <Tooltip label={t.articleViewer.openInBrowserTooltip} placement="bottom">
          <button
            className="btn btn-ghost has-label"
            style={{ fontSize: 12 }}
            onClick={() => window.api.openExternal(article.link)}
          >
            <ExternalLink size={13} />
            <span className="viewer-toolbar-label">{t.articleViewer.openInBrowser}</span>
          </button>
        </Tooltip>
        <Tooltip
          label={linkCopied ? t.articleViewer.linkCopied : t.articleViewer.shareTooltip}
          placement="bottom"
        >
          <button
            className={`btn btn-ghost has-label${linkCopied ? ' is-copied' : ''}`}
            style={{ fontSize: 12 }}
            onClick={handleShare}
          >
            {linkCopied ? <Check size={13} /> : <Share2 size={13} />}
            <span className="viewer-toolbar-label">
              {linkCopied ? t.articleViewer.copied : t.articleViewer.share}
            </span>
          </button>
        </Tooltip>
        <div className="viewer-toolbar-sep" />
        <Tooltip label={t.articleViewer.decreaseFont} placement="bottom">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() =>
              update({ readingFontSize: Math.max(12, (settings.readingFontSize || 15) - 1) })
            }
          >
            <span style={{ fontSize: 11, fontWeight: 700 }}>A-</span>
          </button>
        </Tooltip>
        <Tooltip label={t.articleViewer.increaseFont} placement="bottom">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() =>
              update({ readingFontSize: Math.min(24, (settings.readingFontSize || 15) + 1) })
            }
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>A+</span>
          </button>
        </Tooltip>
        <div className="viewer-toolbar-sep" />
        {!article.deletedAt && (
          <Tooltip
            label={article.starred ? t.articleViewer.unstar : t.articleViewer.star}
            placement="bottom"
          >
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => starArticle(article.id, !article.starred)}
            >
              <Star
                size={15}
                fill={article.starred ? 'var(--star)' : 'none'}
                color={article.starred ? 'var(--star)' : undefined}
              />
            </button>
          </Tooltip>
        )}
      </div>

      <div
        className="viewer-content"
        ref={contentRef}
        onScroll={handleContentScroll}
        onMouseDown={(e) => {
          if (e.button === 2) {
            const selection = window.getSelection()
            if (selection && selection.toString()) {
              e.preventDefault()
            }
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          window.dispatchEvent(
            new CustomEvent('cyberfeeds:close-context-menus', { detail: 'viewer' })
          )
          const target = e.target as HTMLElement
          const a = target.closest('a')
          let linkUrl = ''
          if (a) {
            if (a.closest('.reader-title')) {
              linkUrl = article.link
            } else if (a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
              linkUrl = a.href
            }
          }
          // Detect right-click on an image
          let imageUrl = ''
          const img = target.tagName === 'IMG'
            ? (target as HTMLImageElement)
            : target.querySelector('img') || target.closest('.reader-featured-image')?.querySelector('img')
          if (img && (img as HTMLImageElement).src) {
            imageUrl = (img as HTMLImageElement).src
          }
          // Detect right-click on title
          const titleEl = target.closest('.reader-title')
          const titleText = titleEl ? article.title : ''
          const selectedText = window.getSelection()?.toString() ?? ''
          window.api.showReadOnlyContextMenu(linkUrl, selectedText, imageUrl, titleText)
        }}
      >
        <div className="reader-wrap" style={{ maxWidth: settings.readingMaxWidth || 720 }}>
          <h1 className="reader-title">
            <Tooltip label={t.articleViewer.openDefaultBrowser} placement="bottom">
              <a
                role="link"
                tabIndex={0}
                draggable={false}
                onClick={(e) => {
                  e.preventDefault()
                  const selection = window.getSelection()?.toString()
                  if (selection && selection.trim().length > 0) return
                  window.api.openExternal(article.link)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    window.api.openExternal(article.link)
                  }
                }}
                onMouseOver={() => setHoveredLink(article.link)}
                onMouseLeave={() => setHoveredLink(null)}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {article.title}
              </a>
            </Tooltip>
          </h1>
          <div className="reader-meta">
            {(article.feedIcon || article.feedTitle) && (
              <FeedFavicon icon={article.feedIcon} title={article.feedTitle} size={15} />
            )}
            {article.feedTitle && <span style={{ fontWeight: 500 }}>{article.feedTitle}</span>}
            {article.author && article.author.trim().toLowerCase() !== article.feedTitle?.trim().toLowerCase() && (
              <>
                <span>·</span>
                <span>{article.author}</span>
              </>
            )}
            <span>·</span>
            <span>{formatFullDate(article.pubDate, language)}</span>
          </div>

          {ytVideoId ? (
            isPlayingVideo ? (
              <div
                className="reader-youtube-player-wrapper"
                style={{
                  margin: '20px 0'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '8px'
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setIsPlayingVideo(false)
                      update({ autoPlayYouTube: false })
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--text-secondary)'
                    }}
                    title={t.articleViewer.closePlayer}
                  >
                    <X size={13} />
                    <span>{t.articleViewer.closePlayer}</span>
                  </button>
                </div>
                <div
                  className="reader-youtube-player"
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '56.25%',
                    height: 0,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#000',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=0&rel=0`}
                    title={article.title}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 0
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : settings.showArticleThumbnails && ytThumbnail ? (
              <div
                className="reader-featured-image reader-youtube-thumbnail-wrapper"
                style={{
                  position: 'relative',
                  margin: '20px 0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  backgroundColor: '#000'
                }}
                onClick={() => {
                  setIsPlayingVideo(true)
                  update({ autoPlayYouTube: true })
                }}
                title={t.articleViewer.playVideoInApp}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setIsPlayingVideo(true)
                    update({ autoPlayYouTube: true })
                  }
                }}
              >
                <img
                  src={ytThumbnail}
                  alt={article.title}
                  style={{
                    width: '100%',
                    display: 'block',
                    maxHeight: '480px',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    const el = (e.target as HTMLElement).closest('.reader-featured-image') as HTMLElement | null
                    if (el) el.remove()
                  }}
                />
                <div
                  className="reader-youtube-play-overlay"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.28)'
                  }}
                >
                  <div
                    className="reader-youtube-play-btn"
                    style={{
                      width: '68px',
                      height: '48px',
                      background: '#ff0000',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                    }}
                  >
                    <Play size={22} fill="#ffffff" color="#ffffff" style={{ marginLeft: 2 }} />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ margin: '20px 0' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setIsPlayingVideo(true)
                    update({ autoPlayYouTube: true })
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  <span>{t.articleViewer.playVideoInApp}</span>
                </button>
              </div>
            )
          ) : (
            article.thumbnail && settings.showArticleThumbnails && (
              <div
                className="reader-featured-image"
                style={{
                  margin: '20px 0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  border: '1px solid var(--border)'
                }}
              >
                <img
                  src={article.thumbnail}
                  alt={article.title}
                  onError={(e) => {
                    const el = (e.target as HTMLElement).closest('.reader-featured-image') as HTMLElement | null
                    if (el) el.remove()
                  }}
                />
              </div>
            )
          )}

          {showSummary && summary && (
            <div
              style={{
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                marginBottom: 20,
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-primary)'
              }}
            >
              <strong
                style={{ color: 'var(--accent)', display: 'block', marginBottom: 6, fontSize: 12 }}
              >
                {t.articleViewer.quickSummary}
              </strong>
              {summary}
              <button
                onClick={() => setShowSummary(false)}
                style={{
                  display: 'block',
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 11
                }}
              >
                {t.articleViewer.dismiss}
              </button>
            </div>
          )}

          <div
            className="reader-body"
            style={{ fontSize: settings.readingFontSize || 15, userSelect: 'text', cursor: 'text' }}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
            onClick={(e) => {
              const target = e.target as HTMLElement
              const a = target.closest('a')
              if (a && a.href) {
                e.preventDefault()
                window.api.openExternal(a.href)
              }
            }}
            onMouseOver={(e) => {
              const target = e.target as HTMLElement
              const a = target.closest('a')
              if (a && a.href) {
                setHoveredLink(a.href)
              } else {
                setHoveredLink(null)
              }
            }}
            onMouseLeave={() => setHoveredLink(null)}
          />
          {!fullHtml && !loading && !isYt && !isReddit && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn btn-ghost has-label"
                onClick={fetchFullContent}
                style={{
                  fontSize: 13,
                  padding: '8px 16px',
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 'var(--radius)'
                }}
              >
                <FileText size={14} />
                {t.articleViewer.loadFull}
              </button>
            </div>
          )}
        </div>
      </div>

      {showScrollTop && (
        <Tooltip label={t.articleViewer.backToTop} placement="bottom">
          <button
            type="button"
            className="scroll-top-fab"
            onClick={scrollToTop}
            aria-label={t.articleViewer.backToTop}
          >
            <ArrowUp size={16} />
          </button>
        </Tooltip>
      )}

      {hoveredLink && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            background: '#333333',
            color: '#eeeeee',
            borderTopRightRadius: '4px',
            borderTop: '1px solid #444444',
            borderRight: '1px solid #444444',
            padding: '3px 10px',
            fontSize: '12px',
            zIndex: 9999,
            maxWidth: '80%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            boxShadow: '0 -1px 3px rgba(0,0,0,0.3)'
          }}
        >
          {hoveredLink}
        </div>
      )}

      {settings.selectionToolbarEnabled !== false && (
        <SelectionFlyout containerRef={contentRef} />
      )}
    </div>
  )
})

export default ArticleViewer
