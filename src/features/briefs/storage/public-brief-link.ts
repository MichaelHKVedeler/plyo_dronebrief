import type { PdfLanguage } from '../export/pdf-copy'
import { defaultOverlaySize } from '@/features/map/map-object-scale'

export { defaultOverlaySize }

export const publicShareTokenPattern = /^[A-Za-z0-9_-]{43}$/
export const minOverlaySize = 0
export const maxOverlaySize = 300
export const maxProjectSlugLength = 40

/** Which part of the brief a public link presents. Legacy `/s/` links show everything. */
export type BriefingContent = 'all' | 'photo' | 'scan'

export type BriefingPresentation = {
  content: BriefingContent
  language: PdfLanguage
  /** `null` means the briefing looks up the address from the brief location itself. */
  address: string | null
  includeProjectName: boolean
  includeClientName: boolean
  overlaySize: number
}

export const defaultBriefingPresentation: BriefingPresentation = {
  content: 'all',
  language: 'en',
  address: '',
  includeProjectName: true,
  includeClientName: true,
  overlaySize: defaultOverlaySize,
}

const contentSegments = { photo: 'photobrief', scan: 'dronescan' } as const

export function clampOverlaySize(value: number) {
  if (!Number.isFinite(value)) return defaultOverlaySize
  const stepped = Math.round(value)
  return Math.min(maxOverlaySize, Math.max(minOverlaySize, stepped))
}

/** Readable, decorative project name for links; never used to find the project. */
export function projectSlug(name: string) {
  return name.toLowerCase()
    .replaceAll('æ', 'ae').replaceAll('ø', 'o').replaceAll('å', 'a')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, maxProjectSlugLength).replace(/-+$/, '')
}

/**
 * Photo brief and drone scan links use `/photobrief/<project>/<token>` and `/dronescan/<project>/<token>`,
 * omitting default settings. The project segment is left out when the project name is hidden.
 */
export function publicSharePath(token: string, presentation: BriefingPresentation = defaultBriefingPresentation, projectName = '') {
  const params = new URLSearchParams()
  if (presentation.language !== 'en') params.set('lang', presentation.language)
  if (presentation.address !== null && (presentation.content !== 'all' || presentation.address.trim())) params.set('address', presentation.address.trim())
  if (!presentation.includeProjectName) params.set('project', '0')
  if (!presentation.includeClientName) params.set('client', '0')
  const overlaySize = clampOverlaySize(presentation.overlaySize)
  if (overlaySize !== defaultOverlaySize) params.set('size', String(overlaySize))
  const query = params.toString()
  const slug = presentation.includeProjectName ? projectSlug(projectName) : ''
  const path = presentation.content === 'all' ? `/s/${token}` : `/${contentSegments[presentation.content]}/${slug ? `${slug}/` : ''}${token}`
  return query ? `${path}?${query}` : path
}

export function publicShareLink(token: string, presentation?: BriefingPresentation, projectName?: string) {
  return `${location.origin}${location.pathname}${location.search}#${publicSharePath(token, presentation, projectName)}`
}

const splitRoute = /^\/(photobrief|dronescan)\/(?:[a-z0-9-]{1,40}\/)?([A-Za-z0-9_-]{43})$/

export function parsePublicShareRoute(route: string): { token: string; presentation: BriefingPresentation } | null {
  const separator = route.indexOf('?')
  const path = separator === -1 ? route : route.slice(0, separator)
  const params = new URLSearchParams(separator === -1 ? '' : route.slice(separator + 1))
  let token: string
  let content: BriefingContent
  const split = splitRoute.exec(path)
  if (split) {
    token = split[2]
    content = split[1] === 'dronescan' ? 'scan' : 'photo'
  } else if (path.startsWith('/s/') && publicShareTokenPattern.test(path.slice(3))) {
    token = path.slice(3)
    content = 'all'
  } else return null
  const size = params.get('size')
  const address = params.get('address')
  return {
    token,
    presentation: {
      content,
      language: params.get('lang') === 'nb' ? 'nb' : 'en',
      // Legacy links without an address show none; split links look it up.
      address: address === null ? (content === 'all' ? '' : null) : address.slice(0, 200),
      includeProjectName: params.get('project') !== '0',
      includeClientName: params.get('client') !== '0',
      overlaySize: size === null || size === '' ? defaultOverlaySize : clampOverlaySize(Number(size)),
    },
  }
}
