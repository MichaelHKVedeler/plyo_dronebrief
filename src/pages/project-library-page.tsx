import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, FolderOpen, LayoutGrid, List, MoreHorizontal, Pencil, Plus, Search, Trash2, User } from 'lucide-react'
import { AppBrand } from '@/components/layout/app-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ActorAvatar } from '@/features/cloud/components/actor-avatar'
import { ProjectMapProvider, ProjectMapThumbnail } from '@/features/cloud/components/project-map-thumbnail'
import { Choice } from '@/features/cloud/components/choice'
import { Problem } from '@/features/cloud/components/problem'
import { cloudError } from '@/features/cloud/auth/firebase'
import { cloudLibrary } from '@/features/cloud/storage/library-repository'
import { cloudProjects } from '@/features/cloud/storage/project-repository'
import type { DroneBrief } from '@/features/briefs/model/brief'
import type { Actor, LibraryPage, LibraryQuery, Organization, PersonalCollection, ProjectSummary } from '@/features/cloud/model/cloud'

const viewLabels = { mine: 'My projects', organization: 'Organization projects', trash: 'Deleted projects' } as const

export function ProjectLibraryPage({ organization, uid, onOpen, onCreate, header, drafts = [], onSaveDraft }: {
  organization: Organization
  uid: string
  onOpen: (id: string) => void
  onCreate: () => void
  header?: ReactNode
  drafts?: DroneBrief[]
  onSaveDraft?: (brief: DroneBrief) => void
}) {
  const [query, setQuery] = useState<LibraryQuery>({ orgId: organization.id, view: 'mine', search: '', collectionId: null, creatorId: null, sort: 'updated', direction: 'desc', cursor: null })
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<{ query: LibraryQuery; refresh: number; page: LibraryPage | null; error: string | null } | null>(null)
  const [collections, setCollections] = useState<PersonalCollection[]>([])
  const [creators, setCreators] = useState<Actor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const loading = result?.query !== query || result?.refresh !== refresh
  const page = loading ? null : result?.page
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null)
  const [purge, setPurge] = useState<ProjectSummary | null>(null)
  const [moveProject, setMoveProject] = useState<ProjectSummary | null>(null)
  const [moveCollection, setMoveCollection] = useState('')
  const [collectionDialog, setCollectionDialog] = useState(false)
  const [collectionId, setCollectionId] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setQuery((previous) => previous.search === search ? previous : { ...previous, search, cursor: null }), 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let active = true
    void cloudLibrary.search(query).then((page) => { if (active) setResult({ query, refresh, page, error: null }) }).catch((error) => { if (active) setResult({ query, refresh, page: null, error: cloudError(error) }) })
    return () => { active = false }
  }, [query, refresh])
  useEffect(() => {
    let active = true
    void cloudLibrary.collections(organization.id).then((result) => { if (active) { setCollections(result.collections); setCreators(result.creators) } }).catch((error) => { if (active) setError(cloudError(error)) })
    return () => { active = false }
  }, [organization.id, refresh])
  const change = (patch: Partial<LibraryQuery>) => setQuery((previous) => ({ ...previous, ...patch, cursor: null }))
  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await operation(); setRefresh((value) => value + 1); setConfirm(null); setPurge(null); setMoveProject(null); setCollectionDialog(false) }
    catch (error) { setError(cloudError(error)) } finally { setBusy(false) }
  }, [])
  const selectedCollection = collections.find((item) => item.id === query.collectionId)
  const heading = selectedCollection?.name ?? viewLabels[query.view]
  const completePage = Boolean(page && !page.cursor && !query.search && !query.creatorId && !query.collectionId)
  const shown = page?.projects.length ?? 0
  const summary = selectedCollection
    ? `${shown} project${shown === 1 ? '' : 's'} in this collection${page?.cursor ? ' on this page' : ''}`
    : `${shown} project${shown === 1 ? '' : 's'}${page?.cursor ? ' on this page' : ''} · ${collections.length} collection${collections.length === 1 ? '' : 's'}`
  function openCollectionEditor(id = '') {
    setCollectionId(id)
    setCollectionName(collections.find((item) => item.id === id)?.name ?? '')
    setCollectionDialog(true)
  }
  const views: LibraryQuery['view'][] = ['mine', 'organization', ...(organization.role === 'admin' ? ['trash' as const] : [])]
  const projectGrid = layout === 'list' ? 'grid gap-4' : 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-6'
  return <div className="flex min-h-0 flex-1 bg-muted">
    <aside className="hidden w-60 shrink-0 flex-col gap-2 border-r bg-card px-4 py-7 lg:flex" aria-label="Project navigation">
      <div className="mb-6 flex items-center gap-2 px-2 text-base"><AppBrand /></div>
      <p className="px-3 text-xs font-semibold tracking-wide text-muted-foreground">PROJECTS</p>
      {views.map((view) => <NavButton key={view} active={!query.collectionId && query.view === view} icon={viewIcon(view)} onClick={() => change({ view, collectionId: null })}>
        {viewLabels[view]}{completePage && view === query.view && <Badge variant="outline" className="ml-auto">{shown}</Badge>}
      </NavButton>)}
      <p className="mt-6 px-3 text-xs font-semibold tracking-wide text-muted-foreground">COLLECTIONS</p>
      {collections.map((item) => <NavButton key={item.id} active={query.collectionId === item.id} icon={<FolderOpen />} onClick={() => change({ collectionId: item.id, view: query.view === 'trash' ? 'mine' : query.view })}>
        <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
        {completePage && <Badge variant="outline" className="ml-auto">{page?.projects.filter((project) => project.collectionId === item.id).length}</Badge>}
      </NavButton>)}
      <NavButton icon={<Plus />} onClick={() => openCollectionEditor()}>New collection</NavButton>
      <Card className="mt-auto bg-muted py-0"><CardContent className="px-4 py-4">
        <Badge variant="outline">Connected</Badge>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">Your projects and changes are saved to your account.</p>
      </CardContent></Card>
    </aside>
    <main className="min-w-0 flex-1 overflow-auto px-4 py-8 sm:px-8 lg:px-[5%] lg:py-12">
      <div className="mb-6 flex w-full items-center justify-end">{header}</div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.13em] text-primary">PROJECT OVERVIEW</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{heading}</h1>
          <p className="mt-2 text-muted-foreground" role={loading ? 'status' : undefined}>{loading ? 'Loading projects…' : summary}</p>
        </div>
        <Button onClick={onCreate}><Plus /> New project</Button>
      </div>
      <div className="mt-6 flex items-end gap-2 lg:hidden">
        <div className="grid min-w-0 flex-1 gap-1">
          <Label htmlFor="library-mobile-browse">Browse</Label>
          <Select value={query.collectionId ? `collection:${query.collectionId}` : `view:${query.view}`} onValueChange={(value) => {
            if (value.startsWith('collection:')) change({ collectionId: value.slice(11), view: query.view === 'trash' ? 'mine' : query.view })
            else change({ view: value.slice(5) as LibraryQuery['view'], collectionId: null })
          }}>
            <SelectTrigger id="library-mobile-browse" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {views.map((view) => <SelectItem key={view} value={`view:${view}`}>{viewLabels[view]}</SelectItem>)}
              {collections.map((item) => <SelectItem key={item.id} value={`collection:${item.id}`}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" aria-label="Create collection" onClick={() => openCollectionEditor()}><Plus /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 py-7">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="library-search" aria-label="Search projects" className="pl-9" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or clients…" />
        </div>
        <ToolbarSelect label="Creator" value={query.creatorId ?? ''} onChange={(value) => change({ creatorId: value || null })} options={[{ value: '', label: 'All creators' }, ...creators.map((item) => ({ value: item.uid, label: item.name }))]} />
        <ToolbarSelect label="Sort projects" value={query.sort} onChange={(value) => change({ sort: value as LibraryQuery['sort'] })} options={[{ value: 'updated', label: 'Last updated' }, { value: 'name', label: 'Project name' }, { value: 'creator', label: 'Creator' }]} />
        <ToolbarSelect label="Sort direction" value={query.direction} onChange={(value) => change({ direction: value as LibraryQuery['direction'] })} options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]} />
        <Button variant={layout === 'grid' ? 'secondary' : 'outline'} size="icon" aria-label="Grid layout" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><LayoutGrid /></Button>
        <Button variant={layout === 'list' ? 'secondary' : 'outline'} size="icon" aria-label="List layout" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List /></Button>
        {selectedCollection && <Button variant="ghost" size="icon" aria-label="Collection actions" onClick={() => openCollectionEditor(selectedCollection.id)}><MoreHorizontal /></Button>}
        <Button variant="ghost" onClick={() => setRefresh((value) => value + 1)}>Refresh</Button>
      </div>
      <Problem message={error ?? (!loading ? result?.error ?? null : null)} />
      {page?.indexing && <p role="status" className="mb-4">Preparing your project library. Refresh shortly to see the remaining projects.</p>}
      {!loading && page && page.projects.length > 0 && <ProjectMapProvider><div className={projectGrid}>
        {page.projects.map((project) => <ProjectCard key={project.id} project={project} layout={layout} owner={project.createdBy.uid === uid} busy={busy} onOpen={() => onOpen(project.id)} onMove={() => { setMoveProject(project); setMoveCollection(project.collectionId ?? '') }} onDelete={() => setConfirm(project)} onRestore={() => void mutate(() => cloudProjects.trash(project.id, true))} onPurge={() => setPurge(project)} onRename={(name) => void mutate(() => cloudProjects.rename(project.id, name))} canDelete={organization.role === 'admin' || project.createdBy.uid === uid} />)}
      </div></ProjectMapProvider>}
      {!loading && !page?.projects.length && <p>No projects match this view.</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {!loading && page && <p className="text-sm text-muted-foreground">{shown ? `1–${shown}${page.cursor ? '' : ` of ${shown}`}` : '0 projects'}</p>}
        <div className="flex gap-2">
          <Button variant="outline" disabled={!query.cursor || loading} onClick={() => change({})}>First page</Button>
          <Button variant="outline" disabled={!page?.cursor || loading} onClick={() => setQuery((previous) => ({ ...previous, cursor: page?.cursor ?? null }))}>Next page</Button>
        </div>
      </div>
      {drafts.length > 0 && <section className="mt-10 grid gap-3">
        <h2 className="text-lg font-medium">Local drafts on this device</h2>
        {drafts.map((draft) => <div key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3"><span>{draft.project.name}</span><Button variant="outline" onClick={() => onSaveDraft?.(draft)}>Save to organization</Button></div>)}
      </section>}
    </main>
    <Dialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open) setConfirm(null) }}><DialogContent><DialogHeader><DialogTitle>Delete project?</DialogTitle><DialogDescription>Public links stop working immediately. An administrator can restore this project from Deleted projects within 30 days, or delete it permanently.</DialogDescription></DialogHeader><Problem message={error} /><Button variant="destructive" disabled={busy} onClick={() => { if (confirm) void mutate(() => cloudProjects.trash(confirm.id)) }}>Delete {confirm?.name}</Button></DialogContent></Dialog>
    <Dialog open={Boolean(purge)} onOpenChange={(open) => { if (!open) setPurge(null) }}><DialogContent><DialogHeader><DialogTitle>Delete project permanently?</DialogTitle><DialogDescription>This removes the project and its files. This cannot be undone.</DialogDescription></DialogHeader><Problem message={error} /><Button variant="destructive" disabled={busy} onClick={() => { if (purge) void mutate(() => cloudProjects.purge(purge.id)) }}>Delete {purge?.name} permanently</Button></DialogContent></Dialog>
    <Dialog open={Boolean(moveProject)} onOpenChange={(open) => { if (!open) setMoveProject(null) }}><DialogContent><DialogHeader><DialogTitle>Move to collection</DialogTitle><DialogDescription>Collections and assignments are visible only to you.</DialogDescription></DialogHeader>
      <Choice label={`Collection for ${moveProject?.name ?? 'project'}`} value={moveCollection} onChange={setMoveCollection} options={[{ value: '', label: 'Uncollected' }, ...collections.map((item) => ({ value: item.id, label: item.name }))]} />
      <Button disabled={busy || !moveProject} onClick={() => { if (moveProject) void mutate(() => cloudLibrary.assign(organization.id, moveProject.id, moveCollection || null)) }}>Save</Button>
    </DialogContent></Dialog>
    <Dialog open={collectionDialog} onOpenChange={setCollectionDialog}><DialogContent><DialogHeader><DialogTitle>{collectionId ? collectionName || 'Collection' : 'New collection'}</DialogTitle><DialogDescription>Collections and assignments are visible only to you.</DialogDescription></DialogHeader><Problem message={error} />
      <Label htmlFor="collection-name">Collection name</Label><Input id="collection-name" maxLength={200} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} />
      <Button disabled={busy || !collectionName.trim()} onClick={() => {
        const id = collectionId || crypto.randomUUID()
        void mutate(async () => {
          if (collectionId) await cloudLibrary.renameCollection(organization.id, collectionId, collectionName)
          else { await cloudLibrary.createCollection(organization.id, collectionName, id); setQuery((previous) => ({ ...previous, collectionId: id, view: previous.view === 'trash' ? 'mine' : previous.view, cursor: null })) }
        })
      }}>{collectionId ? 'Rename' : 'Create collection'}</Button>
      {collectionId && <Button variant="outline" disabled={busy} onClick={() => void mutate(async () => { await cloudLibrary.deleteCollection(organization.id, collectionId); setQuery((previous) => previous.collectionId === collectionId ? { ...previous, collectionId: null, cursor: null } : previous) })}>Delete collection, keep projects</Button>}
    </DialogContent></Dialog>
  </div>
}

function viewIcon(view: LibraryQuery['view']) {
  if (view === 'mine') return <User />
  if (view === 'organization') return <OrganizationMark />
  return <Trash2 />
}

function OrganizationMark() {
  return <>
    <img src={`${import.meta.env.BASE_URL}brand/plyo-mark-flat-ink.svg`} alt="" className="size-4 dark:hidden" />
    <img src={`${import.meta.env.BASE_URL}brand/plyo-mark-flat-white.svg`} alt="" className="hidden size-4 dark:block" />
  </>
}

function NavButton({ active = false, icon, onClick, children }: { active?: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return <Button variant="ghost" aria-pressed={active} className={'w-full min-w-0 justify-start ' + (active ? 'bg-secondary font-medium' : '')} onClick={onClick}>{icon}{children}</Button>
}

function ToolbarSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <Select value={value || '__none__'} onValueChange={(next) => onChange(next === '__none__' ? '' : next)}>
    <SelectTrigger aria-label={label} className="w-auto min-w-32"><SelectValue /></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.value || '__none__'} value={option.value || '__none__'}>{option.label}</SelectItem>)}</SelectContent>
  </Select>
}

function ProjectName({ name, deleted, busy, onOpen, onRename }: {
  name: string
  deleted: boolean
  busy: boolean
  onOpen: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const editingRef = useRef(false)
  function start() {
    if (deleted || busy || editingRef.current) return
    editingRef.current = true
    setDraft(name)
    setEditing(true)
  }
  function finish(commit: boolean) {
    if (!editingRef.current) return
    editingRef.current = false
    setEditing(false)
    const next = draft.trim()
    if (commit && next && next !== name) onRename(next)
  }
  if (editing) {
    return <form className="min-w-0" onSubmit={(event) => { event.preventDefault(); finish(true) }}>
      <Input autoFocus aria-label="Project name" value={draft} maxLength={200} disabled={busy} className="h-8" onChange={(event) => setDraft(event.target.value)} onBlur={() => finish(true)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); finish(false) } }} />
    </form>
  }
  return <div className="group/name flex min-w-0 items-center gap-0.5">
    <Button variant="ghost" title={name} className="h-auto -ml-3 min-w-0 max-w-full shrink justify-start overflow-hidden px-3 text-base font-semibold text-foreground" disabled={deleted} onClick={onOpen}>
      <span className="min-w-0 truncate">{name}</span>
    </Button>
    {!deleted && <Button type="button" variant="ghost" size="icon-xs" className="shrink-0 opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-within/name:opacity-100 max-lg:opacity-100" aria-label={`Rename ${name}`} disabled={busy} onClick={start}><Pencil /></Button>}
  </div>
}

function ProjectCard({ project, layout, owner, busy, canDelete, onOpen, onMove, onDelete, onRestore, onPurge, onRename }: {
  project: ProjectSummary
  layout: 'grid' | 'list'
  owner: boolean
  busy: boolean
  canDelete: boolean
  onOpen: () => void
  onMove: () => void
  onDelete: () => void
  onRestore: () => void
  onPurge: () => void
  onRename: (name: string) => void
}) {
  const deleted = Boolean(project.deletedAt)
  return <Card className={'min-w-0 gap-0 overflow-hidden py-0 ' + (layout === 'list' ? 'flex-row' : deleted ? '' : 'aspect-square')}>
    <div className={'relative overflow-hidden bg-background ' + (layout === 'list' ? 'min-h-36 w-40 shrink-0' : 'min-h-32 w-full flex-1')}>
      <ProjectMapThumbnail project={project} />
      <Button variant="ghost" className="absolute inset-0 size-full rounded-none bg-transparent p-0 hover:bg-foreground/5" disabled={deleted} onClick={onOpen} aria-label={`Open ${project.name}`}>
        <Badge variant="secondary" className="absolute top-3.5 left-3.5 z-10 bg-card">{owner ? 'Owner' : 'Can edit'}</Badge>
        <span className="absolute right-3.5 bottom-3.5 z-10 grid size-7 place-items-center rounded-full bg-card text-foreground"><ArrowUpRight className="size-4" /></span>
      </Button>
    </div>
    <CardContent className={'grid gap-3 py-4 pr-4 pl-6 ' + (layout === 'list' ? 'min-w-0 flex-1' : 'min-w-0')}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ProjectName name={project.name} deleted={deleted} busy={busy} onOpen={onOpen} onRename={onRename} />
          <p className="mt-1 text-[13px] text-muted-foreground">{project.clientName}</p>
          {deleted && <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={onRestore}>Restore</Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={onPurge}>Delete permanently</Button>
          </div>}
        </div>
        {!deleted && <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={busy} onClick={onMove}>Move to collection</DropdownMenuItem>
            {canDelete && <DropdownMenuItem onClick={onDelete}>Delete project</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>
      <div className="flex items-center justify-between"><ActorAvatar label="Edited by" actor={project.editedBy} at={project.updatedAt} /></div>
      <Separator />
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        <span className="truncate">{project.collectionName || 'Uncollected'}</span>
      </div>
    </CardContent>
  </Card>
}
