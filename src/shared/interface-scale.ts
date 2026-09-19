export const INTERFACE_SCALE_MIN = 80
export const INTERFACE_SCALE_MAX = 125
export const INTERFACE_SCALE_STEP = 5
export const DEFAULT_INTERFACE_SCALE = 100

export function normalizeInterfaceScale(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_INTERFACE_SCALE

  const bounded = Math.min(INTERFACE_SCALE_MAX, Math.max(INTERFACE_SCALE_MIN, numeric))
  return Math.round(bounded / INTERFACE_SCALE_STEP) * INTERFACE_SCALE_STEP
}

export function interfaceScaleToZoomFactor(value: unknown): number {
  return normalizeInterfaceScale(value) / 100
}
