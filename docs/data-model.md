# Brief JSON v1

The runtime contract is `src/features/briefs/model/brief.ts`. This document explains its meaning.

| Field | Meaning |
| --- | --- |
| schemaVersion | 1 |
| id | Stable brief ID |
| createdAt, updatedAt | UTC ISO timestamps |
| project | name, clientName, optional description and instructions (max 2000 each), calendar date YYYY-MM-DD, times HH:mm[], optional shoots[{date, time, endTime?}] (max 3) |
| coordinates | Project/map reference point {lat, lng}; new briefs default to Oslo (59.9139, 10.7522) |
| circleRig | null or {id, position, radiusMeters, ovalRatio, rotationDegrees, arrowCount} |
| angles | Discriminated camera-angle array |
| typeSettings | Drone/360 heightsMeters arrays (new briefs: drone 40, 60; 360 2, 5, 8); DSLR angleCount and spacingDegrees plus preserved legacy heightsMeters |
| polygons | Newbuild polygons with id, label, and vertices[] |
| imageOverlays | Legacy embedded source or local file reference, plus transform metadata |
| references | Optional reference photos `{id, caption, source}` using the same source union as image overlays (max 4) |

Position coordinates use WGS84. Height is a requested photography height in meters, not a compliance limit or terrain-adjusted flight altitude. Schedule dates and times are wall-clock values at the shoot location; there is no timezone conversion in v1. `description` and `instructions` are additive schema v1 project notes fields (max 2000 characters each); older snapshots omit them and parse as empty strings. The Contents tab shows them as Property information and Instructions under Description. `shoots` is an additive schema v1 array of up to three `{date, time}` pairs used by the stacked map time sliders. The editor exposes one shared date at the top of the slider box and writes that date onto every slot. Older snapshots omit `shoots`; the UI then uses `date` plus the first three `times`. Saving from the sliders writes `shoots` and keeps `date`/`times` in sync so older readers still see the first date and the slot times. Extra times beyond three from older snapshots are dropped only after a slot edit. DB1/DB2 transport versions are unchanged.

### Shoot ranges

Every shoot slot is a range. `shoots[].endTime` (HH:mm) is the end on the slot's saved date. `time` is the start; `endTime` must be strictly later, with both between 00:00 and 23:59. Midnight-crossing ranges require separate dates/slots. A range counts as one shoot for capture totals. The legacy `project.times` list stores each slot's start, and `project.date` stores the first slot's date. Updated apps preserve the entire range through draft storage, DB1/DB2 import/export and PDF export. A new brief, and each newly added slot, starts as 07:00–17:00 on the current slot date. The editor always shows two handles. A stored time without `endTime` is shown from its start through 17:00 when that is later, otherwise through 23:59 (or 23:44–23:59 when the start is 23:59). Opening that brief in the editor saves the filled range. The viewer shows the same two handles without saving.

**Version decision:** this is an additive schema v1 field; DB1/DB2 transport versions are unchanged. Old snapshots import as stored, with no migration until an editor save fills a missing end. Older app builds ignore `endTime`, display the start time, and lose the end on re-export. Invalid or reversed ranges are rejected at import and at the session update boundary. Selection of the start/end handle is ephemeral: ShadeMap receives only that endpoint's instant, and selection never changes the saved range. Viewer adjustments remain temporary and do not alter the saved PDF schedule.

## Circle and oval

`radiusMeters` is the semi-major axis. `ovalRatio` is minor/major axis, 0.1–1; 1 is a circle. `rotationDegrees` rotates the major axis clockwise from north, in [0, 360). The rig's own position is independent of the project's reference coordinates.

Map geometry uses spherical distances and bearings with longitude wrapping. The rig outline has 64 vertices. The combined edge dot sits half a numbered-point interval after point 1, between badges. Dragging changes the semi-major axis and rotation together, compensating for the handle’s angular offset and oval ratio so it stays under the pointer. The center and oval ratio remain fixed. The oval handle sits halfway along the minor axis and changes the ratio without changing the major radius. These are planning graphics, not survey geometry.

`arrowCount` is an integer from 1–50, defaulting to 10 for new rigs and imported rigs missing the field. Numbered arrows follow clockwise parametric intervals around the circle/oval edge, starting at the rotated major-axis endpoint, and aim toward the center. Arrow symbols are offset 36 screen pixels toward the center; numbered badges are centered on the outline. Arrows have white fills and crisp 2-pixel colored strokes without shadows. They follow rig movement, rotation, and reshaping in both maps. This is an additive schema v1 extension; DB1/DB2 transport versions are unchanged. Older app builds ignore the field and lose it on re-export.

## Angles

```json
[
  {
    "id": "angle-1",
    "label": "South facade",
    "type": "drone-image",
    "position": { "lat": 51.5, "lng": -0.1 },
    "directionDegrees": 0
  },
  {
    "id": "angle-2",
    "label": "Panorama",
    "type": "360",
    "position": { "lat": 51.501, "lng": -0.101 }
  },
  {
    "id": "angle-3",
    "label": "Street elevation",
    "type": "dslr",
    "position": { "lat": 51.502, "lng": -0.102 },
    "directionDegrees": 90
  }
]
```

Drone and 360 points use the height list of their type. A 360 point has no top-level direction; its optional `focus` is described below. DSLR points use the shared `typeSettings.dslr.angleCount` (integer 1–12) and `spacingDegrees` (integer 15–floor(360 / angleCount)). The directions are symmetric around each point's saved `directionDegrees`; even counts straddle that bearing. Moving any aim handle rotates the fan together. The count/spacing applies to existing and future points, including placement previews and viewers. Renderers use a fixed 40-pixel screen radius for all drone-image and DSLR arrows regardless of count or spacing; dense fans may overlap. Camera number badges derive from array order within each camera type, starting at 1 and closing gaps after removal, and identify points in the UI. Reordering a category updates its positions within the angles array while preserving other categories. Legacy labels remain round-tripped for schema v1 compatibility but are not displayed or editable.

This is an additive **schema v1** extension, with unchanged DB1/DB2 transport versions. Missing DSLR fields default to one arrow and 30° spacing, preserving the appearance of older snapshots. `dslr.heightsMeters` remains validated and round-tripped unchanged for compatibility; it is no longer exposed as an editable or displayed DSLR setting and is never reinterpreted as arrow count or spacing. New exports include both arrow settings. Older app builds ignore these new fields and display one arrow; re-exporting from an older build loses the fan settings. Use an updated app to retain the fan. Invalid count/spacing combinations are rejected at import and at the session mutation boundary.

360 placement commits with one map click. DSLR and drone-image placement commits after pressing for the position, dragging to aim, and releasing. Only the resulting bearing is stored; the direction handle's screen-sized line is not a stored distance or field of view. Map drags commit position or direction at drag end. Temporary placement previews, selections, and layer visibility are excluded from JSON.

### 360 focus

360 points optionally store `focus: { directionDegrees, fovDegrees }`. The focus direction is clockwise from north in [0, 360); FOV is the sector's full angular width, 10–180°. Both numbers must be finite. For example, `"focus": { "directionDegrees": 90, "fovDegrees": 120 }` highlights a 120° sector centered east. Omission means no preferred focus and no cone; it does not imply a default direction. Clearing focus removes the property from JSON. Capture type, height rules and image counts are unchanged.

Right-dragging an existing icon previews focus in both maps, with one CSS pixel of radial mouse distance corresponding to one degree of width, clamped to the allowed range. Heading follows the pointer around the icon. Release commits through the session reducer; Escape, pointer cancellation and window blur discard the preview. The cone's radius is a 50-pixel visualization at zoom 17 and 100% Overlay size, scaled with the other camera graphics; it is not a stored capture distance. Both maps are locked north-up. Movement and duplication preserve focus. The viewer renders saved focus without editing it.

**Version decision:** optional focus is an additive schema v1 extension; DB1/DB2 transport versions stay unchanged. Previously valid snapshots require no migration and retain their original position-only meaning. Updated apps round-trip the focus through draft storage and share keys. Older builds ignore the optional field and lose it on re-export. Invalid focus is rejected at import and at the session update boundary.

### 360 height override

A 360 angle may store optional `heightsMeters`, the same meter list as `typeSettings['360'].heightsMeters` (up to 50 finite values from 0 to 10,000). The editor shows that list in a text field beside the point number. A non-empty list is the override and is used for image counts, project size and the public briefing. Clearing the field omits `heightsMeters`, and the point uses the shared 360 list. An imported empty array remains an override with no heights. Drone points and the circle rig still use the shared drone heights. Duplication copies the override. This is an additive schema v1 field; DB1/DB2 transport versions are unchanged. Older snapshots need no migration. Older builds ignore the field and lose it on re-export. Invalid lists are rejected at import and at the session update boundary.

## Polygons and image overlays

A polygon has at least three WGS84 vertices; the map renderer closes the ring. Polygon editing, geometry validity checks, and self-intersection handling are not yet implemented.

Image overlays use `id`, `name`, `source`, `position`, `widthMeters`, `heightMeters`, `rotationDegrees`, and `opacity`. Position is the image center; zero rotation puts its top edge north, positive rotation is clockwise, dimensions are meters (up to 10,000 on either side), and opacity is in [0, 1]. Both providers render the same rectangle in their locked top view. Geometry uses Web Mercator with local latitude compensation so an arbitrary anchor remains fixed during simultaneous rotation/scaling, including anchors outside the image. Edge movement preserves dimensions and rotation. Transform steps exceeding the dimension limits are rejected. Scene framing includes all four rotated corners.

`source` is either the original embedded PNG/JPEG/WebP base64 data URL or `{ kind: "local-file", fileId: UUID, fileName: string }`. New selections accept JPG/PNG only, validate their signature and decoded dimensions, and use the local-file variant. Temporary blob URLs, file URLs, arbitrary remote URLs, and SVG are rejected by the JSON schema. Runtime object URLs are released when replaced, removed, or the brief closes. Browser read-only FileSystemFileHandles are stored separately in IndexedDB under the UUID, never in JSON. In local-only briefs, image bytes are not uploaded or copied into persistent browser storage. New portable exports never include local image bytes. Cloud projects upload through their separate asset manifest. A plain browser cannot reveal the absolute local path. File access may require a permission gesture or reselection after reopening; recipients reconnect the file on their device.

**Version decision:** this is an additive schema v1 source variant; DB1/DB2 transport and all legacy source values retain their existing meaning. No migration is required for previously valid briefs. Older builds reject briefs containing local-file sources, so new local-image snapshots require an updated app. Legacy embedded snapshots continue to round-trip unchanged. Invalid local reference IDs are rejected. Do not silently convert local references into embedded data or remote sources.

Per-image opacity is an authored image setting, saved through the reducer after slider release. Layer visibility, opacity previews, selected image, and per-image editing anchor are session state and are not exported. A viewer can reconnect files and toggle the image layer without mutating its brief or writing a draft.

## Reference images

`references` is an additive schema v1 array of up to four `{id, caption, source}` photos. `source` uses the same embedded-or-local-file union as image overlays. Caption is 1–200 characters. These images are not placed on the map; Contents lists them below Floor plan. PDF export and the public briefing include them automatically (briefing details panel, after capture instructions). Cloud projects upload them through the same asset manifest as floorplans. Older snapshots omit the field and parse as `[]`. Older app builds ignore the field and lose it on re-export.

The whole JSON must fit within the existing 2 MB share-key limit. A local reference is device-specific rather than a portable image asset; export UI explicitly tells recipients to reconnect the matching file. Cloud storage uses the separate envelope described below without changing portable reference semantics.

ShadeMap consumes the same WGS84 positions and rig outline geometry without changing the JSON. Map renderer, center/zoom, and provider choice are ephemeral view state. Shadows use the currently active shoot slot in the viewed location's timezone. Newbuild polygons have no height and do not cast simulated shadows.

## Compatibility and validation

### Cloud project envelope

Firebase persistence uses a separate envelope version 1 containing the unchanged brief, an asset manifest and cloud project metadata. Cloud project IDs are independent of portable brief IDs. Organization membership, roles, creator/latest editor, revision and server timestamps are never inserted into portable JSON. Large bodies are serialized in bounded Firestore chunks and loaded/written transactionally.

The manifest maps a `local-file.fileId` to an immutable, project-scoped optimized Storage asset. The live project resolves the manifest; exporting the portable brief intentionally omits it and retains existing local-reference/reconnect semantics. There is no reinterpretation of DB1/DB2 snapshots or new remote source variant. Legacy embedded sources remain unchanged.

Asset metadata records original filename/size/oriented dimensions, final WebP dimensions/size, Storage path and optimizer version. Optimization preserves WGS84 placement, physical dimensions, rotation, opacity and transparency. It never changes an overlay's authored geometry. Byte limits and the optimization algorithm are documented in [Firebase setup](firebase-setup.md).

Authenticated project links are live membership-gated resources; public links are explicitly enabled revocable read-only capabilities and include optimized floorplans without sign-in. Neither is a portable snapshot key. Personal collection assignments and ephemeral transfer/view state remain separate from the brief.

Imports and saved drafts pass through the same Zod schema. Invalid values, unsupported versions, oversized keys, and malformed encoding are rejected. Unrecognized object fields are stripped by Zod. Add explicit version migrations before introducing incompatible semantics.

Transport versions are independent of the JSON schema: DB1 is base64url UTF-8 JSON; DB2 is base64url raw-DEFLATE UTF-8 JSON. New exports use DB2; imports accept both and retain the 2 MB uncompressed limit. Coordinates and other values are preserved without rounding. QR codes encode the same complete DB2 key and are omitted when it exceeds 2,200 characters.
