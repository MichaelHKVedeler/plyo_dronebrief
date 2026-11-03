import { isIP } from 'node:net'

// Only the last forwarding hop is considered. Never trust request.ip or the
// client-controlled XFF prefix. This can conservatively group a Google proxy;
// identity/share/global budgets remain authoritative regardless of this key.
export function requestNetworkKey(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded !== 'string' || forwarded.length > 4096) return 'unknown'
  const last = forwarded.split(',').at(-1)?.trim() ?? ''
  const kind = isIP(last)
  if (kind === 4) return last
  if (kind !== 6 || last.includes('%')) return 'unknown'
  const canonical = new URL(`http://[${last}]/`).hostname.slice(1, -1)
  if (canonical.startsWith('::ffff:')) {
    const words = canonical.slice(7).split(':')
    if (words.length === 2) {
      const high = Number.parseInt(words[0], 16); const low = Number.parseInt(words[1], 16)
      return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
    }
  }
  // IPv6 privacy-address rotation should not create a new network budget.
  const [left, right] = canonical.split('::')
  const first = left ? left.split(':') : []
  const lastWords = right ? right.split(':') : []
  const words = right === undefined ? first : [...first, ...Array<string>(8 - first.length - lastWords.length).fill('0'), ...lastWords]
  return `${words.slice(0, 4).join(':')}::/64`
}
