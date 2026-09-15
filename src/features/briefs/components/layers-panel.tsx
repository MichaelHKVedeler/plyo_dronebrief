import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Accordion } from '@/components/ui/accordion'
import { SettingsSection } from './settings-section'
import { ImageOverlayControls, type ImageControlsProps } from './image-overlay-controls'
import { ImageCountSummary } from './image-count-summary'
import { countBriefImages } from '../model/image-count'
import type { BriefSession } from '../state/brief-session'

export function LayersPanel({ session, ...imageControls }: ImageControlsProps & { session: BriefSession }) {
  const { brief } = session
  const editing = session.mode === 'edit'
  function commit(field: 'description' | 'instructions', value: string) {
    if (value !== brief.project[field]) imageControls.onUpdate((current) => ({ ...current, project: { ...current.project, [field]: value } }))
  }
  return <Accordion type="multiple" defaultValue={['description', 'floor-plan', 'calculate-images']}>
    <SettingsSection value="description" title="Description">
      {editing
        ? <>
          <div className="grid gap-2"><Label htmlFor="property-information">Property information</Label>
            <Textarea id="property-information" key={brief.id + '-description'} defaultValue={brief.project.description} maxLength={2000}
              placeholder="Notes about this property" onBlur={(event) => commit('description', event.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" key={brief.id + '-instructions'} defaultValue={brief.project.instructions} maxLength={2000}
              placeholder="Notes for the shoot" onBlur={(event) => commit('instructions', event.target.value)} /></div>
        </>
        : <>
          <div><p className="text-sm font-medium">Property information</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{brief.project.description || 'No property information.'}</p></div>
          <div><p className="text-sm font-medium">Instructions</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{brief.project.instructions || 'No instructions.'}</p></div>
        </>}
    </SettingsSection>
    <SettingsSection value="floor-plan" title="Floor plan">
      <ImageOverlayControls {...imageControls} overlays={brief.imageOverlays} editable={editing} />
    </SettingsSection>
    <SettingsSection value="calculate-images" title="Calculate images" count={countBriefImages(brief).total}>
      <ImageCountSummary brief={brief} />
    </SettingsSection>
  </Accordion>
}
