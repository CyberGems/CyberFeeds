export function isThumbnailPageForSource(page: URL, source: URL | null): boolean {
  if (!source || page.username || page.password || !['http:', 'https:'].includes(page.protocol)) return false
  if (page.origin === source.origin) return true

  return page.protocol === 'https:' && ['http:', 'https:'].includes(source.protocol) &&
    !page.port && !source.port &&
    page.hostname.replace(/^www\./, '') === source.hostname.replace(/^www\./, '')
}
