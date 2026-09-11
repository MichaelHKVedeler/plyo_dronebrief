import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ExportQr, MAX_QR_KEY_CHARS } from './export-qr'
const qr = vi.hoisted(() => ({ toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') }))
vi.mock('qrcode', () => qr)
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('encodes the complete key locally and offers the generated image for download', async () => {
  render(<ExportQr shareKey="DB2.example" />)
  expect(await screen.findByAltText('QR code containing this brief’s export key')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
  expect(qr.toDataURL).toHaveBeenCalledWith('DB2.example', expect.objectContaining({ errorCorrectionLevel: 'M', margin: 4 }))
  expect(screen.getByRole('link', { name: 'Download QR code' })).toHaveAttribute('download', 'dronebrief-qr.png')
})
it('keeps oversized snapshots available as keys without generating a truncated QR', () => {
  render(<ExportQr shareKey={'a'.repeat(MAX_QR_KEY_CHARS + 1)} />)
  expect(screen.getByText(/too large for one QR code/)).toBeVisible()
  expect(qr.toDataURL).not.toHaveBeenCalled()
})
