import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { Map as LibreMap } from 'maplibre-gl'
import { ImageLayer } from './image-layer'
import { imageAnchorRadius } from './image-geometry'
import { ShadeProjection } from './shade-projection'
import type { ImageLayerState } from './image-interaction'

const mocks = vi.hoisted(() => ({ map: null as unknown }))
vi.mock('@vis.gl/react-google-maps', () => ({ useMap: () => mocks.map }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.map = null; document.body.replaceChildren() })
const state: ImageLayerState = {
  images: [{ id: 'image', name: 'Plan', source: 'data:image/png;base64,AAAA', position: { lat: 0, lng: 0 }, widthMeters: 100, heightMeters: 60, rotationDegrees: 0, opacity: 1 }],
  editable: false, interactive: false, selectedId: null, anchors: {}, sourceUrl: () => 'blob:test',
  onSelect: vi.fn(), onAnchor: vi.fn(), onCommit: vi.fn(),
}

it('keeps Google imagery in pane coordinates throughout fractional zoom', () => {
  const surface = document.createElement('div')
  document.body.append(surface)
  mocks.map = { getDiv: () => surface }
  let draw = () => {}
  let scale = 1
  const containerProject = vi.fn(() => ({ x: 999, y: 999 }))
  vi.stubGlobal('google', { maps: {
    LatLng: class {
      point: { lat: number; lng: number }
      constructor(point: { lat: number; lng: number }) { this.point = point }
    },
    OverlayView: class {
      getProjection() { return {
        fromLatLngToDivPixel: ({ point }: { point: { lat: number; lng: number } }) => ({ x: point.lng * scale, y: -point.lat * scale }),
        fromLatLngToContainerPixel: containerProject,
      } }
      getPanes() { return { overlayLayer: surface } }
      onAdd() {} draw() {} onRemove() {}
      setMap(map: unknown) { if (map) { this.onAdd(); draw = () => this.draw(); draw() } else this.onRemove() }
    },
  } })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  render(<ImageLayer {...state} />)
  const svg = surface.querySelector('svg')!
  const image = svg.querySelector('image')!
  const initial = image.getAttribute('transform')!
  const insert = vi.spyOn(svg, 'insertBefore')
  scale = 2 ** 0.5; draw()
  expect(image.getAttribute('transform')).not.toBe(initial)
  scale = 1; draw()
  expect(image.getAttribute('transform')).toBe(initial)
  expect(containerProject).not.toHaveBeenCalled()
  expect(svg.style.left).toBe('0px')
  expect(svg.style.overflow).toBe('visible')
  expect(insert).not.toHaveBeenCalled()
})

it('draws the selected anchor as a round primary control', () => {
  const surface = document.createElement('div')
  surface.innerHTML = '<div data-map></div><div data-image-host></div>'
  document.body.append(surface)
  const map = {
    getContainer: () => surface.firstElementChild,
    project: ([lng, lat]: number[]) => ({ x: lng + 40, y: lat + 24 }),
    on: () => {}, off: vi.fn(),
  }
  render(<ShadeProjection value={map as unknown as LibreMap}><ImageLayer {...state} editable interactive selectedId="image" /></ShadeProjection>)
  const anchor = surface.querySelector('[data-image-anchor]')!
  const disc = anchor.querySelector('circle')!
  expect(disc.getAttribute('fill')).toBe('var(--card)')
  expect(disc.getAttribute('stroke')).toBe('var(--primary)')
  expect(disc.getAttribute('r')).toBe(String(imageAnchorRadius - 1))
  expect(anchor.querySelector('path')!.getAttribute('stroke')).toBe('var(--primary)')
  expect(anchor.getAttribute('transform')).toBe('translate(40 24)')
  expect(anchor.getAttribute('stroke')).toBeNull()
})

it('updates ShadeMap imagery in each render frame without reinserting the image', () => {
  const surface = document.createElement('div')
  surface.innerHTML = '<div data-map></div><div data-image-host></div>'
  document.body.append(surface)
  let draw = () => {}
  let scale = 1
  const map = {
    getContainer: () => surface.firstElementChild,
    project: ([lng, lat]: number[]) => ({ x: lng * scale, y: -lat * scale }),
    on: (_event: string, callback: () => void) => { draw = callback }, off: vi.fn(),
  }
  render(<ShadeProjection value={map as unknown as LibreMap}><ImageLayer {...state} /></ShadeProjection>)
  const svg = surface.querySelector('svg')!
  const image = svg.querySelector('image')!
  const initial = image.getAttribute('transform')
  const insert = vi.spyOn(svg, 'insertBefore')
  scale = 2 ** 0.25; draw()
  expect(image.getAttribute('transform')).not.toBe(initial)
  scale = 1; draw()
  expect(image.getAttribute('transform')).toBe(initial)
  expect(insert).not.toHaveBeenCalled()
})
