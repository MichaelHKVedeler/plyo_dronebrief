# Next implementation steps

The skeleton intentionally includes the workflow and data boundaries, not the complete map editor.

| Feature | Current state | Next work |
| --- | --- | --- |
| Create/load/export | Compressed DB2 keys, legacy DB1 import, local QR generation and PNG download for fitting snapshots | Optional backend for short lookup keys and scannable viewer links |
| Draft storage | Browser JSON, last draft resume | Shared durable storage and draft list |
| Google Maps | Search/satellite toolbar, Places suggestions, wheel zoom, scene framing, and cloud-style JSON to hide labels | Publish/associate label-free style with own Google map ID; further map editing tools |
| ShadeMap | Lazy-loaded shadow preview, synchronized center/zoom, shared controls and click placement, rig/camera/polygon overlays, shoot-date time slider in location timezone | Object dragging/adjustment handles; higher-resolution building/terrain data and optional newbuild heights |
| Circle rig | Add, drag center/interior, combined scale/rotation edge dot and oval handle, numeric settings | Optional snapping and undo history |
| Camera angles | Place/select/rename/remove, drag, direction handles, distinct icons, per-type heights | Optional field-of-view footprints |
| 360 | One-click position-only placement and draggable panorama icon | Optional panorama coverage preview |
| DSLR | Two-click placement, camera icon, draggable position and aim handle | Optional lens settings |
| Newbuild polygons | Contract and imported polygon rendering | Drawing, vertex editing, geometry validation |
| Image overlays | Contract and layer list only | Upload, bitmap rendering, move/scale/rotate/opacity tools |
| Viewer | UI and state-level read-only, on-map rig/angle visibility switches synchronized with sidebar, shadow preview | Backend permissions if stronger access control is needed |
| Navigation | In-memory screens; reload goes home | Router/deep links only when product needs them |

Implement each map tool under src/features/map and send updates through the brief session reducer. Do not write Google Maps objects to the JSON or bypass view-mode guards.

Recommended sequence: add polygon drawing, then add image overlay uploads and transforms. Consider backend storage before enabling large image uploads: embedding images in a copied key does not scale well.
