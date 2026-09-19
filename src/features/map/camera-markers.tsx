import { memo, useCallback } from 'react'
import { numberedCameras, nextCameraNumber } from '@/features/briefs/model/camera-numbers'
import type { CameraAngle, DroneBrief, Position } from '@/features/briefs/model/brief'
import { CameraMarker } from './camera-marker'
import { metersPerPixel } from './geometry'

type Props = {
  angles: CameraAngle[]
  pendingAngle: CameraAngle | null
  editable: boolean
  interactive: boolean
  selectedCameraIds: string[]
  zoom: number
  dslrSettings: DroneBrief['typeSettings']['dslr']
  onSelectCamera: (id: string, additive: boolean) => void
  onCommit: (angle: CameraAngle) => void
  onDuplicate?: (source: CameraAngle, position: Position) => void
}

export const CameraMarkers = memo(function CameraMarkers({
  angles, pendingAngle, editable, interactive, selectedCameraIds, zoom, dslrSettings, onSelectCamera, onCommit, onDuplicate,
}: Props) {
  const nextNumbers = {
    'drone-image': nextCameraNumber(angles, 'drone-image'),
    '360': nextCameraNumber(angles, '360'),
    dslr: nextCameraNumber(angles, 'dslr'),
  }
  const canDuplicate = Boolean(editable && onDuplicate && angles.length < 1000)
  return <>
    {numberedCameras(angles).map(({ angle, number }) => <CameraPoint key={angle.id} angle={angle} number={number}
      duplicateNumber={nextNumbers[angle.type]} editable={editable} interactive={interactive}
      selected={selectedCameraIds.includes(angle.id)} zoom={zoom} dslrSettings={dslrSettings}
      onSelectCamera={onSelectCamera} onCommit={onCommit} onDuplicate={canDuplicate ? onDuplicate : undefined} />)}
    {pendingAngle && <CameraMarker angle={pendingAngle} editable={false} interactive={false} selected={false}
      number={nextNumbers[pendingAngle.type]} dslrSettings={dslrSettings}
      pixelsToMeters={metersPerPixel(pendingAngle.position.lat, zoom)} onSelect={ignoreSelect} onCommit={ignoreCommit} />}
  </>
})

const ignoreSelect = () => {}
const ignoreCommit = () => {}

const CameraPoint = memo(function CameraPoint({ angle, number, duplicateNumber, editable, interactive, selected, zoom, dslrSettings, onSelectCamera, onCommit, onDuplicate }: {
  angle: CameraAngle
  number: number
  duplicateNumber: number
  editable: boolean
  interactive: boolean
  selected: boolean
  zoom: number
  dslrSettings: DroneBrief['typeSettings']['dslr']
  onSelectCamera: (id: string, additive: boolean) => void
  onCommit: (angle: CameraAngle) => void
  onDuplicate?: (source: CameraAngle, position: Position) => void
}) {
  const onSelect = useCallback((additive = false) => onSelectCamera(angle.id, additive), [onSelectCamera, angle.id])
  const duplicate = useCallback((position: Position) => onDuplicate?.(angle, position), [onDuplicate, angle])
  return <CameraMarker angle={angle} editable={editable} interactive={interactive} selected={selected} number={number}
    duplicateNumber={duplicateNumber} dslrSettings={dslrSettings} pixelsToMeters={metersPerPixel(angle.position.lat, zoom)}
    onSelect={onSelect} onCommit={onCommit} onDuplicate={onDuplicate ? duplicate : undefined} />
})
