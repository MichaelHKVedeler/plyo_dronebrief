import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { ImageOverlay, Position } from '@/features/briefs/model/brief'
import { ShadeProjection } from './shade-projection'
import { imageAnchorRadius, imageCorners } from './image-geometry'
import { attachImageInteraction, type ImageLayerState, type ImageProjection } from './image-interaction'

const ns = 'http://www.w3.org/2000/svg'
function createImageCanvas(getState: () => ImageLayerState, projection: ImageProjection) {
  const svg = document.createElementNS(ns, 'svg')
  svg.dataset.imageLayer = ''
  svg.setAttribute('aria-hidden', 'true')
  Object.assign(svg.style, { position: 'absolute', pointerEvents: 'none', overflow: 'hidden' })
  const images = new Map<string, SVGImageElement>()
  const outline = document.createElementNS(ns, 'polygon')
  outline.setAttribute('fill', 'none'); outline.setAttribute('stroke', '#ffffff'); outline.setAttribute('stroke-width', '2')
  outline.setAttribute('stroke-dasharray', '6 4')
  const anchor = document.createElementNS(ns, 'g')
  anchor.dataset.imageAnchor = ''
  anchor.style.filter = 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.16)) drop-shadow(0 4px 6px rgb(0 0 0 / 0.12))'
  const disc = document.createElementNS(ns, 'circle')
  // Stroke is centered on the radius, so the disc's outer edge matches an icon-sm handle.
  disc.setAttribute('r', String(imageAnchorRadius - 1))
  disc.setAttribute('fill', 'var(--card)')
  disc.setAttribute('stroke', 'var(--primary)')
  disc.setAttribute('stroke-width', '2')
  const mark = document.createElementNS(ns, 'path')
  mark.setAttribute('d', 'M -8 0 H -3.5 M 3.5 0 H 8 M 0 -8 V -3.5 M 0 3.5 V 8')
  mark.setAttribute('fill', 'none')
  mark.setAttribute('stroke', 'var(--primary)')
  mark.setAttribute('stroke-width', '2')
  mark.setAttribute('stroke-linecap', 'round')
  const dot = document.createElementNS(ns, 'circle')
  dot.setAttribute('r', '1.6')
  dot.setAttribute('fill', 'var(--primary)')
  anchor.append(disc, mark, dot)
  svg.append(outline, anchor)
  const draw = (preview: ImageOverlay | null, previewAnchor: Position | null = null) => {
    const state = getState()
    for (const [id, image] of images) if (!state.images.some((overlay) => overlay.id === id && state.sourceUrl(overlay))) { image.remove(); images.delete(id) }
    for (const saved of state.images) {
      const overlay = preview?.id === saved.id ? preview : saved
      const url = state.sourceUrl(overlay)
      if (!url) continue
      let image = images.get(overlay.id)
      if (!image) {
        image = document.createElementNS(ns, 'image'); images.set(overlay.id, image)
        image.dataset.imageOverlay = overlay.id
        image.setAttribute('width', '1'); image.setAttribute('height', '1'); image.setAttribute('preserveAspectRatio', 'none')
      }
      // Keep image nodes attached during zoom; reinsertion can invalidate the
      // browser's decoded SVG image/compositing state on every map frame.
      const index = state.images.filter((item) => state.sourceUrl(item)).findIndex((item) => item.id === overlay.id)
      if (svg.children[index] !== image) svg.insertBefore(image, svg.children[index] ?? outline)
      if (image.getAttribute('href') !== url) image.setAttribute('href', url)
      const corners = imageCorners(overlay).map(projection.project)
      const [a, b, , d] = corners
      if (!a || !b || !d) { image.style.display = 'none'; continue }
      image.style.display = ''
      image.setAttribute('transform', `matrix(${b.x - a.x} ${b.y - a.y} ${d.x - a.x} ${d.y - a.y} ${a.x} ${a.y})`)
      image.setAttribute('opacity', String(overlay.opacity))
    }
    const selected = state.images.find((image) => image.id === state.selectedId)
    outline.style.display = anchor.style.display = 'none'
    if (selected && state.editable && state.interactive && state.sourceUrl(selected)) {
      const overlay = preview?.id === selected.id ? preview : selected
      const corners = imageCorners(overlay).map(projection.project)
      if (corners.every(Boolean)) { outline.setAttribute('points', corners.map((p) => `${p!.x},${p!.y}`).join(' ')); outline.style.display = '' }
      const p = projection.project(previewAnchor ?? state.anchors[selected.id] ?? overlay.position)
      if (p) {
        anchor.setAttribute('transform', `translate(${p.x} ${p.y})`)
        anchor.style.display = ''
      }
    }
  }
  return { svg, draw }
}

// Both providers use this renderer and gesture controller. Only projection and
// the layer attachment differ; imagery never enters either provider's API.
export function ImageLayer(props: ImageLayerState) {
  const googleMap = useMap()
  const shadeMap = useContext(ShadeProjection)
  const latest = useRef(props)
  const redraw = useRef<(() => void) | null>(null)
  useLayoutEffect(() => { latest.current = props; redraw.current?.() })
  useEffect(() => {
    let preview: ImageOverlay | null = null
    let previewAnchor: Position | null = null
    let paint = () => {}
    const show = (image: ImageOverlay | null, anchor?: Position | null) => { preview = image; previewAnchor = anchor ?? null; paint() }
    if (shadeMap) {
      const surface = shadeMap.getContainer().parentElement!
      const projection: ImageProjection = {
        project: (p) => shadeMap.project([p.lng, p.lat]),
        unproject: (p) => { const point = shadeMap.unproject([p.x, p.y]); return { lat: point.lat, lng: point.lng } },
      }
      const canvas = createImageCanvas(() => latest.current, projection)
      Object.assign(canvas.svg.style, { inset: '0', width: '100%', height: '100%' })
      // The dedicated host is above the basemap/dimmer and below brief icons.
      surface.querySelector('[data-image-host]')!.append(canvas.svg)
      paint = () => canvas.draw(preview, previewAnchor)
      const draw = () => paint()
      redraw.current = draw
      shadeMap.on('render', draw)
      const detach = attachImageInteraction(surface, projection, () => latest.current, show)
      draw()
      return () => { detach(); shadeMap.off('render', draw); canvas.svg.remove(); redraw.current = null }
    }
    if (!googleMap) return
    const surface = googleMap.getDiv()
    let overlay: google.maps.OverlayView
    const projection: ImageProjection = {
      project: (p) => overlay.getProjection()?.fromLatLngToContainerPixel(new google.maps.LatLng(p)) ?? null,
      unproject: (p) => overlay.getProjection()?.fromContainerPixelToLatLng(new google.maps.Point(p.x, p.y))?.toJSON() ?? null,
    }
    // The pane is animated by Google. Render in its own pixel coordinates;
    // container pixels are only for pointer hit testing, outside that pane.
    const canvas = createImageCanvas(() => latest.current, {
      ...projection,
      project: (p) => overlay.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(p)) ?? null,
    })
    Object.assign(canvas.svg.style, { left: '0', top: '0', width: '1px', height: '1px', overflow: 'visible' })
    class Images extends google.maps.OverlayView {
      onAdd() { this.getPanes()?.overlayLayer.append(canvas.svg) }
      draw() {
        canvas.draw(preview, previewAnchor)
      }
      onRemove() { canvas.svg.remove() }
    }
    overlay = new Images()
    paint = () => overlay.draw()
    redraw.current = paint
    overlay.setMap(googleMap)
    const detach = attachImageInteraction(surface, projection, () => latest.current, show)
    const resize = new ResizeObserver(() => overlay.draw())
    resize.observe(surface)
    return () => { detach(); resize.disconnect(); overlay.setMap(null); redraw.current = null }
  }, [googleMap, shadeMap, props.interactive, props.editable])
  return null
}
