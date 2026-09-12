import { useEffect, useRef } from 'react'
import type { Position } from '@/features/briefs/model/brief'
import type { MapNavigation } from './map-navigation'

export function useCameraFocus(position: Position | null | undefined, navigation: MapNavigation | null) {
  const last = useRef<Position | null>(null)
  useEffect(() => {
    if (!position || !navigation || position === last.current) return
    navigation.panTo(position)
    last.current = position
  }, [position, navigation])
}
