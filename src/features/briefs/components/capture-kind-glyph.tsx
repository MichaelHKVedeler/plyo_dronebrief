import { Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CameraAngle } from '../model/brief'
import { cameraAppearance } from './camera-appearance'

export type CaptureKind = 'circleRig' | CameraAngle['type']

export function CaptureKindGlyph({ kind }: { kind: CaptureKind }) {
  if (kind === 'circleRig') {
    return <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-primary shadow-sm">
      <Circle className="size-4" />
    </span>
  }
  const appearance = cameraAppearance[kind]
  const Icon = appearance.Icon
  return <span aria-hidden className={'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ' + appearance.className}>
    <Icon className="size-4" />
  </span>
}

export function CaptureKindIsolateButton({ kind, label, pressed, onClick }: {
  kind: CaptureKind
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return <Button type="button" variant="ghost" size="icon-sm" className={`rounded-full p-0 hover:bg-transparent ${pressed ? 'ring-2 ring-ring' : ''}`}
    aria-pressed={pressed} aria-label={`Show only ${label}`} onClick={onClick}>
    <CaptureKindGlyph kind={kind} />
  </Button>
}
