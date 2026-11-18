import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
// A tab left open across a release asks for files that are gone: load the new version (at most once a minute) instead of going blank.
window.addEventListener('vite:preloadError', () => {
  if (Date.now() - Number(sessionStorage.getItem('dronebrief:reloaded')) > 60_000) { sessionStorage.setItem('dronebrief:reloaded', String(Date.now())); location.reload() }
})
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)