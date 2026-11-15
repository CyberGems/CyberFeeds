export function decodeThumbnailEntities(url: string): string {
  const trimmed = url.trim()
  if (!/^(?:https?:)?\/\//i.test(trimmed)) return url
  return trimmed.replace(/&(?:amp|#0*38|#x0*26);/gi, '&')
}

export function getThumbnailUrl(url: string): string {
  return decodeThumbnailEntities(url).replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://')
}
