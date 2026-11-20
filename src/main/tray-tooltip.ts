// Hover text of the tray icon. The suite standard is the app name plus a single
// segment, capped at 63 characters because that is what Windows displays, with
// the ellipsis included in the cap.
export const TRAY_TOOLTIP_MAX_LEN = 63

export function clampTrayTooltip(text: string): string {
  return text.length > TRAY_TOOLTIP_MAX_LEN ? `${text.slice(0, TRAY_TOOLTIP_MAX_LEN - 1)}…` : text
}

export function formatTrayTooltip(segment: string | null | undefined): string {
  const clean = String(segment || '').trim()
  return clampTrayTooltip(clean ? `CyberFeeds · ${clean}` : 'CyberFeeds')
}
