export type LocalImageHandle = FileSystemFileHandle & {
  queryPermission: (options: { mode: 'read' }) => Promise<PermissionState>
  requestPermission: (options: { mode: 'read' }) => Promise<PermissionState>
}
type ImagePicker = (options: { multiple: boolean; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<LocalImageHandle[]>
export function imagePicker(): ImagePicker | undefined {
  return (window as Window & { showOpenFilePicker?: ImagePicker }).showOpenFilePicker?.bind(window)
}

// Only capabilities are stored here, never file bytes or temporary object URLs.
async function handleStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('dronebrief-local-images', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('handles')
    open.onerror = () => reject(open.error)
    open.onblocked = () => reject(new Error('Local file references are unavailable.'))
    open.onsuccess = () => {
      const db = open.result
      const transaction = db.transaction('handles', mode)
      let request: IDBRequest<T>
      try { request = action(transaction.objectStore('handles')) } catch (error) { db.close(); reject(error); return }
      transaction.oncomplete = () => { db.close(); resolve(request.result) }
      transaction.onabort = transaction.onerror = () => { db.close(); reject(transaction.error) }
    }
  })
}
export async function rememberImageHandle(id: string, handle: LocalImageHandle) {
  await handleStore('readwrite', (store) => store.put(handle, id))
}
export async function readImageHandle(id: string): Promise<LocalImageHandle | undefined> {
  return handleStore('readonly', (store) => store.get(id))
}
export async function readLocalImage(file: File) {
  if (!/\.(jpe?g|png)$/i.test(file.name) || (file.type && !['image/jpeg', 'image/png'].includes(file.type))) {
    throw new Error('Choose a JPG or PNG image.')
  }
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.')
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!png && !jpeg) throw new Error('This file is not a valid JPG or PNG image.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 100_000_000) {
      throw new Error('Choose an image with fewer than 100 million pixels.')
    }
    return { url, width: image.naturalWidth, height: image.naturalHeight }
  } catch (error) { URL.revokeObjectURL(url); throw error }
}
