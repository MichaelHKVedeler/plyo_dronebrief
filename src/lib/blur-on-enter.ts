import type { KeyboardEvent } from 'react'

/** Enter confirms a single-line field by leaving it; blur handlers do the commit. */
export function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur()
}
