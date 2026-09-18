import React, { useEffect, useState, useRef } from 'react'
import { Pin, PinOff, ExternalLink, X } from 'lucide-react'
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

  const resetHideTimer = (): void => {
    setShowControls(true)
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false)
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
    await window.api.pip.returnToReader()
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

  const startSecond = data.currentTime && data.currentTime > 2 ? Math.floor(data.currentTime) : 0

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
      {/* Top Floating Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px 0 14px',
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 70%, transparent 100%)',
          zIndex: 9999,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: showControls ? 'auto' : 'none',
          WebkitAppRegion: 'drag' as any
        }}
      >
        {/* Title area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflow: 'hidden',
            marginRight: '12px'
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.92)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {data.title || 'CyberFeeds'}
          </span>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            WebkitAppRegion: 'no-drag' as any
          }}
        >
          <button
            type="button"
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
      <div style={{ width: '100%', height: '100%' }}>
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
