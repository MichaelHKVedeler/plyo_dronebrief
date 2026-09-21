import type { PdfLanguage } from '../export/pdf-copy'

export const publicShareTokenPattern = /^[A-Za-z0-9_-]{43}$/
// URL values remain rendering percentages for compatibility with existing links.
export const minOverlaySize = 0
export const maxOverlaySize = 300
export const defaultOverlaySize = 100

export type BriefingPresentation = {
  language: PdfLanguage
  address: string
  includeProjectName: boolean
  includeClientName: boolean
  overlaySize: number
}

export const defaultBriefingPresentation: BriefingPresentation = {
  language: 'en',
  address: '',
  includeProjectName: true,
  includeClientName: true,
  overlaySize: defaultOverlaySize,
}

export function clampOverlaySize(value: number) {
  if (!Number.isFinite(value)) return defaultOverlaySize
  const stepped = Math.round(value)
  return Math.min(maxOverlaySize, Math.max(minOverlaySize, stepped))
}

export function publicSharePath(token: string, presentation: BriefingPresentation = defaultBriefingPresentation) {
  const params = new URLSearchParams()
  if (presentation.language !== 'en') params.set('lang', presentation.language)
  if (presentation.address.trim()) params.set('address', presentation.address.trim())
  if (!presentation.includeProjectName) params.set('project', '0')
  if (!presentation.includeClientName) params.set('client', '0')
  const overlaySize = clampOverlaySize(presentation.overlaySize)
  if (overlaySize !== defaultOverlaySize) params.set('size', String(overlaySize))
  const query = params.toString()
  return query ? `/s/${token}?${query}` : `/s/${token}`
}

export function publicShareLink(token: string, presentation?: BriefingPresentation) {
  return `${location.origin}${location.pathname}${location.search}#${publicSharePath(token, presentation)}`
}

export function parsePublicShareRoute(route: string): { token: string; presentation: BriefingPresentation } | null {
  if (!route.startsWith('/s/')) return null
  const rest = route.slice(3)
  const separator = rest.indexOf('?')
  const token = separator === -1 ? rest : rest.slice(0, separator)
  if (!publicShareTokenPattern.test(token)) return null
  const params = new URLSearchParams(separator === -1 ? '' : rest.slice(separator + 1))
  const size = params.get('size')
  return {
    token,
    presentation: {
      language: params.get('lang') === 'nb' ? 'nb' : 'en',
      address: (params.get('address') ?? '').slice(0, 200),
      includeProjectName: params.get('project') !== '0',
      includeClientName: params.get('client') !== '0',
      overlaySize: size === null || size === '' ? defaultOverlaySize : clampOverlaySize(Number(size)),
    },
  }
}
