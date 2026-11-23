interface UpdateRelease {
  version: string
  releaseUrl: string
  releaseNotes?: string
  notesLoading?: boolean
  portableUrl?: string
}

export type PendingUpdate = { release: UpdateRelease } & (
  | { state: 'available'; downloadFailed?: boolean }
  | { state: 'downloading'; percent: number; transferred?: number; total?: number; cancelling?: boolean }
  | { state: 'downloaded'; installFailed?: boolean }
  | { state: 'installing' }
)

export type UpdateCheckResult =
  | { ok: true; available: false }
  | { ok: true; available: true; version: string }
  | { ok: false; error: string }
