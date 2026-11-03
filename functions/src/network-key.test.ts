// @vitest-environment node
import { expect, it } from 'vitest'
import { requestNetworkKey } from './network-key'

it('ignores forged forwarding prefixes and uses only the final hop', () => {
  expect(requestNetworkKey({ 'x-forwarded-for': '198.51.100.2, 203.0.113.8' })).toBe('203.0.113.8')
  expect(requestNetworkKey({ 'x-forwarded-for': 'attacker, 1.2.3.4, 203.0.113.8' })).toBe('203.0.113.8')
})
it('shares a fallback bucket rather than trusting malformed or missing hops', () => {
  for (const value of [undefined, '', '1.2.3.4, nonsense', '1.2.3.4,', ['1.2.3.4'], 'x'.repeat(4097), 'fe80::1%eth0']) {
    expect(requestNetworkKey({ 'x-forwarded-for': value })).toBe('unknown')
  }
})
it('normalizes equivalent addresses and groups IPv6 privacy addresses', () => {
  expect(requestNetworkKey({ 'x-forwarded-for': '::ffff:192.0.2.1' })).toBe('192.0.2.1')
  expect(requestNetworkKey({ 'x-forwarded-for': '::ffff:c000:201' })).toBe('192.0.2.1')
  expect(requestNetworkKey({ 'x-forwarded-for': '2001:0db8:0001:0002::3' })).toBe('2001:db8:1:2::/64')
  expect(requestNetworkKey({ 'x-forwarded-for': '2001:db8:1:2:ffff::8' })).toBe('2001:db8:1:2::/64')
})
