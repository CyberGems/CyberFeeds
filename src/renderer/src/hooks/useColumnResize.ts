import { useState, useEffect, useCallback } from 'react'

/**
 * High-performance column resize hook.
 * - During drag: updates CSS variable directly on <html> — zero React re-renders
 * - On drag end: persists to localStorage and commits state
 */
export function useColumnResize(
  key: string,
  defaultWidth: number,
  min: number,
  max: number
): { width: number; startDrag: (e: React.MouseEvent) => void } {
  const storageKey = `cyberfeeds-col-${key}`
  const cssVar = `--col-${key}`

  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) return Math.min(max, Math.max(min, Number(stored)))
    } catch { /* ignore */ }
    return Math.min(max, Math.max(min, defaultWidth))
  })

  // Apply CSS var on mount and when committed width changes
  useEffect(() => {
    document.documentElement.style.setProperty(cssVar, `${width}px`)
  }, [width, cssVar])

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width

    // Visual feedback on the handle
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (me: MouseEvent): void => {
      const newW = Math.min(max, Math.max(min, startW + me.clientX - startX))
      // Direct DOM update — NO React re-render while dragging
      document.documentElement.style.setProperty(cssVar, `${newW}px`)
    }

    const onUp = (me: MouseEvent): void => {
      const newW = Math.min(max, Math.max(min, startW + me.clientX - startX))
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // Commit to state + localStorage only on release
      setWidth(newW)
      try { localStorage.setItem(storageKey, String(newW)) } catch { /* ignore */ }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [width, cssVar, min, max, storageKey])

  return { width, startDrag }
}
