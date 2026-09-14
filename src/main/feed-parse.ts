import RssParser from 'rss-parser'
import { XMLParser } from 'fast-xml-parser'
import * as db from './db'
import {
  FEED_USER_AGENT,
  fetchWithRetry,
  formatHttpFeedError,
  parseRedditFeedUrl,
  redditCanonicalRssUrl,
  redditJsonApiUrl,
  redditRssFallbackUrls
} from '../shared/reddit'
import {
  isYouTubeUrl,
  resolveYouTubeFeedUrl,
  getYouTubeCanonicalGuid,
  extractYouTubeVideoId,
  extractYouTubeDescription,
  extractYouTubeViews,
  buildYouTubeArticleContent
} from '../shared/youtube'

const rssParser = new RssParser({
  timeout: 5500,
  headers: {
    'User-Agent': FEED_USER_AGENT,
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

function uiLang(): 'en' | 'es' {
  return (db.getSettings().language || 'en') as 'en' | 'es'
}

function mapRedditListing(data: any, targetTitle: string, targetLink: string): any {
  const posts = data?.data?.children || []
  const items = posts.map((post: any) => {
    const d = post.data || {}
    const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : (d.url || '')
    const content = d.selftext_html || d.selftext || (d.url ? `<a href="${d.url}">${d.url}</a>` : '')
    const pubDate = d.created ? new Date(d.created * 1000).toISOString() : ''
    return {
      title: d.title?.trim() || '(No title)',
      link: permalink,
      content,
      contentSnippet: String(content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
      pubDate,
      isoDate: pubDate,
      guid: d.permalink || d.id || permalink,
      creator: d.author || undefined
    }
  })
  return {
    title: targetTitle,
    description: '',
    link: targetLink,
    items
  }
}

async function parseRedditFeed(url: string): Promise<any> {
  const target = parseRedditFeedUrl(url)
  if (!target) throw new Error('Not a Reddit feed URL')

  const lang = uiLang()
  const title = target.kind === 'subreddit' ? `r/${target.name}` : `u/${target.name}`
  const link = redditCanonicalRssUrl(target).replace(/\/\.rss$/, '/')
  let rateLimited = false
  const errors: string[] = []

  // Prefer Atom/RSS first — Reddit's public JSON endpoint often returns 403 to desktop UAs.
  for (const rssUrl of redditRssFallbackUrls(target)) {
    try {
      const resp = await fetchWithRetry(rssUrl, {
        headers: {
          'User-Agent': FEED_USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
        }
      })
      if (!resp.ok) {
        if (resp.status === 429 || resp.status === 503) rateLimited = true
        errors.push(`${rssUrl} → HTTP ${resp.status}`)
        continue
      }
      const text = await resp.text()
      if (!text || text.trim().toLowerCase().startsWith('<!doctype html')) {
        errors.push(`${rssUrl} → HTML/empty`)
        continue
      }
      const feed = await rssParser.parseString(text)
      if (feed?.items?.length) {
        const sanitizedItems = feed.items.map((item: any) => ({
          ...item,
          link: (item.link || '')
            .replace('https://old.reddit.com/', 'https://www.reddit.com/')
            .replace('http://old.reddit.com/', 'https://www.reddit.com/')
        }))
        return {
          title: feed.title || title,
          description: feed.description || '',
          link: (feed.link || link)
            .replace('https://old.reddit.com/', 'https://www.reddit.com/')
            .replace('http://old.reddit.com/', 'https://www.reddit.com/'),
          items: sanitizedItems
        }
      }
      errors.push(`${rssUrl} → no items`)
    } catch (err) {
      errors.push(`${rssUrl} → ${err instanceof Error ? err.message : String(err)}`)
      console.warn(`[Reddit] RSS fallback failed for ${rssUrl}:`, err)
    }
  }

  // JSON API second (better thumbnails when available)
  const jsonUrl = redditJsonApiUrl(target)
  try {
    const resp = await fetchWithRetry(jsonUrl, {
      headers: { 'User-Agent': FEED_USER_AGENT, Accept: 'application/json' }
    })
    if (resp.ok) {
      const data = await resp.json()
      const mapped = mapRedditListing(data, title, link)
      if (mapped.items.length > 0) return mapped
      errors.push(`${jsonUrl} → no items`)
    } else {
      if (resp.status === 429 || resp.status === 503) rateLimited = true
      errors.push(`${jsonUrl} → HTTP ${resp.status}`)
    }
  } catch (err) {
    errors.push(`${jsonUrl} → ${err instanceof Error ? err.message : String(err)}`)
    console.warn(`[Reddit] JSON fetch failed for ${jsonUrl}:`, err)
  }

  console.warn('[Reddit] All strategies failed:', errors.join(' | '))

  if (rateLimited) {
    throw new Error(formatHttpFeedError(429, lang, 'Reddit'))
  }

  throw new Error(
    lang === 'es'
      ? 'No se pudo obtener el feed de Reddit. Espera un momento e inténtalo de nuevo.'
      : 'Could not fetch this Reddit feed. Wait a moment and try again.'
  )
}

export async function robustParse(url: string): Promise<any> {
  if (parseRedditFeedUrl(url)) {
    return parseRedditFeed(url)
  }

  let targetUrl = url
  if (isYouTubeUrl(url)) {
    const resolved = await resolveYouTubeFeedUrl(url)
    if (resolved) targetUrl = resolved
  }

  const headers = {
    'User-Agent': FEED_USER_AGENT,
    Accept: 'application/rss+xml, application/xml, text/xml, text/html, */*'
  }

  try {
    const feed = await rssParser.parseURL(targetUrl)
    if (feed?.items) {
      feed.items = feed.items.map((item: any) => {
        const ytGuid = getYouTubeCanonicalGuid(item)
        if (ytGuid) {
          item.guid = ytGuid
          const videoId = extractYouTubeVideoId(ytGuid) || extractYouTubeVideoId(item.link || '')
          const ytDesc = extractYouTubeDescription(item)
          const views = extractYouTubeViews(item)
          if (videoId) {
            item.link = `https://www.youtube.com/watch?v=${videoId}`
            item.content = buildYouTubeArticleContent({
              videoId,
              title: item.title?.trim() || '(No title)',
              description: ytDesc,
              views,
              author: typeof item.author === 'object' ? item.author?.name : (item.creator || item.author)
            })
            item.contentSnippet = ytDesc || item.contentSnippet
          }
        }
        return item
      })
    }
    return feed
  } catch (err) {
    console.error(`Standard RSS parsing failed for ${targetUrl}, trying robust fallback...`, err)

    const resp = await fetchWithRetry(targetUrl, { headers })
    if (!resp.ok) {
      const feedContext = isYouTubeUrl(targetUrl) || isYouTubeUrl(url) ? 'YouTube' : 'Feed'
      throw new Error(formatHttpFeedError(resp.status, uiLang(), feedContext))
    }
    let text = await resp.text()

    if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
      console.log(`[Discovery] HTML detected at ${targetUrl}, searching for RSS links...`)
      const rssLinkMatch = text.match(/<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["']/i) ||
                           text.match(/<link[^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ||
                           text.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["'][^>]+type=["']application\/(rss\+xml|atom\+xml)["']/i)

      if (rssLinkMatch && rssLinkMatch[2]) {
        let discoveredUrl = rssLinkMatch[2]
        if (!discoveredUrl.startsWith('http')) {
          const baseUrl = new URL(targetUrl)
          discoveredUrl = new URL(discoveredUrl, baseUrl.origin).href
        }
        console.log(`[Discovery] Found RSS link: ${discoveredUrl}, fetching...`)
        const subResp = await fetchWithRetry(discoveredUrl, { headers })
        if (subResp.ok) {
          text = await subResp.text()
        }
      } else {
        const lowerUrl = targetUrl.toLowerCase()
        if (lowerUrl.endsWith('/rss') || lowerUrl.endsWith('/rss/')) {
          const guessUrl = lowerUrl.endsWith('/') ? `${targetUrl}feed` : `${targetUrl}/feed`
          console.log(`[Discovery] Guessing feed URL: ${guessUrl}`)
          const guessResp = await fetchWithRetry(guessUrl, { headers })
          if (guessResp.ok) {
            text = await guessResp.text()
          }
        }
      }
    }

    const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const parsed = xmlParser.parse(text)

    const channel = parsed.rss?.channel || parsed.feed || parsed
    const channelTitle = channel.title?.['#text'] || channel.title || targetUrl
    const channelDesc = channel.description || channel.subtitle || ''

    const extractLinkString = (linkObj: any): string => {
      if (!linkObj) return ''
      if (typeof linkObj === 'string') return linkObj
      if (Array.isArray(linkObj)) {
        const alt = linkObj.find(l => l['@_rel'] === 'alternate') || linkObj[0]
        return extractLinkString(alt)
      }
      return linkObj['@_href'] || linkObj['#text'] || ''
    }

    const channelLink = extractLinkString(channel.link)
    const isYtFeed = isYouTubeUrl(targetUrl) || isYouTubeUrl(channelLink)

    const rawItems = Array.isArray(channel.item) ? channel.item :
                     Array.isArray(channel.entry) ? channel.entry :
                     channel.item ? [channel.item] :
                     channel.entry ? [channel.entry] : []

    const items = rawItems.map((item: any) => {
      const title = item.title?.['#text'] || item.title || 'Untitled'
      const link = extractLinkString(item.link)
      const ytGuid = getYouTubeCanonicalGuid(item)
      const isYt = Boolean(ytGuid || isYtFeed || isYouTubeUrl(link))
      const ytDesc = isYt ? extractYouTubeDescription(item) : ''
      const videoId = (ytGuid ? extractYouTubeVideoId(ytGuid) : null) || extractYouTubeVideoId(link)

      let content = item['content:encoded'] || item.content?.['#text'] || item.content || item.description || ''
      if (isYt && videoId) {
        content = buildYouTubeArticleContent({
          videoId,
          title: String(title).trim(),
          description: ytDesc,
          views: extractYouTubeViews(item)
        })
      }

      const pubDate = item.pubDate || item.published || item.updated || ''
      const guid = ytGuid || item.guid?.['#text'] || item.guid || item.id || link

      return {
        title,
        link: videoId ? `https://www.youtube.com/watch?v=${videoId}` : link,
        content,
        contentSnippet: ytDesc || undefined,
        pubDate,
        guid,
        isoDate: pubDate
      }
    })

    if (items.length === 0) {
      if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
        const isEs = uiLang() === 'es'
        throw new Error(
          isEs
            ? 'La URL proporcionada es una página web, no un feed RSS. Proporciona la dirección directa del feed.'
            : 'The URL provided is a webpage, not an RSS feed. Please provide the direct feed URL.'
        )
      }
      throw err
    }

    return {
      title: channelTitle,
      description: channelDesc,
      link: channelLink,
      items
    }
  }
}
