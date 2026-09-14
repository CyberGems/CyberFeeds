/** Shared Reddit feed URL helpers — used by main IPC and feed-fetcher worker. */

export const FEED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export type RedditTarget = {
  kind: 'subreddit' | 'user'
  name: string
  /** Optional listing sort segment (hot/new/top/rising). */
  sort?: string
}

function ensureUrl(raw: string): URL | null {
  try {
    let trimmed = raw.trim()
    if (/^\/?(r|u|user)\//i.test(trimmed)) {
      trimmed = trimmed.replace(/^\/+/, '')
      return new URL(`https://www.reddit.com/${trimmed}`)
    }
    return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

/**
 * Detect Reddit feed-ish URLs:
 * /r/sub, /r/sub/, /r/sub/.rss, /r/sub.rss, /r/sub/hot/.rss, .json, users, etc.
 */
export function parseRedditFeedUrl(raw: string): RedditTarget | null {
  const u = ensureUrl(raw)
  if (!u) return null
  if (!/(^|\.)reddit\.com$/i.test(u.hostname)) return null

  const path = u.pathname

  // /r/Name[/sort][/.rss|/rss|.rss|.json]/
  const sub = path.match(
    /^\/r\/([^/]+)(?:\/(hot|new|top|rising))?\/?(?:\.rss|rss|\.json)?\/?$/i
  )
  if (sub?.[1]) {
    return { kind: 'subreddit', name: sub[1], sort: sub[2]?.toLowerCase() }
  }

  // Legacy /r/Name.rss (no slash before .rss) — broken form some clients produce
  const legacySub = path.match(/^\/r\/([^/.]+)\.rss\/?$/i)
  if (legacySub?.[1]) {
    return { kind: 'subreddit', name: legacySub[1] }
  }

  // /user/Name[/submitted|/comments][/.rss|...] or /u/Name[...]
  const user = path.match(
    /^\/(?:user|u)\/([^/]+)(?:\/(?:submitted|comments))?\/?(?:\.rss|rss|\.json)?\/?$/i
  )
  if (user?.[1]) {
    return { kind: 'user', name: user[1] }
  }

  return null
}

export function isRedditFeedUrl(raw: string): boolean {
  return !!parseRedditFeedUrl(raw)
}

export function redditCanonicalRssUrl(target: RedditTarget): string {
  if (target.kind === 'user') {
    return `https://www.reddit.com/user/${target.name}/.rss`
  }
  const sort = target.sort ? `/${target.sort}` : ''
  return `https://www.reddit.com/r/${target.name}${sort}/.rss`
}

export function redditJsonApiUrl(target: RedditTarget): string {
  if (target.kind === 'user') {
    return `https://www.reddit.com/user/${target.name}/.json?limit=100`
  }
  const sort = target.sort ? `/${target.sort}` : ''
  return `https://www.reddit.com/r/${target.name}${sort}/.json?limit=100`
}

/** RSS URL variants to try (standard www.reddit.com RSS endpoint). */
export function redditRssFallbackUrls(target: RedditTarget): string[] {
  if (target.kind === 'user') {
    return [
      `https://www.reddit.com/user/${target.name}/.rss`
    ]
  }
  const sort = target.sort ? `/${target.sort}` : ''
  const urls = [
    `https://www.reddit.com/r/${target.name}${sort}/.rss`
  ]
  if (sort) {
    urls.push(
      `https://www.reddit.com/r/${target.name}/.rss`
    )
  }
  return [...new Set(urls)]
}

/** Normalize a Reddit URL for storage; leave non-Reddit URLs unchanged. */
export function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim()
  const target = parseRedditFeedUrl(trimmed)
  if (target) return redditCanonicalRssUrl(target)
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch with timeout + retries on 429/503 (honors Retry-After when present).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const retries = opts.retries ?? 2
  const timeoutMs = opts.timeoutMs ?? 5500
  let lastError: unknown

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers = new Headers(init.headers || {})
      if (!headers.has('User-Agent')) headers.set('User-Agent', FEED_USER_AGENT)
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*')
      }

      const resp = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers
      })

      if ((resp.status === 429 || resp.status === 503) && attempt < retries - 1) {
        const retryAfter = Number(resp.headers.get('retry-after'))
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 3000)
            : 1000 + Math.floor(Math.random() * 300)
        await sleep(waitMs)
        continue
      }

      return resp
    } catch (err) {
      lastError = err
      if (attempt < retries - 1) {
        await sleep(800)
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`)
}

export function formatHttpFeedError(
  status: number,
  lang: 'en' | 'es' = 'en',
  context = 'Feed'
): string {
  const isReddit = context.toLowerCase().includes('reddit')
  const isYouTube = context.toLowerCase().includes('youtube')

  if (status === 429) {
    if (isReddit) {
      return lang === 'es'
        ? `${context}: Reddit limitó las peticiones (HTTP 429). Espera un momento e inténtalo de nuevo.`
        : `${context}: Reddit rate-limited this request (HTTP 429). Wait a moment and try again.`
    }
    if (isYouTube) {
      return lang === 'es'
        ? `${context}: demasiadas peticiones (HTTP 429). Espera un momento e inténtalo de nuevo.`
        : `${context}: too many requests (HTTP 429). Wait a moment and try again.`
    }
    return lang === 'es'
      ? `${context}: demasiadas peticiones (HTTP 429). Espera un momento e inténtalo de nuevo.`
      : `${context}: rate-limited (HTTP 429). Wait a moment and try again.`
  }

  if (status === 403) {
    if (isReddit) {
      return lang === 'es'
        ? `${context}: acceso denegado (HTTP 403). Reddit puede estar bloqueando la petición.`
        : `${context}: access denied (HTTP 403). Reddit may be blocking the request.`
    }
    if (isYouTube) {
      return lang === 'es'
        ? `${context}: acceso denegado (HTTP 403). YouTube puede estar bloqueando la petición.`
        : `${context}: access denied (HTTP 403). YouTube may be blocking the request.`
    }
    return lang === 'es'
      ? `${context}: acceso denegado (HTTP 403). El servidor bloqueó la petición.`
      : `${context}: access denied (HTTP 403). The server blocked the request.`
  }

  if (status === 404) {
    if (isReddit) {
      return lang === 'es'
        ? `${context}: no encontrado (HTTP 404). Revisa el nombre del subreddit o usuario.`
        : `${context}: not found (HTTP 404). Check the subreddit or user name.`
    }
    if (isYouTube) {
      return lang === 'es'
        ? `${context}: no se pudo obtener el feed del canal (HTTP 404). Los servidores RSS de YouTube pueden estar temporalmente inaccesibles o el canal no estar disponible.`
        : `${context}: channel feed not found (HTTP 404). YouTube RSS servers may be temporarily unavailable or the channel does not exist.`
    }
    return lang === 'es'
      ? `${context}: no encontrado (HTTP 404). Revisa la dirección del feed.`
      : `${context}: not found (HTTP 404). Check the feed address.`
  }

  if (status === 500 || status === 502 || status === 503) {
    if (isYouTube) {
      return lang === 'es'
        ? `${context}: el servicio de feeds de YouTube no está disponible temporalmente (HTTP ${status}).`
        : `${context}: YouTube feed service is temporarily unavailable (HTTP ${status}).`
    }
    return lang === 'es'
      ? `${context}: servidor no disponible temporalmente (HTTP ${status}).`
      : `${context}: server temporarily unavailable (HTTP ${status}).`
  }

  return `${context}: HTTP ${status}`
}
