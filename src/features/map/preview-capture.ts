/** A small JPEG of the Google map as it is on screen, for the project card. Null when that map is not showing or a tile is missing. */
export async function captureMapPreview(width = 512, height = 288): Promise<string | null> {
  const surface = document.querySelector<HTMLElement>('[data-pdf-map-surface]')
  // Not drawn yet, ShadeMap in front, or a "map could not load" message: nothing worth keeping.
  if (!surface || surface.hasAttribute('inert') || surface.clientWidth < 1 || surface.clientHeight < 1 || surface.querySelector('[data-pdf-map-unavailable]') || !surface.querySelector('img, canvas')) return null
  const { toCanvas } = await import('html-to-image')
  let imageFailed = false
  const shot = await toCanvas(surface, {
    pixelRatio: 1, skipFonts: true, includeQueryParams: true,
    onImageErrorHandler: () => { imageFailed = true },
    filter: (element) => !(element instanceof Element) || !element.matches('iframe, [data-pdf-exclude]'),
  })
  const card = document.createElement('canvas')
  card.width = width; card.height = height
  const context = card.getContext('2d')
  if (imageFailed || shot.width < 1 || shot.height < 1 || !context) return null
  // Keep the middle of the map and fill the card's shape.
  const scale = Math.max(width / shot.width, height / shot.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(shot, (shot.width - width / scale) / 2, (shot.height - height / scale) / 2, width / scale, height / scale, 0, 0, width, height)
  return card.toDataURL('image/jpeg', 0.7)
}
