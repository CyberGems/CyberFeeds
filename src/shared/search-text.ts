export function normalizeSearchText(text: string | null | undefined): string {
  return (text ?? '').normalize('NFC').toLowerCase()
}
