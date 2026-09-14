import { FEED_USER_AGENT, fetchWithRetry } from './reddit'

export function isYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (trimmed.startsWith('@')) return true
  return /(?:youtube\.com|youtu\.be)/i.test(trimmed)
}

/** Extract 11-character YouTube video ID from any link, guid, or embed url */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null
  const str = input.trim()

  // yt:video:VIDEO_ID
  const ytPrefix = str.match(/yt:video:([a-zA-Z0-9_-]{11})/i)
  if (ytPrefix) return ytPrefix[1]

  // https://www.youtube.com/watch?v=VIDEO_ID or /shorts/VIDEO_ID or /embed/VIDEO_ID
  const urlMatch = str.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i)
  if (urlMatch) return urlMatch[1]

  // Pure 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str

  return null
}

/** Get canonical YouTube GUID: always 'yt:video:VIDEO_ID' */
export function getYouTubeCanonicalGuid(item: any): string | null {
  const raw = item.guid?.['#text'] || item.guid || item.id || item['yt:videoId'] || item.link?.['@_href'] || item.link || ''
  const videoId = extractYouTubeVideoId(String(raw))
  if (videoId) return `yt:video:${videoId}`
  return null
}

/** Get high-quality thumbnail for YouTube video */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Resolve any YouTube URL (handle @name, channel URL, playlist, custom URL)
 * to its canonical RSS XML feed URL (e.g. https://www.youtube.com/feeds/videos.xml?channel_id=UC...).
 */
export async function resolveYouTubeFeedUrl(rawUrl: string): Promise<string | null> {
  const url = rawUrl.trim()
  if (!isYouTubeUrl(url)) return null

  // If already a feed URL
  if (url.includes('youtube.com/feeds/videos.xml')) {
    return url.startsWith('http') ? url : `https://${url}`
  }

  // Direct channel ID URL: https://www.youtube.com/channel/UCxxxx
  const channelMatch = url.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i)
  if (channelMatch) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`
  }

  // Playlist URL: https://www.youtube.com/playlist?list=PLxxxx
  const playlistMatch = url.match(/youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/i)
  if (playlistMatch) {
    return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistMatch[1]}`
  }

  // Video URL: https://www.youtube.com/watch?v=xxx, youtu.be/xxx, /shorts/xxx
  const videoId = extractYouTubeVideoId(url)
  if (videoId) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      const resp = await fetchWithRetry(
        oembedUrl,
        {
          headers: {
            'User-Agent': FEED_USER_AGENT,
            Accept: 'application/json'
          }
        },
        { timeoutMs: 5000, retries: 2 }
      )
      if (resp.ok) {
        const data = (await resp.json()) as { author_url?: string }
        if (data?.author_url) {
          const directChannel = data.author_url.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i)
          if (directChannel) {
            return `https://www.youtube.com/feeds/videos.xml?channel_id=${directChannel[1]}`
          }
          const resolvedChannel = await resolveYouTubeFeedUrl(data.author_url)
          if (resolvedChannel) return resolvedChannel
        }
      }
    } catch (err) {
      console.warn(`[YouTube] Failed to resolve video to channel feed via oEmbed for ${url}:`, err)
    }
  }

  // Format full URL for handle or custom username
  let targetUrl = url
  if (targetUrl.startsWith('@')) {
    targetUrl = `https://www.youtube.com/${targetUrl}`
  } else if (!targetUrl.startsWith('http')) {
    targetUrl = `https://${targetUrl}`
  }

  try {
    const resp = await fetchWithRetry(targetUrl, {
      headers: {
        'User-Agent': FEED_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, { timeoutMs: 5000, retries: 2 })

    if (!resp.ok) return null
    const text = await resp.text()

    // 1. Check for standard RSS link tag in HTML header
    const rssTagMatch = text.match(/<link[^>]+href=["'](https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[a-zA-Z0-9_-]+)["']/i) ||
                        text.match(/<link[^>]+href=["']([^"']*\/feeds\/videos\.xml\?[^"']+)["']/i)
    if (rssTagMatch && rssTagMatch[1]) {
      const href = rssTagMatch[1]
      return href.startsWith('http') ? href : `https://www.youtube.com${href}`
    }

    // 2. Extract channelId / externalId from YouTube JSON / meta tags
    const idMatch = text.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/) ||
                    text.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/) ||
                    text.match(/<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[a-zA-Z0-9_-]+)["']/i) ||
                    text.match(/<meta[^>]+itemprop=["']identifier["'][^>]+content=["'](UC[a-zA-Z0-9_-]+)["']/i) ||
                    text.match(/channel_id=(UC[a-zA-Z0-9_-]+)/)

    if (idMatch && idMatch[1]) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`
    }
  } catch (err) {
    console.warn(`[YouTube] Failed to resolve channel feed for ${url}:`, err)
  }

  return null
}

function unwrapText(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (Array.isArray(val)) {
    for (const item of val) {
      const res = unwrapText(item)
      if (res) return res
    }
    return ''
  }
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>
    const text = obj['#text'] || obj['_'] || obj['content']
    if (typeof text === 'string') return text
    return ''
  }
  return String(val)
}

/** Extract full video description from rss-parser or fast-xml-parser item */
export function extractYouTubeDescription(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const obj = item as Record<string, any>

  // 1. Direct fields or rss-parser custom fields
  const candidates = [
    obj.mediaGroup?.['media:description'],
    obj['media:group']?.['media:description'],
    obj.mediaDescription,
    obj['media:description'],
    obj.description,
    obj.content,
    obj['content:encoded'],
    obj.summary
  ]

  for (const candidate of candidates) {
    const text = unwrapText(candidate)
    if (text && text.trim().length > 0) {
      return text.trim()
    }
  }

  return ''
}

/** Extract view count from YouTube XML item */
export function extractYouTubeViews(item: unknown): number | null {
  if (!item || typeof item !== 'object') return null
  const obj = item as Record<string, any>

  const communityCandidates = [
    obj.mediaGroup?.['media:community'],
    obj['media:group']?.['media:community'],
    obj.mediaCommunity,
    obj['media:community']
  ]

  for (let comm of communityCandidates) {
    if (!comm) continue
    if (Array.isArray(comm)) comm = comm[0]
    if (!comm || typeof comm !== 'object') continue

    const stat = comm['media:statistics'] || comm.statistics
    if (!stat) continue
    const target = Array.isArray(stat) ? stat[0] : stat
    if (!target || typeof target !== 'object') continue

    const viewsRaw =
      target['@_views'] ||
      target['$']?.views ||
      target.views ||
      target['@_count']

    if (viewsRaw !== undefined && viewsRaw !== null) {
      const num = parseInt(String(viewsRaw), 10)
      if (!isNaN(num) && num >= 0) return num
    }
  }

  // Also check direct statistics candidate
  const directStats = [
    obj['media:statistics'],
    obj.mediaStatistics
  ]
  for (let stat of directStats) {
    if (!stat) continue
    if (Array.isArray(stat)) stat = stat[0]
    if (!stat || typeof stat !== 'object') continue

    const viewsRaw =
      stat['@_views'] ||
      stat['$']?.views ||
      stat.views ||
      stat['@_count']

    if (viewsRaw !== undefined && viewsRaw !== null) {
      const num = parseInt(String(viewsRaw), 10)
      if (!isNaN(num) && num >= 0) return num
    }
  }

  return null
}

/** Format views count into readable string (e.g. 1.2M views / 1.2M vistas) */
export function formatYouTubeViews(views: number | null | undefined, lang: 'en' | 'es' = 'en'): string | null {
  if (views === null || views === undefined || isNaN(views)) return null
  const num = Math.max(0, views)

  let formattedNum = ''
  if (num >= 1_000_000_000) {
    formattedNum = `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  } else if (num >= 1_000_000) {
    formattedNum = `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  } else if (num >= 1_000) {
    formattedNum = `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  } else {
    formattedNum = num.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')
  }

  const label = lang === 'es' ? 'vistas' : 'views'
  return `${formattedNum} ${label}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Convert raw YouTube description into clean HTML paragraphs with active clickable links */
export function formatYouTubeDescriptionHtml(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return ''

  // Split into paragraphs by 2 or more line breaks
  const paragraphs = rawText.split(/\r?\n\s*\r?\n/)

  return paragraphs
    .map((p) => {
      const trimmed = p.trim()
      if (!trimmed) return ''
      const escaped = escapeHtml(trimmed)
      // Convert single line breaks to <br/>
      const withBreaks = escaped.replace(/\r?\n/g, '<br/>')
      // Autolink URLs safely
      const autolinked = withBreaks.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      return `<p>${autolinked}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

/** Build rich article HTML content for a YouTube video */
export function buildYouTubeArticleContent(params: {
  videoId: string
  title: string
  description: string
  views?: number | null
  author?: string
  lang?: 'en' | 'es'
}): string {
  const { videoId, title, description, views, author, lang = 'en' } = params
  const viewsText = formatYouTubeViews(views, lang)
  const watchLabel = lang === 'es' ? 'Ver en YouTube' : 'Watch on YouTube'
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`

  const metaItems: string[] = []
  if (author) {
    metaItems.push(`<span>${escapeHtml(author)}</span>`)
  }
  if (viewsText) {
    metaItems.push(`<span>${escapeHtml(viewsText)}</span>`)
  }

  const metaHtml = metaItems.length > 0
    ? `<div class="yt-article-meta" style="display: flex; gap: 12px; margin-bottom: 12px; font-size: 13px; color: var(--text-muted);">${metaItems.join(' • ')}</div>`
    : ''

  const playerHtml = `
<div class="yt-player-container" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; margin-bottom: 16px; border-radius: 8px; overflow: hidden; background: #000;">
  <iframe
    src="${embedUrl}"
    title="${escapeHtml(title)}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</div>
<div style="margin-bottom: 16px;">
  <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="yt-watch-btn" style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--accent); text-decoration: none;">
    ${watchLabel} &rarr;
  </a>
</div>`

  const descHtml = description ? formatYouTubeDescriptionHtml(description) : `<p><em>${lang === 'es' ? 'Sin descripción disponible.' : 'No description available.'}</em></p>`

  return `
<div class="yt-article-wrapper">
  ${playerHtml}
  ${metaHtml}
  <div class="yt-article-description" style="line-height: 1.6; word-break: break-word;">
    ${descHtml}
  </div>
</div>`.trim()
}

