import { useEffect, useRef, useState } from 'react'
import type { ImageSource } from '../model/brief'
import { readImageHandle, readLocalImage, rememberImageHandle, type LocalImageHandle } from '../storage/local-images'
import type { ImageTransport } from '../storage/image-transport'

export type ImageSourceItem = { source: ImageSource }
export type ImageResource = { url?: string; message?: string; handle?: LocalImageHandle }
export function useLocalImages(overlays: ImageSourceItem[], transport?: ImageTransport) {
  const [resources, setResources] = useState<Record<string, ImageResource>>({})
  const [opacityOverrides, setOpacityOverrides] = useState<Record<string, number>>({})
  const ownedUrls = useRef(new Set<string>())
  const resourceCache = useRef<Record<string, ImageResource>>({})
  const referenced = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const alive = useRef(true)
  const transfers = useRef(new AbortController())
  const cloudVersion = useRef(transport?.version)
  useEffect(() => {
    alive.current = true
    const urls = ownedUrls.current
    transfers.current = new AbortController()
    return () => { alive.current = false; transfers.current.abort(); for (const url of urls) URL.revokeObjectURL(url); urls.clear() }
  }, [])
  const publish = (id: string, resource: ImageResource) => {
    if (!alive.current) { if (resource.url) URL.revokeObjectURL(resource.url); return }
    const previousUrl = resourceCache.current[id]?.url
    if (previousUrl && previousUrl !== resource.url) { URL.revokeObjectURL(previousUrl); ownedUrls.current.delete(previousUrl) }
    if (resource.url) ownedUrls.current.add(resource.url)
    resourceCache.current[id] = resource
    setResources((previous) => ({ ...previous, [id]: resource }))
  }
  useEffect(() => {
    if (cloudVersion.current !== transport?.version) {
      cloudVersion.current = transport?.version
      for (const url of ownedUrls.current) URL.revokeObjectURL(url)
      ownedUrls.current.clear(); resourceCache.current = {}; setResources({})
      return
    }
    const ids = new Set(overlays.flatMap((image) => typeof image.source === 'string' ? [] : [image.source.fileId]))
    for (const id of referenced.current) if (!ids.has(id)) {
      const url = resourceCache.current[id]?.url
      if (url) { URL.revokeObjectURL(url); ownedUrls.current.delete(url) }
      delete resourceCache.current[id]
      setResources((previous) => { const next = { ...previous }; delete next[id]; return next })
    }
    referenced.current = ids
    for (const overlay of overlays) {
      if (typeof overlay.source === 'string' || resources[overlay.source.fileId] || pending.current.has(overlay.source.fileId)) continue
      const id = overlay.source.fileId
      const version = cloudVersion.current
      const signal = transfers.current.signal
      pending.current.add(id)
      void (async () => {
        try {
          if (transport) {
            const blob = await transport.load(id, signal)
            if (signal.aborted || !alive.current || version !== cloudVersion.current || !referenced.current.has(id) || resourceCache.current[id]) return
            publish(id, { url: URL.createObjectURL(blob) }); return
          }
          const handle = await readImageHandle(id)
          if (!referenced.current.has(id) || resourceCache.current[id]) return
          if (!handle) { publish(id, { message: 'Reconnect the local image to display it.' }); return }
          const permission = await handle.queryPermission({ mode: 'read' })
          if (!referenced.current.has(id) || resourceCache.current[id]) return
          if (permission !== 'granted') {
            publish(id, { handle, message: 'Allow access to display this local image.' }); return
          }
          const image = await readLocalImage(await handle.getFile())
          if (!referenced.current.has(id) || resourceCache.current[id]) { URL.revokeObjectURL(image.url); return }
          publish(id, { url: image.url, handle })
        } catch { if (!signal.aborted && alive.current && version === cloudVersion.current && referenced.current.has(id)) publish(id, { message: transport ? 'This floorplan could not be loaded. Retry when the connection is available.' : 'The local image is unavailable. Reconnect it to continue.' }) }
        finally { pending.current.delete(id); if (alive.current && (signal.aborted || version !== cloudVersion.current)) setResources((previous) => ({ ...previous })) }
      })()
    }
  }, [overlays, resources, transport])
  async function connect(id: string, file: File, handle?: LocalImageHandle) {
    const image = await readLocalImage(file)
    let message: string | undefined
    if (transport) {
      if (!transport.upload) { URL.revokeObjectURL(image.url); throw new Error('This project is read-only.') }
      transport.onBusy?.(true)
      try { await transport.upload(id, file, transfers.current.signal) }
      catch (error) { URL.revokeObjectURL(image.url); throw error }
      finally { transport.onBusy?.(false) }
    } else if (handle) {
      try { await rememberImageHandle(id, handle) } catch { message = 'Image opened, but its file reference could not be remembered. Reconnect after reopening.' }
    } else message = 'This browser requires reconnecting the image after reopening.'
    if (!alive.current) { URL.revokeObjectURL(image.url); throw new Error('Image opening was cancelled.') }
    publish(id, { url: image.url, handle, message })
    return image
  }
  async function allow(id: string, handle: LocalImageHandle) {
    if (await handle.requestPermission({ mode: 'read' }) !== 'granted') throw new Error('File access was not granted. You can reconnect the image instead.')
    return connect(id, await handle.getFile(), handle)
  }
  const sourceUrl = (overlay: ImageSourceItem) => typeof overlay.source === 'string' ? overlay.source : resources[overlay.source.fileId]?.url
  function previewOpacity(id: string, value?: number) {
    setOpacityOverrides((previous) => {
      const next = { ...previous }
      if (value === undefined) delete next[id]
      else next[id] = value
      return next
    })
  }
  function retry(id: string) { delete resourceCache.current[id]; setResources((previous) => { const next = { ...previous }; delete next[id]; return next }) }
  function cancel() { transfers.current.abort(); transfers.current = new AbortController() }
  return { resources, connect, allow, sourceUrl, opacityOverrides, previewOpacity, cloud: Boolean(transport), description: transport?.description, retry, cancel }
}
export type LocalImages = ReturnType<typeof useLocalImages>
