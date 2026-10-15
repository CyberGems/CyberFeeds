import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Copy, Check, Languages, Loader2 } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'
import Tooltip from './Tooltip'

interface SelectionFlyoutProps {
  containerRef: React.RefObject<HTMLElement | null>
}

interface TranslationResult {
  text: string
  translation: string
  sourceLang: string
  targetLang: string
}

interface FlyoutCoords {
  top: number
  left: number
  placement: 'top' | 'bottom'
  arrowLeft: number
}

const VIEWPORT_MARGIN = 12
const GAP = 9
const ESTIMATED_WIDTH = 260

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.max(min, Math.min(value, max))
}

function computeFlyoutCoords(
  rect: DOMRect,
  container: HTMLElement | null,
  flyoutWidth: number
): FlyoutCoords {
  const vw = window.innerWidth
  const flyoutHeight = 36
  const topSpace = rect.top - flyoutHeight - GAP
  const placement: 'top' | 'bottom' = topSpace < 48 ? 'bottom' : 'top'
  const top = placement === 'top' ? rect.top - GAP : rect.bottom + GAP

  const cx = rect.left + rect.width / 2

  let leftBound = VIEWPORT_MARGIN
  let rightBound = vw - VIEWPORT_MARGIN

  if (container) {
    const containerRect = container.getBoundingClientRect()
    // Give breathing room from container boundaries and its scrollbar
    const cRight = Math.min(vw - VIEWPORT_MARGIN, containerRect.right - 14)
    const cLeft = Math.max(VIEWPORT_MARGIN, containerRect.left + VIEWPORT_MARGIN)
    if (cRight - cLeft >= flyoutWidth) {
      leftBound = cLeft
      rightBound = cRight
    }
  }

  const idealLeft = cx - flyoutWidth / 2
  const left = clamp(idealLeft, leftBound, Math.max(leftBound, rightBound - flyoutWidth))
  const arrowX = cx - left
  const arrowLeft = clamp(arrowX, 16, Math.max(16, flyoutWidth - 16))

  return { top, left, placement, arrowLeft }
}

export default function SelectionFlyout({ containerRef }: SelectionFlyoutProps): JSX.Element | null {
  const { t, language } = useTranslation()
  const [selectedText, setSelectedText] = useState('')
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [coords, setCoords] = useState<FlyoutCoords | null>(null)
  const [copied, setCopied] = useState(false)
  const [transCopied, setTransCopied] = useState(false)
  const [showTranslate, setShowTranslate] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)
  const [translationError, setTranslationError] = useState(false)

  const flyoutRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setCoords(null)
      setAnchorRect(null)
      setSelectedText('')
      setShowTranslate(false)
      return
    }

    const text = selection.toString().trim()
    if (!text || text.length < 1 || text.length > 5000) {
      setCoords(null)
      setAnchorRect(null)
      setSelectedText('')
      setShowTranslate(false)
      return
    }

    // Verify selection is inside our container
    const container = containerRef.current
    if (!container) return

    const anchorNode = selection.anchorNode
    const focusNode = selection.focusNode
    if (!anchorNode || !focusNode) return
    if (!container.contains(anchorNode) || !container.contains(focusNode)) {
      setCoords(null)
      setAnchorRect(null)
      setSelectedText('')
      setShowTranslate(false)
      return
    }

    // Don't trigger if selection is inside inputs or buttons
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return
    }

    try {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return

      const measuredWidth = flyoutRef.current?.offsetWidth || ESTIMATED_WIDTH
      const newCoords = computeFlyoutCoords(rect, containerRef.current, measuredWidth)

      setAnchorRect(rect)
      setCoords(newCoords)
      setSelectedText(text)
      setCopied(false)
    } catch {
      // Ignored if range is unavailable
    }
  }, [containerRef])

  // Synchronously refine coords before paint with the exact measured flyout width
  useLayoutEffect(() => {
    if (!anchorRect) return
    const measuredWidth = flyoutRef.current?.offsetWidth || ESTIMATED_WIDTH
    const newCoords = computeFlyoutCoords(anchorRect, containerRef.current, measuredWidth)
    setCoords((prev) => {
      if (
        prev &&
        prev.top === newCoords.top &&
        prev.left === newCoords.left &&
        prev.placement === newCoords.placement &&
        prev.arrowLeft === newCoords.arrowLeft
      ) {
        return prev
      }
      return newCoords
    })
  }, [anchorRect, selectedText, containerRef])

  // Listen to selection events
  useEffect(() => {
    const handleMouseUp = (): void => {
      // Small timeout to let browser finish selection
      setTimeout(checkSelection, 20)
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setCoords(null)
        setAnchorRect(null)
        setSelectedText('')
        setShowTranslate(false)
        return
      }
      setTimeout(checkSelection, 20)
    }

    const handleScroll = (): void => {
      // On scroll, re-anchor or hide if selection scrolled out of view
      if (!coords) return
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setCoords(null)
        setAnchorRect(null)
        setSelectedText('')
        setShowTranslate(false)
        return
      }
      try {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const container = containerRef.current
        if (!container) return
        const containerRect = container.getBoundingClientRect()

        // If selection is scrolled out of container bounds
        if (rect.bottom < containerRect.top || rect.top > containerRect.bottom) {
          setCoords(null)
          setAnchorRect(null)
          return
        }

        const measuredWidth = flyoutRef.current?.offsetWidth || ESTIMATED_WIDTH
        setAnchorRect(rect)
        setCoords(computeFlyoutCoords(rect, container, measuredWidth))
      } catch {
        setCoords(null)
        setAnchorRect(null)
      }
    }

    const handleResize = (): void => {
      if (anchorRect) {
        const measuredWidth = flyoutRef.current?.offsetWidth || ESTIMATED_WIDTH
        setCoords(computeFlyoutCoords(anchorRect, containerRef.current, measuredWidth))
      }
    }

    const handleMouseDown = (e: MouseEvent): void => {
      if (flyoutRef.current && flyoutRef.current.contains(e.target as Node)) {
        return
      }
      // If clicking outside the flyout, dismiss
      setCoords(null)
      setAnchorRect(null)
      setShowTranslate(false)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mouseup', handleMouseUp)
      container.addEventListener('scroll', handleScroll, { passive: true })
    }
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('resize', handleResize)

    return () => {
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp)
        container.removeEventListener('scroll', handleScroll)
      }
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [checkSelection, containerRef, coords, anchorRect])

  // Translation trigger
  const triggerTranslation = useCallback(async () => {
    if (!selectedText) return
    setShowTranslate(true)

    // Check if we already have the translation for this exact text
    if (translationResult && translationResult.text === selectedText) {
      return
    }

    setTranslating(true)
    setTranslationError(false)

    try {
      const targetLang = language === 'es' ? 'es' : 'en'
      const result = await window.api.translateText(selectedText, targetLang)
      if (result && result.translation) {
        setTranslationResult({
          text: selectedText,
          translation: result.translation,
          sourceLang: result.sourceLang,
          targetLang: result.targetLang
        })
      } else {
        setTranslationError(true)
      }
    } catch (err) {
      console.warn('[SelectionFlyout] Translation failed:', err)
      setTranslationError(true)
    } finally {
      setTranslating(false)
    }
  }, [selectedText, translationResult, language])

  // Copy selected text
  const handleCopy = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!selectedText) return
    navigator.clipboard.writeText(selectedText).then(() => {
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 1600)
    })
  }

  // Copy translated text
  const handleCopyTranslation = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!translationResult?.translation) return
    navigator.clipboard.writeText(translationResult.translation).then(() => {
      setTransCopied(true)
      if (transCopyTimerRef.current) clearTimeout(transCopyTimerRef.current)
      transCopyTimerRef.current = setTimeout(() => setTransCopied(false), 1600)
    })
  }

  // Search in Google
  const handleSearch = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (!selectedText) return
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`
    window.api.openExternal(searchUrl)
  }

  // Hover handlers for translate button
  const handleTranslateMouseEnter = (): void => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      triggerTranslation()
    }, 120)
  }

  const handleTranslateMouseLeave = (): void => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }

  const handleWheel = (e: React.WheelEvent): void => {
    const target = e.target as HTMLElement
    const scrollableBody = target.closest('.selection-translate-body')
    if (scrollableBody && scrollableBody.scrollHeight > scrollableBody.clientHeight) {
      return
    }
    if (containerRef.current) {
      containerRef.current.scrollTop += e.deltaY
      containerRef.current.scrollLeft += e.deltaX
    }
  }

  if (!coords || !selectedText) return null

  const st = t.articleViewer.selectionToolbar

  return createPortal(
    <div
      ref={flyoutRef}
      className={`selection-flyout ${coords.placement === 'bottom' ? 'is-bottom' : 'is-top'}`}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 9999
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={handleWheel}
    >
      {/* Little arrow pointing toward the selected text */}
      <div className="selection-flyout-arrow" style={{ left: coords.arrowLeft }} />

      {/* Main Buttons Bar */}
      <div className="selection-flyout-bar">
        {/* Search */}
        <Tooltip label={st.search} placement={coords.placement === 'top' ? 'top' : 'bottom'}>
          <button
            type="button"
            className="selection-flyout-btn"
            onClick={handleSearch}
          >
            <Search size={13} />
            <span>{st.search}</span>
          </button>
        </Tooltip>

        <div className="selection-flyout-divider" />

        {/* Copy */}
        <Tooltip label={copied ? st.copied : st.copy} placement={coords.placement === 'top' ? 'top' : 'bottom'}>
          <button
            type="button"
            className={`selection-flyout-btn ${copied ? 'is-copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
            <span>{copied ? st.copied : st.copy}</span>
          </button>
        </Tooltip>

        <div className="selection-flyout-divider" />

        {/* Translate */}
        <div
          className="selection-flyout-translate-wrapper"
          onMouseEnter={handleTranslateMouseEnter}
          onMouseLeave={handleTranslateMouseLeave}
        >
          <button
            type="button"
            className={`selection-flyout-btn ${showTranslate ? 'is-active' : ''}`}
            onClick={triggerTranslation}
          >
            <Languages size={13} />
            <span>{st.translate}</span>
          </button>

          {/* Translation Popover on Hover / Click */}
          {showTranslate && (
            <div
              className={`selection-translate-popover ${coords.placement === 'bottom' ? 'popover-below' : 'popover-above'} ${coords.left < 80 ? 'popover-align-left' : ''}`}
              onMouseEnter={() => {
                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
              }}
            >
              <div className="selection-translate-header">
                <span className="selection-translate-provider">
                  {st.provider} {translationResult?.sourceLang ? `· ${translationResult.sourceLang}` : ''}
                </span>
                {translationResult?.translation && (
                  <Tooltip label={transCopied ? st.translationCopied : st.copyTranslation} placement="top">
                    <button
                      type="button"
                      className="selection-translate-copy-btn"
                      onClick={handleCopyTranslation}
                    >
                      {transCopied ? (
                        <>
                          <Check size={11} color="var(--green)" />
                          <span>{st.translationCopied}</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>{st.copy}</span>
                        </>
                      )}
                    </button>
                  </Tooltip>
                )}
              </div>

              <div className="selection-translate-body">
                {translating ? (
                  <div className="selection-translate-loading">
                    <Loader2 size={13} className="spin-icon" />
                    <span>{st.translating}</span>
                  </div>
                ) : translationError ? (
                  <div className="selection-translate-error">
                    <span>{st.translationError}</span>
                  </div>
                ) : (
                  <Tooltip label={st.copyTranslation} placement="bottom">
                    <div
                      className="selection-translate-text"
                      onClick={handleCopyTranslation}
                    >
                      {translationResult?.translation}
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
