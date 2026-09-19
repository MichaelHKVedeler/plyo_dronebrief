# Brief JSON v1

The runtime contract is `src/features/briefs/model/brief.ts`. This document explains its meaning.

| Field | Meaning |
| --- | --- |
| schemaVersion | 1 |
| id | Stable brief ID |
| createdAt, updatedAt | UTC ISO timestamps |
| project | name, clientName, optional description and instructions (max 2000 each), calendar date YYYY-MM-DD, times HH:mm[], optional shoots[{date, time}] (max 3) |
| coordinates | Project/map reference point {lat, lng}; new briefs default to Oslo (59.9139, 10.7522) |
| circleRig | null or {id, position, radiusMeters, ovalRatio, rotationDegrees, arrowCount} |
| angles | Discriminated camera-angle array |
| typeSettings | Drone/360 heightsMeters arrays (new briefs: drone 40, 60; 360 2, 5, 8); DSLR angleCount and spacingDegrees plus preserved legacy heightsMeters |
| polygons | Newbuild polygons with id, label, and vertices[] |
| imageOverlays | Legacy embedded source or local file reference, plus transform metadata |

Position coordinates use WGS84. Height is a requested photography height in meters, not a compliance limit or terrain-adjusted flight altitude. Schedule dates and times are wall-clock values at the shoot location; there is no timezone conversion in v1. `description` and `instructions` are additive schema v1 project notes fields (max 2000 characters each); older snapshots omit them and parse as empty strings. The Contents tab shows them as Property information and Instructions under Description. `shoots` is an additive schema v1 array of up to three `{date, time}` pairs used by the stacked map time sliders. The editor exposes one shared date at the top of the slider box and writes that date onto every slot. Older snapshots omit `shoots`; the UI then uses `date` plus the first three `times`. Saving from the sliders writes `shoots` and keeps `date`/`times` in sync so older readers still see the first date and the slot times. Extra times beyond three from older snapshots are dropped only after a slot edit. DB1/DB2 transport versions are unchanged.

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

## Polygons and image overlays

A polygon has at least three WGS84 vertices; the map renderer closes the ring. Polygon editing, geometry validity checks, and self-intersection handling are not yet implemented.

Image overlays use `id`, `name`, `source`, `position`, `widthMeters`, `heightMeters`, `rotationDegrees`, and `opacity`. Position is the image center; zero rotation puts its top edge north, positive rotation is clockwise, dimensions are meters (up to 10,000 on either side), and opacity is in [0, 1]. Both providers render the same rectangle in their locked top view. Geometry uses Web Mercator with local latitude compensation so an arbitrary anchor remains fixed during simultaneous rotation/scaling, including anchors outside the image. Edge movement preserves dimensions and rotation. Transform steps exceeding the dimension limits are rejected. Scene framing includes all four rotated corners.

`source` is either the original embedded PNG/JPEG/WebP base64 data URL or `{ kind: "local-file", fileId: UUID, fileName: string }`. New selections accept JPG/PNG only, validate their signature and decoded dimensions, and use the local-file variant. Temporary blob URLs, file URLs, arbitrary remote URLs, and SVG are rejected by the JSON schema. Runtime object URLs are released when replaced, removed, or the brief closes. Browser read-only FileSystemFileHandles are stored separately in IndexedDB under the UUID, never in JSON. No image bytes are uploaded, copied into persistent browser storage, or included in a new local-image export. A plain browser cannot reveal the absolute local path. File access may require a permission gesture or reselection after reopening; recipients reconnect the file on their device.

**Version decision:** this is an additive schema v1 source variant; DB1/DB2 transport and all legacy source values retain their existing meaning. No migration is required for previously valid briefs. Older builds reject briefs containing local-file sources, so new local-image snapshots require an updated app. Legacy embedded snapshots continue to round-trip unchanged. Invalid local reference IDs are rejected. Do not silently convert local references into embedded data or remote sources.

Per-image opacity is an authored image setting, saved through the reducer after slider release. Layer visibility, opacity previews, selected image, and per-image editing anchor are session state and are not exported. A viewer can reconnect files and toggle the image layer without mutating its brief or writing a draft.

The whole JSON must fit within the existing 2 MB share-key limit. A local reference is device-specific rather than a portable image asset; export UI explicitly tells recipients to reconnect the matching file. Remote asset storage would require a separate deliberate contract decision.

ShadeMap consumes the same WGS84 positions and rig outline geometry without changing the JSON. Map renderer, center/zoom, and provider choice are ephemeral view state. Shadows use the currently active shoot slot in the viewed location's timezone. Newbuild polygons have no height and do not cast simulated shadows.

## Compatibility and validation

Imports and saved drafts pass through the same Zod schema. Invalid values, unsupported versions, oversized keys, and malformed encoding are rejected. Unrecognized object fields are stripped by Zod. Add explicit version migrations before introducing incompatible semantics.

Transport versions are independent of the JSON schema: DB1 is base64url UTF-8 JSON; DB2 is base64url raw-DEFLATE UTF-8 JSON. New exports use DB2; imports accept both and retain the 2 MB uncompressed limit. Coordinates and other values are preserved without rounding. QR codes encode the same complete DB2 key and are omitted when it exceeds 2,200 characters.
