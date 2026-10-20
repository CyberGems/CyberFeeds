import type { Display } from 'electron'

export const MIN_WINDOW_WIDTH = 800
export const MIN_WINDOW_HEIGHT = 600

export interface WindowBoundsInput {
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
  displayId?: number | null
  displayBounds?: { x: number; y: number; width: number; height: number } | null
}

export interface ClampedWindowBounds {
  x: number
  y: number
  width: number
  height: number
  displayId: number
}

export interface ClampWindowBoundsOpts {
  displays: Display[]
  primary: Display
  /** Explicit preferred monitor; ignored when missing or 'auto'. */
  preferredDisplayId?: string | number | null
  /** Last-closed monitor id (overrides center-point guess). */
  savedDisplayId?: string | number | null
  /** Last-closed monitor bounds (survives ID changes across Windows reboots). */
  savedDisplayBounds?: { x: number; y: number; width: number; height: number } | null
}

/**
 * Clamp/restore window bounds into a single display workArea.
 * Mitigates Electron+Windows mixed-DPI bugs where saved sizes grow across launches
 * and spill onto a neighboring monitor (CyberViewer pattern).
 *
 * Display priority:
 * 1) preferredDisplayId (explicit, not "auto")
 * 2) Exact displayId match
 * 3) Exact display geometry bounds match (survives Windows reboots where IDs change)
 * 4) Display nearest to window coordinates center
 * 5) primary fallback
 */
export function clampWindowBounds(
  bounds: WindowBoundsInput | null | undefined,
  opts: ClampWindowBoundsOpts
): ClampedWindowBounds {
  const displays = opts.displays || []
  const primary = opts.primary || displays[0]
  if (!primary) {
    return { x: 0, y: 0, width: 1280, height: 800, displayId: 0 }
  }

  let display: Display | null = null
  const preferredId = opts.preferredDisplayId
  const savedId =
    (opts.savedDisplayId != null ? opts.savedDisplayId : null) ??
    (bounds && bounds.displayId != null ? bounds.displayId : null)
  const savedBounds = opts.savedDisplayBounds ?? bounds?.displayBounds

  // 1. Explicit preferred monitor setting
  if (preferredId != null && preferredId !== '' && preferredId !== 'auto') {
    display = displays.find((d) => d.id.toString() === preferredId.toString()) || null
  }

  // 2. Exact display ID match (same session or stable IDs)
  if (!display && savedId != null && savedId !== '' && savedId !== 'auto') {
    display = displays.find((d) => d.id.toString() === savedId.toString()) || null
  }

  // 3. Exact display geometry match (crucial: survives Windows reboots where display IDs change)
  if (!display && savedBounds) {
    display =
      displays.find(
        (d) =>
          d.bounds.x === savedBounds.x &&
          d.bounds.y === savedBounds.y &&
          d.bounds.width === savedBounds.width &&
          d.bounds.height === savedBounds.height
      ) || null
  }

  // 4. Match by window coordinates: which display contains or is nearest to (cx, cy)
  if (!display && bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number') {
    const cx = Math.round(bounds.x + (Number(bounds.width) || 0) / 2)
    const cy = Math.round(bounds.y + (Number(bounds.height) || 0) / 2)
    display = displayNearestPoint(displays, primary, cx, cy)
  }

  // 5. Ultimate fallback if displays list is empty or coordinates are invalid
  if (!display) {
    display = primary
  }

  const area = display.workArea || display.bounds
  const maxW = Math.max(MIN_WINDOW_WIDTH, area.width)
  const maxH = Math.max(MIN_WINDOW_HEIGHT, area.height)
  const defaultW = Math.min(1280, Math.max(MIN_WINDOW_WIDTH, Math.floor(area.width * 0.85)))
  const defaultH = Math.min(800, Math.max(MIN_WINDOW_HEIGHT, Math.floor(area.height * 0.85)))

  let w = Number(bounds && bounds.width)
  let h = Number(bounds && bounds.height)
  if (!Number.isFinite(w) || w <= 0) w = defaultW
  if (!Number.isFinite(h) || h <= 0) h = defaultH

  // Saved size larger than the target work area ⇒ DPI inflation; reset.
  if (w > area.width || h > area.height) {
    w = defaultW
    h = defaultH
  }

  w = Math.min(Math.max(Math.round(w), MIN_WINDOW_WIDTH), maxW)
  h = Math.min(Math.max(Math.round(h), MIN_WINDOW_HEIGHT), maxH)

  let x = bounds && typeof bounds.x === 'number' ? Math.round(bounds.x) : NaN
  let y = bounds && typeof bounds.y === 'number' ? Math.round(bounds.y) : NaN

  const onPreferred = preferredId != null && preferredId !== '' && preferredId !== 'auto'
  const fullyInside =
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= area.x - 8 &&
    y >= area.y - 8 &&
    x + w <= area.x + area.width + 8 &&
    y + h <= area.y + area.height + 8

  if (onPreferred || !fullyInside || !Number.isFinite(x) || !Number.isFinite(y)) {
    x = Math.round(area.x + (area.width - w) / 2)
    y = Math.round(area.y + (area.height - h) / 2)
  }

  x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - w))
  y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - h))

  return { x, y, width: w, height: h, displayId: display.id }
}

export function displayNearestPoint(
  displays: Display[],
  primary: Display,
  x: number,
  y: number
): Display {
  let best = primary
  let bestDist = Infinity
  for (const d of displays) {
    const b = d.bounds
    const cx = Math.min(Math.max(x, b.x), b.x + b.width)
    const cy = Math.min(Math.max(y, b.y), b.y + b.height)
    const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy)
    if (dist < bestDist) {
      bestDist = dist
      best = d
    }
  }
  return best
}
