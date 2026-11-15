import { parseHTML } from 'linkedom'
import { decodeThumbnailEntities } from '../shared/thumbnail-url'

type FeedImage = { $?: { url?: string } }
type RedditMediaImage = { u?: string }

export function redditImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = decodeThumbnailEntities(value)
  if (!/^(?:https?:)?\/\//i.test(cleaned)) return undefined
  const url = URL.parse(cleaned, 'https://www.reddit.com')
  if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined
  if (/(^|\.)(redditstatic\.com|styles\.redditmedia\.com)$/.test(url.hostname)) return undefined
  if (/(?:default[_-](?:avatar|gallery|removal|thumbnail)|shreddit[_-]og[_-]image|reddit[_-]logo)/i.test(url.pathname)) {
    return undefined
  }
  url.protocol = 'https:'
  return url.href
}

function directImage(value: unknown): string | undefined {
  const url = redditImageUrl(value)
  if (!url) return undefined
  const image = new URL(url)
  if (['i.redd.it', 'preview.redd.it', 'external-preview.redd.it'].includes(image.hostname) ||
    /\.(?:jpe?g|png|gif|webp|avif)$/i.test(image.pathname)) return url
  return undefined
}

export function redditMarkupThumbnail(html: string | null | undefined): string | undefined {
  if (!html || !html.includes('<')) return undefined
  const { document } = parseHTML(html)
  for (const image of document.querySelectorAll('img')) {
    const width = Number(image.getAttribute('width'))
    const height = Number(image.getAttribute('height'))
    if ((width > 0 && width < 64) || (height > 0 && height < 64)) continue
    const url = redditImageUrl(image.getAttribute('data-src')) ?? redditImageUrl(image.getAttribute('src'))
    if (url) return url
  }
  for (const link of document.querySelectorAll('a[href]')) {
    const url = directImage(link.getAttribute('href'))
    if (url) return url
  }
  return undefined
}

export function redditFeedThumbnail(item: {
  redditThumbnails?: FeedImage[]
  'content:encoded'?: string
  content?: string
  link?: string
}): string | undefined {
  for (const image of item.redditThumbnails ?? []) {
    const url = redditImageUrl(image.$?.url)
    if (url) return url
  }
  return redditMarkupThumbnail(item['content:encoded'] || item.content) ?? directImage(item.link)
}

export function redditListingThumbnail(post: {
  gallery_data?: { items?: { media_id: string }[] }
  media_metadata?: Record<string, { status?: string; s?: RedditMediaImage; p?: RedditMediaImage[] }>
  preview?: { images?: { source?: { url: string } }[] }
  thumbnail?: string
  url_overridden_by_dest?: string
  url?: string
  selftext_html?: string
  over_18?: boolean
  spoiler?: boolean
}): string | undefined {
  const thumbnail = /^https?:\/\//i.test(post.thumbnail ?? '') ? redditImageUrl(post.thumbnail) : undefined
  // Respect previews Reddit has already chosen to blur for these posts.
  if (post.over_18 || post.spoiler) return thumbnail

  const media = post.media_metadata ?? {}
  const mediaIds = post.gallery_data?.items?.map((item) => item.media_id) ?? Object.keys(media)
  for (const id of mediaIds) {
    const image = media[id]
    if (!image || (image.status && image.status !== 'valid')) continue
    const url = redditImageUrl(image.s?.u) ?? redditImageUrl(image.p?.at(-1)?.u)
    if (url) return url
  }
  return redditImageUrl(post.preview?.images?.[0]?.source?.url) ??
    directImage(post.url_overridden_by_dest ?? post.url) ??
    redditMarkupThumbnail(post.selftext_html) ?? thumbnail
}
