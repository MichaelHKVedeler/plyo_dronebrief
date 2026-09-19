import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrief, type DroneBrief } from '@/features/briefs/model/brief'

export function CreateBriefPage({ onCreate, onCancel }: { onCreate: (brief: DroneBrief) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState('')
  return <main className="mx-auto max-w-xl px-6 py-10">
    <Button variant="ghost" className="mb-5 -ml-3" onClick={onCancel}><ArrowLeft /> Back to home</Button>
    <Card>
      <CardHeader><CardTitle className="text-2xl">Project details</CardTitle></CardHeader>
      <CardContent><form className="grid gap-5" onSubmit={(event) => {
        event.preventDefault()
        const project = { name: name.trim(), clientName: clientName.trim() }
        if (!project.name || !project.clientName) { setError('Enter a project name and client name.'); return }
        setError('')
        onCreate(createBrief(project))
      }}>
        <div className="grid gap-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside development" maxLength={200} required autoFocus /></div>
        <div className="grid gap-2"><Label htmlFor="client-name">Client name</Label><Input id="client-name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or company" maxLength={200} required /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end"><Button type="submit">Create brief</Button></div>
      </form></CardContent>
    </Card>
  </main>
}
