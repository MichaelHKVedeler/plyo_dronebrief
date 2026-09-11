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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<google.maps.GeocoderResult[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
  function clearResults() { request.current++; setBusy(false); setResults([]); setMessage('') }
  async function search() {
    if (!query.trim() || !map || !geocoding) return
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
  return <div className="absolute inset-x-3 top-3 z-10 max-w-md" onKeyDown={(event) => { if (event.key === 'Escape') { clearResults(); event.stopPropagation() } }}>
    <form className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm" role="search" aria-label="Find a location" onSubmit={(event) => { event.preventDefault(); void search() }}>
      <Input aria-label="Search street or location" placeholder="Search street or location…" className="min-w-0 border-0 shadow-none" value={query}
        onChange={(event) => { setQuery(event.target.value); clearResults() }} />
      {query && <Button type="button" variant="ghost" size="icon" aria-label="Clear location search" onClick={() => { setQuery(''); clearResults() }}><X /></Button>}
      <Button type="submit" size="icon" aria-label="Search location" disabled={busy || !query.trim() || !geocoding}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Search />}
      </Button>
    </form>
    {(results.length > 0 || message) && <Card className="mt-2 gap-0 overflow-hidden py-0 shadow-lg"><CardContent className="max-h-48 overflow-y-auto overscroll-contain p-2">
      {message && <p role="status" className="p-2 text-sm">{message}</p>}
      {results.length > 0 && <><p className="px-2 py-1 text-xs text-muted-foreground">Choose a location</p>
        {results.map((result) => <Button key={result.place_id} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => {
          map?.fitBounds(result.geometry.viewport, map ? mapPadding(map) : 40)
          setQuery(result.formatted_address); clearResults()
        }}>{result.formatted_address}</Button>)}
      </>}
    </CardContent></Card>}
  </div>
}
