import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, Copy, Check, Languages, Loader2 } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

interface SelectionFlyoutProps {
  containerRef: React.RefObject<HTMLElement | null>
}

interface TranslationResult {
  text: string
  translation: string
  sourceLang: string
  targetLang: string
}

export default function SelectionFlyout({ containerRef }: SelectionFlyoutProps): JSX.Element | null {
  const { t, language } = useTranslation()
  const [selectedText, setSelectedText] = useState('')
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)
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
      setSelectedText('')
      setShowTranslate(false)
      return
    }

    const text = selection.toString().trim()
    if (!text || text.length < 1 || text.length > 5000) {
      setCoords(null)
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

      const flyoutHeight = 36
      const gap = 9
      const topSpace = rect.top - flyoutHeight - gap
      const placement: 'top' | 'bottom' = topSpace < 48 ? 'bottom' : 'top'

      const top = placement === 'top' ? rect.top - gap : rect.bottom + gap
      const left = rect.left + rect.width / 2

      setCoords({ top, left, placement })
      setSelectedText(text)
      setCopied(false)
    } catch {
      // Ignored if range is unavailable
    }
  }, [containerRef])

  // Listen to selection events
  useEffect(() => {
    const handleMouseUp = (): void => {
      // Small timeout to let browser finish selection
      setTimeout(checkSelection, 20)
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setCoords(null)
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
          return
        }

        const flyoutHeight = 36
        const gap = 9
        const topSpace = rect.top - flyoutHeight - gap
        const placement: 'top' | 'bottom' = topSpace < 48 ? 'bottom' : 'top'
        const top = placement === 'top' ? rect.top - gap : rect.bottom + gap
        const left = rect.left + rect.width / 2
        setCoords({ top, left, placement })
      } catch {
        setCoords(null)
      }
    }

    const handleMouseDown = (e: MouseEvent): void => {
      if (flyoutRef.current && flyoutRef.current.contains(e.target as Node)) {
        return
      }
      // If clicking outside the flyout, dismiss
      setCoords(null)
      setShowTranslate(false)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mouseup', handleMouseUp)
      container.addEventListener('scroll', handleScroll, { passive: true })
    }
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      if (container) {
        container.removeEventListener('mouseup', handleMouseUp)
        container.removeEventListener('scroll', handleScroll)
      }
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [checkSelection, containerRef, coords])

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
    >
      {/* Little arrow pointing toward the selected text */}
      <div className="selection-flyout-arrow" />

      {/* Main Buttons Bar */}
      <div className="selection-flyout-bar">
        {/* Search */}
        <button
          type="button"
          className="selection-flyout-btn"
          onClick={handleSearch}
          title={st.search}
        >
          <Search size={13} />
          <span>{st.search}</span>
        </button>

        <div className="selection-flyout-divider" />

        {/* Copy */}
        <button
          type="button"
          className={`selection-flyout-btn ${copied ? 'is-copied' : ''}`}
          onClick={handleCopy}
          title={copied ? st.copied : st.copy}
        >
          {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
          <span>{copied ? st.copied : st.copy}</span>
        </button>

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
              className={`selection-translate-popover ${coords.placement === 'bottom' ? 'popover-below' : 'popover-above'}`}
              onMouseEnter={() => {
                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
              }}
            >
              <div className="selection-translate-header">
                <span className="selection-translate-provider">
                  {st.provider} {translationResult?.sourceLang ? `· ${translationResult.sourceLang}` : ''}
                </span>
                {translationResult?.translation && (
                  <button
                    type="button"
                    className="selection-translate-copy-btn"
                    onClick={handleCopyTranslation}
                    title={transCopied ? st.translationCopied : st.copyTranslation}
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
                  <div
                    className="selection-translate-text"
                    onClick={handleCopyTranslation}
                    title={st.copyTranslation}
                  >
                    {translationResult?.translation}
                  </div>
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
