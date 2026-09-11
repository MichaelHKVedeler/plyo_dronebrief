# Next implementation steps

The skeleton intentionally includes the workflow and data boundaries, not the complete map editor.

| Feature | Current state | Next work |
| --- | --- | --- |
| Create/load/export | Working | Optional backend for short lookup keys |
| Draft storage | Browser JSON, last draft resume | Shared durable storage and draft list |
| Google Maps | Live map, satellite toggle, wheel zoom, and independent details scrolling | Extend direct map-editing tools |
| Circle rig | Add, reposition to project, edit radius/ratio/rotation; outline renderer | Drag handles and direct map editing |
| Camera angles | Typed data, imported marker rendering, per-type height editing | Add/select/move, direction and footprint handles |
| 360 | Position-only contract and marker | Placement tool |
| DSLR | Position + direction contract and marker | Placement and direction tools |
| Newbuild polygons | Contract and imported polygon rendering | Drawing, vertex editing, geometry validation |
| Image overlays | Contract and layer list only | Upload, bitmap rendering, move/scale/rotate/opacity tools |
| Viewer | UI and state-level read-only, local visibility | Backend permissions if stronger access control is needed |
| Navigation | In-memory screens; reload goes home | Router/deep links only when product needs them |

Implement each map tool under src/features/map and send updates through the brief session reducer. Do not write Google Maps objects to the JSON or bypass view-mode guards.

Recommended sequence: add camera-angle tools, add polygon drawing, then add image overlay uploads and transforms. Consider backend storage before enabling large image uploads: embedding images in a copied key does not scale well.
