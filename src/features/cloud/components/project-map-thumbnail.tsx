import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Box } from 'lucide-react'
import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps'
import type { ProjectSummary } from '../model/cloud'
import { editorMapView, type EditorMapView } from '../model/map-view'
import { cloudProjects } from '../storage/project-repository'

const frames = new Map<string, EditorMapView>()
const pending = new Map<string, Promise<EditorMapView | undefined>>()

function resolveProjectMap(project: ProjectSummary) {
  if (project.map) return Promise.resolve(project.map)
  if (project.deletedAt) return Promise.resolve(undefined)
  const key = `${project.id}:${project.revision}`
  const saved = frames.get(key)
  if (saved) return Promise.resolve(saved)
  const existing = pending.get(key)
  if (existing) return existing
  const task = cloudProjects.load(project.id).then((loaded) => {
    const view = editorMapView(loaded.brief)
    frames.set(key, view)
    return view
  }).catch(() => undefined).finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}

export function ProjectMapProvider({ children }: { children: ReactNode }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
  if (!apiKey) return children
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>
}

function useVisible(ref: RefObject<HTMLDivElement | null>) {
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '240px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return visible
}

function useMapFrame(project: ProjectSummary, enabled: boolean) {
  const [loaded, setLoaded] = useState<EditorMapView | undefined>()
  useEffect(() => {
    if (!enabled || project.map || project.deletedAt) return
    let active = true
    void resolveProjectMap(project).then((view) => { if (active) setLoaded(view) })
    return () => { active = false }
  }, [enabled, project])
  return project.map ?? loaded
}

function SatelliteLock() {
  const map = useMap()
  useEffect(() => { map?.setMapTypeId('satellite') }, [map])
  return null
}

export function ProjectMapThumbnail({ project }: { project: ProjectSummary }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''
  const root = useRef<HTMLDivElement>(null)
  const visible = useVisible(root)
  const frame = useMapFrame(project, visible && Boolean(apiKey))
  return <div ref={root} className="absolute inset-0">
    {apiKey && frame && visible ? <div role="img" aria-label={`${project.name} map`} data-zoom={frame.zoom} className="pointer-events-none size-full [&_.gm-style-cc]:!hidden">
      <GoogleMap defaultCenter={{ lat: frame.lat, lng: frame.lng }} defaultZoom={frame.zoom} mapTypeId="satellite" disableDefaultUI gestureHandling="none" keyboardShortcuts={false} clickableIcons={false} draggable={false} scrollwheel={false} disableDoubleClickZoom style={{ width: '100%', height: '100%' }}>
        <SatelliteLock />
      </GoogleMap>
    </div> : <span className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><Box className="size-8" /> Project preview</span>}
  </div>
}
