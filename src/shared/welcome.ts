export type TimeOfDayKey = 'morning' | 'afternoon' | 'evening'

/**
 * Format a raw username (e.g. OS username "CARLOS" or "carlos_dev") into a clean display name.
 */
export function formatDisplayName(raw?: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // Replace underscores with spaces if user has e.g. "carlos_dev"
  const normalized = trimmed.replace(/_+/g, ' ')

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Get the effective user name by preferring custom settings name over detected OS name.
 */
export function getEffectiveUserName(settingsName?: string, detectedName?: string): string {
  if (settingsName && settingsName.trim()) {
    return settingsName.trim()
  }
  return formatDisplayName(detectedName)
}

/**
 * Determine the current time of day bucket.
 * 05:00 - 11:59: morning
 * 12:00 - 18:59: afternoon
 * 19:00 - 04:59: evening
 */
export function getTimeOfDay(now: Date = new Date()): TimeOfDayKey {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) {
    return 'morning'
  }
  if (hour >= 12 && hour < 19) {
    return 'afternoon'
  }
  return 'evening'
}

export interface WelcomeTranslations {
  goodMorning: string
  goodAfternoon: string
  goodEvening: string
}

/**
 * Build a localized greeting text with the user's name if available.
 */
export function getGreetingText(
  timeOfDay: TimeOfDayKey,
  name: string,
  welcomeDict: WelcomeTranslations
): string {
  const base =
    timeOfDay === 'morning'
      ? welcomeDict.goodMorning
      : timeOfDay === 'afternoon'
      ? welcomeDict.goodAfternoon
      : welcomeDict.goodEvening

  const cleanName = name.trim()
  if (cleanName) {
    return `${base}, ${cleanName}`
  }
  return base
}

/**
 * Format today's date for display in the Welcome Lounge.
 */
export function formatWelcomeDate(now: Date = new Date(), lang: 'en' | 'es' = 'en'): string {
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const formatted = now.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  // Capitalize first letter (especially useful in Spanish)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
