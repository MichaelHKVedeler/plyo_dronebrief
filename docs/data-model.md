# Brief JSON v1

The runtime contract is `src/features/briefs/model/brief.ts`. This document explains its meaning.

| Field | Meaning |
| --- | --- |
| schemaVersion | 1 |
| id | Stable brief ID |
| createdAt, updatedAt | UTC ISO timestamps |
| project | name, clientName, calendar date YYYY-MM-DD, times HH:mm[] |
| coordinates | Project/map reference point {lat, lng}; new briefs default to Oslo (59.9139, 10.7522) |
| circleRig | null or {id, position, radiusMeters, ovalRatio, rotationDegrees} |
| angles | Discriminated camera-angle array |
| typeSettings | Drone/360 heightsMeters arrays; DSLR angleCount and spacingDegrees plus preserved legacy heightsMeters |
| polygons | Newbuild polygons with id, label, and vertices[] |
| imageOverlays | Durable image source and transform metadata |

Position coordinates use WGS84. Height is a requested photography height in meters, not a compliance limit or terrain-adjusted flight altitude. Schedule dates and times are wall-clock values at the shoot location; there is no timezone conversion in v1.

## Circle and oval

`radiusMeters` is the semi-major axis. `ovalRatio` is minor/major axis, 0.1–1; 1 is a circle. `rotationDegrees` rotates the major axis clockwise from north, in [0, 360). The rig's own position is independent of the project's reference coordinates.

Map geometry uses spherical distances and bearings with longitude wrapping. The rig outline has 64 vertices. The combined edge dot changes the semi-major axis and its bearing together: distance from the center determines radius, and direction from the center determines rotation. The dot stays on the major-axis endpoint while the center and oval ratio remain fixed. The oval handle sits halfway along the minor axis and changes the ratio without changing the major radius. These are planning graphics, not survey geometry.

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

Drone and 360 points use the height list of their type. No direction field is used for 360. DSLR points use the shared `typeSettings.dslr.angleCount` (integer 1–12) and `spacingDegrees` (integer 15–floor(360 / angleCount)). The directions are symmetric around each point's saved `directionDegrees`; even counts straddle that bearing. Moving any aim handle rotates the fan together. The count/spacing applies to existing and future points, including placement previews and viewers. Renderers use a fixed 40-pixel screen radius for all drone-image and DSLR arrows regardless of count or spacing; dense fans may overlap. Camera number badges derive from array order within each camera type, starting at 1 and closing gaps after removal, and identify points in the UI. Reordering a category updates its positions within the angles array while preserving other categories. Legacy labels remain round-tripped for schema v1 compatibility but are not displayed or editable.

This is an additive **schema v1** extension, with unchanged DB1/DB2 transport versions. Missing DSLR fields default to one arrow and 30° spacing, preserving the appearance of older snapshots. `dslr.heightsMeters` remains validated and round-tripped unchanged for compatibility; it is no longer exposed as an editable or displayed DSLR setting and is never reinterpreted as arrow count or spacing. New exports include both arrow settings. Older app builds ignore these new fields and display one arrow; re-exporting from an older build loses the fan settings. Use an updated app to retain the fan. Invalid count/spacing combinations are rejected at import and at the session mutation boundary.

360 placement commits with one map click. DSLR and drone-image placement commits after pressing for the position, dragging to aim, and releasing. Only the resulting bearing is stored; the direction handle's screen-sized line is not a stored distance or field of view. Map drags commit position or direction at drag end. Temporary placement previews, selections, and layer visibility are excluded from JSON.

## Polygons and image overlays

A polygon has at least three WGS84 vertices; the map renderer closes the ring. Polygon editing, geometry validity checks, and self-intersection handling are not yet implemented.

Image overlays reserve `id`, `name`, `source`, `position`, `widthMeters`, `heightMeters`, `rotationDegrees`, and `opacity`. Position is the image center, rotation is clockwise, and opacity is in [0, 1]. v1 accepts only embedded PNG/JPEG/WebP base64 data URLs, not temporary blob URLs, arbitrary remote URLs, or SVG. Uploading, aligning, and rendering the image overlay are not implemented in this skeleton. The schema preserves imported overlay metadata and the layers panel lists it.

The whole JSON must fit within the 2 MB share-key limit. Future remote asset storage will require a deliberate contract and import-validation update.

ShadeMap consumes the same WGS84 positions and rig outline geometry without changing the JSON. Map renderer, center/zoom, and the shadow slider are ephemeral view state. Shadows use the project's shoot date plus the selected time in the viewed location's timezone. Newbuild polygons have no height and do not cast simulated shadows.

## Compatibility and validation

Imports and saved drafts pass through the same Zod schema. Invalid values, unsupported versions, oversized keys, and malformed encoding are rejected. Unrecognized object fields are stripped by Zod. Add explicit version migrations before introducing incompatible semantics.

Transport versions are independent of the JSON schema: DB1 is base64url UTF-8 JSON; DB2 is base64url raw-DEFLATE UTF-8 JSON. New exports use DB2; imports accept both and retain the 2 MB uncompressed limit. Coordinates and other values are preserved without rounding. QR codes encode the same complete DB2 key and are omitted when it exceeds 2,200 characters.
