import { connectStorageEmulator, getBlob, getStorage, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage'
import { assetSchema, type CloudAsset } from '../model/cloud'
import { callCloud, emulated, firebase } from '../auth/firebase'
import { publicRequest } from './project-repository'

// Created here, so only the editor downloads the Storage SDK.
let bucket: FirebaseStorage | undefined
function storage() {
  if (!bucket) { bucket = getStorage(firebase().app); if (emulated) connectStorageEmulator(bucket, '127.0.0.1', 9199) }
  return bucket
}

export async function uploadFloorplan(projectId: string, fileId: string, file: File, progress: (label: string) => void, signal: AbortSignal): Promise<CloudAsset> {
  signal.throwIfAborted()
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose an image smaller than 30 MB.')
  const assetId = crypto.randomUUID()
  const { path } = await callCloud<{ path: string }>('prepareUpload', { projectId, fileId, assetId, fileName: file.name })
  signal.throwIfAborted()
  const task = uploadBytesResumable(ref(storage(), path), file, { contentType: file.type || (/\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg') })
  const cancel = () => task.cancel()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await new Promise<void>((resolve, reject) => task.on('state_changed', (state) => progress(`Uploading ${Math.round(100 * state.bytesTransferred / state.totalBytes)}%`), reject, resolve))
    signal.throwIfAborted(); progress('Optimizing site plan…')
    const asset = assetSchema.parse(await callCloud('finalizeUpload', { projectId, assetId }))
    signal.throwIfAborted()
    return asset
  } finally { signal.removeEventListener('abort', cancel) }
}
export async function downloadFloorplan(asset: CloudAsset, publicToken?: string, signal?: AbortSignal) {
  if (publicToken) return (await publicRequest(publicToken, asset.id, signal)).blob()
  const blob = await getBlob(ref(storage(), asset.path), 4 * 1024 * 1024)
  signal?.throwIfAborted()
  return blob
}
