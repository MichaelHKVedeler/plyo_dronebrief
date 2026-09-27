import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { createBrief } from '@/features/briefs/model/brief'
import type { PdfMapCapture } from '@/features/briefs/export/pdf-types'
import { usePdfMapCapture } from './use-pdf-map-capture'
const capture = vi.hoisted(() => ({ image: vi.fn(async () => 'data:image/png;base64,test') }))
vi.mock('html-to-image', () => ({ toPng: capture.image }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
function setup(images = false, scan = false, extras = false) {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  const brief = createBrief({ name: 'Map export', clientName: 'Test' })
  if (images) brief.imageOverlays = [{ id: 'img', name: 'Plan', source: 'data:image/png;base64,test', position: brief.coordinates, widthMeters: 20, heightMeters: 20, rotationDegrees: 0, opacity: 1 }]
  if (scan) brief.droneScan = { id: 'scan', highRes: { id: 'high', position: brief.coordinates, radiusMeters: 20 }, lowRes: { id: 'low', position: brief.coordinates, radiusMeters: 50 } }
  if (extras) brief.angles = [{ id: 'extra', label: 'Extra coverage 1', type: 'extra-coverage', position: brief.coordinates }]
  const root = document.createElement('div'), surface = document.createElement('div')
  surface.dataset.pdfMapSurface = ''
  Object.defineProperties(surface, { clientWidth: { value: 640 }, clientHeight: { value: 400 } })
  root.append(surface)
  const ref = createRef<PdfMapCapture>()
  const navigation = { getDiv: () => root, getZoom: () => 19, getBounds: () => undefined, panTo: vi.fn(), fitBounds: vi.fn(), setZoom: vi.fn(), moveCamera: vi.fn(), waitForIdle: vi.fn(async () => {}) }
  const setCapturing = vi.fn(), sourceUrl = vi.fn((): string | undefined => 'data:image/png;base64,test')
  const view = { current: { center: brief.coordinates, zoom: 14 } }
  renderHook(() => usePdfMapCapture(ref, { root: { current: root }, navigation, view, brief, sourceUrl, setCapturing }))
  return { ref, navigation, setCapturing, view, sourceUrl, surface }
}
it('exports both floor-plan and clean map views, then restores the original view', async () => {
  const { ref, navigation, setCapturing, view } = setup(true)
  let result
  await act(async () => { result = await ref.current!(new AbortController().signal) })
  expect(result).toEqual([{ kind: 'floor-plan', dataUrl: 'data:image/png;base64,test' }, { kind: 'map', dataUrl: 'data:image/png;base64,test' }])
  expect(navigation.setZoom).toHaveBeenCalledWith(18.5)
  expect(navigation.moveCamera).toHaveBeenLastCalledWith(view.current)
  expect(setCapturing.mock.calls.map(([value]) => value)).toEqual(['full', false])
})
it('captures an extra map framed on the drone scan', async () => {
  const { ref, navigation, setCapturing } = setup(false, true)
  let result
  await act(async () => { result = await ref.current!(new AbortController().signal) })
  expect(result).toEqual([
    { kind: 'map', dataUrl: 'data:image/png;base64,test' },
    { kind: 'drone-scan', dataUrl: 'data:image/png;base64,test' },
  ])
  expect(navigation.fitBounds).toHaveBeenCalledTimes(2)
  expect(setCapturing.mock.calls.map(([value]) => value)).toEqual(['full', 'drone-scan', false])
})
it('restores rendering and navigation when screenshot capture fails', async () => {
  const { ref, navigation, setCapturing, view } = setup()
  capture.image.mockRejectedValueOnce(new Error('Capture failed'))
  await act(async () => { await expect(ref.current!(new AbortController().signal)).rejects.toThrow('Capture failed') })
  expect(navigation.moveCamera).toHaveBeenLastCalledWith(view.current)
  expect(setCapturing).toHaveBeenLastCalledWith(false)
})
it('requires missing local images to be reconnected before touching the map', async () => {
  const { ref, sourceUrl, navigation } = setup(true)
  sourceUrl.mockReturnValue(undefined)
  await expect(ref.current!(new AbortController().signal)).rejects.toThrow('Reconnect')
  expect(navigation.fitBounds).not.toHaveBeenCalled()
})
it('rejects a provider loading error instead of including it in the PDF', async () => {
  const { ref, surface, navigation, view, setCapturing } = setup()
  surface.innerHTML = '<p data-pdf-map-unavailable role="status">Shadows could not load.</p>'
  await act(async () => { await expect(ref.current!(new AbortController().signal)).rejects.toThrow('loading error') })
  expect(capture.image).not.toHaveBeenCalled()
  expect(navigation.moveCamera).toHaveBeenLastCalledWith(view.current)
  expect(setCapturing).toHaveBeenLastCalledWith(false)
})

it('exports a scan page when extra coverage exists without scan circles', async () => {
  const { ref, setCapturing } = setup(false, false, true)
  await act(async () => {
    const result = await ref.current!(new AbortController().signal)
    expect(result.map((image) => image.kind)).toEqual(['map', 'drone-scan'])
  })
  expect(setCapturing.mock.calls.map(([value]) => value)).toEqual(['full', 'drone-scan', false])
})
