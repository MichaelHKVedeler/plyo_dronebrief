// Runtime capabilities, deliberately separate from the portable brief model.
export type ImageTransport = {
  /** Names the stored copy behind a file; when it changes, that one image is fetched again. */
  version: (fileId: string) => string | undefined
  description: string
  load: (fileId: string, signal: AbortSignal) => Promise<Blob>
  upload?: (fileId: string, file: File, signal: AbortSignal) => Promise<void>
  onBusy?: (busy: boolean) => void
}
