import { useState } from 'react'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrief, projectSchema, type DroneBrief, type ProjectDetails } from '@/features/briefs/model/brief'

export function CreateBriefPage({ onCreate, onCancel }: { onCreate: (brief: DroneBrief) => void; onCancel: () => void }) {
  const [step, setStep] = useState(0)
  const [project, setProject] = useState<ProjectDetails>({ name: '', clientName: '', date: '', times: ['09:00'] })
  const [error, setError] = useState('')
  const update = (patch: Partial<ProjectDetails>) => setProject((current) => ({ ...current, ...patch }))
  return <main className="mx-auto max-w-xl px-6 py-10">
    <Button variant="ghost" className="mb-5 -ml-3" onClick={onCancel}><ArrowLeft /> Back to home</Button>
    <Card>
      <CardHeader><Badge variant="secondary" className="mb-2 w-fit">Step {step + 1} of 2</Badge><CardTitle className="text-2xl">{step === 0 ? 'Project details' : 'Shoot schedule'}</CardTitle><CardDescription>{step === 0 ? 'Who is this drone brief for?' : 'Choose a date and one or more shoot times.'}</CardDescription></CardHeader>
      <CardContent><form className="grid gap-5" onSubmit={(event) => {
        event.preventDefault()
        if (step === 0) {
          const valid = projectSchema.pick({ name: true, clientName: true }).safeParse(project)
          if (!valid.success) { setError('Enter a project name and client name.'); return }
          setError(''); setStep(1); return
        }
        const valid = projectSchema.safeParse(project)
        if (!valid.success) { setError('Enter a valid date and at least one shoot time.'); return }
        onCreate(createBrief({ ...valid.data, times: [...new Set(valid.data.times)].sort() }))
      }}>
        {step === 0 ? <>
          <div className="grid gap-2"><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={project.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Riverside development" maxLength={200} required autoFocus /></div>
          <div className="grid gap-2"><Label htmlFor="client-name">Client name</Label><Input id="client-name" value={project.clientName} onChange={(e) => update({ clientName: e.target.value })} placeholder="Client or company" maxLength={200} required /></div>
        </> : <>
          <div className="grid gap-2"><Label htmlFor="shoot-date">Shoot date</Label><Input id="shoot-date" type="date" value={project.date} onChange={(e) => update({ date: e.target.value })} required /></div>
          <div className="grid gap-3">{project.times.map((time, index) => <div key={index} className="grid gap-2">
            <Label htmlFor={'shoot-time-' + index}>Shoot time {index + 1}</Label>
            <div className="flex gap-2"><Input id={'shoot-time-' + index} type="time" value={time} required onChange={(e) => update({ times: project.times.map((value, i) => i === index ? e.target.value : value) })} /><Button type="button" variant="outline" size="icon" disabled={project.times.length === 1} aria-label={'Remove shoot time ' + (index + 1)} onClick={() => update({ times: project.times.filter((_, i) => i !== index) })}><X /></Button></div>
          </div>)}
          <Button type="button" variant="outline" className="w-fit" disabled={project.times.length >= 24} onClick={() => update({ times: [...project.times, '12:00'] })}><Plus /> Add time</Button></div>
          <p className="text-sm text-muted-foreground">Times are local to the shoot location.</p>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-between gap-3">{step === 1 && <Button type="button" variant="outline" onClick={() => { setStep(0); setError('') }}>Back</Button>}<Button type="submit" className="ml-auto">{step === 0 ? 'Continue' : 'Create brief'}</Button></div>
      </form></CardContent>
    </Card>
  </main>
}
