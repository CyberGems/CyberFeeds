type UndoDirection = 'undo' | 'redo'

interface FieldHistory {
  value: string
  undo: string[]
  redo: string[]
}

const histories = new WeakMap<HTMLElement, FieldHistory>()
const HISTORY_LIMIT = 100

function readField(field: HTMLElement): string {
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
    ? field.value : field.innerHTML
}

export function getFieldHistory(field: HTMLElement): FieldHistory {
  const value = readField(field)
  const existing = histories.get(field)
  if (existing?.value === value) return existing

  const history: FieldHistory = { value, undo: [], redo: [] }
  histories.set(field, history)
  return history
}

function push(stack: string[], value: string): void {
  stack.push(value)
  if (stack.length > HISTORY_LIMIT) stack.shift()
}

export function recordFieldEdit(field: HTMLElement, inputType: string): void {
  const history = histories.get(field)
  const value = readField(field)
  if (!history) {
    getFieldHistory(field)
    return
  }
  if (history.value === value) return

  const direction = inputType === 'historyUndo' ? 'undo' : inputType === 'historyRedo' ? 'redo' : null
  if (direction) {
    const source = history[direction]
    const index = source.lastIndexOf(value)
    if (index >= 0) {
      source.length = index
      push(history[direction === 'undo' ? 'redo' : 'undo'], history.value)
    } else {
      // A native shortcut can jump over a browser-coalesced sequence of edits.
      history.undo.length = 0
      history.redo.length = 0
      push(history[direction === 'undo' ? 'redo' : 'undo'], history.value)
    }
  } else {
    push(history.undo, history.value)
    history.redo.length = 0
  }
  history.value = value
}

export function restoreFieldEdit(field: HTMLElement, direction: UndoDirection): void {
  const history = getFieldHistory(field)
  const value = history[direction].pop()
  if (value === undefined) return

  push(history[direction === 'undo' ? 'redo' : 'undo'], history.value)
  history.value = value

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    // The native setter lets React observe a real change in controlled fields.
    const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value)
  } else {
    field.innerHTML = value
  }
  field.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: direction === 'undo' ? 'historyUndo' : 'historyRedo'
  }))
}
