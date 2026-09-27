import { useContext } from 'react'
import { DroneScanEditing } from '../state/drone-scan-editing'
import { Circle, Lock, LockOpen, Crosshair, X } from 'lucide-react'
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
      <p>High Detail: {scan.highRes ? `${formatScanDiameter(scan.highRes.radiusMeters)} m diameter` : 'Not added'}</p>
      <p>Low Detail: {scan.lowRes ? `${formatScanDiameter(scan.lowRes.radiusMeters)} m diameter` : 'Not added'}</p>
    </div>
  }
  return <>
    <div className="grid grid-cols-2 items-start gap-2">
    <ScanControl role="high" label="High Detail" brief={brief} onAdd={onAdd} onUpdate={onUpdate} />
    <ScanControl role="low" label="Low Detail" brief={brief} onAdd={onAdd} onUpdate={onUpdate} />
    </div>
    <div className="flex gap-2">
      <Button size="xs" variant={locked ? 'secondary' : 'outline'} disabled={!scan?.highRes || !scan?.lowRes} aria-pressed={locked} aria-label="Lock drone scan circles together" title="Move both circles together" onClick={() => setLocked(!locked)}>
        {locked ? <Lock /> : <LockOpen />}{locked ? 'Locked' : 'Lock'}
      </Button>
      <Button size="xs" variant="outline" disabled={!scan?.highRes || !scan?.lowRes} aria-label="Center drone scan circles" title="Align High Detail with the Low Detail center" onClick={() => onUpdate((current) => current.droneScan ? { ...current, droneScan: centerScanCircles(current.droneScan) } : current)}><Crosshair />Center</Button>
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
  const colorClass = role === 'high'
    ? 'border-blue-700 bg-blue-50 text-blue-800 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 dark:hover:text-blue-200'
    : 'border-red-700 bg-red-50 text-red-800 hover:bg-red-100 hover:text-red-800 dark:border-red-400 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900 dark:hover:text-red-200'
  if (!circle) return <Button variant="outline" className={'justify-start ' + colorClass} onClick={() => onAdd(role)}><Circle />{label}</Button>
  const limits = scanDiameterBounds(circle, role, other)
  const value = Math.min(limits.max, Math.max(limits.min, Math.round(circle.radiusMeters * 2)))
  return <div className="grid min-w-0 gap-3">
    <Button variant="outline" aria-label={`Remove ${label}`} className={'justify-start ' + colorClass} onClick={() => onUpdate((current) => withoutScanCircle(current, role))}>
      <X className="text-red-600 dark:text-red-400" />{label}
    </Button>
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
