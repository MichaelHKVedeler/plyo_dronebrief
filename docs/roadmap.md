# Next implementation steps

The skeleton intentionally includes the workflow and data boundaries, not the complete map editor.

| Feature | Current state | Next work |
| --- | --- | --- |
| Create/load/export | Compressed DB2 keys, legacy DB1 import, local QR generation and PNG download for fitting snapshots | Optional backend for short lookup keys and scannable viewer links |
| PDF export | Plyo page order, English/Norwegian wizard, editable automatic street/area lookup, optional cover names, sun periods filtered to saved single times/ranges, automatic template size, compact camera/rig coordinates, optional notes with editor-only saving, map/floor-plan pages, offline point diagram, references and framed Points / Files page | Optional additional languages and reusable client templates |
| Draft storage | Browser JSON, last draft resume | Shared durable storage and draft list |
| Google Maps | Search/satellite toolbar, Places suggestions, wheel zoom, scene framing, and cloud-style JSON to hide labels | Publish/associate label-free style with own Google map ID; further map editing tools |
| ShadeMap | Lazy-loaded shadow preview, synchronized center/zoom, shared controls and press-drag-release camera placement with right-click cancellation, shared camera/rig visuals, selection, dragging and adjustment handles, polygon overlays, one shared date and up to three stacked single-time/range sliders, selectable endpoints and one active shadow | Higher-resolution building/terrain data and optional newbuild heights |
| Circle rig | Add at the current view center, drag the outline to move, with interior map panning and cancellable movement previews, editing handles on outline, badge, camera and arrow hover, above cameras with larger grab areas, combined scale/rotation edge dot and oval handle, numbered inward arrows with saved count (default 10), live circle radius spinner and side-by-side oval radius spinners | Optional snapping and undo history |
| Camera angles | Place/select/reorder/remove, per-category numbered icon badges, drag/keyboard list reordering and center-on-point buttons, drag, Alt-drag to duplicate, direction handles, colored add buttons matching icons, indented per-type settings, collapsible added-point categories with confirmed category deletion | Optional field-of-view footprints |
| 360 | Repeated one-click placement, draggable panorama icon, right-drag focus cone width/direction with cancellation, numeric controls and clearing, saved/exported focus in both maps and viewer | Optional lens-specific panorama coverage preview |
| Drone images | Repeated press-drag-release placement, draggable camera position and direction arrow, right-drag direction aiming without FOV in both maps | Optional capture settings |
| DSLR | Repeated press-drag-release placement, camera icon, shared live arrow count/spacing, fixed-distance arrow fans, right-drag direction aiming without FOV, draggable position and fan aim handles | Optional lens settings |
| Newbuild polygons | Contract and imported polygon rendering | Drawing, vertex editing, geometry validation |
| Image overlays | Local JPG/PNG selection, remembered file handles where supported, reconnect flow, rendering in both maps below icons, edge move, right-click anchor, combined rotate/scale, opacity, framing, viewer | Portable image packaging only if explicitly needed; no server storage |
| Viewer | UI and state-level read-only, on-map rig/angle/image overlay visibility switches, shadow preview | Backend permissions if stronger access control is needed |
| Navigation | In-memory screens; reload goes home | Router/deep links only when product needs them |

Implement each map tool under src/features/map and send updates through the brief session reducer. Do not write Google Maps objects to the JSON or bypass view-mode guards.

Recommended next step: polygon drawing. Local image files stay on the user’s device; shared keys contain their references and geometry, so another device must reconnect the files.
