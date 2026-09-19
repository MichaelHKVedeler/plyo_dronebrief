import { useEffect, useRef, useState, type RefObject } from 'react'
import { ArrowLeft, ArrowRight, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { DroneBrief } from '../model/brief'
import { countBriefImages } from '../model/image-count'
import { pdfCopy, pdfDate, pdfFilename, type PdfLanguage } from '../export/pdf-copy'
import type { PdfMapCapture } from '../export/pdf-types'
import { pdfProjectPosition, pdfProjectSize } from '../export/pdf-project'
import { sunlightRange, usedSunlightDays } from '@/features/map/sunlight-times'
import { formatShootTime, shootSlots } from '../model/brief'
import { usePdfAddress } from './use-pdf-address'

type Props = { brief: DroneBrief; editable: boolean; captureRef: RefObject<PdfMapCapture | null>; onSaveNotes: (notes: { description: string; instructions: string }) => void; onClose: () => void }
export function PdfExportDialog({ brief, editable, captureRef, onSaveNotes, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [language, setLanguage] = useState<PdfLanguage>('en')
  const [includeProjectName, setIncludeProjectName] = useState(true)
  const [includeClientName, setIncludeClientName] = useState(true)
  const position = pdfProjectPosition(brief)
  const address = usePdfAddress(position)
  const copy = pdfCopy[language]
  const slots = shootSlots(brief.project)
  const sunDays = usedSunlightDays(slots, position)
  const [description, setDescription] = useState(brief.project.description)
  const [instructions, setInstructions] = useState(brief.project.instructions)
  const [saveNotes, setSaveNotes] = useState(editable)
  const [diagram, setDiagram] = useState(false)
  const [references, setReferences] = useState<{ file: File; caption: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => { abort.current?.abort() }, [])
  const notesChanged = description !== brief.project.description || instructions !== brief.project.instructions
  async function download() {
    if (busy) return
    const controller = new AbortController(); abort.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 60_000)
    setBusy(true); setError(''); setDone(false); setStatus('Preparing PDF…')
    try {
      const [{ createBriefPdf }, { loadPdfAssets, pdfReference, downloadPdf }] = await Promise.all([import('../export/create-brief-pdf'), import('../export/pdf-browser')])
      const assets = await loadPdfAssets(controller.signal)
      let maps = [] as Awaited<ReturnType<PdfMapCapture>>
      if (!diagram) {
        setStatus('Preparing map pages…')
        if (!captureRef.current) throw new Error('The map is unavailable. Choose Point diagram to export without a basemap.')
        maps = await captureRef.current(controller.signal)
      }
      setStatus('Creating PDF pages…')
      const images = await Promise.all(references.map((reference) => pdfReference(reference.file, reference.caption)))
      controller.signal.throwIfAborted()
      const notes = { description, instructions }
      const bytes = await createBriefPdf({ brief, language, coverAddress: address.address.trim(), includeProjectName, includeClientName, notes, maps, diagram, references: images }, assets)
      controller.signal.throwIfAborted()
      downloadPdf(bytes, pdfFilename(brief.project.name, language))
      if (editable && saveNotes && notesChanged) onSaveNotes(notes)
      setDone(true); setStatus('PDF download started.')
    } catch (cause) {
      setError(controller.signal.aborted ? 'Export cancelled or timed out. You can try again.' : cause instanceof Error ? cause.message : 'PDF export failed. Please try again.')
      setStatus('')
    } finally { clearTimeout(timeout); setBusy(false); abort.current = null }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) { abort.current?.abort(); onClose() } }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Export as PDF</DialogTitle><DialogDescription>Follow the Plyo photo brief layout. Step {step + 1} of 3.</DialogDescription></DialogHeader>
      <div className="flex gap-3 text-xs text-muted-foreground" aria-label="Export steps">
        {['Cover', 'Information', 'Review'].map((label, i) => <span key={label} aria-current={step === i ? 'step' : undefined} className={step === i ? 'font-semibold text-foreground' : ''}>{i + 1}. {label}</span>)}
      </div>
      {step === 0 && <div className="grid gap-4 py-2">
        <h3 className="font-semibold">Choose the PDF language</h3>
        <div role="group" aria-label="PDF language" className="grid grid-cols-2 gap-3">
          <Button variant={language === 'en' ? 'default' : 'outline'} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</Button>
          <Button variant={language === 'nb' ? 'default' : 'outline'} aria-pressed={language === 'nb'} onClick={() => setLanguage('nb')}>Norsk bokmål</Button>
        </div>
        <p className="text-sm text-muted-foreground">Headings and standard instructions use this language. Your project name and written notes are included as entered.</p>
        <div className="grid gap-2 border-t pt-4">
          <Label htmlFor="pdf-address">Street address: Area</Label>
          <Input id="pdf-address" value={address.address} maxLength={200} onChange={(event) => address.change(event.target.value)} placeholder="Street address: Area" />
          <p role="status" className="text-sm text-muted-foreground">{address.message}</p>
          <p className="text-xs text-muted-foreground">{brief.circleRig ? 'Based on the circle rig location.' : brief.angles.length ? 'No circle rig: using the first camera point.' : 'No circle rig or camera points: using the project location.'} This name is used on the PDF cover only.</p>
          {address.suggestion && address.address !== address.suggestion && <Button variant="outline" className="h-auto whitespace-normal" onClick={address.useSuggestion}>Use suggested address: {address.suggestion}</Button>}
          {!address.loading && !address.suggestion && <Button variant="outline" onClick={address.retry}>Retry address lookup</Button>}
          <Label className="mt-2 flex items-center gap-3"><Switch checked={includeProjectName} onCheckedChange={setIncludeProjectName} />Include project name on cover</Label>
          <Label className="flex items-center gap-3"><Switch checked={includeClientName} onCheckedChange={setIncludeClientName} />Include client name on cover</Label>
          <div aria-label="Cover preview" className="mt-1 rounded-lg border p-3 text-sm"><p className="font-semibold break-words">{address.address || copy.addressNotSet}</p>{includeProjectName && <p className="break-words">{brief.project.name}</p>}{includeClientName && <p className="text-muted-foreground break-words">{brief.project.clientName}</p>}</div>
        </div>
      </div>}
      {step === 1 && <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">{!brief.project.description.trim() || !brief.project.instructions.trim() ? 'Some information is empty. Would you like to add it before exporting? You can leave either field blank and continue.' : 'Review the property information and instructions for your PDF.'}</p>
        <div className="grid gap-2"><Label htmlFor="pdf-property">Property information{!brief.project.description.trim() ? ' (optional)' : ''}</Label><Textarea id="pdf-property" value={description} maxLength={2000} rows={4} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the property, site, or project…" /></div>
        <div className="grid gap-2"><Label htmlFor="pdf-instructions">Instructions{!brief.project.instructions.trim() ? ' (optional)' : ''}</Label><Textarea id="pdf-instructions" value={instructions} maxLength={2000} rows={4} onChange={(e) => setInstructions(e.target.value)} placeholder="Add access details or instructions for the photographer…" /></div>
        {editable && <Label className="flex items-center gap-3"><Switch checked={saveNotes} onCheckedChange={setSaveNotes} />Save these notes to the brief when exporting</Label>}
        {!editable && <p className="text-sm text-muted-foreground">These notes apply to this PDF only. The shared brief stays read-only.</p>}
      </div>}
      {step === 2 && <div className="grid gap-4">
        <div className="rounded-lg border p-3 text-sm"><p className="font-semibold break-words">{brief.project.name}</p><p>{language === 'nb' ? 'Norsk bokmål' : 'English'} · {countBriefImages(brief).total} photos</p><p className="mt-2 font-semibold">{copy.projectSizes[pdfProjectSize(brief)]}</p><p className="text-xs text-muted-foreground">Automatically matched to the template's point counts and height levels. Rig arrows count as aerial positions.</p><p className="mt-2 text-muted-foreground">Cover, sun times, project size and captures, compact point list, property information, brief maps, optional references, and Points / Files.</p></div>
        <div className="grid gap-3 rounded-lg border p-3 text-sm" aria-label="Calculated sun times">
          <h3 className="font-semibold">Calculated sun times</h3>
          {sunDays.map((day) => <div key={day.date}>
            <p className="mb-1 font-medium">{pdfDate(day.date, language)} · {day.zone}</p>
            {day.usedPhases.length ? <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">{day.usedPhases.map((phase) => <div key={phase} className="contents"><dt>{copy[phase]}</dt><dd>{sunlightRange(day.phases[phase], day.date, day.zone) ?? copy.noSunWindow}</dd></div>)}</dl> : <p>{copy.noSunMatch}</p>}
            <p className="mt-2 text-xs">{copy.plannedShoots}: {slots.filter((slot) => slot.date === day.date).map(formatShootTime).join(', ')}</p>
            {day.condition !== 'normal' && <p className="mt-1">{copy[day.condition]}</p>}
          </div>)}
          <p className="text-xs text-muted-foreground">{copy.sunDefinitions}</p>
        </div>
        <div className="grid gap-2"><Label>Map pages</Label><div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="PDF map source">
          <Button disabled={busy} variant={!diagram ? 'default' : 'outline'} aria-pressed={!diagram} onClick={() => setDiagram(false)}>Current map provider</Button>
          <Button disabled={busy} variant={diagram ? 'default' : 'outline'} aria-pressed={diagram} onClick={() => setDiagram(true)}>Point diagram</Button>
        </div><p className="text-sm text-muted-foreground">{diagram ? 'A labeled position diagram without a basemap or floor plan. Coordinates are listed in the PDF.' : 'The map frames all points for export, then restores your view. Includes a second map without the floor plan when one is present.'}</p></div>
        <div className="grid gap-2"><Label htmlFor="pdf-references">Reference images (optional, up to 4 JPG/PNG files)</Label>
          <Input id="pdf-references" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple disabled={busy} onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length + references.length > 4) { setError('Choose at most four reference images.'); e.target.value = ''; return }
            if (files.some((file) => file.size > 30 * 1024 * 1024 || !/\.(jpe?g|png)$/i.test(file.name))) { setError('Use JPG or PNG reference images under 30 MB each.'); e.target.value = ''; return }
            setReferences((previous) => [...previous, ...files.map((file) => ({ file, caption: file.name.replace(/\.[^.]+$/, '') }))]); setError(''); e.target.value = ''
          }} />
          {references.map((reference, i) => <div key={i} className="flex gap-2"><Input disabled={busy} aria-label={'Reference caption ' + (i + 1)} value={reference.caption} maxLength={200} onChange={(e) => setReferences((current) => current.map((r, index) => i === index ? { ...r, caption: e.target.value } : r))} /><Button disabled={busy} variant="ghost" size="icon" aria-label={'Remove reference ' + (i + 1)} onClick={() => setReferences((current) => current.filter((_, index) => i !== index))}><X /></Button></div>)}
        </div>
      </div>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {status && <p role="status" className="text-sm">{status}</p>}
      <div className="flex flex-wrap justify-between gap-2 pt-2">
        <Button variant="outline" disabled={busy} onClick={() => step ? setStep((s) => s - 1) : onClose()}><ArrowLeft />{step ? 'Back' : 'Cancel'}</Button>
        {step < 2 ? <Button onClick={() => { setError(''); setStep((s) => s + 1) }}>Continue<ArrowRight /></Button> : busy ? <Button variant="outline" onClick={() => abort.current?.abort()}>Cancel export</Button> : <Button onClick={download}><Download />{done ? 'Download again' : 'Download PDF'}</Button>}
      </div>
    </DialogContent>
  </Dialog>
}
