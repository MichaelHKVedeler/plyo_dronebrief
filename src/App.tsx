import { lazy, Suspense } from 'react'
import { cloudConfigured } from '@/features/cloud/auth/config'

const CloudApp = lazy(() => import('@/pages/cloud-app').then((module) => ({ default: module.CloudApp })))
const LocalApp = lazy(() => import('@/pages/local-app').then((module) => ({ default: module.LocalApp })))

export default function App() {
  if (!cloudConfigured && /^#\/(projects|s)\//.test(location.hash)) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-semibold">Cloud projects are not configured</h1><p className="mt-4" role="alert">This installation needs Firebase configuration to open project links. Follow docs/firebase-setup.md.</p></main>
  return <Suspense fallback={<p role="status" className="p-6">{cloudConfigured ? 'Loading account…' : 'Loading Dronebrief…'}</p>}>
    {cloudConfigured ? <CloudApp /> : <LocalApp />}
  </Suspense>
}
