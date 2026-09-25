import { describe, expect, it } from 'vitest'
import { createBrief } from '@/features/briefs/model/brief'
import { editorMapView, staticMapUrl } from './map-view'

describe('editor map thumbnails', () => {
  const brief = createBrief({ name: 'Frame', clientName: 'Client', date: '2026-09-11', times: ['09:00'] })
  it('uses the editor default for an empty Oslo brief and a world view at the origin', () => {
    expect(editorMapView(brief)).toEqual({ lat: 59.9139, lng: 10.7522, zoom: 10 })
    expect(editorMapView({ ...brief, coordinates: { lat: 0, lng: 0 } })).toEqual({ lat: 0, lng: 0, zoom: 2 })
  })
  it('zooms out when the scene covers more ground', () => {
    const tight = editorMapView({ ...brief, angles: [{ id: 'a', label: 'A', type: '360', position: { lat: 59.91, lng: 10.75 } }] })
    const wide = editorMapView({ ...brief, angles: [{ id: 'a', label: 'A', type: '360', position: { lat: 59, lng: 10 } }, { id: 'b', label: 'B', type: '360', position: { lat: 60, lng: 11 } }] })
    expect(wide.zoom).toBeLessThan(tight.zoom)
    expect(wide.lat).toBeGreaterThan(59); expect(wide.lat).toBeLessThan(60)
  })
  it('requests a satellite static map of that frame', () => {
    const url = new URL(staticMapUrl({ lat: 59.9, lng: 10.7, zoom: 16 }, 'test-key'))
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/staticmap')
    expect(url.searchParams.get('maptype')).toBe('satellite')
    expect(url.searchParams.get('zoom')).toBe('16')
    expect(url.searchParams.get('center')).toBe('59.9,10.7')
    expect(url.searchParams.get('key')).toBe('test-key')
  })
})
