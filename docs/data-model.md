# Brief JSON v1

The runtime contract is `src/features/briefs/model/brief.ts`. This document explains its meaning.

| Field | Meaning |
| --- | --- |
| schemaVersion | 1 |
| id | Stable brief ID |
| createdAt, updatedAt | UTC ISO timestamps |
| project | name, clientName, calendar date YYYY-MM-DD, times HH:mm[] |
| coordinates | Project/map reference point {lat, lng}; initially 0, 0 |
| circleRig | null or {id, position, radiusMeters, ovalRatio, rotationDegrees} |
| angles | Discriminated camera-angle array |
| typeSettings | Per-camera arrays of heightsMeters |
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

An angle uses the height list of its type. No direction field is used for 360.

360 placement commits with one map click. DSLR and drone-image placement commits after a position click and a second look-at click. Only the resulting bearing is stored; the direction handle's screen-sized line is not a stored distance or field of view. Map drags commit position or direction at drag end. Temporary placement previews and selections are excluded from JSON.

## Polygons and image overlays

A polygon has at least three WGS84 vertices; the map renderer closes the ring. Polygon editing, geometry validity checks, and self-intersection handling are not yet implemented.

Image overlays reserve `id`, `name`, `source`, `position`, `widthMeters`, `heightMeters`, `rotationDegrees`, and `opacity`. Position is the image center, rotation is clockwise, and opacity is in [0, 1]. v1 accepts only embedded PNG/JPEG/WebP base64 data URLs, not temporary blob URLs, arbitrary remote URLs, or SVG. Uploading, aligning, and rendering the image overlay are not implemented in this skeleton. The schema preserves imported overlay metadata and the layers panel lists it.

The whole JSON must fit within the 2 MB share-key limit. Future remote asset storage will require a deliberate contract and import-validation update.

## Compatibility and validation

Imports and saved drafts pass through the same Zod schema. Invalid values, unsupported versions, oversized keys, and malformed encoding are rejected. Unrecognized object fields are stripped by Zod. Add explicit version migrations before introducing incompatible semantics.
