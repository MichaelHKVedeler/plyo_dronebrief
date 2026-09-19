import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cloudError } from '@/features/cloud/auth/firebase'
import { cloudOrganizations } from '@/features/cloud/storage/organization-repository'
import { Problem } from '@/features/cloud/components/problem'
import { Choice } from '@/features/cloud/components/choice'
import type { Grant, Membership, Organization } from '@/features/cloud/model/cloud'

export function OrganizationPage({ organization, onChange }: { organization: Organization; onChange: () => Promise<void> }) {
  const [grants, setGrants] = useState<Grant[]>([]); const [members, setMembers] = useState<Membership[]>([])
  const [email, setEmail] = useState(''); const [orgName, setOrgName] = useState('')
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [loadedRevision, setLoadedRevision] = useState(-1)
  const [refresh, setRefresh] = useState(0); const [remove, setRemove] = useState<Grant | null>(null)
  const loading = loadedRevision !== refresh
  useEffect(() => {
    let active = true
    void cloudOrganizations.list(organization.id).then((result) => { if (active) { setGrants(result.grants); setMembers(result.members) } }).catch((error) => { if (active) setError(cloudError(error)) }).finally(() => { if (active) setLoadedRevision(refresh) })
    return () => { active = false }
  }, [organization.id, refresh])
  async function act(operation: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await operation(); setEmail(''); setRemove(null); setRefresh((value) => value + 1); await onChange() }
    catch (error) { setError(cloudError(error)) } finally { setBusy(false) }
  }
  return <main className="mx-auto grid w-full max-w-5xl gap-5 p-6"><h1 className="text-2xl font-semibold">Manage {organization.name}</h1><Problem message={error} />
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void act(() => cloudOrganizations.add(organization.id, email)) }}><div className="grid flex-1 gap-1"><Label htmlFor="member-email">Google account email</Label><Input id="member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><Button disabled={busy}>Add member</Button></form>
    <p className="text-sm text-muted-foreground">Access activates after a matching verified Google sign-in. No invitation is sent. An already signed-in person can use Refresh access.</p>
    {loading ? <p role="status">Loading members…</p> : <Table><TableHeader><TableRow>{['Member', 'Email', 'Access', 'Role', 'Actions'].map((name) => <TableHead key={name}>{name}</TableHead>)}</TableRow></TableHeader><TableBody>{grants.filter((grant) => grant.status !== 'revoked').map((grant) => <TableRow key={grant.id}><TableCell>{members.find((member) => member.uid === grant.uid)?.name ?? '—'}</TableCell><TableCell>{grant.email}</TableCell><TableCell>{grant.status === 'pending' ? 'Awaiting first sign-in' : 'Active'}</TableCell><TableCell><Choice label={`Role for ${grant.email}`} value={grant.role} disabled={busy} onChange={(role) => void act(() => cloudOrganizations.setRole(organization.id, grant.id, role))} options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]} /></TableCell><TableCell><Button variant="ghost" disabled={busy} onClick={() => setRemove(grant)}>Remove</Button></TableCell></TableRow>)}</TableBody></Table>}
    <form className="grid max-w-xl gap-2 rounded-lg border p-4" onSubmit={(event) => {
      event.preventDefault(); setBusy(true); setError(null)
      void cloudOrganizations.create(organization.id, orgName, crypto.randomUUID()).then(async () => { setOrgName(''); await onChange() }).catch((error) => setError(cloudError(error))).finally(() => setBusy(false))
    }}><h2 className="text-lg font-medium">Create another organization</h2><Label htmlFor="organization-name">Organization name</Label><Input id="organization-name" value={orgName} maxLength={200} required onChange={(event) => setOrgName(event.target.value)} /><Button disabled={busy}>Create organization</Button></form>
    <Dialog open={Boolean(remove)} onOpenChange={(open) => { if (!open) setRemove(null) }}><DialogContent><DialogHeader><DialogTitle>Remove organization access?</DialogTitle><DialogDescription>{remove?.email} will lose access to organization projects. Projects they created remain in the organization.</DialogDescription></DialogHeader><Problem message={error} /><Button variant="destructive" disabled={busy} onClick={() => { if (remove) void act(() => cloudOrganizations.remove(organization.id, remove.id)) }}>Remove membership</Button></DialogContent></Dialog>
  </main>
}
