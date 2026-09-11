import { briefSchema, type DroneBrief } from '../model/brief'

const PREFIX = 'DB1.'
const MAX_JSON_BYTES = 2_000_000
const MAX_KEY_CHARS = Math.ceil(MAX_JSON_BYTES * 4 / 3) + 8

// A portable snapshot, not a backend identifier, encryption or an access token.
export function exportBriefKey(brief: DroneBrief): string {
  const bytes = new TextEncoder().encode(JSON.stringify(briefSchema.parse(brief)))
  if (bytes.length > MAX_JSON_BYTES) throw new Error('This brief is too large to export as a key.')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return PREFIX + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function importBriefKey(input: string): DroneBrief {
  const key = input.trim()
  if (key.length > MAX_KEY_CHARS) throw new Error('This key is too large.')
  if (!key.startsWith(PREFIX)) throw new Error('Enter a Dronebrief key beginning with DB1.')
  try {
    const payload = key.slice(PREFIX.length)
    if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error('Invalid encoding')
    const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/'))
    if (binary.length > MAX_JSON_BYTES) throw new Error('Oversized payload')
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return briefSchema.parse(JSON.parse(json))
  } catch {
    throw new Error('This key is incomplete, invalid, or uses an unsupported brief version.')
  }
}
