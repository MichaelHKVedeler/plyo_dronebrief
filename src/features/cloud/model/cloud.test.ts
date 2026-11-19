import { expect, it } from 'vitest'
import { previewImage } from './cloud'

it('accepts only a small JPEG data URL as a card picture', () => {
  expect(previewImage.safeParse('data:image/jpeg;base64,/9j/AAAA').success).toBe(true)
  for (const bad of ['data:image/svg+xml;base64,AAAA', 'data:image/jpeg;base64,AAAA', 'https://example.test/a.jpg', 'data:image/jpeg;base64,/9j/AA" onerror="x', 'data:image/jpeg;base64,/9j/' + 'A'.repeat(150_000)]) {
    expect(previewImage.safeParse(bad).success, bad.slice(0, 40)).toBe(false)
  }
})
