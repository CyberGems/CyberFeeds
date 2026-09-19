import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { ExternalLink, Star, FileText, Share2, Check, ArrowUp, BookOpen, Play, X, Search, ChevronUp, ChevronDown, PictureInPicture2, Copy, Link2, Image as ImageIcon } from 'lucide-react'
import { useUIStore } from '../store/ui.store'
import { useArticlesStore } from '../store/articles.store'
import { useSettingsStore } from '../store/settings.store'
import { FeedFavicon } from './ArticleList'
import Tooltip from './Tooltip'
import SelectionFlyout from './SelectionFlyout'
import WelcomeLounge from './WelcomeLounge'
import type { Article } from '../types'
import type { PipVideoPayload } from '@shared/types'
import { useTranslation } from '../hooks/useTranslation'
import { isYouTubeUrl, extractYouTubeVideoId, getYouTubeThumbnailUrl } from '@shared/youtube'
import { copyArticleImage } from '../lib/copyImage'

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

/**
 * Checks if the existing article content from the RSS feed is already rich and complete.
 * If the content already has embedded media players (iframes, videos) or substantial
 * formatted paragraphs, running automatic background scraping is unnecessary, wastes
 * bandwidth, and destroys/restarts active video playback.
 */
function isContentAlreadyFull(content: string | undefined | null, _snippet?: string | null): boolean {
  if (!content) return false
  const trimmed = content.trim()
  if (trimmed.length < 300) return false

  // If content contains an embedded media player (iframe or video), it is already rich and self-contained
  if (/<(?:iframe|video)\b/i.test(trimmed)) {
    return true
  }

  // If the content references video platforms/players but lacks an embedded player,
  // do not consider it full so auto-scraping can fetch the real embedded player.
  const hasVideoReference =
    /(?:youtube\.com\/embed|youtube-nocookie\.com\/embed|player\.vimeo\.com|rumble\.com\/embed|dailymotion\.com\/embed|player\.twitch\.tv|bitchute\.com\/embed|streamable\.com\/[eo]\/|tiktok\.com\/embed|jwplayer|jwplatform|wp-block-embed|Rumble\s*\(|rumble_[a-zA-Z0-9]+)/i.test(trimmed) ||
    /<p\b[^>]*>\s*<a\b[^>]*\bhref=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/watch|youtu\.be\/)/i.test(trimmed)
  if (hasVideoReference) {
    return false
  }

  // If content has 4+ paragraphs and exceeds 3000 chars without missing media, it's a full article
  const pCount = (trimmed.match(/<p\b/gi) || []).length
  if (pCount >= 4 && trimmed.length > 3000) {
    return true
  }

  return false
}

/** Converts dynamic video embeds, fixes protocol-relative URLs on media, and ensures valid player attributes. */
function transformDynamicEmbeds(html: string): string {
  if (!html) return html
  let result = html

  // 0. Promote lazy-load attributes (data-lazy-src, data-src, etc.) to src for media elements when src is missing or empty
  result = result.replace(
    /<(iframe|video|source|embed|img)\b([^>]*?)>/gi,
    (tag, tagName, attrs) => {
      // Must not match -src in data-lazy-src / data-src
      const hasValidSrc = /(?:^|\s)src=["'][^"'\s]+["']/i.test(attrs)
      if (!hasValidSrc) {
        const newAttrs = attrs.replace(/\b(?:data-lazy-src|data-src|data-original|data-url)=["']([^"'\s]+)["']/i, 'src="$1"')
        if (newAttrs !== attrs) {
          return `<${tagName}${newAttrs}>`
        }
      }
      return tag
    }
  )

  // 1. Normalize protocol-relative URLs on media (e.g. src="//www.youtube.com/embed/..." -> src="https://www.youtube.com/embed/...")
  result = result.replace(
    /(<(?:iframe|video|embed|source)\b[^>]*\bsrc=["'])\/\/([^"']+)(["'][^>]*>)/gi,
    '$1https://$2$3'
  )

  // 2. Rumble script embed loaders:
  // Extracts Rumble("play", { video: "xyz", div: "rumble_xyz" })
  const rumbleVideoMap = new Map<string, string>()
  const scriptRegex = /Rumble\s*\(\s*["']play["']\s*,\s*\{[^}]*["']video["']\s*:\s*["']([a-zA-Z0-9]+)["'][^}]*["']div["']\s*:\s*["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = scriptRegex.exec(result)) !== null) {
    const videoId = match[1]
    const divId = match[2]
    rumbleVideoMap.set(divId, videoId)
  }

  // Replace <div id="rumble_xyz"> with responsive Rumble embed iframe
  result = result.replace(/<div\s+id=["'](rumble_[a-zA-Z0-9]+)["'][^>]*>\s*<\/div>/gi, (_, divId) => {
    const videoId = rumbleVideoMap.get(divId) || divId.replace(/^rumble_/, '')
    return `<iframe class="reader-embed-player reader-rumble-player" src="https://rumble.com/embed/${videoId}/?pub=4" frameborder="0" allowfullscreen loading="lazy"></iframe>`
  })

  // 3. JWPlayer dynamic video containers & scripts
  const jwMatch =
    result.match(/"(?:floating_player_playlist_id|player_playlist_id|media_id|playlist_id)"\s*:\s*"([a-zA-Z0-9]{8})"/i) ||
    result.match(/cdn\.jwplayer\.com\/(?:v2\/playlists|players|manifests)\/([a-zA-Z0-9]{8})/i) ||
    result.match(/content\.jwplatform\.com\/(?:players|videos|manifests)\/([a-zA-Z0-9]{8})/i)

  const jwId = jwMatch ? jwMatch[1] : null

  result = result.replace(
    /<(?:div|aside)\b[^>]*?(?:class=["'][^"']*\bjwplayer\b[^"']*["']|id=["']jwplayer--floatingVideo["'])[^>]*>(?:[\s\S]*?<\/(?:div|aside)>)?/gi,
    (m) => {
      const mediaMatch = m.match(/data-(?:media|playlist)-id=["']([a-zA-Z0-9]{8})["']/i)
      const mediaId = mediaMatch ? mediaMatch[1] : jwId
      if (mediaId) {
        return `<iframe class="reader-embed-player reader-jwplayer-player" src="https://cdn.jwplayer.com/players/${mediaId}.html" frameborder="0" allowfullscreen loading="lazy"></iframe>`
      }
      return m
    }
  )

  // 4. Standalone YouTube video links in isolated paragraphs
  result = result.replace(
    /<p\b[^>]*>\s*<a\b[^>]*\bhref=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?][^"']*)?["'][^>]*>(?:https?:\/\/[^<]+|Watch (?:video|on YouTube)[^<]*|YouTube:?[^<]*)<\/a>\s*<\/p>/gi,
    (_, videoId) => {
      return `<iframe class="reader-embed-player reader-youtube-player" src="https://www.youtube-nocookie.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`
    }
  )

  // 5. Ensure YouTube and video iframes have proper permissions, referrerpolicy, and styling classes
  result = result.replace(
    /<iframe\b([^>]*\bsrc=["']https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/[^"']+["'][^>]*)>/gi,
    (m) => {
      let tag = m
      if (!tag.includes('allow=')) {
        tag = tag.replace('<iframe', '<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"')
      }
      if (!tag.includes('allowfullscreen')) {
        tag = tag.replace('<iframe', '<iframe allowfullscreen')
      }
      if (!tag.includes('referrerpolicy=')) {
        tag = tag.replace('<iframe', '<iframe referrerpolicy="strict-origin-when-cross-origin"')
      }
      if (!tag.includes('class=')) {
        tag = tag.replace('<iframe', '<iframe class="reader-embed-player reader-youtube-player"')
      } else if (!tag.includes('reader-embed-player')) {
        tag = tag.replace(/class=["']([^"']*)["']/, 'class="$1 reader-embed-player reader-youtube-player"')
      }
      return tag
    }
  )

  // 6. Ensure JWPlayer iframes have allowfullscreen
  result = result.replace(
    /<iframe\b([^>]*\bsrc=["']https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:jwplayer\.com|jwplatform\.com)\/[^"']+["'][^>]*)>/gi,
    (m) => {
      let tag = m
      if (!tag.includes('allowfullscreen')) {
        tag = tag.replace('<iframe', '<iframe allowfullscreen')
      }
      return tag
    }
  )

  return result
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

  for (const iframe of Array.from(document.querySelectorAll('iframe'))) {
    const src = (iframe.getAttribute('src') || '').trim()
    if (!src || !isHttpUrl(src)) {
      const wrapper = iframe.parentElement
      iframe.remove()
      if (
        wrapper &&
        !wrapper.querySelector('img, video, iframe, a, p, li') &&
        !(wrapper.textContent || '').trim()
      ) {
        wrapper.remove()
      }
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clearHighlights(container: HTMLElement): void {
  const marks = Array.from(container.querySelectorAll('mark.reader-search-match'))
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (parent) {
      const text = mark.textContent || ''
      parent.replaceChild(document.createTextNode(text), mark)
      parent.normalize()
    }
  })
}

function highlightMatches(container: HTMLElement, query: string): HTMLElement[] {
  clearHighlights(container)
  const trimmed = query.trim()
  if (!trimmed) return []

  const escaped = escapeRegex(trimmed)
  const regex = new RegExp(escaped, 'gi')
  const matchedElements: HTMLElement[] = []

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        const tag = parent.tagName.toUpperCase()
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK' || tag === 'IFRAME' || tag === 'VIDEO' || tag === 'BUTTON') {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    }
  )

  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  for (const node of textNodes) {
    const text = node.nodeValue
    if (!text || !regex.test(text)) continue
    regex.lastIndex = 0

    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }

      const mark = document.createElement('mark')
      mark.className = 'reader-search-match'
      mark.textContent = match[0]
      fragment.appendChild(mark)
      matchedElements.push(mark)

      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    if (node.parentNode) {
      node.parentNode.replaceChild(fragment, node)
    }
  }

  return matchedElements
}

interface ArticleBodyProps {
  html: string
  fontSize: number
  onLinkHover: (url: string | null) => void
}

const ArticleBody = memo(
  function ArticleBody({ html, fontSize, onLinkHover }: ArticleBodyProps) {
    return (
      <div
        className="reader-body"
        style={{ fontSize, userSelect: 'text', cursor: 'text' }}
        dangerouslySetInnerHTML={{ __html: html }}
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
            onLinkHover(a.href)
          } else {
            onLinkHover(null)
          }
        }}
        onMouseLeave={() => onLinkHover(null)}
      />
    )
  },
  (prev, next) => {
    return prev.html === next.html && prev.fontSize === next.fontSize
  }
)

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
  const [pipArticleId, setPipArticleId] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRaf = useRef<number | undefined>(undefined)
  const pendingFullHtmlRef = useRef<string | null>(null)
  const ytVideoId = (article && isYouTubeUrl(article.link)) ? extractYouTubeVideoId(article.link) : null
  const isYt = Boolean(ytVideoId || (article && isYouTubeUrl(article.link)))

  // Picture-in-Picture status synchronization
  useEffect(() => {
    window.api.pip.getStatus().then((status) => {
      if (status?.active) {
        setPipArticleId(status.articleId || null)
      } else {
        setPipArticleId(null)
      }
    }).catch(() => {})

    const unsub = window.api.pip.onStatusChange(({ active, articleId }) => {
      if (active) {
        setPipArticleId(articleId || null)
      } else {
        setPipArticleId(null)
      }
    })

    return () => {
      unsub()
    }
  }, [])

  const handleOpenPip = useCallback((payload: PipVideoPayload) => {
    window.api.pip.open(payload)
    setPipArticleId(payload.articleId || article?.id || null)
  }, [article?.id])

  const handleReturnFromPip = useCallback(() => {
    window.api.pip.returnToReader()
    setPipArticleId(null)
    setIsPlayingVideo(true)
  }, [])

  const handleClosePip = useCallback(() => {
    window.api.pip.close()
    setPipArticleId(null)
  }, [])

  const [showStickyTitle, setShowStickyTitle] = useState(false)
  const [ctx, setCtx] = useState<{
    x: number
    y: number
    linkUrl?: string
    selectedText?: string
    imageUrl?: string
    isTitle?: boolean
  } | null>(null)

  useEffect(() => {
    const handleUp = (): void => setCtx(null)
    const handleOtherMenu = (e: Event): void => {
      if ((e as CustomEvent<string>).detail !== 'viewer') setCtx(null)
    }
    window.addEventListener('click', handleUp)
    window.addEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    return () => {
      window.removeEventListener('click', handleUp)
      window.removeEventListener('cyberfeeds:close-context-menus', handleOtherMenu)
    }
  }, [])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const matchesRef = useRef<HTMLElement[]>([])

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current)
      const root = contentRef.current
      if (root) {
        const readerBody = root.querySelector('.reader-body') as HTMLElement | null
        if (readerBody) clearHighlights(readerBody)
      }
    }
  }, [])

  // Load article when selection changes
  useEffect(() => {
    setShowStickyTitle(false)
    setCtx(null)
    setSearchOpen(false)
    setSearchQuery('')
    setMatchCount(0)
    setCurrentMatchIndex(0)
    matchesRef.current = []

    if (!selectedArticleId) {
      setArticle(null)
      setFullHtml(null)
      pendingFullHtmlRef.current = null
      setShowSummary(false)
      setSummary('')
      setIsPlayingVideo(false)
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

  // Automatically fetch full article content when article changes (only if content is not already complete)
  useEffect(() => {
    if (!article) {
      setFullHtml(null)
      return
    }

    if (!settings.autoFetchFullContent) {
      setFullHtml(null)
      return
    }

    // If the article already contains complete content or embedded media players,
    // do not automatically scrape the web in the background (prevents tearing down DOM/restarting videos)
    if (isContentAlreadyFull(article.content, article.snippet)) {
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
          const currentContentText = (article.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          const minLength = Math.max(120, (article.snippet || '').length, currentContentText.length)
          if (textOnly.length >= minLength) {
            const hasMedia = Boolean(contentRef.current?.querySelector('iframe, video'))
            const sel = window.getSelection()
            const hasActiveSelection = Boolean(
              sel && !sel.isCollapsed && contentRef.current && contentRef.current.contains(sel.anchorNode)
            )
            if (hasActiveSelection || hasMedia) {
              pendingFullHtmlRef.current = result.html
            } else {
              setFullHtml(result.html)
            }
          } else {
            console.log('Extracted content is too short or not better, keeping original')
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
      if (searchOpen) return
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
  }, [searchOpen])

  // Handle <video> tags in reader body: provide interactive fallback card if error / CORS / unplayable
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const readerBody = root.querySelector('.reader-body')
    if (!readerBody) return
    const videos = Array.from(readerBody.querySelectorAll('video'))
    const timers: number[] = []

    const showFallback = (video: HTMLVideoElement): void => {
      if (!readerBody.contains(video)) return
      if (video.dataset.fallbackApplied) return
      video.dataset.fallbackApplied = 'true'
      video.style.display = 'none'

      const sourceEl = video.querySelector('source')
      const rawSrc = video.currentSrc || video.getAttribute('src') || sourceEl?.getAttribute('src') || ''
      const targetUrl = rawSrc || article?.link || ''

      const card = document.createElement('div')
      card.className = 'reader-video-fallback-card'
      card.innerHTML = `
        <div class="reader-video-fallback-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
        </div>
        <div class="reader-video-fallback-content">
          <div class="reader-video-fallback-title">${t.articleViewer.videoFallbackTitle}</div>
          <div class="reader-video-fallback-desc">${t.articleViewer.videoFallbackDesc}</div>
        </div>
        <button type="button" class="btn btn-secondary reader-video-fallback-btn">
          <span>${t.articleViewer.videoFallbackBtn}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      `
      const btn = card.querySelector('button')
      if (btn && targetUrl) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          window.api.openExternal(targetUrl)
        })
      }

      video.parentNode?.insertBefore(card, video.nextSibling)
    }

    for (const video of videos) {
      if (video.error) {
        showFallback(video)
        continue
      }
      video.addEventListener('error', () => showFallback(video))
      for (const source of Array.from(video.querySelectorAll('source'))) {
        source.addEventListener('error', () => showFallback(video))
      }
      timers.push(
        window.setTimeout(() => {
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            showFallback(video)
          }
        }, 4000)
      )
    }

    // Attach Firefox-style PiP overlay button to videos and embedded player iframes
    const mediaElements = Array.from(
      readerBody.querySelectorAll<HTMLElement>(
        'video, iframe.reader-embed-player, iframe[src*="youtube"], iframe[src*="rumble"], iframe[src*="vimeo"], iframe[src*="jwplayer"]'
      )
    )

    for (const mediaEl of mediaElements) {
      if (mediaEl.dataset.pipAttached) continue
      mediaEl.dataset.pipAttached = 'true'

      let container = mediaEl.parentElement
      if (!container?.classList.contains('reader-pip-container')) {
        container = document.createElement('div')
        container.className = 'reader-pip-container'
        mediaEl.parentNode?.insertBefore(container, mediaEl)
        container.appendChild(mediaEl)
      }

      const pipBtn = document.createElement('button')
      pipBtn.type = 'button'
      pipBtn.className = 'reader-pip-overlay-btn'
      pipBtn.title = t.articleViewer.pipTooltip
      pipBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4"></path>
          <rect width="10" height="7" x="12" y="13" rx="1"></rect>
        </svg>
        <span class="reader-pip-overlay-text">${t.articleViewer.pipButton}</span>
      `

      pipBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        let payload: PipVideoPayload | null = null
        if (mediaEl.tagName === 'VIDEO') {
          const v = mediaEl as HTMLVideoElement
          v.pause()
          const src = v.currentSrc || v.getAttribute('src') || v.querySelector('source')?.getAttribute('src') || ''
          payload = {
            type: 'video',
            src,
            title: article?.title || '',
            articleId: article?.id,
            currentTime: v.currentTime
          }
        } else if (mediaEl.tagName === 'IFRAME') {
          const iframe = mediaEl as HTMLIFrameElement
          const src = iframe.getAttribute('src') || iframe.src || ''
          const ytId = extractYouTubeVideoId(src)
          if (ytId) {
            payload = {
              type: 'youtube',
              videoId: ytId,
              src,
              title: article?.title || '',
              articleId: article?.id
            }
          } else {
            payload = {
              type: 'embed',
              src,
              title: article?.title || '',
              articleId: article?.id
            }
          }
        }
        if (payload) {
          handleOpenPip(payload)
        }
      })

      container.appendChild(pipBtn)
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
      const cards = Array.from(readerBody.querySelectorAll('.reader-video-fallback-card'))
      for (const c of cards) c.remove()
      const pipBtns = Array.from(readerBody.querySelectorAll('.reader-pip-overlay-btn'))
      for (const b of pipBtns) b.remove()
    }
  }, [article?.id, fullHtml, article?.content, article?.link, t, handleOpenPip])

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
    setCtx((prev) => (prev ? null : prev))
    if (scrollRaf.current != null) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = undefined
      const el = contentRef.current
      if (!el) return
      setShowStickyTitle(el.scrollTop > 100)
      setShowScrollTop(el.scrollTop > 400)
    })
  }, [])

  const executeSearch = useCallback((query: string) => {
    const root = contentRef.current
    if (!root) return
    const readerBody = root.querySelector('.reader-body') as HTMLElement | null
    if (!readerBody) return

    if (!query.trim()) {
      clearHighlights(readerBody)
      matchesRef.current = []
      setMatchCount(0)
      setCurrentMatchIndex(0)
      return
    }

    const matches = highlightMatches(readerBody, query)
    matchesRef.current = matches
    setMatchCount(matches.length)
    if (matches.length > 0) {
      setCurrentMatchIndex(0)
      matches[0].classList.add('reader-search-active')
      matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      setCurrentMatchIndex(0)
    }
  }, [])

  const goToMatch = useCallback((index: number) => {
    const root = contentRef.current
    if (!root) return
    const readerBody = root.querySelector('.reader-body') as HTMLElement | null
    if (!readerBody) return

    const marks = Array.from(readerBody.querySelectorAll<HTMLElement>('mark.reader-search-match'))
    if (marks.length === 0) return

    const safeIndex = ((index % marks.length) + marks.length) % marks.length

    marks.forEach((m, i) => {
      if (i === safeIndex) {
        m.classList.add('reader-search-active')
      } else {
        m.classList.remove('reader-search-active')
      }
    })

    const target = marks[safeIndex]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setCurrentMatchIndex(safeIndex)
  }, [])

  const goToNextMatch = useCallback(() => {
    const root = contentRef.current
    const readerBody = root?.querySelector('.reader-body') as HTMLElement | null
    const total = readerBody ? readerBody.querySelectorAll('mark.reader-search-match').length : matchCount
    if (total === 0) return
    goToMatch(currentMatchIndex + 1)
  }, [matchCount, currentMatchIndex, goToMatch])

  const goToPrevMatch = useCallback(() => {
    const root = contentRef.current
    const readerBody = root?.querySelector('.reader-body') as HTMLElement | null
    const total = readerBody ? readerBody.querySelectorAll('mark.reader-search-match').length : matchCount
    if (total === 0) return
    goToMatch(currentMatchIndex - 1)
  }, [matchCount, currentMatchIndex, goToMatch])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    setMatchCount(0)
    setCurrentMatchIndex(0)
    const root = contentRef.current
    if (root) {
      const readerBody = root.querySelector('.reader-body') as HTMLElement | null
      if (readerBody) clearHighlights(readerBody)
    }
    contentRef.current?.focus()
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    }, 50)
  }, [])

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      closeSearch()
    } else {
      openSearch()
    }
  }, [searchOpen, closeSearch, openSearch])

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val)
    executeSearch(val)
  }, [executeSearch])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        goToPrevMatch()
      } else {
        goToNextMatch()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
    }
  }, [goToNextMatch, goToPrevMatch, closeSearch])

  useEffect(() => {
    if (!article) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openSearch()
        return
      }

      if (e.key === 'Escape' && searchOpen && !isInput) {
        e.preventDefault()
        closeSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [article, searchOpen, openSearch, closeSearch])

  useEffect(() => {
    if (searchOpen && searchQuery) {
      executeSearch(searchQuery)
    }
  }, [fullHtml])

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
  const transformedHtml = transformDynamicEmbeds(rawHtml)
  const cleanedHtml = ytVideoId
    ? transformedHtml.replace(/<div\s+class=["']yt-player-container["'][\s\S]*?<\/div>/gi, '')
    : transformedHtml
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
        'referrerpolicy',
        'loading'
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
        <Tooltip label={`${t.articleViewer.searchInArticle} (Ctrl+F)`} placement="bottom">
          <button
            className={`btn btn-ghost has-label ${searchOpen ? 'is-active' : ''}`}
            style={{
              fontSize: 12,
              color: searchOpen ? 'var(--accent)' : 'inherit'
            }}
            onClick={toggleSearch}
          >
            <Search size={13} />
            <span className="viewer-toolbar-label">{t.articleViewer.searchBtn}</span>
          </button>
        </Tooltip>

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

      {searchOpen && (
        <div className="viewer-search-bar" role="search">
          <div className="viewer-search-input-wrap">
            <Search size={14} className="viewer-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="viewer-search-input"
              placeholder={t.articleViewer.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button
                className="viewer-search-clear"
                onClick={() => handleSearchChange('')}
                title={t.articleViewer.clearSearch}
                aria-label={t.articleViewer.clearSearch}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <span className="viewer-search-count">
            {searchQuery.trim()
              ? matchCount > 0
                ? `${currentMatchIndex + 1} ${t.articleViewer.matchOf} ${matchCount}`
                : t.articleViewer.noMatches
              : ''}
          </span>

          <div className="viewer-search-nav">
            <Tooltip label={`${t.articleViewer.prevMatch} (Shift+Enter)`} placement="bottom">
              <button
                className="btn btn-ghost btn-icon"
                disabled={matchCount === 0}
                onClick={goToPrevMatch}
                aria-label={t.articleViewer.prevMatch}
              >
                <ChevronUp size={14} />
              </button>
            </Tooltip>
            <Tooltip label={`${t.articleViewer.nextMatch} (Enter)`} placement="bottom">
              <button
                className="btn btn-ghost btn-icon"
                disabled={matchCount === 0}
                onClick={goToNextMatch}
                aria-label={t.articleViewer.nextMatch}
              >
                <ChevronDown size={14} />
              </button>
            </Tooltip>
          </div>

          <div className="viewer-toolbar-sep" style={{ height: 14 }} />

          <Tooltip label={`${t.articleViewer.closeSearch} (Esc)`} placement="bottom">
            <button
              className="btn btn-ghost btn-icon"
              onClick={closeSearch}
              aria-label={t.articleViewer.closeSearch}
            >
              <X size={14} />
            </button>
          </Tooltip>
        </div>
      )}

      <div className={`viewer-sticky-header ${showStickyTitle ? 'is-visible' : ''}`}>
        <Tooltip
          label={article.feedTitle ? `${article.feedTitle} · ${article.title}` : article.title}
          placement="bottom"
        >
          <div
            className="viewer-sticky-header-content"
            onClick={scrollToTop}
            role="button"
            tabIndex={showStickyTitle ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                scrollToTop()
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.dispatchEvent(
                new CustomEvent('cyberfeeds:close-context-menus', { detail: 'viewer' })
              )
              setCtx({
                x: e.clientX,
                y: e.clientY,
                linkUrl: article.link,
                isTitle: true,
                selectedText: window.getSelection()?.toString() || ''
              })
            }}
          >
            {(article.feedIcon || article.feedTitle) && (
              <FeedFavicon icon={article.feedIcon} title="" size={15} />
            )}
            <span className="viewer-sticky-title-text">{article.title}</span>
          </div>
        </Tooltip>

        <Tooltip label={t.articleViewer.scrollToTop} placement="bottom">
          <button
            className="viewer-sticky-back-to-top"
            onClick={scrollToTop}
            aria-label={t.articleViewer.scrollToTop}
          >
            <ArrowUp size={12} />
            <span>{t.articleViewer.backToTop}</span>
          </button>
        </Tooltip>
      </div>

      <div
        className="viewer-content"
        ref={contentRef}
        tabIndex={-1}
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
          const isTitle = Boolean(titleEl)
          const selectedText = window.getSelection()?.toString() ?? ''
          setCtx({
            x: e.clientX,
            y: e.clientY,
            linkUrl: isTitle ? article.link : linkUrl,
            imageUrl,
            isTitle,
            selectedText
          })
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
            pipArticleId === article.id ? (
              <div className="reader-pip-active-card">
                <div className="reader-pip-active-icon">
                  <PictureInPicture2 size={26} />
                </div>
                <div className="reader-pip-active-content">
                  <div className="reader-pip-active-title">{t.articleViewer.pipActiveTitle}</div>
                  <div className="reader-pip-active-desc">{t.articleViewer.pipActiveDesc}</div>
                </div>
                <div className="reader-pip-active-actions">
                  <button
                    type="button"
                    className="btn btn-primary reader-pip-active-btn"
                    onClick={handleReturnFromPip}
                  >
                    <PictureInPicture2 size={14} />
                    <span>{t.articleViewer.pipReturnToReader}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary reader-pip-active-btn"
                    onClick={handleClosePip}
                  >
                    <X size={14} />
                    <span>{t.articleViewer.pipCloseFloating}</span>
                  </button>
                </div>
              </div>
            ) : isPlayingVideo ? (
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
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px'
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      handleOpenPip({
                        type: 'youtube',
                        videoId: ytVideoId,
                        src: `https://www.youtube-nocookie.com/embed/${ytVideoId}`,
                        title: article.title,
                        articleId: article.id
                      })
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--text-secondary)'
                    }}
                    title={t.articleViewer.pipTooltip}
                  >
                    <PictureInPicture2 size={13} />
                    <span>{t.articleViewer.pipButton}</span>
                  </button>
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
                  <button
                    type="button"
                    className="reader-pip-overlay-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenPip({
                        type: 'youtube',
                        videoId: ytVideoId,
                        src: `https://www.youtube-nocookie.com/embed/${ytVideoId}`,
                        title: article.title,
                        articleId: article.id
                      })
                    }}
                    title={t.articleViewer.pipTooltip}
                  >
                    <PictureInPicture2 size={15} />
                    <span className="reader-pip-overlay-text">{t.articleViewer.pipButton}</span>
                  </button>
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

          <ArticleBody
            html={safeHtml}
            fontSize={settings.readingFontSize || 15}
            onLinkHover={setHoveredLink}
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

      {ctx && article && (
        <div
          className="ctx-menu"
          style={{
            left: Math.max(10, Math.min(ctx.x, window.innerWidth - 220)),
            top: Math.max(10, Math.min(ctx.y, window.innerHeight - 240))
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctx.isTitle && (
            <div
              className="ctx-item"
              onClick={() => {
                navigator.clipboard.writeText(article.title)
                setCtx(null)
              }}
            >
              <Copy size={14} />
              {t.mainProcess.webviewCtx.copyTitle}
            </div>
          )}

          {ctx.linkUrl && (
            <>
              {ctx.isTitle && <div className="ctx-divider" />}
              <div
                className="ctx-item"
                onClick={() => {
                  window.api.openExternal(ctx.linkUrl!)
                  setCtx(null)
                }}
              >
                <ExternalLink size={14} />
                {t.mainProcess.webviewCtx.openLink}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  navigator.clipboard.writeText(ctx.linkUrl!)
                  setCtx(null)
                }}
              >
                <Link2 size={14} />
                {t.mainProcess.webviewCtx.copyLinkAddress}
              </div>
            </>
          )}

          {ctx.selectedText && ctx.selectedText.trim().length > 0 && (
            <>
              {(ctx.linkUrl || ctx.isTitle) && <div className="ctx-divider" />}
              <div
                className="ctx-item"
                onClick={() => {
                  navigator.clipboard.writeText(ctx.selectedText!)
                  setCtx(null)
                }}
              >
                <Copy size={14} />
                {t.mainProcess.webviewCtx.copy}
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  const q = encodeURIComponent(ctx.selectedText!.trim().slice(0, 500))
                  window.api.openExternal(`https://www.google.com/search?q=${q}`)
                  setCtx(null)
                }}
              >
                <Search size={14} />
                {t.mainProcess.webviewCtx.searchGoogle}
              </div>
            </>
          )}

          {ctx.imageUrl && (
            <>
              {(ctx.linkUrl || ctx.isTitle || (ctx.selectedText && ctx.selectedText.trim().length > 0)) && (
                <div className="ctx-divider" />
              )}
              <div
                className="ctx-item"
                onClick={() => {
                  const url = ctx.imageUrl
                  setCtx(null)
                  void copyArticleImage({ url })
                }}
              >
                <ImageIcon size={14} />
                {t.mainProcess.webviewCtx.copyImage}
              </div>
            </>
          )}

          {!ctx.isTitle && !ctx.linkUrl && !ctx.imageUrl && (!ctx.selectedText || ctx.selectedText.trim().length === 0) && (
            <div
              className="ctx-item"
              onClick={() => {
                const selection = window.getSelection()
                const range = document.createRange()
                if (contentRef.current) {
                  range.selectNodeContents(contentRef.current)
                  selection?.removeAllRanges()
                  selection?.addRange(range)
                }
                setCtx(null)
              }}
            >
              <FileText size={14} />
              {t.mainProcess.webviewCtx.selectAll}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default ArticleViewer
