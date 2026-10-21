import React, { useEffect, useState, useRef } from 'react'
import { Pin, PinOff, ExternalLink, X, GripHorizontal } from 'lucide-react'
import type { PipVideoPayload } from '../../shared/types'
import { translations } from '../../shared/translations'

export default function PipApp(): React.JSX.Element {
  const [data, setData] = useState<PipVideoPayload | null>(null)
  const [isPinned, setIsPinned] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [language, setLanguage] = useState<'en' | 'es'>('en')
  const hideTimerRef = useRef<number | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    // Reset zoom factor to 1.0 so that renderer-side host zoom does not clip the PIP player
    try {
      window.api.setZoomFactor(1.0)
    } catch {
      // ignore
    }

    // Fetch app language and settings
    window.api.getSettings().then((s: any) => {
      if (s?.language === 'es' || s?.language === 'en') {
        setLanguage(s.language)
      }
    }).catch(() => {})

    // Fetch initial PiP data and status
    window.api.pip.getData().then((payload) => {
      if (payload) setData(payload)
    }).catch(() => {})

    window.api.pip.getStatus().then((status) => {
      if (status) setIsPinned(status.isPinned)
    }).catch(() => {})

    // Listen for updates when user sends a new video to this PiP window
    const unsub = window.api.pip.onUpdateData((newPayload) => {
      setData(newPayload)
    })

    return () => {
      unsub()
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    }
  }, [])

  const isDraggingRef = useRef(false)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const currentPipTimeRef = useRef<number>(0)

  useEffect(() => {
    const handlePipMessage = (e: MessageEvent): void => {
      try {
        const payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (payload?.event === 'infoDelivery' && payload?.info) {
          const ct = payload.info.currentTime
          if (typeof ct === 'number' && ct > 0) {
            currentPipTimeRef.current = ct
          }
        }
      } catch {}
    }
    window.addEventListener('message', handlePipMessage)
    return () => window.removeEventListener('message', handlePipMessage)
  }, [])

  const handleDragMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    setIsDragging(true)
    dragStartPos.current = { x: e.screenX, y: e.screenY }

    const onMouseMove = (moveEvent: MouseEvent): void => {
      if (!isDraggingRef.current || !dragStartPos.current) return
      const dx = moveEvent.screenX - dragStartPos.current.x
      const dy = moveEvent.screenY - dragStartPos.current.y
      if (dx !== 0 || dy !== 0) {
        dragStartPos.current = { x: moveEvent.screenX, y: moveEvent.screenY }
        window.api.pip.moveBy(dx, dy).catch(() => {})
      }
    }

    const onMouseUp = (): void => {
      isDraggingRef.current = false
      setIsDragging(false)
      dragStartPos.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const resetHideTimer = (): void => {
    setShowControls(true)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      if (!isDraggingRef.current) {
        setShowControls(false)
      }
    }, 2500)
  }

  const handleMouseMove = (): void => {
    resetHideTimer()
  }

  const handleTogglePin = async (): Promise<void> => {
    const next = await window.api.pip.togglePin()
    setIsPinned(next)
  }

  const handleReturnToReader = async (): Promise<void> => {
    const finalTime =
      (videoRef.current ? videoRef.current.currentTime : currentPipTimeRef.current) ||
      (data?.currentTime ?? 0)
    await window.api.pip.returnToReader(Math.floor(finalTime))
  }

  const handleClose = async (): Promise<void> => {
    await window.api.pip.close()
  }

  const t = translations[language].articleViewer

  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#8b949e',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '13px'
        }}
      >
        <span>Loading video...</span>
      </div>
    )
  }

  const startSecond = data.currentTime && data.currentTime > 1 ? Math.floor(data.currentTime) : 0

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={resetHideTimer}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#000000',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Fullscreen drag capture shield (prevents iframe from capturing mouse during window drag) */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            cursor: 'grabbing',
            background: 'transparent',
            userSelect: 'none'
          }}
        />
      )}

      {/* Persistent Top Drag Strip (Always draggable even when controls fade) */}
      <div
        className="pip-drag-zone"
        title={t.pipDragTooltip}
        onMouseDown={handleDragMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '28px',
          zIndex: 10000,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      />

      {/* Subtle top grab pill indicator when controls are hidden */}
      {!showControls && !isDragging && (
        <div
          style={{
            position: 'absolute',
            top: '5px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '42px',
            height: '4px',
            borderRadius: '2px',
            background: 'rgba(255, 255, 255, 0.55)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.7)',
            zIndex: 10001,
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease'
          }}
        />
      )}

      {/* Top Floating Control Bar */}
      <div
        className="pip-drag-zone"
        onMouseDown={handleDragMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px 0 12px',
          background: 'linear-gradient(to bottom, rgba(10, 14, 23, 0.94) 0%, rgba(10, 14, 23, 0.7) 80%, transparent 100%)',
          zIndex: 9999,
          opacity: showControls || isDragging ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: showControls || isDragging ? 'auto' : 'none',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        {/* Drag Handle & Title area */}
        <div
          className="pip-drag-handle"
          title={t.pipDragTooltip}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            minWidth: 0,
            marginRight: '12px',
            padding: '4px 6px',
            borderRadius: '6px',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <GripHorizontal
            size={18}
            style={{
              color: 'var(--accent, #00d8f1)',
              flexShrink: 0,
              opacity: 0.9
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.94)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none'
            }}
          >
            {data.title || 'CyberFeeds'}
          </span>
        </div>

        {/* Action Buttons */}
        <div
          className="pip-no-drag"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'default'
          }}
        >
          <button
            type="button"
            className="pip-action-btn"
            onClick={handleTogglePin}
            title={t.pipPinTooltip}
            style={{
              background: isPinned ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
              border: 0,
              borderRadius: '6px',
              color: isPinned ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
              padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            {isPinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          <button
            type="button"
            className="pip-action-btn"
            onClick={handleReturnToReader}
            title={t.pipReturnToReader}
            style={{
              background: 'transparent',
              border: 0,
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.75)',
              padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <ExternalLink size={15} />
          </button>

          <button
            type="button"
            className="pip-action-btn"
            onClick={handleClose}
            title={t.pipCloseFloating}
            style={{
              background: 'transparent',
              border: 0,
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.75)',
              padding: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Video Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: isDragging ? 'none' : 'auto'
        }}
      >
        {data.type === 'youtube' && data.videoId ? (
          <iframe
            key={data.videoId}
            src={`https://www.youtube-nocookie.com/embed/${data.videoId}?autoplay=1&enablejsapi=1&rel=0${startSecond ? `&start=${startSecond}` : ''}`}
            title={data.title}
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block'
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : data.type === 'video' ? (
          <video
            ref={videoRef}
            src={data.src}
            controls
            autoPlay
            onLoadedMetadata={() => {
              if (videoRef.current && startSecond > 0) {
                videoRef.current.currentTime = startSecond
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        ) : (
          <iframe
            key={data.src}
            src={data.src}
            title={data.title}
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block'
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        )}
      </div>
    </div>
  )
}
