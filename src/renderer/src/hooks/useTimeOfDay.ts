import { useState, useEffect } from 'react'
import { getTimeOfDay, type TimeOfDayKey } from '@shared/welcome'

/**
 * Reactive hook that keeps time-of-day and current date synchronized across components,
 * updating every 30 seconds as well as on window focus and visibility change.
 */
export function useTimeOfDay(): { timeOfDay: TimeOfDayKey; now: Date } {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const refresh = (): void => setNow(new Date())

    const interval = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return {
    timeOfDay: getTimeOfDay(now),
    now
  }
}
