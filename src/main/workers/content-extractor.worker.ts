// Content Extractor Worker Thread
// Extracts full article content from URLs using linkedom
// Runs off the main thread to avoid blocking IPC

import { parentPort } from 'worker_threads'
import { parseHTML } from 'linkedom'
import https from 'https'
import http from 'http'

interface ExtractRequest {
  reqId: string
  url: string
}

interface ExtractResult {
  reqId: string
  html?: string
  error?: string
}

const TIMEOUT_MS = 12000
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity'
      },
      timeout: TIMEOUT_MS
    }, (res) => {
      // Follow single redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject)
        req.destroy()
        return
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        req.destroy()
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_SIZE) { req.destroy(); reject(new Error('Response too large')); return }
        chunks.push(chunk)
      })
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function scoreCandidate(el: Element): number {
  let score = 0
  const tag = el.tagName?.toLowerCase() || ''
  if (tag === 'article') score += 30
  if (tag === 'main') score += 25
  if (tag === 'section') score += 10

  const cls = (el.className || '').toLowerCase()
  const id = (el.id || '').toLowerCase()
  const combined = `${cls} ${id}`

  if (/article|post|content|entry|story|body/.test(combined)) score += 20
  if (/sidebar|nav|menu|footer|header|ad|banner|comment/.test(combined)) score -= 30

  const pCount = el.querySelectorAll('p').length
  score += Math.min(pCount * 3, 30)
  score += Math.min((el.textContent?.length || 0) / 100, 20)

  return score
}

function extractArticle(html: string, baseUrl: string): string {
  const { document } = parseHTML(html)

  // Remove noise
  const noise = ['script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer', 'aside', '[role="navigation"]', '[role="banner"]', '[role="complementary"]']
  noise.forEach(sel => {
    try {
      document.querySelectorAll(sel).forEach((el: Element) => el.remove())
    } catch { /* ignore */ }
  })

  // Find best candidate
  const candidates = [...document.querySelectorAll('article, main, [role="main"], .post, .article, .content, .entry, section, div')]
  let best: Element | null = null
  let bestScore = -Infinity

  for (const el of candidates) {
    const score = scoreCandidate(el)
    if (score > bestScore) { bestScore = score; best = el }
  }

  const content = best || document.body
  if (!content) return ''

  // Normalize image src attributes
  const origin = new URL(baseUrl).origin
  content.querySelectorAll('img').forEach((img: Element) => {
    const src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('src')
    if (src) {
      try {
        const abs = new URL(src, baseUrl).href
        img.setAttribute('src', abs)
      } catch {
        img.setAttribute('src', `${origin}${src}`)
      }
    }
    img.removeAttribute('width')
    img.removeAttribute('height')
    img.removeAttribute('data-src')
    img.removeAttribute('data-lazy-src')
    img.removeAttribute('data-original')
    img.removeAttribute('loading')
  })

  // Normalize links
  content.querySelectorAll('a').forEach((a: Element) => {
    const href = a.getAttribute('href')
    if (href && !href.startsWith('http')) {
      try { a.setAttribute('href', new URL(href, baseUrl).href) } catch { /* ignore */ }
    }
  })

  return content.innerHTML || ''
}

import {
  isYouTubeUrl,
  extractYouTubeVideoId,
  buildYouTubeArticleContent
} from '../../shared/youtube'

parentPort!.on('message', async (req: ExtractRequest) => {
  try {
    if (isYouTubeUrl(req.url)) {
      const videoId = extractYouTubeVideoId(req.url)
      if (videoId) {
        let title = 'YouTube Video'
        let author = ''
        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
          if (oembedRes.ok) {
            const data = (await oembedRes.json()) as any
            title = data.title || title
            author = data.author_name || author
          }
        } catch { /* ignore */ }

        let description = ''
        try {
          const html = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`)
          const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
                            html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i)
          if (descMatch && descMatch[1]) {
            description = descMatch[1]
          }
        } catch { /* ignore */ }

        const extracted = buildYouTubeArticleContent({
          videoId,
          title,
          description,
          author
        })
        parentPort!.postMessage({ reqId: req.reqId, html: extracted } as ExtractResult)
        return
      }
    }

    const html = await fetchUrl(req.url)
    const extracted = extractArticle(html, req.url)
    parentPort!.postMessage({ reqId: req.reqId, html: extracted } as ExtractResult)
  } catch (err) {
    parentPort!.postMessage({ reqId: req.reqId, error: String(err) } as ExtractResult)
  }
})
