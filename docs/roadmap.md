# Next implementation steps

The skeleton intentionally includes the workflow and data boundaries, not the complete map editor.

| Feature | Current state | Next work |
| --- | --- | --- |
| Create/load/export | DB1/DB2 snapshots and QR; Firebase project library; authenticated and revocable public project links; deployed at plyo-dronebrief.web.app | Broader production workflow validation |
| Draft storage | Browser JSON/resume; explicit migration to organization projects; transactional cloud saves with revision conflicts | Automatic simultaneous merging and offline cloud drafts are not implemented |
| Authentication and organizations | Live Google sign-in on plyo-dronebrief, verified-email membership activation, admin/member roles, protected admin bootstrap and organization management | Verify additional member accounts as they join |
| Project library | Personal collections, server-side prefix search/filter/sort, 50-row pages, background projections, My/Organization views and admin trash | Full-text/typo-tolerant search; broader load testing |
| Google Maps | Search/satellite toolbar, Places suggestions, wheel zoom, scene framing, and cloud-style JSON to hide labels | Publish/associate label-free style with own Google map ID; further map editing tools |
| ShadeMap | Lazy-loaded shadow preview, synchronized center/zoom, shared controls and press-drag-release camera placement with right-click cancellation, shared camera/rig visuals, selection, dragging and adjustment handles, polygon overlays, one shared date and up to three stacked time sliders on both maps with one active shadow | Higher-resolution building/terrain data and optional newbuild heights |
| Circle rig | Add at the current view center, drag the outline to move, with interior map panning and cancellable movement previews, combined scale/rotation edge dot and oval handle, numbered inward arrows with saved count (default 10), live circle radius spinner and side-by-side oval radius spinners | Optional snapping and undo history |
| Camera angles | Place/select/reorder/remove, per-category numbered icon badges, drag/keyboard list reordering and center-on-point buttons, drag, Alt-drag to duplicate, direction handles, colored add buttons matching icons, indented per-type settings, collapsible added-point categories with confirmed category deletion | Optional field-of-view footprints |
| 360 | Repeated one-click placement, draggable panorama icon, right-drag focus cone width/direction with cancellation, numeric controls and clearing, saved/exported focus in both maps and viewer | Optional lens-specific panorama coverage preview |
| DSLR | Repeated press-drag-release placement, camera icon, shared live arrow count/spacing, fixed-distance arrow fans, draggable position and fan aim handles | Optional lens settings |
| Newbuild polygons | Contract and imported polygon rendering | Drawing, vertex editing, geometry validation |
| Image overlays | Existing local workflow plus private cloud uploads, server-side WebP optimization, immutable assets, replacement, public viewing and cleanup | Self-contained export packages and cloud original archives are not implemented |
| Viewer | UI/reducer read-only protection; Firebase-backed membership enforcement; public links include optimized images without sign-in | Production access/rules and public-link smoke tests |
| Navigation | Hash routes for configured cloud installations; local-only in-memory workflow remains available without Firebase | Further navigation enhancements as needed |

Implement each map tool under src/features/map and send updates through the brief session reducer. Do not write Google Maps objects to the JSON or bypass view-mode guards.

The Plyo Firebase project is provisioned and deployed; see `docs/firebase-setup.md` for its configuration and release workflow. New installations require their own provisioning. Portable keys still contain local image references and geometry, so snapshot recipients reconnect files. Live cloud/public project links resolve uploaded floorplans automatically.
