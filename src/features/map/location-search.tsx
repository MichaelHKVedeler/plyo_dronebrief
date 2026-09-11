import { useEffect, useRef, useState } from 'react'
import { APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Position } from '@/features/briefs/model/brief'

export function SearchUnavailable({ message }: { message: string }) {
  return <div className="grid gap-2">
    <Label htmlFor="location-search-unavailable">Search location</Label>
    <Input id="location-search-unavailable" placeholder="Search Google Maps" disabled aria-describedby="location-search-help" />
    <p id="location-search-help" className="text-sm text-muted-foreground">{message}</p>
  </div>
}

export function LocationSearch({ position, onPosition }: { position: Position; onPosition: (position: Position) => void }) {
  const status = useApiLoadingStatus()
  const host = useRef<HTMLDivElement>(null)
  const widget = useRef<google.maps.places.PlaceAutocompleteElement | null>(null)
  const onSelect = useRef(onPosition)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => { onSelect.current = onPosition }, [onPosition])
  useEffect(() => {
    if (status !== APILoadingStatus.LOADED) return
    let active = true
    let request = 0
    let cleanup = () => {}
    const initialize = async () => {
      try {
        const places = await google.maps.importLibrary('places') as google.maps.PlacesLibrary
        if (!active || !host.current) return
        const search = new places.PlaceAutocompleteElement({ locationBias: { lat: 59.9139, lng: 10.7522 }, placeholder: 'Search for an address or place' })
        search.setAttribute('aria-label', 'Search location')
        search.classList.add('location-autocomplete')
        search.style.width = '100%'
        search.style.colorScheme = 'light'
        search.style.border = '0'
        search.style.borderRadius = '6px'
        widget.current = search
        const select = async (event: google.maps.places.PlacePredictionSelectEvent) => {
          const current = ++request
          setError('')
          try {
            const place = event.placePrediction.toPlace()
            await place.fetchFields({ fields: ['location'] })
            if (!active || current !== request) return
            if (!place.location) { setError('This result has no location. Choose another result.'); return }
            onSelect.current(place.location.toJSON())
          } catch {
            if (active && current === request) setError('Could not load this location. Please try again.')
          }
        }
        const fail = () => { if (active) setError('Location search is unavailable. Check the Places API configuration or try again later.') }
        search.addEventListener('gmp-select', select)
        search.addEventListener('gmp-error', fail)
        host.current.append(search)
        setReady(true)
        cleanup = () => {
          search.removeEventListener('gmp-select', select)
          search.removeEventListener('gmp-error', fail)
          search.remove()
          widget.current = null
        }
      } catch {
        if (active) setError('Location search could not load. You can still set coordinates in Project.')
      }
    }
    void initialize()
    return () => { active = false; cleanup() }
  }, [status])
  useEffect(() => { if (widget.current) widget.current.locationBias = position }, [position, ready])
  return <div className="grid gap-2">
    <span className="text-sm font-medium">Search location</span>
    <div ref={host} className={ready ? 'rounded-lg border border-input bg-white p-1' : ''} />
    {!ready && <p className="text-sm text-muted-foreground">{status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE ? 'Search is unavailable while Google Maps is disconnected.' : error ? 'Search unavailable.' : 'Loading location search…'}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>
}
