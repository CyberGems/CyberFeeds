import { useCallback, useState, useEffect, useLayoutEffect, useRef, cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode, MouseEvent as ReactMouseEvent, CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  label: ReactNode
  placement?: Placement
  children: ReactElement
}

const VIEWPORT_MARGIN = 8 // separación mínima respecto al borde de la ventana
const GAP = 8 // separación respecto al elemento ancla
const HOVER_DELAY_MS = 300
const NESTED_TRIGGER = '[data-has-tooltip="true"], button, a, [role="button"]'

function clamp(value: number, min: number, max: number) {
  if (max < min) return min // el tooltip es más grande que el espacio: prioriza el margen
  return Math.max(min, Math.min(value, max))
}

// Tooltip elegante y reutilizable (mismo estilo que las pestañas del editor).
// Clona al hijo y le añade los handlers de hover sin envolverlo en otro nodo,
// de modo que no altera los layouts flex existentes. Se reposiciona para no
// salirse de la pantalla y la flecha se re-ancla al centro del elemento.
export default function Tooltip({ label, placement = 'bottom', children }: TooltipProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; arrow: CSSProperties } | null>(null)
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleShow = useCallback((trigger: HTMLElement): void => {
    const showWhenReady = (): void => {
      delayTimer.current = null
      if (!trigger.isConnected || !trigger.matches(':hover')) return
      const strip = trigger.closest('[data-scroll-hover]')
      if (strip?.getAttribute('data-scroll-hover') === 'paused') {
        delayTimer.current = setTimeout(showWhenReady, HOVER_DELAY_MS)
        return
      }
      // The wheel may have moved the pointer over a nested trigger, such as Close tab.
      if (strip && trigger.querySelector(`:hover:is(${NESTED_TRIGGER})`)) return
      setAnchor(trigger)
    }
    delayTimer.current = setTimeout(showWhenReady, HOVER_DELAY_MS)
  }, [])

  // Medimos el tooltip ya renderizado y calculamos la posición con clamping.
  useLayoutEffect(() => {
    if (!anchor || !cardRef.current) {
      setPos(null)
      return
    }
    const rect = anchor.getBoundingClientRect()
    const card = cardRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let left = 0
    let top = 0
    let arrow: CSSProperties = {}

    if (placement === 'top' || placement === 'bottom') {
      left = clamp(cx - card.width / 2, VIEWPORT_MARGIN, vw - card.width - VIEWPORT_MARGIN)
      top = placement === 'bottom' ? rect.bottom + GAP : rect.top - GAP - card.height
      const ax = clamp(cx - left, 12, card.width - 12) // flecha alineada al centro del ancla
      arrow =
        placement === 'bottom'
          ? {
              top: -4,
              left: ax,
              marginLeft: -4,
              borderTop: '1px solid var(--border)',
              borderLeft: '1px solid var(--border)'
            }
          : {
              bottom: -4,
              left: ax,
              marginLeft: -4,
              borderBottom: '1px solid var(--border)',
              borderRight: '1px solid var(--border)'
            }
    } else {
      top = clamp(cy - card.height / 2, VIEWPORT_MARGIN, vh - card.height - VIEWPORT_MARGIN)
      left = placement === 'right' ? rect.right + GAP : rect.left - GAP - card.width
      const ay = clamp(cy - top, 12, card.height - 12)
      arrow =
        placement === 'right'
          ? {
              left: -4,
              top: ay,
              marginTop: -4,
              borderBottom: '1px solid var(--border)',
              borderLeft: '1px solid var(--border)'
            }
          : {
              right: -4,
              top: ay,
              marginTop: -4,
              borderTop: '1px solid var(--border)',
              borderRight: '1px solid var(--border)'
            }
    }
    setPos({ left, top, arrow })
    // Nota: no dependemos de `label` para evitar recálculos en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, placement])

  // Ocultar al hacer scroll para que el tooltip no quede "flotando".
  useEffect(() => {
    if (!anchor) return
    const hide = (event: Event): void => {
      setAnchor(null)
      const strip = anchor.closest('[data-scroll-hover]')
      if (!delayTimer.current && event.target instanceof Node && strip?.contains(event.target)) {
        scheduleShow(anchor)
      }
    }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('wheel', hide, true)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('wheel', hide, true)
    }
  }, [anchor, scheduleShow])

  // Limpiar temporizadores de retardo al desmontar
  useEffect(() => {
    return () => {
      if (delayTimer.current) clearTimeout(delayTimer.current)
    }
  }, [])

  if (!isValidElement(children)) return children
  const child = children as ReactElement<any>

  const show = (e: ReactMouseEvent<HTMLElement>): void => {
    child.props.onMouseEnter?.(e)
    if (delayTimer.current) {
      clearTimeout(delayTimer.current)
      delayTimer.current = null
    }

    const target = e.target as HTMLElement
    const currentTarget = e.currentTarget as HTMLElement
    const closestTrigger = target.closest(NESTED_TRIGGER)
    if (closestTrigger && closestTrigger !== currentTarget) {
      setAnchor(null)
    } else if (label) {
      scheduleShow(currentTarget)
    }
  }
  const hide = (e: ReactMouseEvent<HTMLElement>): void => {
    child.props.onMouseLeave?.(e)
    if (delayTimer.current) {
      clearTimeout(delayTimer.current)
      delayTimer.current = null
    }
    setAnchor(null)
  }
  const clickHide = (e: ReactMouseEvent<HTMLElement>): void => {
    child.props.onClick?.(e)
    if (delayTimer.current) {
      clearTimeout(delayTimer.current)
      delayTimer.current = null
    }
    setAnchor(null)
  }
  const handleMouseMove = (e: ReactMouseEvent<HTMLElement>): void => {
    child.props.onMouseMove?.(e)
    const target = e.target as HTMLElement
    const currentTarget = e.currentTarget as HTMLElement
    const closestTrigger = target.closest(NESTED_TRIGGER)
    if (closestTrigger && closestTrigger !== currentTarget) {
      if (delayTimer.current) {
        clearTimeout(delayTimer.current)
        delayTimer.current = null
      }
      setAnchor(null)
    } else if (label) {
      if (!anchor && !delayTimer.current) {
        scheduleShow(currentTarget)
      }
    }
  }

  // eslint-disable-next-line react-hooks/refs
  const cloned = cloneElement(child, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onClick: clickHide,
    onMouseMove: handleMouseMove,
    'data-has-tooltip': 'true'
  })

  return (
    <>
      {cloned}
      {anchor &&
        label &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: pos ? pos.left : -9999,
              top: pos ? pos.top : -9999,
              zIndex: 1000001,
              pointerEvents: 'none',
              visibility: pos ? 'visible' : 'hidden',
              outline: 'none'
            }}
          >
            <div
              ref={cardRef}
              style={{
                position: 'relative',
                background: 'rgba(15, 15, 20, 0.97)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border)',
                outline: 'none',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 4px var(--accent-glow)',
                borderRadius: 8,
                padding: '6px 10px',
                color: 'rgba(255, 255, 255, 0.95)',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                animation: 'tooltipPop 0.14s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {label}
              <div
                style={{
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  background: 'rgba(15, 15, 20, 0.97)',
                  transform: 'rotate(45deg)',
                  ...(pos?.arrow || {})
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
