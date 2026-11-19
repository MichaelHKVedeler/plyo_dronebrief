import { useRef } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import { ImageOverlayControls, type ImageControlsProps } from './image-overlay-controls'
import { ReferenceImageControls } from './reference-image-controls'
import { ImageCountSummary } from './image-count-summary'
import { countBriefImages } from '../model/image-count'
import type { LayerVisibility } from '../model/brief'
import type { BriefSession } from '../state/brief-session'
import type { LocalImages } from '../state/use-local-images'

export function LayersPanel({ session, referenceImages, onVisibilityChange, ...imageControls }: ImageControlsProps & {
  session: BriefSession
  referenceImages: LocalImages
  onVisibilityChange: (layer: keyof LayerVisibility, visible: boolean) => void
}) {
  const { brief } = session
  const editing = session.mode === 'edit'
  // Notes save after a pause in typing, so closing the tab mid-note loses a second of text, not all of it.
  const pause = useRef<number>(undefined)
  const soon = (field: 'description' | 'instructions', value: string) => { clearTimeout(pause.current); pause.current = window.setTimeout(() => commit(field, value), 1000) }
  function commit(field: 'description' | 'instructions', value: string) {
    clearTimeout(pause.current)
    if (value !== brief.project[field]) imageControls.onUpdate((current) => ({ ...current, project: { ...current.project, [field]: value } }))
  }
  return <Accordion type="multiple" defaultValue={['description', 'floor-plan', 'references', 'calculate-images']}>
    <SettingsSection value="description" title="Description">
      {editing
        ? <>
          <div className="grid gap-2"><Label htmlFor="property-information">Property information</Label>
            <Textarea id="property-information" key={brief.id + '-description'} defaultValue={brief.project.description} maxLength={2000}
              placeholder="Notes about this property" onChange={(event) => soon('description', event.target.value)} onBlur={(event) => commit('description', event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" key={brief.id + '-instructions'} defaultValue={brief.project.instructions} maxLength={2000}
              placeholder="Notes for the shoot" onChange={(event) => soon('instructions', event.target.value)} onBlur={(event) => commit('instructions', event.target.value)} /></div>
        </>
        : <>
          <div><p className="text-sm font-medium">Property information</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{brief.project.description || 'No property information.'}</p></div>
          <div><p className="text-sm font-medium">Instructions</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{brief.project.instructions || 'No instructions.'}</p></div>
        </>}
    </SettingsSection>
    <SettingsSection value="floor-plan" title="Site plan" visibility={{ visible: session.visibility.imageOverlays, onToggle: () => onVisibilityChange('imageOverlays', !session.visibility.imageOverlays) }}>
      <ImageOverlayControls {...imageControls} overlays={brief.imageOverlays} editable={editing} />
    </SettingsSection>
    <SettingsSection value="references" title="Reference images" count={brief.references.length}>
      <ReferenceImageControls references={brief.references} editable={editing} images={referenceImages} onUpdate={imageControls.onUpdate} />
    </SettingsSection>
    <SettingsSection value="calculate-images" title="Calculate images" count={countBriefImages(brief).total}>
      <ImageCountSummary brief={brief} />
    </SettingsSection>
  </Accordion>
}
