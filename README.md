# Dronebrief

A drone photography brief editor with local drafts and optional Firebase organization projects.

Live app: [Plyo Dronebrief](https://plyo-dronebrief.web.app). The `plyo-dronebrief` Firebase project uses real Google sign-in. Local development uses the ignored `.env.local`; keep `VITE_FIREBASE_EMULATORS=false` to use real accounts. Emulator mode intentionally opens a test-user form instead of Google's account picker.

## Start

Use a current Node.js LTS release (22.12+ or 24+) and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. No API key is needed for the create, save, export, or load workflow.

With Firebase configured, Google sign-in opens **Create project** and **Load projects**. Organization members share editing access, personal collections organize the library, and revision checks prevent silent overwrites. Creators/admins can create public briefing links from **Export → Create Link** (or Share). Recipients open Google Maps with cameras, floorplan and circle rig, plus shoot times and capture instructions, without signing in. Local drafts and DB1/DB2 snapshots keep their existing format.

See [Firebase setup and operations](docs/firebase-setup.md) for emulators, EU provisioning, admin bootstrap, deployment, permissions, uploads and recovery. `npm run check` additionally requires Java 21+ for rules/backend emulator tests. Cloud deployment needs your Firebase project, billing and operator credentials; it is separate from a successful local build.

```sh
npm run check   # lint, meaningful behavior tests, TypeScript, production build
npm run preview
```

## Included

- Vite + React + strict TypeScript + Tailwind CSS v4.
- Official shadcn/ui components, installed through its CLI; no second UI kit.
- Landing page with create, load, and resume-last-local-draft actions.
- One-step wizard for project and client names. Shoot dates and times are set on the map, not during setup.
- Separate editor and read-only viewer modes.
- Basic editor: rename project, add rigs at the current map center, adjust rigs on the map, set drone/360 height arrays, and set the number and spacing of DSLR arrows.
- Committed local edits autosave to browser storage; cloud edits use transactional saves with visible saving, failure and conflict states.
- Compressed snapshot keys and downloadable QR codes, with legacy key support, schema validation and size limits.
- **Export** opens a three-step wizard (Cover, Information, Review). Review offers **Download PDF** and **Create Link** together. PDF download keeps map pages. Create Link copies a no-sign-in public briefing URL for cloud projects (creators/admins). Local drafts, portable snapshots and org members without manage rights still get PDF download, with an explanation instead of a working link.
- PDF export uses English/Norwegian layouts, optional property information and instructions, map pages, point details, and reference images. Optional note edits use the active local/cloud save workflow; viewer notes remain PDF-only.
- Layer visibility switches, kept separate from saved brief content.
- Local JPG/PNG image overlays in Contents → Floor plan, with edge dragging, an adjustable anchor, combined scale/rotation, and a visibility slider in both maps.
- Contents → Reference images holds up to four JPG/PNG photos with captions. They are stored with the brief, uploaded with cloud floorplans, and included automatically in PDF export and the public briefing details.
- Contents → Calculate images shows the locked capture rules with camera icons and live counts: circle-rig arrows × drone heights, one drone image per point and height, ten 360 images per point and height, and one DSLR image per arrow. Each count is multiplied by the number of shoot times. The total is also listed beside Shoot times in the bar under the header.
- Optional Google Maps adapter: circle/oval outlines, camera markers and polygons.
- Map placement for 360, DSLR, and drone images, with distinct icons and camera directions.
- Circle/oval rigs show numbered arrows pointing toward the center in both maps and the viewer. **Number of arrows** updates live from 1–50, defaults to 10, and is saved/exported with the rig.
- Drag cameras and the circle rig to move them; Alt-drag a camera icon to place a copy while the original stays put. Rig handles adjust radius, rotation, and ovalness, and camera handles adjust direction.
- Satellite toggle and mouse-wheel zoom without Ctrl in both editor and viewer. The editor opens in Satellite; the viewer opens in the normal map. These view preferences do not modify the brief JSON.
- An adjustable dark grey overlay (15% by default) dims both basemaps beneath the rig and camera objects. It does not intercept gestures or dim app controls and attribution, and makes no extra map requests. The bottom Map dimming slider adjusts opacity from 0�100%, shared across providers for the current session without saving to the brief.
- Editor/viewer fit the browser window. The project title and client name sit together, aligned, in the centered top bar. The Editor/Read-only badge sits beside the theme toggle, with the save status immediately to its right. Share sits at the far right of the Created/Edited bar. The editor shows those names as a title; a pencil (or clicking the names) opens wider text fields. Enter, Tab, or clicking away saves and returns to the title. The header stays on one row; long titles truncate without hiding header actions. The details panel has its own shadcn scrollbar; on narrow screens it sits below the map and the screen scrolls to keep controls accessible.
- Briefs automatically frame their cameras, complete rig outline, and polygons when opened. **Frame scene** repeats this at any time; edits, search, and visibility toggles do not trigger automatic reframing.
- Shadcn accordion sections group rig settings above camera creation, indented per-type settings, and added camera points. Sections start expanded. Project name and client name are edited in the header title. Shoot date, times, and the total image count sit on the bar with Created/Edited. Contents holds Description (Property information and Instructions), Floor plan, and Calculate images. Selecting a map object opens its settings; opening sections does not save the brief.
- Street/location suggestions while typing (after three characters and a 350 ms pause), with Enter/search-button geocoding as a fallback. Search moves the view only and works in the viewer too.
- One shared map toolbar keeps search and navigation available in both providers. The Google Maps / ShadeMap control sits above Satellite, which is shown only in Google Maps and lines up with the ShadeMap half.
- Label-free Google cloud style provided in `docs/google-map-no-labels.json`; publish and associate it with your map ID as described below. Camera labels and attribution remain visible.
- A compact map layer menu under search toggles the rig, additional angles, and image overlays in editor and viewer.
- ShadeMap shadow preview with the same WGS84 coordinates and matched zoom scale, terrain/building shadows, one shared date on the slider header, and up to three stacked time sliders. The sliders stay visible in Google Maps and ShadeMap. Only the slider being moved is shown as ShadeMap shadows.
- ShadeMap uses a locked top view with flat building footprints; original building heights remain available for shadow calculations.
- ShadeMap camera icons and rig overlays update in the map's render frame during navigation, including zoom scaling.
- Tests covering Unicode exports, malformed keys, persistence failures, and read-only behavior.

Project and camera coordinate/direction fields commit on blur (clicking elsewhere or pressing Tab). Circle/oval radius, DSLR count/spacing, and drone/360 height lists update and save on every valid change, without leaving the field; empty or invalid input retains the last valid value until corrected or reset on blur. New briefs start with drone-image heights 40 and 60 m and 360 heights 2, 5, and 8 m. **Add floor (3m)** beside the 360 height list appends 3 m above the last height (or 2 m if the list is empty). New briefs start in Oslo (59.9139, 10.7522). Search or pan to the desired area, then choose **Add Circle Rig** to place a rig at the current map center. Its initial diameter fills roughly half the shorter map dimension at the current zoom in either provider, with the radius rounded up to whole meters (1–10,000 m). The project-location marker and controls have been removed. Existing `coordinates` remain in schema version 1 for import/export compatibility and as a fallback for empty briefs or an unavailable map. Colored camera add buttons match their map icons. Drone/360 height lists and DSLR count/spacing controls are indented beneath their corresponding add buttons; placed points have a separate **Added camera points** section with collapsible Drone image, 360, and DSLR categories. Each category has a delete-all button that reveals **Delete?**, a confirmation checkmark, and a cancel button. Individual removal remains immediate. Oval and rotation adjustments use map handles; oval rigs also have side-by-side biggest and smallest radius spinners.

Right-drag an existing DSLR or drone-image camera icon to aim its direction without moving its position. The arrow (or configured DSLR arrow fan) rotates live; DSLR and drone-image cameras do not show or save an FOV cone. Release saves the direction, while Escape, pointer cancellation or losing focus restores it. A stationary right-click makes no edit. The gesture works in both map providers, takes priority over floor-plan anchor placement, and is disabled in the viewer. Direction is preserved in saved/shared briefs and PDFs.

DSLR settings apply to every existing and newly placed DSLR point in both maps and the read-only viewer. **Number of angles** accepts 1–12; **Spacing (°)** accepts whole degrees from 15 to floor(360 / count). Increasing count reduces spacing if needed. Arrows form a fan centered on the saved direction; dragging any arrow rotates the entire fan. At the default Overlay size, all drone-image and DSLR arrows sit 24 pixels from their camera point at Google-equivalent zoom 17, regardless of count or spacing; dense fans can overlap. Camera icons, number badges, arrows, adjustment handles, arrow spacing, and rig/polygon line widths are locked to the map scale in both providers: each step out halves their size, and each step in doubles it, with continuous fractional scaling and no minimum-size floor. The Overlay size slider above Map dimming adjusts camera overlays and polygon line widths from 0% to 100% (50% is the standard size and default, matching the former 30% setting; 100% is twice standard size; 0% hides camera overlays) while preserving zoom scaling. Rig arrows, badges, edge adjustment handles, arrow offsets, and line thickness instead stay proportional to the rig radius, including live resize previews, and ignore Overlay size. For ovals, the major radius drives these sizes. It is shared across providers and available in the editor and viewer for the current session only. Create Link copies the current Overlay size into the public briefing URL so camera icons match the editor; it is still not stored in brief JSON. Toolbar controls keep their normal size. This is display-only and does not change saved brief geometry. Camera icons show a small numbered badge at the top right in both maps, numbered from 1 within each camera category. Points are identified only by category and number. Drag the grip beside a point up or down within its category to change its number, or focus the grip and press Up/Down. Drop onto another row to swap just those two points. Releasing between rows leaves the order unchanged. While dragging, the row lifts and follows the pointer while the other rows stay still. An outline marks the swap target. Release animates the point into place before saving. Escape cancels the preview. Reordering saves the new order; the crosshair centers the active map on that point without changing zoom or saving.

### Map editing

While right-dragging a 360 point, its focus fan is hidden inside the round camera icon and appears outside its edge. Releasing a drag inside the icon clears the focus. A stationary right-click or cancelling the gesture preserves the previous focus.

In either map, choose **Add 360 point**, **Add DSLR point**, or **Add drone image**, then place points repeatedly on the map. Click to place a 360 point. For DSLR and drone images, press to set the position, hold and drag to aim, then release to finish the point. The same tool stays active for the next point. **Right-click**, **Escape**, or **Cancel placement** stops placement and discards any unfinished point.

Drag a camera icon or grab the circle/oval outline to reposition it. **Alt-drag** a camera icon to drop a copy of the same type, direction, and settings; the original stays where it was. Escape or pointer cancellation discards the copy. The rig has no center move icon; its outline has an invisible 20-pixel minimum grab area. Hovering the movable outline thickens it and shows a pointing-hand cursor in both maps; hovering or focusing its radius and oval controls keeps the same outline highlight; dragging shows a grabbing cursor. The rig interior uses the regular map pointer; click the outline to select the rig. Dragging the interior pans the map; middle-button dragging pans over the map, rig, and camera icons. Outline movement previews live, preserves the radius and shape, and saves on release. Escape or pointer cancellation discards the move. While editing, hover the rig outline to reveal one edge dot for both scale and rotation, plus the oval handle on the minor-axis edge for ovalness. Hovering any rig number badge or inward arrow, or a camera on the outline and any of its arrows, also reveals the rig controls. Moving between these parts keeps both controls visible. Both controls sit above camera markers and camera aiming handles, with an invisible 32-pixel minimum grab area. They are hidden during camera placement, in the read-only viewer, and in PDF captures. DSLR/drone direction arrows remain visible beside their camera icons. Hover or select a camera, then drag an arrow to aim in the editor. The handles and outline highlight disappear when the pointer leaves the rig, its cameras/arrows and controls, unless a control has keyboard focus or an adjustment is being dragged. Selecting the rig alone does not keep its handles visible. Drag the edge dot in/out to resize and around the center to rotate. The sidebar retains a radius spinner for circles and side-by-side biggest/smallest radius spinners for ovals; map handles also control ovalness and rotation. Camera selection exposes coordinates, direction where applicable, and removal action.

Movement previews are temporary until the drag ends; committed changes autosave and are included in exports. Placement, selection, and hover state are not saved. Loaded briefs display the same geometry with editing and adjustment handles disabled.

For an existing **360 point**, hold the **right mouse button** on its icon and drag to set a focus cone. Drag farther from the point to widen the FOV (10–180°), and move around the point to choose its heading. The purple cone previews both settings without moving the camera. Release to save; Escape, pointer cancellation, or losing window focus discards the adjustment. A right-click without dragging makes no edit. The gesture works in Google Maps and ShadeMap and takes priority over floor-plan anchor placement. The selected point's settings also provide **Focus direction**, **Focus FOV**, and **Clear 360 focus**, with **Set 360 focus** as a keyboard-accessible starting point. Focus cones follow the existing Overlay size and map zoom scaling; their display radius is not a requested capture distance. Focus settings survive moving, duplication, autosave, and export, and appear in the read-only viewer. Existing points have no focus cone until one is set.

### Shoot time ranges

Right-click a sun slider to add a second time at that position. The track fills between the two handles; the original time stays selected. Click either handle or its time label to choose the single instant shown in ShadeMap. Left-drag a handle, or the active slider's track, to move the selected endpoint; endpoints cannot cross. Arrow keys move the focused endpoint by 15 minutes. Escape, pointer cancellation or losing window focus cancels an unfinished drag. Range/single-time buttons provide the same actions for keyboard and touch users; returning to a single time keeps the selected endpoint.

Up to three slots can be single times or same-day ranges (00:00–23:59). Each range counts as one shoot for image totals. Editor changes save on release and survive reopening and share-key export. The viewer can preview ranges without saving. The selected handle and shadow preview are temporary view state. On narrow maps, the clock button opens a larger time editor with the same controls.

### Local image overlays

This section describes local-only briefs and portable snapshots. Cloud projects upload and optimize floorplans automatically and render them on other devices, including public viewers; see [Firebase floorplans](docs/firebase-setup.md#floorplans-and-public-links).

Open **Contents → Floor plan → Upload image** and choose a JPG or PNG (up to 30 MB and 100 million pixels, maximum ten images). The image starts at the current map center, sized to the viewport with its aspect ratio preserved. Grab an edge to move it. Right-click anywhere on the map to set the selected image’s anchor (shown as a red cross); dragging inside the image rotates and scales it together around that anchor. With no custom anchor, the image center is used. Select an image by clicking it or its name in Floor plan. Escape, pointer cancellation, or leaving the page cancels an unfinished drag. Middle-button panning and camera placement still work over images.

Each image has a **Visibility** slider: 0% is transparent and 100% is opaque. It previews live and saves on release, like image geometry. The map **Image overlays** switch only hides the layer for the session. Anchor positions and selection are temporary editing state. Frame scene includes complete rotated image bounds. Read-only briefs display images with editing disabled; reconnecting a file does not alter or save the brief.

Images are read locally: no upload endpoint, server storage, or image bytes in new export keys. Where supported, the browser remembers a read-only file handle in IndexedDB, separately from brief JSON. Browsers do not expose a full filesystem path; the brief keeps a filename and stable local reference. On reopening, previously granted access restores the image; otherwise use **Allow file access** or **Reconnect image**. Browsers without persistent file handles require reconnecting after reopening. Moving/deleting the file, changing browser/site origin, or clearing site storage may also require reconnecting. Reconnection retains position, size, rotation, and opacity. The original file is never modified. Legacy embedded PNG/JPEG/WebP snapshots still render.

Shared keys preserve image geometry and local references but do not carry the local image itself. Recipients must reconnect the matching file on their device; the export dialog explains this. Use an updated app to read the local-file source extension.

## Branding and appearance

Plyo assets live in public/brand; use the supplied light-background and dark-background logo variants without recoloring them. Brand colors, neutral surfaces, focus colors and button roundness are defined in src/styles/globals.css. Keep styling changes there or at feature call sites, leaving vendored shadcn primitives intact.

The small header theme button cycles System → Light → Dark → System. System is the initial default and follows OS appearance changes. Explicit preferences are stored separately under dronebrief:theme, never in brief JSON or export keys; returning to System removes the override. The page applies the preference before first paint and stays usable if storage is blocked. Google road maps follow the resolved app theme; satellite photography keeps its natural appearance. Opaque gizmos and theme-specific camera surfaces maintain contrast. Map instances are reused for each color scheme within the page to reduce repeated map initialization. Switching themes preserves the current map position and zoom.

## Google Maps setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_GOOGLE_MAPS_API_KEY` using your own Google Cloud project with Maps JavaScript API enabled.
3. Optionally set `VITE_GOOGLE_MAPS_MAP_ID`; the skeleton otherwise uses `DEMO_MAP_ID`.
4. Restart Vite.

Keep the actual key only in `.env.local`, which Git ignores. `.env.example` must stay blank. You can confirm the exclusion with `git check-ignore -v .env.local`. Do not force-add local environment files.

In Google Cloud Console, open **APIs & Services → Credentials → your API key**:

- Set **Application restrictions** to **Websites**.
- Allow `http://127.0.0.1:5173/*` and `http://localhost:5173/*` for local development.
- Set **API restrictions** to **Restrict key**, selecting **Maps JavaScript API**.
- For suggestions while typing, enable **Places API (New)** in the same Google Cloud project and add it to this key's allowed APIs. The app uses AutocompleteSuggestion with session tokens and requests place details only after selection. Choose a suggestion (Tab then Enter also works) to jump there; Escape dismisses results. Suggestions do not change saved coordinates.
- Keep **Geocoding API** enabled and allowed for the Enter/search-button fallback. If Places access is missing, the map remains usable and search explains how to enable suggestions; Enter still searches addresses. No new key is needed.
- Confirm Maps JavaScript API is enabled and the Google Cloud project has the required billing configuration.

The dev server stays on port 5173 and reports an error if that port is occupied, so it cannot silently switch to an origin excluded by your key restrictions. Before deploying, use a separately restricted production key and allow the exact production website origin. Configure it in your hosting provider's build environment; never commit it. Vite includes browser-prefixed values in the client build, so `.env.local` prevents source-control exposure, not browser visibility.

See [Google's API key restriction guidance](https://developers.google.com/maps/api-security-best-practices).
See [Google's JavaScript geocoding setup](https://developers.google.com/maps/documentation/javascript/geocoding) for the search service requirements.

A Maps JavaScript API key is browser-visible. Restrict its allowed referrers and API in Google Cloud; do not put a server secret in any VITE variable. A working Google Cloud configuration, including any required billing, is your responsibility. Verify live map loading on each deployment using its restricted key.

Without a key, the map shows a clear placeholder. All application controls use shadcn/ui. The Google Maps canvas, attribution, and geographic shapes are the necessary mapping exception.

## Hide Google basemap labels

Google requires cloud styling when a map ID is present; the editor's advanced markers require a map ID. Inline styles and StyledMapType are therefore not used. In Google Cloud **Map Styles**, create a style using the JSON in `docs/google-map-no-labels.json`, save/publish it, and associate it with a JavaScript map ID. Put that ID in `VITE_GOOGLE_MAPS_MAP_ID` in `.env.local` and restart Vite. Alternatively, edit the existing associated cloud style to hide label text and icons. Google's DEMO_MAP_ID cannot be styled by this app. This Google Cloud configuration step is required before Google labels disappear.

Reference: [Google cloud map styling](https://developers.google.com/maps/documentation/javascript/cloud-customization/map-styles).

## ShadeMap setup

The optional shadow preview uses MapLibre and the official ShadeMap SDK. OpenFreeMap provides the basemap and OpenStreetMap buildings; AWS Open Data supplies elevation tiles. No Mapbox or MapTiler key is needed. The renderer is loaded only when switching to ShadeMap.

1. In the project root's ignored `.env.local`, fill in `VITE_SHADEMAP_API_KEY=your_key_here` (a blank entry is provided). Keep `.env.example` blank.
2. Enable your development/production domains in your ShadeMap account as required by your key/plan.
3. Restart Vite, open a brief, and select **ShadeMap**. Use **Google Maps** to switch back.

The current center and scale transfer in both directions, including fractional zoom: Google's 256 px tile convention maps to MapLibre zoom minus one (512 px). Brief coordinates are never rounded or rewritten. Google Maps remains mounted while hidden so returning does not reframe the scene. Provider choice and map movement are temporary view settings; exports and autosave are unaffected. In the editor, shadow date/time slots save as brief schedule data.

Up to three stacked sliders sit at the bottom of both maps. Each has a 00:00–23:45 control in 15-minute steps. Clicking an inactive slider's track activates it without moving the time; once it is active, clicking the track or dragging the knob changes the time. The date is shown as text with a calendar picker, not a type-in field. A chevron collapses the panel to the slot dates and times. New briefs start at today 09:00; **Add time** stacks another slider 15 minutes after the last slot, on that slot's date. Only one slot is previewed at a time: dragging a knob, choosing a date, clicking a slot's date or track, or adding a slot shows that time on ShadeMap. The displayed IANA timezone follows the viewed location, including daylight saving. For a nonexistent local clock time at a spring DST transition, the UI shows the resolved clock time and an adjustment notice. At the autumn repeated hour, the timezone library chooses one occurrence; this UI does not select between both occurrences. Viewer adjustments preview shadows without writing the draft.

ShadeMap provides shadow preview and object editing in the editor, with a read-only viewer. Both maps share camera icons, direction arrows, selection highlights, rig outlines, and adjustment controls. Search, camera placement, zoom, framing, and layer toggles work over both maps. Both maps use repeated press-drag-release placement for DSLR/drone cameras and one-click placement for 360 points; right-click, Escape, or Cancel placement stops and discards any unfinished point. Both maps support camera selection and dragging, arrow dragging to aim, rig outline dragging, and scale/rotation/oval handles. ShadeMap drags commit on release; Escape or pointer cancellation discards the preview. Missing keys, failed map loading, and SDK license failures show a message while keeping the return control available.

The adapter waits for map tiles before querying buildings, explicitly retains MapLibre geometry getters, and removes duplicate tile-buffer polygons before sending plain GeoJSON to ShadeMap. Development keys are not documented as using lower-quality shadow rendering; paid plans primarily change deployment and usage allowances.

Building shadows depend on OpenStreetMap coverage and available height attributes; missing heights use a 3 m estimate, and buildings load at street-level zoom. Terrain resolution also limits detail. The preview is not a measured survey. Newbuild polygons currently have no height field and are outlines, not shadow-casting buildings. Local image overlays render above both basemaps/shadows and below camera and rig icons.

Like the Google browser key, this Vite-prefixed key is visible to browsers. `.env.local` keeps it out of Git; restrict permitted domains with the provider and use your hosting environment for production configuration. API keys are never included in brief JSON or shared keys.

References: [ShadeMap SDK](https://github.com/ted-piotrowski/mapbox-gl-shadow-simulator), [OpenFreeMap](https://openfreemap.org/quick_start/).

## Export

**Export** in the header opens a three-step wizard: Cover (English or Norsk bokmål, street address, optional project/client names), Information (property notes and instructions), and Review (sun times, PDF map source, then **Download PDF** and **Create Link**). The cover shows **Street address: Area**, followed by project name and client. Google reverse geocoding uses the circle rig's center (or the first camera, then project coordinates if no rig exists). The suggested address is editable; typing is never overwritten by a delayed lookup. Empty notes are optional. In the editor you can save revised notes to the brief when exporting; viewer notes apply only to this export. Choosing Cancel leaves the brief unchanged.

The cover wizard has independent **Include project name on cover** and **Include client name on cover** switches. Either or both can be omitted; the address stays visible and saved project details are unchanged. The Time Slot page and wizard review show only solar periods used by the saved schedule. A single time selects its containing period; a range selects every period it overlaps. Rounded shared boundaries belong to the next period. The full planned times/ranges are also printed. Shoots outside all standard periods still show their planned times, with an explanation instead of unused solar ranges.

The landscape PDF follows this order: cover; calculated sun times; project size and capture requirements; compact points and coordinates; property information and instructions; brief maps with/without a floor plan; optional references; and the framed Points / Files page with RAW/JPG delivery guidance. Coordinate tables include the rig center, every rig arrow, and all camera points, with up to 40 rows per page. Long notes and point lists continue onto additional pages. Standard headings and instructions are translated; authored notes are preserved as entered.

Sun times are calculated locally with [SunCalc 1.9](https://github.com/mourner/suncalc/tree/v1.9.0), also used by ShadeMap. Each distinct shoot date uses the site location's time zone and daylight saving rules. The photographic windows are sunrise to morning golden-hour end, daytime between the golden hours, evening golden-hour start to sunset, and evening blue hour when the sun is -4° to -6°. Saved shoot times remain listed separately and are not changed. Midnight sun, polar night and missing phase boundaries are explicitly labeled; `(+1)` denotes the next local date. Terrain and weather can change the observed light.

Project size is the smallest reference-template tier that fits every point-count and height-count limit. Rig arrows plus individual drone points count as aerial positions. Mini: up to 2 aerial, 1 panorama, no DSLR, and 2 panorama heights; Small: 8 aerial, 4 panoramas, 3 DSLR, and 4 panorama heights; Medium: 10 aerial, 8 panoramas, 6 DSLR, and 6 panorama heights; otherwise Large. The first three tiers allow up to 2 aerial height levels. Mini uses the more inclusive two-height limit from the Norwegian reference (the English example has one). Actual heights, arrow counts and image totals are always preserved, including projects exceeding the Large example.

Map export frames the entire scene, includes every geometry layer, and restores the previous view afterward. The selected provider, satellite setting and map dimming are reflected in the capture. When a floor plan exists, the PDF contains maps with and without it; reconnect any missing local images first. ShadeMap captures include the active preview date/time. Camera directions and 360 focus are shown on the map and in the coordinate tables. **Point diagram** is an explicit alternative without a basemap or floor plan, available even when map services cannot load. Up to four optional JPG/PNG reference images with captions are authored in Contents and included automatically.

PDF creation runs locally in the browser, using bundled fonts and design assets; the map providers retain their normal network requirements. Export does not change the brief schema or shared-key format. PDFs are downloadable documents and cannot be imported as editable briefs. Keep the export key for that purpose.

**Create Link** is available on the same Review step. Creators and organization admins get a public `#/s/<token>` URL, with language, address, name flags and the editor Overlay size in the hash query. Recipients do not sign in. The briefing fills the window with Google Maps (satellite on by default) with camera points, floorplan and circle rig at the same overlay size as the editor. Capture-type icons overlay the map in place of layer toggles and isolate the same way as before. When the brief has a floorplan, a grid/off button under those icons shows or hides it without writing the saved project. On wide screens, Plyo/Dronebrief branding, project and client names, shoot times, property notes, capture instructions and reference images sit in a right-hand panel. On narrow screens the map stays full-frame with no page scroll; an information button in the bottom-left corner overlays those details in a scrolling block over the map. Search, ShadeMap, overlay size and map dimming are hidden. Local drafts and portable snapshots cannot mint a URL until they are saved as a cloud project. The same token is also available from Share; revoking it closes the briefing.

## Persistence and export semantics

This skeleton has no server, database, account system, or disk-file writer. JSON is serialized to browser storage under `dronebrief:draft:v1:<id>`. The last draft is offered on the landing page. Clearing browser storage removes drafts. Keep an export key to retain a portable copy.

New export keys start with `DB2.` and contain the complete validated UTF-8 JSON snapshot, compressed with raw DEFLATE and encoded with base64url. Existing uncompressed `DB1.` keys still load. Brief JSON remains schema version 1. Older app versions cannot read DB2 keys. Compression preserves all values, including coordinate precision. Imports enforce the 2 MB JSON limit with a bounded decompression buffer. Legacy embedded images can still produce large keys. Newly selected local images add only a file reference and geometry; their bytes are not included.

The export dialog generates a QR code locally for keys up to 2,200 characters and offers a PNG download. Scan to copy the key and paste it into Load brief on another device running the updated app. It contains the snapshot itself, not a website link. Larger briefs show a Copy key fallback instead of truncating the snapshot. No brief data is sent to a QR service.

Keys are longer than database lookup IDs, are not encrypted or signed, and are not live links. Anyone with a key can read its content; later edits require another export.

Loading always opens a viewer. The UI omits editing controls, and the session reducer rejects mutations in view mode. This is an application behavior guarantee, not a tamper-proof authorization system. Viewer visibility changes never alter the saved JSON or overwrite a local draft.

Navigation is deliberately small: React screen state, with no router dependency. Refresh returns to the landing page, where you can resume the last saved draft. Multiple drafts are stored, but only the latest is exposed in this skeleton. Simultaneous editing in multiple browser tabs has no conflict resolution.

For short revocable keys and shared durable storage, replace the repository and share-key adapters with a backend API and server-side permissions. Do not present localStorage as shared storage.

## Folder structure

```text
src/
  App.tsx                    # screen navigation, save/export orchestration
  main.tsx                   # React entry point
  pages/                     # landing, creation wizard, brief page, public briefing
  components/
    ui/                      # official shadcn primitives
    layout/                  # shared app chrome
  features/
    briefs/
      model/brief.ts         # versioned Zod schema and inferred types
      state/                 # edit/view boundary; ephemeral visibility
      storage/               # JSON repository and portable export adapter
      export/                # PDF copy, layout, generation and download
      components/            # project, layers, export UI
    map/                     # Google Maps integration and rig geometry
  lib/                       # shared non-domain utilities
  styles/                    # theme tokens and Tailwind entry
  test/                      # test setup and integration tests
docs/
  data-model.md              # field meanings, units, examples
  roadmap.md                 # intentionally unfinished map tools
AGENTS.md                    # rules for humans and AI contributors
components.json              # shadcn aliases and component configuration
```

## Adding UI components

```sh
npx shadcn@latest add select
```

Import primitives directly from `@/components/ui/<name>`. Compose domain controls inside their feature folder; keep project state out of vendored UI components.

Setup references: [shadcn with Vite](https://ui.shadcn.com/docs/installation/vite), [Vite](https://vite.dev/guide/), [React Google Maps](https://visgl.github.io/react-google-maps/docs).
