// Feed Fetcher Worker Thread
// Runs outside the main thread — fetches and parses RSS feeds in parallel
// No Electron APIs allowed here

import { parentPort, workerData } from 'worker_threads'
import RssParser from 'rss-parser'
import crypto from 'crypto'
import { XMLParser } from 'fast-xml-parser'
import {
  FEED_USER_AGENT,
  fetchWithRetry,
  parseRedditFeedUrl,
  redditJsonApiUrl,
  redditRssFallbackUrls
} from '../../shared/reddit'
import {
  isYouTubeUrl,
  resolveYouTubeFeedUrl,
  getYouTubeCanonicalGuid,
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  extractYouTubeDescription,
  extractYouTubeViews,
  buildYouTubeArticleContent
} from '../../shared/youtube'

const USER_AGENT = FEED_USER_AGENT

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  return fetchWithRetry(url, { headers: { 'User-Agent': USER_AGENT } }, { timeoutMs, retries: 2 })
}

interface WorkerMessage {
  feeds: Array<{ id: string; url: string }>
  concurrency?: number
}

interface ParsedArticle {
  id: string
  feedId: string
  title: string
  link: string
  pubDate: number
  content: string
  snippet: string
  author?: string
  guid: string
  thumbnail?: string
}

interface FeedResult {
  feedId: string
  articles: ParsedArticle[]
  error?: string
  lastFetched: number
}

const parser = new RssParser({
  timeout: 6000,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml, application/xml, text/xml, */*'
  },
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['media:description', 'mediaDescription'],
      ['media:community', 'mediaCommunity'],
      ['yt:videoId', 'ytVideoId'],
      ['yt:channelId', 'ytChannelId']
    ]
  }
})

function makeId(feedId: string, guid: string): string {
  return crypto.createHash('sha1').update(`${feedId}:${guid}`).digest('hex')
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '...'
}

/** Validate a URL is a real image, not a placeholder */
function isValidImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase()
  // Skip known placeholders
  if (lower.includes('default_avatar') || lower.includes('self') || lower.includes('removed') || lower.includes('default_removal')) return false
  // Must look like an image URL
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/)) return true
  // CDNs like i.redd.it, i.ytimg.com, thumbs.redditmedia.com are valid
  if (lower.includes('i.redd.it') || lower.includes('i.ytimg.com') || lower.includes('thumbs.redditmedia.com') || lower.includes('redditstatic.com')) return true
  return false
}

/**
 * Extract the best thumbnail URL from an RSS item.
 * Priority: media:content (image) → media:thumbnail → rss-parser fields → enclosure → og:image → <img> / data-src
 */
function extractThumbnail(item: any): string | undefined {
  // 1. media:content — find the first image-type entry
  const mediaContent = item['media:content']
  if (mediaContent && typeof mediaContent === 'object') {
    const arr = Array.isArray(mediaContent) ? mediaContent : [mediaContent]
    for (const mc of arr) {
      const url = mc['@_url'] || mc.url
      if (url && isValidImage(url)) return url
    }
    // Fallback: take first URL even if type isn't image
    const first = arr[0]
    const firstUrl = first?.['@_url'] || first?.url
    if (firstUrl && isValidImage(firstUrl)) return firstUrl
  }

  // 2. media:thumbnail
  const mediaThumbnail = item['media:thumbnail']
  if (mediaThumbnail && typeof mediaThumbnail === 'object') {
    const mt = Array.isArray(mediaThumbnail) ? mediaThumbnail[0] : mediaThumbnail
    const url = mt['@_url'] || mt.url
    if (url && isValidImage(url)) return url
  }

  // 3. rss-parser: item.thumbnail (string URL)
  if (item.thumbnail && isValidImage(item.thumbnail)) return item.thumbnail

  // 4. rss-parser: item.thumbnails (array of { url, width, height })
  if (item.thumbnails && Array.isArray(item.thumbnails) && item.thumbnails.length > 0) {
    const best = item.thumbnails.reduce((a: any, b: any) =>
      (a.width || 0) * (a.height || 0) > (b.width || 0) * (b.height || 0) ? a : b
    )
    if (best.url && isValidImage(best.url)) return best.url
  }

  // 5. rss-parser: item.media.thumbnail (nested in media group)
  if (item.media && item.media.thumbnail) {
    const mt = item.media.thumbnail
    if (typeof mt === 'string' && isValidImage(mt)) return mt
    if (mt.url && isValidImage(mt.url)) return mt.url
    if (mt['@_url'] && isValidImage(mt['@_url'])) return mt['@_url']
  }

  // 6. rss-parser: item.media.content (nested media:content)
  if (item.media && item.media.content) {
    const mc = Array.isArray(item.media.content) ? item.media.content[0] : item.media.content
    if (mc && mc.url && isValidImage(mc.url)) return mc.url
  }

  // 7. enclosure with image type
  const enclosures = item.enclosures || item['media:enclosure']
  if (enclosures) {
    const enc = Array.isArray(enclosures) ? enclosures : [enclosures]
    for (const e of enc) {
      const url = e['@_url'] || e.url
      const type = (e['@_type'] || e.type || '').toLowerCase()
      if (url && type.startsWith('image') && isValidImage(url)) return url
    }
  }

  // 8. og:image meta tag in content
  const rawContent = item['content:encoded'] || item.content || ''
  const ogMatch = rawContent.match(/<meta\s+(?:property|"og:image")\s*=\s*"(og:image)"\s+content\s*=\s*"([^"]+)"/i)
    || rawContent.match(/<meta\s+content\s*=\s*"([^"]+)"\s+(?:property|"og:image")\s*=\s*"(og:image)"/i)
  if (ogMatch && isValidImage(ogMatch[1])) return ogMatch[1]

  // 9. <img> with src or data-src (Reddit uses data-src for lazy loading)
  const imgSrcMatch = rawContent.match(/<img[^>]+(?:src|data-src)\s*=\s*"([^"]+)"/i)
  if (imgSrcMatch && isValidImage(imgSrcMatch[1])) return imgSrcMatch[1]

  // 10. YouTube fallback: extract video ID from link and construct thumbnail URL
  const link = item.link || ''
  const ytMatch = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/)
  if (ytMatch) {
    return `https://i.ytimg.com/vi/${ytMatch[1]}/maxresdefault.jpg`
  }

  return undefined
}

function getRedditGuid(text: string): string | null {
  if (!text) return null
  // Match t1_..., t3_..., etc. (Reddit fullnames)
  const fullnameMatch = text.match(/\b(t[1-8]_[a-z0-9]+)\b/i)
  if (fullnameMatch) {
    return fullnameMatch[1].toLowerCase()
  }
  // Match comment/post ID in URL/permalink
  const commentMatch = text.match(/\/comments\/([a-z0-9]+)/i)
  if (commentMatch) {
    return `t3_${commentMatch[1].toLowerCase()}`
  }
  return null
}

/** Fetch from Reddit's JSON API and convert to feed items */
async function fetchRedditJson(feedId: string, jsonUrl: string): Promise<FeedResult> {
  const lastFetched = Date.now()
  const resp = await fetchWithRetry(jsonUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  })
  if (!resp.ok) throw new Error(`Reddit JSON API returned ${resp.status}`)

  const data = await resp.json()
  const posts = data.data?.children || []

  const articles: ParsedArticle[] = posts.map((post: any) => {
    const d = post.data
    const rawGuid = d.name || (d.id ? `t3_${d.id}` : '') || d.permalink || d.url
    const guid = getRedditGuid(rawGuid) || rawGuid
    const id = makeId(feedId, guid)
    const pubDate = d.created ? Math.floor(d.created * 1000) : lastFetched

    // Get thumbnail from preview images (highest res)
    let thumbnail: string | undefined
    if (d.preview?.images?.[0]?.sources?.[0]) {
      const src = d.preview.images[0].sources[0]
      thumbnail = src.url
    } else if (d.thumbnail && d.thumbnail !== 'self' && d.thumbnail !== 'default' && d.thumbnail !== 'image' && !d.thumbnail.includes('default_removal') && !d.thumbnail.includes('default_gallery')) {
      thumbnail = d.thumbnail
    }

    // Build content from selftext + link
    const content = d.selftext_html || d.selftext || (d.url ? `<a href="${d.url}">${d.url}</a>` : '')

    return {
      id,
      feedId,
      title: d.title?.trim() || '(No title)',
      link: `https://www.reddit.com${d.permalink}`,
      pubDate: isNaN(pubDate) ? lastFetched : pubDate,
      content,
      snippet: truncate(cleanHtml(content), 300),
      author: d.author || undefined,
      guid,
      thumbnail
    }
  })

  return { feedId, articles, lastFetched }
}

async function fetchRedditWithFallbacks(feedId: string, url: string): Promise<FeedResult | null> {
  const target = parseRedditFeedUrl(url)
  if (!target) return null

  // Prefer Atom/RSS first — public JSON is frequently blocked (403) for desktop UAs.
  for (const rssUrl of redditRssFallbackUrls(target)) {
    try {
      const resp = await fetchWithTimeout(rssUrl)
      if (!resp.ok) continue
      const text = await resp.text()
      if (!text || text.trim().toLowerCase().startsWith('<!doctype html')) continue
      const feed = await parser.parseString(text)
      const lastFetched = Date.now()
      const articles: ParsedArticle[] = (feed.items || []).slice(0, 100).map((item: any) => {
        const rawGuid = item.guid || item.id || item.link || item.title || String(Math.random())
        const guid = getRedditGuid(rawGuid) || rawGuid
        const id = makeId(feedId, guid)
        const rawContent = item['content:encoded'] || item.content || item.contentSnippet || ''
        const rawSnippet = item.contentSnippet || cleanHtml(rawContent)
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : lastFetched
        const thumbnail = extractThumbnail(item)
        return {
          id,
          feedId,
          title: item.title?.trim() || '(No title)',
          link: item.link || '',
          pubDate: isNaN(pubDate) ? lastFetched : pubDate,
          content: rawContent,
          snippet: truncate(cleanHtml(rawSnippet), 300),
          author: item.creator || item.author || undefined,
          guid,
          thumbnail
        }
      })
      if (articles.length > 0) return { feedId, articles, lastFetched }
    } catch (err) {
      console.warn(`[Worker] Reddit RSS fallback failed for ${rssUrl}:`, err)
    }
  }

  const jsonUrl = redditJsonApiUrl(target)
  try {
    return await fetchRedditJson(feedId, jsonUrl)
  } catch (err) {
    console.warn(`[Worker] Reddit JSON failed for ${url}:`, err)
  }

  return null
}

async function fetchFeed(feedId: string, url: string): Promise<FeedResult> {
  const lastFetched = Date.now()
  try {
    // Reddit special handling — JSON API first, then RSS host fallbacks
    const redditResult = await fetchRedditWithFallbacks(feedId, url)
    if (redditResult) return redditResult

    // YouTube handling: resolve feed URL if it's not already the XML feed
    let targetUrl = url
    if (isYouTubeUrl(url)) {
      if (!url.includes('youtube.com/feeds/videos.xml')) {
        const resolved = await resolveYouTubeFeedUrl(url)
        if (resolved) targetUrl = resolved
      }
    }

    let feed: any
    try {
      feed = await parser.parseURL(targetUrl)
    } catch (err) {
      console.error(`[Worker] Standard RSS parsing failed for ${targetUrl}, trying robust fallback...`, err)
      const resp = await fetchWithTimeout(targetUrl)
      let text = await resp.text()

      if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
        const rssLinkMatch = text.match(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["']/i) ||
                             text.match(/<link[^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ||
                             text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["'][^>]+type=["']application\/(rss\+xml|atom\+xml)["']/i)
        if (rssLinkMatch && rssLinkMatch[2]) {
          let discoveredUrl = rssLinkMatch[2]
          if (!discoveredUrl.startsWith('http')) {
            const baseUrl = new URL(targetUrl)
            discoveredUrl = new URL(discoveredUrl, baseUrl.origin).href
          }
          const subResp = await fetchWithTimeout(discoveredUrl)
          if (subResp.ok) text = await subResp.text()
        } else {
          const lowerUrl = targetUrl.toLowerCase()
          if (lowerUrl.endsWith('/rss') || lowerUrl.endsWith('/rss/')) {
            const guessUrl = lowerUrl.endsWith('/') ? `${targetUrl}feed` : `${targetUrl}/feed`
            const guessResp = await fetchWithTimeout(guessUrl)
            if (guessResp.ok) text = await guessResp.text()
          }
        }
      }

      const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
      const parsed = xmlParser.parse(text)
      const channel = parsed.rss?.channel || parsed.feed || parsed
      const rawItems = Array.isArray(channel.item) ? channel.item : 
                       Array.isArray(channel.entry) ? channel.entry : 
                       channel.item ? [channel.item] : 
                       channel.entry ? [channel.entry] : []
      
      const items: any[] = []
      rawItems.forEach((item: any) => {
        const title = item.title?.['#text'] || item.title || 'Untitled'
        const link = item.link?.['@_href'] || item.link || ''
        const ytDesc = extractYouTubeDescription(item)
        const content = ytDesc || item['content:encoded'] || item.content?.['#text'] || item.content || item.description || ''
        const pubDate = item.pubDate || item.published || item.updated || ''
        const guid = getYouTubeCanonicalGuid(item) || item.guid?.['#text'] || item.guid || item.id || link
        items.push({
          ...item,
          title,
          link,
          content,
          contentSnippet: truncate(cleanHtml(content), 400),
          pubDate,
          guid
        })
      })

      if (items.length === 0) {
        if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
          throw new Error('The URL provided is a webpage, not an RSS feed.')
        }
        throw err
      }
      feed = { items }
    }

    const articles: ParsedArticle[] = (feed.items || []).slice(0, 100).map(item => {
      const ytGuid = getYouTubeCanonicalGuid(item)
      const guid = ytGuid || item.guid || item.id || item.link || item.title || String(Math.random())
      const id = makeId(feedId, guid)
      let rawContent = item['content:encoded'] || item.content || item.contentSnippet || ''
      let rawSnippet = item.contentSnippet || cleanHtml(rawContent)
      const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : lastFetched

      let thumbnail = extractThumbnail(item)
      let link = item.link || ''
      const isYt = Boolean(ytGuid || isYouTubeUrl(link) || isYouTubeUrl(targetUrl))

      if (isYt) {
        const videoId =
          (ytGuid ? extractYouTubeVideoId(ytGuid) : null) ||
          extractYouTubeVideoId(link) ||
          (item.ytVideoId ? String(item.ytVideoId) : null)
        const ytDesc = extractYouTubeDescription(item)
        const views = extractYouTubeViews(item)
        const authorName = typeof item.author === 'object' ? item.author?.name : (item.creator || item.author)

        if (videoId) {
          link = `https://www.youtube.com/watch?v=${videoId}`
          if (!thumbnail || !thumbnail.includes('ytimg.com')) {
            thumbnail = getYouTubeThumbnailUrl(videoId)
          }
          rawContent = buildYouTubeArticleContent({
            videoId,
            title: item.title?.trim() || '(No title)',
            description: ytDesc,
            views,
            author: authorName
          })
        }
        if (ytDesc) {
          rawSnippet = ytDesc
        }
      }

      return {
        id,
        feedId,
        title: item.title?.trim() || '(No title)',
        link,
        pubDate: isNaN(pubDate) ? lastFetched : pubDate,
        content: rawContent,
        snippet: truncate(cleanHtml(rawSnippet), 400),
        author: typeof item.author === 'object' ? item.author?.name : (item.creator || item.author || undefined),
        guid,
        thumbnail
      }
    })
    return { feedId, articles, lastFetched }
  } catch (err) {
    return { feedId, articles: [], error: String(err), lastFetched }
  }
}

async function run(): Promise<void> {
  const msg: WorkerMessage = workerData
  const { feeds, concurrency = 5 } = msg

  // Process in batches for controlled concurrency
  for (let i = 0; i < feeds.length; i += concurrency) {
    const batch = feeds.slice(i, i + concurrency)
    const results = await Promise.all(batch.map(f => fetchFeed(f.id, f.url)))
    for (const result of results) {
      parentPort!.postMessage(result)
    }
  }

  parentPort!.postMessage({ done: true })
}

run().catch(err => {
  parentPort!.postMessage({ error: String(err), done: true })
})
