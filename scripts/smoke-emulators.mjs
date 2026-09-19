// Synthetic data only. Start `npm run emulators` and bootstrap before running.
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'
import { connectStorageEmulator, getStorage, ref, uploadBytes, getBytes } from 'firebase/storage'
import sharp from 'sharp'

const projectId = 'demo-dronebrief'
const app = initializeApp({ apiKey: 'demo-key', projectId, storageBucket: `${projectId}.appspot.com` })
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
const functions = getFunctions(app, 'europe-west1'); connectFunctionsEmulator(functions, '127.0.0.1', 5001)
const storage = getStorage(app); connectStorageEmulator(storage, '127.0.0.1', 9199)
const api = async (operation, data = {}) => (await httpsCallable(functions, 'api')({ operation, data })).data
const publicRead = (token, assetId) => fetch(`http://127.0.0.1:5001/${projectId}/europe-west1/publicView`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, assetId }) })
try {
  const jwt = [Buffer.from('{"alg":"none"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: 'dronebrief-emulator-qa', email: 'kristian.nordahl@plyo.com', email_verified: true, name: 'Emulator QA', iat: Math.floor(Date.now() / 1000) })).toString('base64url'), ''].join('.')
  await signInWithCredential(auth, GoogleAuthProvider.credential(jwt))
  const organizations = await api('account')
  assert.equal(organizations.find((org) => org.id === 'plyo')?.role, 'admin')
  const { createBrief } = await import('../functions/lib/src/features/briefs/model/brief.js')
  const brief = createBrief({ name: 'Emulator QA floorplan', clientName: 'Synthetic client' })
  const project = await api('createProject', { orgId: 'plyo', brief, assets: {}, operationId: crypto.randomUUID() })
  const fileId = crypto.randomUUID(); const assetId = crypto.randomUUID()
  const upload = await api('prepareUpload', { projectId: project.summary.id, fileId, assetId, fileName: 'representative-floorplan.png' })
  const svg = '<svg width="4200" height="2400" xmlns="http://www.w3.org/2000/svg"><path d="M80 80H4100V2300H80Z M800 80V1600H4100 M2000 1600V2300" fill="none" stroke="#252525" stroke-width="8"/><path d="M100 2000H1800" stroke="#25a490" stroke-width="12"/><g font-family="sans-serif" fill="#252525"><text x="150" y="250" font-size="48">ENTRANCE · 12.5 m</text><text x="900" y="250" font-size="36">ROOM 101 · 24 m²</text><text x="1000" y="1800" font-size="28">Small annotation · 2.4 m</text></g></svg>'
  const original = await sharp(Buffer.from(svg)).png().toBuffer()
  await uploadBytes(ref(storage, upload.path), original, { contentType: 'image/png' })
  const asset = await api('finalizeUpload', { projectId: project.summary.id, assetId })
  const overlay = { id: crypto.randomUUID(), name: 'Representative floorplan', source: { kind: 'local-file', fileId, fileName: 'representative-floorplan.png' }, position: brief.coordinates, widthMeters: 84, heightMeters: 48, rotationDegrees: 20, opacity: 0.7 }
  const request = { projectId: project.summary.id, expectedRevision: 1, operationId: crypto.randomUUID(), brief: { ...brief, imageOverlays: [overlay] }, assets: { [fileId]: asset } }
  const saved = await api('saveProject', request)
  assert.deepEqual(await api('saveProject', request), saved)
  assert.deepEqual((await api('loadProject', { projectId: project.summary.id })).brief.imageOverlays[0], overlay)
  assert.ok((await getBytes(ref(storage, asset.path))).byteLength <= 4 * 1024 * 1024)
  const { token } = await api('share', { projectId: project.summary.id, action: 'enable' })
  const publicResult = await publicRead(token)
  assert.equal(publicResult.status, 200); assert.match(publicResult.headers.get('cache-control'), /no-store/)
  assert.equal((await publicResult.json()).summary.createdBy.name, 'Emulator QA')
  assert.equal((await publicRead(token, assetId)).status, 200)
  const admin = await api('organization', { orgId: 'plyo', action: 'list' })
  assert.ok(admin.grants.some((grant) => grant.email === 'michael.vedeler@plyo.com' && grant.status === 'pending'))
  console.log(JSON.stringify({ passed: true, projectId: project.summary.id, publicUrl: `http://127.0.0.1:5173/#/s/${token}`, originalBytes: original.length, optimizedBytes: asset.size, dimensions: [asset.width, asset.height] }))
} finally { await deleteApp(app) }
