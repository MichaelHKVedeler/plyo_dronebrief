// Runtime capabilities, deliberately separate from the portable brief model.
export type ImageTransport = {
  version: string
  description: string
  load: (fileId: string, signal: AbortSignal) => Promise<Blob>
  upload?: (fileId: string, file: File, signal: AbortSignal) => Promise<void>
  onBusy?: (busy: boolean) => void
}
