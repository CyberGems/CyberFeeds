export const BUILTIN_SHORTCUTS = new Set([
  'alt+m',
  'f11',
  'ctrl+m',
  'ctrl+w',
  'ctrl+f',
  'alt+f',
  'f3',
  'ctrl+h',
  'ctrl+i',
  'ctrl+l',
  'ctrl+,',
  'ctrl+tab',
  'ctrl+shift+tab',
  'f1',
  'f10'
])

export function normalizeKey(key: string, code?: string): string {
  if (key.length === 1 && key >= 'a' && key <= 'z') return key.toUpperCase()
  if (key.length === 1 && key >= '0' && key <= '9') return key

  switch (key) {
    case ' ': return 'Space'
    case 'ArrowUp': return 'Up'
    case 'ArrowDown': return 'Down'
    case 'ArrowLeft': return 'Left'
    case 'ArrowRight': return 'Right'
    case 'Escape': return 'Esc'
    case 'Enter': return 'Enter'
    case 'Tab': return 'Tab'
    case 'Backspace': return 'Backspace'
    case 'Delete': return 'Delete'
    case 'Insert': return 'Insert'
    case 'Home': return 'Home'
    case 'End': return 'End'
    case 'PageUp': return 'PageUp'
    case 'PageDown': return 'PageDown'
    case 'PrintScreen': return 'PrintScreen'
    case '`': case '~': return '`'
    case '-': case '_': return '-'
    case '=': case '+': return '='
    case '[': case '{': return '['
    case ']': case '}': return ']'
    case ';': case ':': return ';'
    case "'": case '"': return "'"
    case ',': case '<': return ','
    case '.': case '>': return '.'
    case '/': case '?': return '/'
    case '\\': case '|': return '\\'
  }

  if (/^F[1-9][0-9]?$/i.test(key)) return key.toUpperCase()
  if (code && code.startsWith('Key')) return code.substring(3).toUpperCase()
  if (code && code.startsWith('Digit')) return code.substring(5)
  if (code && code.startsWith('Numpad')) return code

  return key
}

export function isValidAccelerator(acc: string): boolean {
  if (!acc) return true
  const parts = acc.split('+').map((p) => p.trim())
  if (parts.length === 1 && /^F[1-9][0-9]?$/i.test(parts[0])) return true
  const hasModifier = parts.some((p) =>
    ['ctrl', 'control', 'cmdorctrl', 'commandorcontrol', 'alt', 'shift', 'cmd', 'command', 'meta'].includes(
      p.toLowerCase()
    )
  )
  const isAltF4 = parts.some((p) => p.toLowerCase() === 'alt') && parts.some((p) => p.toLowerCase() === 'f4')
  return hasModifier && !isAltF4 && parts.length >= 2
}

export function matchesAccelerator(e: KeyboardEvent, accelerator?: string): boolean {
  if (!accelerator) return false
  const parts = accelerator.split('+').map((p) => p.trim())
  if (parts.length === 0) return false

  let reqCtrl = false
  let reqAlt = false
  let reqShift = false
  let reqMeta = false
  let keyPart = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (['ctrl', 'control', 'cmdorctrl', 'commandorcontrol'].includes(lower)) {
      reqCtrl = true
    } else if (lower === 'alt') {
      reqAlt = true
    } else if (lower === 'shift') {
      reqShift = true
    } else if (['cmd', 'meta', 'win'].includes(lower)) {
      reqMeta = true
    } else {
      keyPart = part
    }
  }

  const hasCtrl = e.ctrlKey || (reqCtrl && e.metaKey)
  if (reqCtrl !== hasCtrl) return false
  if (reqAlt !== e.altKey) return false
  if (reqShift !== e.shiftKey) return false
  if (reqMeta !== e.metaKey && !reqCtrl) return false

  const pressedKey = normalizeKey(e.key, e.code).toLowerCase()
  const targetKey = normalizeKey(keyPart).toLowerCase()
  return pressedKey === targetKey
}
