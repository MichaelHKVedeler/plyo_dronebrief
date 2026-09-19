import type { AssetManifest, ProjectSummary } from '../model/cloud'
import type { DroneBrief } from '@/features/briefs/model/brief'

export type SaveStatus = 'Saved' | 'Unsaved' | 'Saving' | 'Save failed' | 'Conflict'
type Pending = { brief: DroneBrief; assets: AssetManifest; sequence: number; operationId: string; expectedRevision: number }
export class SaveCoordinator {
  private revision: number
  private sequence = 0
  private acknowledged = 0
  private pending: Pending | null = null
  private queued: { brief: DroneBrief; assets: AssetManifest; sequence: number } | null = null
  private running = false
  private stopped = false
  private save: (pending: Pending) => Promise<ProjectSummary>
  private changed: (status: SaveStatus, summary?: ProjectSummary, error?: unknown, assets?: AssetManifest) => void
  committedAssets: AssetManifest | null = null
  status: SaveStatus = 'Saved'
  constructor(revision: number, save: (pending: Pending) => Promise<ProjectSummary>, changed: (status: SaveStatus, summary?: ProjectSummary, error?: unknown, assets?: AssetManifest) => void) { this.revision = revision; this.save = save; this.changed = changed }
  attach() { this.stopped = false }
  get dirty() { return this.sequence !== this.acknowledged }
  get saving() { return this.running }
  get currentRevision() { return this.revision }
  enqueue(brief: DroneBrief, assets: AssetManifest) {
    if (this.stopped) return
    this.queued = { brief, assets, sequence: ++this.sequence }
    if (this.status !== 'Conflict' && this.status !== 'Save failed') void this.flush()
  }
  private publish(status: SaveStatus, summary?: ProjectSummary, error?: unknown) { this.status = status; if (!this.stopped) this.changed(status, summary, error, this.committedAssets ?? undefined) }
  async flush() {
    if (this.running || this.stopped || this.status === 'Conflict') return
    this.running = true
    try {
      while (!this.stopped && (this.pending || this.queued)) {
        if (!this.pending && this.queued) { this.pending = { ...this.queued, expectedRevision: this.revision, operationId: crypto.randomUUID() }; this.queued = null }
        const pending = this.pending!
        this.publish('Saving')
        try {
          const summary = await this.save(pending)
          if (this.stopped) return
          this.revision = summary.revision; this.acknowledged = pending.sequence; this.committedAssets = pending.assets; this.pending = null
          this.publish(this.queued ? 'Unsaved' : 'Saved', summary)
        } catch (error) {
          this.publish((error as { code?: string }).code === 'functions/aborted' ? 'Conflict' : 'Save failed', undefined, error)
          return
        }
      }
    } finally { this.running = false }
  }
  remoteRevision(revision: number) {
    if (revision > this.revision && this.dirty && !this.running) this.publish('Conflict')
  }
  dispose() { this.stopped = true; this.queued = null }
}
