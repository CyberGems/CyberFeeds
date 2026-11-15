export function getThumbnailUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://')
}
