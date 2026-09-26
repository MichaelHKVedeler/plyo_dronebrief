import { useContext } from 'react'
import { DroneScanEditing } from '../state/drone-scan-editing'
import { Circle, Lock, LockOpen, Crosshair } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DroneBrief } from '../model/brief'
import { NumberField } from './number-field'
import { applyScanDiameter, centerScanCircles, formatScanDiameter, scanDiameterBounds, scanDiameterStep, withoutScanCircle, type ScanRole } from '@/features/map/drone-scan'

export function DroneScanControls({ brief, editing, onAdd, onUpdate }: {
  brief: DroneBrief
  editing: boolean
  onAdd: (role: ScanRole) => void
  onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
}) {
  const { locked, setLocked } = useContext(DroneScanEditing)
  const scan = brief.droneScan
  if (!editing) {
    if (!scan?.highRes && !scan?.lowRes) return <p>No drone scan in this brief.</p>
    return <div className="grid gap-2 text-sm">
      <p>High res: {scan.highRes ? `${formatScanDiameter(scan.highRes.radiusMeters)} m diameter` : 'Not added'}</p>
      <p>Low res: {scan.lowRes ? `${formatScanDiameter(scan.lowRes.radiusMeters)} m diameter` : 'Not added'}</p>
    </div>
  }
  return <>
    <div className="grid grid-cols-2 items-start gap-2">
    <ScanControl role="high" label="High res" brief={brief} onAdd={onAdd} onUpdate={onUpdate} />
    <ScanControl role="low" label="Low res" brief={brief} onAdd={onAdd} onUpdate={onUpdate} />
    </div>
    <div className="flex gap-2">
      <Button size="xs" variant={locked ? 'secondary' : 'outline'} disabled={!scan?.highRes || !scan?.lowRes} aria-pressed={locked} aria-label="Lock drone scan circles together" title="Move both circles together" onClick={() => setLocked(!locked)}>
        {locked ? <Lock /> : <LockOpen />}{locked ? 'Locked' : 'Lock'}
      </Button>
      <Button size="xs" variant="outline" disabled={!scan?.highRes || !scan?.lowRes} aria-label="Center drone scan circles" title="Align high res with the low-res center" onClick={() => onUpdate((current) => current.droneScan ? { ...current, droneScan: centerScanCircles(current.droneScan) } : current)}><Crosshair />Center</Button>
    </div>
  </>
}

function ScanControl({ role, label, brief, onAdd, onUpdate }: {
  role: ScanRole
  label: string
  brief: DroneBrief
  onAdd: (role: ScanRole) => void
  onUpdate: (update: (brief: DroneBrief) => DroneBrief) => void
}) {
  const scan = brief.droneScan
  const circle = role === 'high' ? scan?.highRes : scan?.lowRes
  const other = role === 'high' ? scan?.lowRes ?? null : scan?.highRes ?? null
  if (!circle) return <Button variant="outline" className="justify-start border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" onClick={() => onAdd(role)}><Circle />{label}</Button>
  const limits = scanDiameterBounds(circle, role, other)
  const value = Math.min(limits.max, Math.max(limits.min, Math.round(circle.radiusMeters * 2)))
  return <div className="grid min-w-0 gap-3">
    <Button variant="ghost" className="px-1 text-xs" onClick={() => onUpdate((current) => withoutScanCircle(current, role))}>Remove {label.toLowerCase()}</Button>
    <NumberField label={`${label} diameter (m)`} value={value} min={limits.min} max={limits.max} step={scanDiameterStep} live
      onChange={(diameter) => onUpdate((current) => {
        const currentScan = current.droneScan
        const currentCircle = role === 'high' ? currentScan?.highRes : currentScan?.lowRes
        if (!currentScan || !currentCircle || currentCircle.id !== circle.id) return current
        const partner = role === 'high' ? currentScan.lowRes : currentScan.highRes
        const next = applyScanDiameter(currentCircle, diameter, role, partner)
        return { ...current, droneScan: { ...currentScan, highRes: role === 'high' ? next : currentScan.highRes, lowRes: role === 'low' ? next : currentScan.lowRes } }
      })} />
  </div>
}
