import { lazy, Suspense, useEffect, useState } from 'react'
import { cloudConfigured } from '@/features/cloud/auth/config'
import { toolkitsSignIn, toolkitsUrl } from '@/features/cloud/auth/toolkits-login'

const loadCloudApp = () => import('@/pages/cloud-app').then((module) => ({ default: module.CloudApp }))
const CloudApp = lazy(loadCloudApp)
const LocalApp = lazy(() => import('@/pages/local-app').then((module) => ({ default: module.LocalApp })))
// A Plyo Toolkits sign-in ends in the cloud app: fetch it while signing in.
if (toolkitsSignIn) void loadCloudApp().catch(() => {})

export default function App() {
  // undefined while a Plyo Toolkits sign-in is in progress; null when there is none or it succeeded.
  const [toolkitsError, setToolkitsError] = useState<string | null | undefined>(toolkitsSignIn ? undefined : null)
  useEffect(() => {
    // index.html keeps the Plyo loading screen up during a Toolkits sign-in; after a success CloudApp lifts it.
    const lift = () => document.documentElement.removeAttribute('data-plyo-loading')
    if (toolkitsSignIn) void toolkitsSignIn.then((error) => { if (error) lift(); setToolkitsError(error) }); else lift()
  }, [])
  if (toolkitsError === undefined) return <p role="status" className="p-6">Signing in with Plyo Toolkits…</p>
  if (toolkitsError) return <main className="mx-auto grid max-w-xl gap-4 p-6"><h1 className="text-2xl font-semibold">Plyo Toolkits sign-in did not complete</h1><p role="alert">{toolkitsError}</p><p><a className="underline" href={toolkitsUrl}>Back to Plyo Toolkits</a> · <a className="underline" href={location.pathname}>Continue to Dronebrief</a></p></main>
  if (!cloudConfigured && /^#\/(projects|s)\//.test(location.hash)) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-semibold">Cloud projects are not configured</h1><p className="mt-4" role="alert">This installation needs Firebase configuration to open project links. Follow docs/firebase-setup.md.</p></main>
  return <Suspense fallback={<p role="status" className="p-6">{cloudConfigured ? 'Loading account…' : 'Loading Dronebrief…'}</p>}>
    {cloudConfigured ? <CloudApp /> : <LocalApp />}
  </Suspense>
}
