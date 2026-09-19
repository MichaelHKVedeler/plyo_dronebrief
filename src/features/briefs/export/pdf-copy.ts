export type PdfLanguage = 'en' | 'nb'

export const pdfCopy = {
  en: {
    title: 'Photo Brief', schedule: 'Time Slot', scheduleNote: 'Times indicate expected light conditions. The photographer can assess when conditions are best.',
    sunrise: 'Sunrise', daytime: 'Daytime', sunset: 'Sunset', blueHour: 'Blue hour',
    sunCalculated: 'Calculated for', sunMethod: 'SunCalc · local time', plannedShoots: 'Planned shoot times',
    sunDefinitions: 'Sunrise/sunset include golden hour. Blue hour: evening sun at -4° to -6°. Terrain and weather may affect the light.',
    noSunWindow: 'No standard window', noSunMatch: 'The planned times fall outside the standard sun periods.', polarDay: 'Midnight sun: no sunrise or sunset on this date.', polarNight: 'Polar night: the sun does not rise on this date.',
    addressNotSet: 'Address not specified', project: 'Project', projectSizes: { mini: 'Mini project', small: 'Small project', medium: 'Medium project', large: 'Large project' },
    captures: 'Capture requirements', information: 'Information', property: 'Property', instructions: 'Instructions', total: 'Amount of photos',
    rig: 'Circle / oval rig', drone: 'Aerial photo', panorama: '360°', dslr: 'DSLR', point: 'Point', points: 'points', arrows: 'angles',
    heights: 'Heights', ground: 'Ground-level', photos: 'photos', time: 'time slot', times: 'time slots', perTime: 'per time slot',
    individual: 'Individual photos, not a stitched panorama', panoramaRule: '10 photos per point and height',
    droneRule: '1 photo per point and height', rigRule: '1 photo per arrow and height', dslrRule: '1 photo per angle',
    notSet: 'Not specified', none: 'No camera points or rig added.', map: 'Photo positions', mapPlan: 'Photo positions with floor plan',
    diagram: 'Point diagram - no basemap', reference: 'Reference', positions: 'Points', delivery: 'Files',
    positionsNote: 'All points are indicative. Move the point of view if anything blocks the drone or camera.',
    files: 'RAW + JPG', folders: 'Organize in folders: Time slot / Type / Point / Height',
    coordinates: 'Coordinates', direction: 'Direction', focus: 'Focus', continued: 'continued', client: 'Client',
    emptyNotes: 'No additional information provided.', mapNote: 'North up. Camera numbers match the brief.',
    diagramNote: 'Schematic positions only. Use the coordinates for navigation.', captureList: 'Points and coordinates',
    pointLegend: 'R: rig arrow · R0: rig center · D: aerial photo · P: 360° · S: DSLR',
    headingFov: 'Heading / FOV',
  },
  nb: {
    title: 'Fotobrief', schedule: 'Tidspunkt', scheduleNote: 'Planlagte fototidspunkt. Fotografen kan vurdere når lysforholdene er best.',
    sunrise: 'Soloppgang', daytime: 'Dagtid', sunset: 'Solnedgang', blueHour: 'Blåtime',
    sunCalculated: 'Beregnet for', sunMethod: 'SunCalc · lokal tid', plannedShoots: 'Planlagte fototidspunkt',
    sunDefinitions: 'Soloppgang/solnedgang inkluderer den gylne timen. Blåtime: kveldssol ved -4° til -6°. Terreng og vær kan påvirke lyset.',
    noSunWindow: 'Ingen standardperiode', noSunMatch: 'De planlagte tidene er utenfor de vanlige solperiodene.', polarDay: 'Midnattssol: ingen soloppgang eller solnedgang denne datoen.', polarNight: 'Mørketid: solen står ikke opp denne datoen.',
    addressNotSet: 'Adresse ikke angitt', project: 'Prosjekt', projectSizes: { mini: 'Miniprosjekt', small: 'Lite prosjekt', medium: 'Mellomstort prosjekt', large: 'Stort prosjekt' },
    captures: 'Fotoplan', information: 'Informasjon', property: 'Eiendom / tomt', instructions: 'Instruksjoner', total: 'Antall foto',
    rig: 'Sirkel- / ovalrigg', drone: 'Oversiktsfoto', panorama: '360°', dslr: 'DSLR', point: 'Punkt', points: 'punkter', arrows: 'vinkler',
    heights: 'Høyder', ground: 'Bakkenivå', photos: 'foto', time: 'tidspunkt', times: 'tidspunkt', perTime: 'per tidspunkt',
    individual: 'Individuelle bilder, ikke et sammensatt panorama', panoramaRule: '10 foto per punkt og høyde',
    droneRule: '1 foto per punkt og høyde', rigRule: '1 foto per pil og høyde', dslrRule: '1 foto per vinkel',
    notSet: 'Ikke angitt', none: 'Ingen kamerapunkter eller rigg lagt til.', map: 'Fotopunkter', mapPlan: 'Fotopunkter med situasjonsplan',
    diagram: 'Punktdiagram - uten bakgrunnskart', reference: 'Referanse', positions: 'Punkter', delivery: 'Filer',
    positionsNote: 'Alle punkter er veiledende. Flytt standpunktet hvis noe blokkerer sikten til dronen eller kameraet.',
    files: 'RAW + JPG', folders: 'Organiser i mapper: Tidspunkt / Type / Punkt / Høyde',
    coordinates: 'Koordinater', direction: 'Retning', focus: 'Fokus', continued: 'fortsetter', client: 'Kunde',
    emptyNotes: 'Ingen tilleggsinformasjon angitt.', mapNote: 'Nord opp. Punktnumrene samsvarer med briefen.',
    diagramNote: 'Skjematiske posisjoner. Bruk koordinatene til navigasjon.', captureList: 'Punkter og koordinater',
    pointLegend: 'R: riggpil · R0: riggsenter · D: oversiktsfoto · P: 360° · S: DSLR',
    headingFov: 'Retning / FOV',
  },
} as const

export function pdfFilename(name: string, language: PdfLanguage) {
  const safe = [...name.normalize('NFC')].map((char) => char.charCodeAt(0) < 32 ? '-' : char).join('').replace(/[<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 100) || 'Project'
  return `${safe}_${language === 'nb' ? 'Fotobrief' : 'Photobrief'}_Plyo.pdf`
}

export function pdfDate(date: string, language: PdfLanguage) {
  return new Intl.DateTimeFormat(language === 'nb' ? 'nb-NO' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(date + 'T12:00:00Z'))
}
