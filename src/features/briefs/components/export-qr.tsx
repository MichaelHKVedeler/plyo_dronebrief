import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Capacity headroom at medium error correction; larger snapshots still copy normally.
export const MAX_QR_KEY_CHARS = 2200
export function ExportQr({ shareKey }: { shareKey: string }) {
  const [image, setImage] = useState('')
  const [failed, setFailed] = useState(false)
  const fits = shareKey.length <= MAX_QR_KEY_CHARS
  useEffect(() => {
    let active = true
    if (fits) void import('qrcode').then((qr) => qr.toDataURL(shareKey, { errorCorrectionLevel: 'M', margin: 4, width: 640 }))
      .then((url) => { if (active) setImage(url) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [shareKey, fits])
  if (!fits) return <p className="text-sm text-muted-foreground">This brief is too large for one QR code. Use Copy key to share the complete brief.</p>
  if (failed) return <p role="status" className="text-sm text-muted-foreground">QR code unavailable. You can still copy the key.</p>
  return <div className="grid justify-items-center gap-2">
    {image ? <>
      <img src={image} alt="QR code containing this brief’s export key" width={320} height={320} className="h-auto w-80 max-w-full" />
      <Button asChild variant="outline"><a href={image} download="dronebrief-qr.png"><Download /> Download QR code</a></Button>
    </> : <p role="status" className="text-sm">Creating QR code…</p>}
  </div>
}
