import type { Position } from '@/features/briefs/model/brief'
import { distanceMeters } from './geometry'

type AddressResult = Pick<google.maps.GeocoderResult, 'address_components' | 'geometry'>
export function nearestStreetAddress(results: AddressResult[], position: Position) {
  const component = (result: AddressResult, type: string) => result.address_components.find((part) => part.types.includes(type))?.long_name
  const streets = results.filter((result) => component(result, 'route')).sort((a, b) =>
    distanceMeters(position, a.geometry.location.toJSON()) - distanceMeters(position, b.geometry.location.toJSON()))
  const result = streets[0]
  if (!result) return null
  const street = [component(result, 'route'), component(result, 'street_number')].filter(Boolean).join(' ')
  const areaTypes = ['neighborhood', 'sublocality_level_1', 'sublocality', 'postal_town', 'locality', 'administrative_area_level_2']
  const area = areaTypes.map((type) => component(result, type)).find(Boolean)
  return area ? `${street}: ${area}` : street
}

export async function lookupPdfAddress(position: Position, signal: AbortSignal): Promise<string> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(abort, 8000)
  try {
    signal.throwIfAborted()
    // The map may still be loading when the wizard is opened immediately.
    while (!window.google?.maps?.importLibrary) {
      controller.signal.throwIfAborted()
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return await new Promise<string>((resolve, reject) => {
      const cancelled = () => reject(new Error('Address lookup is unavailable. Enter a street address and area, or retry.'))
      controller.signal.addEventListener('abort', cancelled, { once: true })
      if (controller.signal.aborted) { cancelled(); return }
      void (async () => {
        try {
          const { Geocoder } = await google.maps.importLibrary('geocoding') as google.maps.GeocodingLibrary
          const { results } = await new Geocoder().geocode({ location: position })
          const address = nearestStreetAddress(results, position)
          if (!address) throw new Error('No nearby street found. Enter a custom address and area.')
          resolve(address)
        } catch { reject(new Error('No nearby street could be found. Enter a custom address and area, or retry.')) }
        finally { controller.signal.removeEventListener('abort', cancelled) }
      })()
    })
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
}
