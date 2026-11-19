import { Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CameraAngle } from '../model/brief'
import { cameraAppearance } from './camera-appearance'

export type CaptureKind = 'circleRig' | 'droneScan' | CameraAngle['type']

export function CaptureKindGlyph({ kind, number }: { kind: CaptureKind; number?: number }) {
  if (kind === 'circleRig') {
    return <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-primary shadow-sm">
      {number ? <span className="text-sm font-semibold leading-none tabular-nums">{number}</span> : <Circle className="size-4" />}
    </span>
  }
  if (kind === 'droneScan') {
    return <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-red-600 bg-red-500/15 dark:border-red-400">
      <span className="size-3 rounded-full bg-blue-600 dark:bg-blue-400" />
    </span>
  }
  const appearance = cameraAppearance[kind]
  const Icon = appearance.Icon
  return <span aria-hidden className={'inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ' + appearance.className}>
    <Icon className="size-4" />
  </span>
}

export function CaptureKindToggleButton({ kind, number, label, visible, onClick }: {
  kind: CaptureKind
  number?: number
  /** The action, such as "Hide Aerial photo". */
  label: string
  visible: boolean
  onClick: () => void
}) {
  return <Button type="button" variant="ghost" size="icon-sm" className={`rounded-full p-0 hover:bg-transparent ${visible ? '' : 'opacity-50'}`}
    aria-pressed={visible} aria-label={label} title={label} onClick={onClick}>
    <CaptureKindGlyph kind={kind} number={number} />
  </Button>
}
