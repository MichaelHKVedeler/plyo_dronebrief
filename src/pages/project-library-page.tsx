import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ActorAvatar } from '@/features/cloud/components/actor-avatar'
import { Choice } from '@/features/cloud/components/choice'
import { Problem } from '@/features/cloud/components/problem'
import { cloudError } from '@/features/cloud/auth/firebase'
import { cloudLibrary } from '@/features/cloud/storage/library-repository'
import { cloudProjects } from '@/features/cloud/storage/project-repository'
import type { Actor, LibraryPage, LibraryQuery, Organization, PersonalCollection, ProjectSummary } from '@/features/cloud/model/cloud'

export function ProjectLibraryPage({ organization, uid, onOpen }: { organization: Organization; uid: string; onOpen: (id: string) => void }) {
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
  const [collectionDialog, setCollectionDialog] = useState(false)
  const [collectionId, setCollectionId] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { const timer = setTimeout(() => setQuery((previous) => ({ ...previous, search, cursor: null })), 300); return () => clearTimeout(timer) }, [search])
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
    try { await operation(); setRefresh((value) => value + 1); setConfirm(null); setCollectionDialog(false) }
    catch (error) { setError(cloudError(error)) } finally { setBusy(false) }
  }, [])
  return <main className="mx-auto grid w-full max-w-7xl gap-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Project library</h1><div className="flex gap-2"><Button variant="outline" onClick={() => setCollectionDialog(true)}>My collections</Button><Button variant="outline" onClick={() => setRefresh((value) => value + 1)}>Refresh</Button></div></div>
    <Problem message={error ?? (!loading ? result?.error ?? null : null)} />
    <Tabs value={query.view} onValueChange={(view) => change({ view: view as LibraryQuery['view'] })}><TabsList><TabsTrigger value="mine">My projects</TabsTrigger><TabsTrigger value="organization">Organization projects</TabsTrigger>{organization.role === 'admin' && <TabsTrigger value="trash">Trash</TabsTrigger>}</TabsList></Tabs>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="grid gap-1"><Label htmlFor="library-search">Search names</Label><Input id="library-search" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} placeholder="Start of project, client, collection or user name" /></div>
      <Choice label="Collection" value={query.collectionId ?? ''} onChange={(value) => change({ collectionId: value || null })} options={[{ value: '', label: 'All collections' }, ...collections.map((item) => ({ value: item.id, label: item.name }))]} />
      <Choice label="Creator" value={query.creatorId ?? ''} onChange={(value) => change({ creatorId: value || null })} options={[{ value: '', label: 'All creators' }, ...creators.map((item) => ({ value: item.uid, label: item.name }))]} />
      <Choice label="Sort by" value={query.sort} onChange={(value) => change({ sort: value as LibraryQuery['sort'] })} options={[{ value: 'name', label: 'Project name' }, { value: 'creator', label: 'Creator' }, { value: 'updated', label: 'Last updated' }]} />
      <Choice label="Order" value={query.direction} onChange={(value) => change({ direction: value as LibraryQuery['direction'] })} options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]} />
    </div>
    {page?.indexing && <p role="status">Preparing your project library. Refresh shortly to see the remaining projects.</p>}
    {loading ? <p role="status">Loading projects…</p> : page?.projects.length ? <Table><TableHeader><TableRow>{['Project', 'Client', 'My collection', 'Created by', 'Edited by', 'Last updated', 'Actions'].map((name) => <TableHead key={name}>{name}</TableHead>)}</TableRow></TableHeader><TableBody>{page.projects.map((project) => <TableRow key={project.id}>
      <TableCell><Button variant="link" disabled={Boolean(project.deletedAt)} onClick={() => onOpen(project.id)}>{project.name}</Button></TableCell><TableCell>{project.clientName}</TableCell>
      <TableCell><Choice label={`Collection for ${project.name}`} value={project.collectionId ?? ''} disabled={busy || Boolean(project.deletedAt)} onChange={(id) => void mutate(() => cloudLibrary.assign(organization.id, project.id, id || null))} options={[{ value: '', label: 'Uncollected' }, ...collections.map((item) => ({ value: item.id, label: item.name }))]} /></TableCell>
      <TableCell><ActorAvatar label="Created by" actor={project.createdBy} at={project.createdAt} /></TableCell><TableCell><ActorAvatar label="Edited by" actor={project.editedBy} at={project.updatedAt} /></TableCell><TableCell className="whitespace-nowrap">{new Date(project.updatedAt).toLocaleString()}</TableCell>
      <TableCell>{project.deletedAt ? <Button variant="outline" disabled={busy} onClick={() => void mutate(() => cloudProjects.trash(project.id, true))}>Restore</Button> : (organization.role === 'admin' || project.createdBy.uid === uid) && <Button variant="ghost" onClick={() => setConfirm(project)}>Delete</Button>}</TableCell>
    </TableRow>)}</TableBody></Table> : <p>No projects match this view.</p>}
    <div className="flex gap-2"><Button variant="outline" disabled={!query.cursor || loading} onClick={() => change({})}>First page</Button><Button variant="outline" disabled={!page?.cursor || loading} onClick={() => setQuery((previous) => ({ ...previous, cursor: page?.cursor ?? null }))}>Next page</Button></div>
    <Dialog open={Boolean(confirm)} onOpenChange={(open) => { if (!open) setConfirm(null) }}><DialogContent><DialogHeader><DialogTitle>Move project to trash?</DialogTitle><DialogDescription>Public links stop working immediately. An administrator can restore this project within 30 days.</DialogDescription></DialogHeader><Problem message={error} /><Button variant="destructive" disabled={busy} onClick={() => { if (confirm) void mutate(() => cloudProjects.trash(confirm.id)) }}>Delete {confirm?.name}</Button></DialogContent></Dialog>
    <Dialog open={collectionDialog} onOpenChange={setCollectionDialog}><DialogContent><DialogHeader><DialogTitle>My collections</DialogTitle><DialogDescription>Collections and assignments are visible only to you.</DialogDescription></DialogHeader><Problem message={error} />
      <Choice label="Manage collection" value={collectionId} onChange={(id) => { setCollectionId(id); setCollectionName(collections.find((item) => item.id === id)?.name ?? '') }} options={[{ value: '', label: 'New collection' }, ...collections.map((item) => ({ value: item.id, label: item.name }))]} />
      <Label htmlFor="collection-name">Collection name</Label><Input id="collection-name" maxLength={200} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} />
      <Button disabled={busy || !collectionName.trim()} onClick={() => void mutate(() => collectionId ? cloudLibrary.renameCollection(organization.id, collectionId, collectionName) : cloudLibrary.createCollection(organization.id, collectionName, crypto.randomUUID()))}>{collectionId ? 'Rename' : 'Create collection'}</Button>
      {collectionId && <Button variant="outline" disabled={busy} onClick={() => void mutate(() => cloudLibrary.deleteCollection(organization.id, collectionId))}>Delete collection, keep projects</Button>}
    </DialogContent></Dialog>
  </main>
}
