import { useImperativeHandle, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import type { DroneBrief, ImageOverlay, ShootSlot } from '@/features/briefs/model/brief'
import type { PdfMapCapture, PdfMapImage } from '@/features/briefs/export/pdf-types'
import type { MapNavigation } from './map-navigation'
import type { MapView } from './map-view'
import { sceneBounds, scenePoints } from './scene-bounds'
import { droneScanOutlinePoints, hasDroneScan } from './drone-scan'

export type PdfCapturePass = 'full' | 'drone-scan'

export function usePdfMapCapture(ref: RefObject<PdfMapCapture | null> | undefined, { root, navigation, view, brief, sourceUrl, setCapturing, shadowSlot }: {
  root: RefObject<HTMLDivElement | null>
  navigation: MapNavigation | null
  view: RefObject<MapView>
  brief: DroneBrief
  sourceUrl: (overlay: ImageOverlay) => string | undefined
  setCapturing: (value: PdfCapturePass | false) => void
  shadowSlot?: ShootSlot
}) {
  useImperativeHandle(ref, () => async (signal) => {
    if (!navigation) throw new Error('The map is not ready. Wait for it to load, or choose Point diagram.')
    const missing = brief.imageOverlays.filter((image) => !sourceUrl(image))
    if (missing.length) throw new Error('Reconnect these floor-plan images before exporting the map: ' + missing.map((image) => image.name).join(', '))
    const saved = { ...view.current, center: { ...view.current.center } }
    const { toPng } = await import('html-to-image')
    signal.throwIfAborted()
    flushSync(() => setCapturing('full'))
    try {
      const surface = root.current?.querySelector<HTMLElement>('[data-pdf-map-surface]')
      if (!surface || surface.clientWidth < 1 || surface.clientHeight < 1) throw new Error('The map could not be captured. Choose Point diagram or try again.')
      const frame = async (points: Parameters<typeof sceneBounds>[0]) => {
        navigation.fitBounds(sceneBounds(points), 56)
        await navigation.waitForIdle?.(signal)
        if ((navigation.getZoom() ?? 0) > 18.5) {
          navigation.setZoom(18.5)
          await navigation.waitForIdle?.(signal)
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        signal.throwIfAborted()
        if (surface.querySelector('[data-pdf-map-unavailable]')) throw new Error('Google Maps is still loading or has a loading error. Wait, or choose Point diagram.')
      }
      const shoot = async (kind: PdfMapImage['kind'], hideImages: boolean) => {
        let imageFailed = false
        const dataUrl = await toPng(surface, {
          pixelRatio: 2, skipFonts: true, includeQueryParams: true,
          fetchRequestInit: { signal },
          onImageErrorHandler: () => { imageFailed = true },
          filter: (element) => {
            if (!(element instanceof Element)) return true
            if (element.matches('iframe, [data-pdf-exclude]')) return false
            if (hideImages && element.matches('[data-image-layer]')) return false
            return true
          },
        })
        if (imageFailed || !dataUrl.startsWith('data:image/png')) throw new Error('A Google Maps image could not be captured. Retry, or choose Point diagram.')
        return { kind, dataUrl, ...(shadowSlot ? { shadowSlot } : {}) }
      }
      // Tighter export framing, with room for direction arrows and 360 focus.
      await frame(scenePoints(brief))
      const maps: PdfMapImage[] = []
      for (const kind of brief.imageOverlays.length ? ['floor-plan', 'map'] as const : ['map'] as const) {
        signal.throwIfAborted()
        maps.push(await shoot(kind, kind !== 'floor-plan'))
      }
      if (hasDroneScan(brief.droneScan)) {
        signal.throwIfAborted()
        flushSync(() => setCapturing('drone-scan'))
        await frame(droneScanOutlinePoints(brief.droneScan))
        maps.push(await shoot('drone-scan', true))
      }
      signal.throwIfAborted()
      return maps
    } finally {
      navigation.moveCamera(saved)
      flushSync(() => setCapturing(false))
    }
  }, [root, navigation, view, brief, sourceUrl, setCapturing, shadowSlot])
}

export function waitForMapIdle(map: { addListener: (event: string, callback: () => void) => { remove: () => void } }, signal: AbortSignal, event = 'idle', timeout = 2500) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => { cleanup(); resolve() }
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
    const listener = map.addListener(event, finish)
    // Idle may already have fired for an unchanged frame; the bounded fallback
    // still lets DOM capture await each image's load, without hanging the wizard.
    const timer = window.setTimeout(finish, timeout)
    const cleanup = () => { clearTimeout(timer); listener.remove(); signal.removeEventListener('abort', abort) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}
