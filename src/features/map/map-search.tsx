import { useEffect, useRef, useState } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { LoaderCircle, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { mapPadding } from './scene-bounds'

export function MapSearch() {
  const map = useMap()
  const geocoding = useMapsLibrary('geocoding')
  const places = useMapsLibrary('places')
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<google.maps.GeocoderResult[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef(0)
  useEffect(() => () => { request.current++; if (timer.current) clearTimeout(timer.current) }, [])
  function clearResults() { request.current++; if (timer.current) clearTimeout(timer.current); setBusy(false); setResults([]); setSuggestions([]); setMessage('') }
  function suggest(value: string) {
    setQuery(value); clearResults()
    if (value.trim().length < 3) { token.current = null; return }
    const current = request.current
    timer.current = setTimeout(async () => {
      if (!places) { setMessage('Suggestions need Places API (New). You can still press Enter to search.'); return }
      setBusy(true)
      try {
        token.current ??= new places.AutocompleteSessionToken()
        const { suggestions: matches } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value.trim(), sessionToken: token.current, locationBias: map?.getBounds(),
        })
        if (current !== request.current) return
        setSuggestions(matches.flatMap((item) => item.placePrediction ? [item.placePrediction] : []).slice(0, 5))
        if (!matches.length) setMessage('No suggestions. Try adding a city or postcode.')
      } catch {
        if (current === request.current) setMessage('Suggestions unavailable. Enable Places API (New) and allow it for your key, or press Enter to search.')
      } finally { if (current === request.current) setBusy(false) }
    }, 350)
  }
  async function choose(prediction: google.maps.places.PlacePrediction) {
    clearResults()
    const current = request.current
    setBusy(true)
    try {
      const place = prediction.toPlace()
      await place.fetchFields({ fields: ['location', 'viewport'] })
      if (current !== request.current) return
      if (place.viewport && map) map.fitBounds(place.viewport, mapPadding(map))
      else if (place.location && map) { map.panTo(place.location); map.setZoom(17) }
      else throw new Error('Missing location')
      setQuery(prediction.text.toString())
    } catch { if (current === request.current) setMessage('Could not load this location. Please try again.') }
    finally { token.current = null; if (current === request.current) setBusy(false) }
  }
  async function search() {
    if (!query.trim() || !map || !geocoding) return
    clearResults()
    const current = ++request.current
    setBusy(true); setResults([]); setMessage('')
    try {
      const { results: matches } = await new geocoding.Geocoder().geocode({ address: query.trim(), bounds: map.getBounds() })
      if (current !== request.current) return
      if (matches.length) setResults(matches.slice(0, 5))
      else setMessage('No locations found. Try adding a city or postcode.')
    } catch (error) {
      if (current !== request.current) return
      const status = typeof error === 'object' && error !== null && 'code' in error ? error.code : error
      if (status === 'ZERO_RESULTS') setMessage('No locations found. Try adding a city or postcode.')
      else if (status === 'REQUEST_DENIED') setMessage('Location search is not enabled for this map. Enable the Geocoding API and allow it for your key; see Google Maps setup in README.')
      else setMessage('Search is unavailable right now. Please try again.')
    } finally {
      if (current === request.current) setBusy(false)
    }
  }
  return <div className="pointer-events-auto relative min-w-0 flex-1 sm:max-w-md" onKeyDown={(event) => { if (event.key === 'Escape') { clearResults(); event.stopPropagation() } }}>
    <form className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm" role="search" aria-label="Find a location" onSubmit={(event) => { event.preventDefault(); void search() }}>
      <Input aria-label="Search street or location" placeholder="Search street or location…" className="min-w-0 border-0 shadow-none" value={query}
        onChange={(event) => suggest(event.target.value)} />
      {query && <Button type="button" variant="ghost" size="icon" aria-label="Clear location search" onClick={() => { setQuery(''); clearResults() }}><X /></Button>}
      <Button type="submit" size="icon" aria-label="Search location" disabled={!query.trim() || !geocoding}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
      </Button>
    </form>
    {(results.length > 0 || suggestions.length > 0 || message) && <Card className="absolute inset-x-0 top-full z-20 mt-2 gap-0 overflow-hidden py-0 shadow-lg"><CardContent className="max-h-48 overflow-y-auto overscroll-contain p-2">
      {message && <p role="status" className="p-2 text-sm">{message}</p>}
      {suggestions.map((prediction) => <Button key={prediction.placeId} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => void choose(prediction)}>{prediction.text.toString()}</Button>)}
      {results.length > 0 && <><p className="px-2 py-1 text-xs text-muted-foreground">Choose a location</p>
        {results.map((result) => <Button key={result.place_id} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => {
          map?.fitBounds(result.geometry.viewport, map ? mapPadding(map) : 40)
          setQuery(result.formatted_address); clearResults()
        }}>{result.formatted_address}</Button>)}
      </>}
    </CardContent></Card>}
  </div>
}
