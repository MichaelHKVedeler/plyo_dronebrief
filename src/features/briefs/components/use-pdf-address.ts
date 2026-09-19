import { useEffect, useRef, useState } from 'react'
import type { Position } from '../model/brief'
import { lookupPdfAddress } from '@/features/map/pdf-address'

export function usePdfAddress(position: Position) {
  const [address, setAddress] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [message, setMessage] = useState('Finding the nearest street…')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const custom = useRef(false)
  const { lat, lng } = position
  useEffect(() => {
    const controller = new AbortController()
    void lookupPdfAddress({ lat, lng }, controller.signal).then((value) => {
      if (controller.signal.aborted) return
      setSuggestion(value)
      if (!custom.current) setAddress(value)
      setMessage('Suggested from the nearest street. You can edit it below.')
    }).catch(() => {
      if (!controller.signal.aborted) setMessage('Address lookup unavailable. Enter your own address or retry.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [lat, lng, attempt])
  return { address, suggestion, message, loading,
    change: (value: string) => { custom.current = true; setAddress(value) },
    useSuggestion: () => { custom.current = false; setAddress(suggestion) },
    retry: () => { setLoading(true); setMessage('Finding the nearest street…'); setAttempt((value) => value + 1) },
  }
}
