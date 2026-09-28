import { afterEach, expect, it } from 'vitest'
import { defaultBriefingPresentation, parsePublicShareRoute, projectSlug, publicShareLink, publicSharePath } from './public-brief-link'

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
    content: 'all',
    language: 'nb',
    address: 'Karl Johans gate: Oslo',
    includeProjectName: false,
    includeClientName: true,
    overlaySize: 150,
  })
  const parsed = parsePublicShareRoute(path)
  expect(parsed).toEqual({
    token,
    presentation: { content: 'all', language: 'nb', address: 'Karl Johans gate: Oslo', includeProjectName: false, includeClientName: true, overlaySize: 150 },
  })
})

it('parses a bare token as the default briefing', () => {
  expect(parsePublicShareRoute(`/s/${token}`)).toEqual({ token, presentation: defaultBriefingPresentation })
})

it.each([['photo', 'photobrief'], ['scan', 'dronescan']] as const)('builds a short %s link with the kind and project name', (content, segment) => {
  const presentation = { ...defaultBriefingPresentation, content, address: null }
  const path = publicSharePath(token, presentation, 'Villa Ærø – Solbakken 2')
  expect(path).toBe(`/${segment}/villa-aero-solbakken-2/${token}`)
  expect(parsePublicShareRoute(path)).toEqual({ token, presentation })
  expect(parsePublicShareRoute(`/${segment}/${token}`)).toEqual({ token, presentation })
})

it('keeps non-default split link settings and hides the name when the project name is omitted', () => {
  const presentation = { content: 'scan' as const, language: 'nb' as const, address: '', includeProjectName: false, includeClientName: true, overlaySize: 150 }
  const path = publicSharePath(token, presentation, 'Secret project')
  expect(path).toBe(`/dronescan/${token}?lang=nb&address=&project=0&size=150`)
  expect(parsePublicShareRoute(path)?.presentation).toEqual(presentation)
  expect(parsePublicShareRoute(`/photobrief/p/${token}?address=Storgata%201%3A%20Oslo`)?.presentation.address).toBe('Storgata 1: Oslo')
})

it('limits project names to a short readable slug', () => {
  expect(projectSlug('  Ålesund Havn / Kai 3!  ')).toBe('alesund-havn-kai-3')
  expect(projectSlug('x'.repeat(60))).toHaveLength(40)
  expect(projectSlug('!!!')).toBe('')
})

it('rejects malformed public routes', () => {
  expect(parsePublicShareRoute('/s/short')).toBeNull()
  expect(parsePublicShareRoute('/projects/project')).toBeNull()
  expect(parsePublicShareRoute(`/s/${token}extra`)).toBeNull()
  expect(parsePublicShareRoute(`/dronescan/Bad Name/${token}`)).toBeNull()
  expect(parsePublicShareRoute(`/photobrief/${token}/extra`)).toBeNull()
})

it('builds an origin link from the current location', () => {
  history.replaceState(null, '', '/app?x=1')
  expect(publicShareLink(token, { content: 'all', language: 'nb', address: '', includeProjectName: true, includeClientName: false, overlaySize: 100 }))
    .toBe(`${location.origin}/app?x=1#/s/${token}?lang=nb&client=0&size=100`)
})
