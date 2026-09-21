import { afterEach, expect, it } from 'vitest'
import { defaultBriefingPresentation, parsePublicShareRoute, publicShareLink, publicSharePath } from './public-brief-link'

const token = 'x'.repeat(43)

it.each([0, 6, 10, 60, 66, 100, 120, 200, 300])('preserves rendering size %s in shared links, including zero and legacy sizes', (overlaySize) => {
  const path = publicSharePath(token, { ...defaultBriefingPresentation, overlaySize })
  expect(parsePublicShareRoute(path)?.presentation.overlaySize).toBe(overlaySize)
})

afterEach(() => { history.replaceState(null, '', '/') })

it('omits default English presentation from the path', () => {
  expect(publicSharePath(token)).toBe(`/s/${token}`)
  expect(publicSharePath(token, defaultBriefingPresentation)).toBe(`/s/${token}`)
})

it('encodes language, address, overlay size and omitted names in the hash query', () => {
  const path = publicSharePath(token, {
    language: 'nb',
    address: 'Karl Johans gate: Oslo',
    includeProjectName: false,
    includeClientName: true,
    overlaySize: 150,
  })
  const parsed = parsePublicShareRoute(path)
  expect(parsed).toEqual({
    token,
    presentation: { language: 'nb', address: 'Karl Johans gate: Oslo', includeProjectName: false, includeClientName: true, overlaySize: 150 },
  })
})

it('parses a bare token as the default briefing', () => {
  expect(parsePublicShareRoute(`/s/${token}`)).toEqual({ token, presentation: defaultBriefingPresentation })
})

it('rejects malformed public routes', () => {
  expect(parsePublicShareRoute('/s/short')).toBeNull()
  expect(parsePublicShareRoute('/projects/project')).toBeNull()
  expect(parsePublicShareRoute(`/s/${token}extra`)).toBeNull()
})

it('builds an origin link from the current location', () => {
  history.replaceState(null, '', '/app?x=1')
  expect(publicShareLink(token, { language: 'nb', address: '', includeProjectName: true, includeClientName: false, overlaySize: 100 }))
    .toBe(`${location.origin}/app?x=1#/s/${token}?lang=nb&client=0`)
})
