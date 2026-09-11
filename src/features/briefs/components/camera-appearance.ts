import { Camera, Drone, Rotate3D } from 'lucide-react'
import type { CameraAngle } from '../model/brief'

export const cameraAppearance = {
  'drone-image': { Icon: Drone, color: '#c2410c', className: 'border-orange-700 bg-orange-50 text-orange-800 hover:bg-orange-100' },
  dslr: { Icon: Camera, color: '#0369a1', className: 'border-sky-700 bg-sky-50 text-sky-800 hover:bg-sky-100' },
  '360': { Icon: Rotate3D, color: '#7e22ce', className: 'border-purple-700 bg-purple-50 text-purple-800 hover:bg-purple-100' },
} satisfies Record<CameraAngle['type'], unknown>
