# Dronebrief

A small local-first skeleton for planning drone photography briefs.

## Start

Use a current Node.js LTS release (22.12+ or 24+) and npm.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. No API key is needed for the create, save, export, or load workflow.

```sh
npm run check   # lint, meaningful behavior tests, TypeScript, production build
npm run preview
```

## Included

- Vite + React + strict TypeScript + Tailwind CSS v4.
- Official shadcn/ui components, installed through its CLI; no second UI kit.
- Landing page with create, load, and resume-last-local-draft actions.
- Two-step wizard: project/client, then date and multiple times. The date defaults to today, with half-hour time sliders.
- Separate editor and read-only viewer modes.
- Basic editor: rename project, add rigs at the current map center, adjust rigs on the map, set drone/360 height arrays, and set the number and spacing of DSLR arrows.
- JSON autosave in browser localStorage after every committed editor change.
- Compressed snapshot keys and downloadable QR codes, with legacy key support, schema validation and size limits.
- Layer visibility switches, kept separate from saved brief content.
- Optional Google Maps adapter: circle/oval outlines, camera markers and polygons.
- Map placement for 360, DSLR, and drone images, with distinct icons and camera directions.
- Drag cameras and the circle rig to move them; rig handles adjust radius, rotation, and ovalness, and camera handles adjust direction.
- Satellite toggle and mouse-wheel zoom without Ctrl in both editor and viewer. The editor opens in Satellite; the viewer opens in the normal map. These view preferences do not modify the brief JSON.
- A subtle 15% ink overlay dims the Google basemap beneath the rig and camera objects. It does not intercept gestures or dim app controls and attribution, and makes no extra map requests.
- Editor/viewer fit the browser window. The details panel has its own shadcn scrollbar; on narrow screens it sits below the map.
- Briefs automatically frame their cameras, complete rig outline, and polygons when opened. **Frame scene** repeats this at any time; edits, search, and visibility toggles do not trigger automatic reframing.
- Shadcn accordion sections group project details, rig settings above camera creation, indented per-type settings, and added camera points. Selecting a map object opens its settings; opening sections does not save the brief.
- Street/location suggestions while typing (after three characters and a 350 ms pause), with Enter/search-button geocoding as a fallback. Search moves the view only and works in the viewer too.
- One shared map toolbar keeps search and navigation available in both providers. The shadcn ButtonGroup sits above Satellite, which is shown only in Google Maps.
- Label-free Google cloud style provided in `docs/google-map-no-labels.json`; publish and associate it with your map ID as described below. Camera labels and attribution remain visible.
- A compact map layer menu under search toggles the rig and additional angles in editor and viewer, synchronized with the Layers panel.
- ShadeMap shadow preview with the same WGS84 coordinates and matched zoom scale, terrain/building shadows, and a bottom-center time slider using the shoot date and viewed location's timezone.
- Tests covering Unicode exports, malformed keys, persistence failures, and read-only behavior.

Project, height lists, and camera coordinate/direction fields commit on blur (clicking elsewhere or pressing Tab). Circle/oval radius and DSLR count/spacing spinners update and save on every valid change, without leaving the field; empty or invalid input retains the last valid value until corrected or reset on blur. New briefs start in Oslo (59.9139, 10.7522). Search or pan to the desired area, then choose **Add Circle Rig** to place a rig at the current map center. The project-location marker and controls have been removed. Existing `coordinates` remain in schema version 1 for import/export compatibility and as a fallback for empty briefs or an unavailable map. Colored camera add buttons match their map icons. Drone/360 height lists and DSLR count/spacing controls are indented beneath their corresponding add buttons; placed points have a separate **Added camera points** section with collapsible Drone image, 360, and DSLR categories. Each category has a delete-all button that reveals **Delete?**, a confirmation checkmark, and a cancel button. Individual removal remains immediate. Oval and rotation adjustments use map handles; oval rigs also have side-by-side biggest and smallest radius spinners.

DSLR settings apply to every existing and newly placed DSLR point in both maps and the read-only viewer. **Number of angles** accepts 1–12; **Spacing (°)** accepts whole degrees from 15 to floor(360 / count). Increasing count reduces spacing if needed. Arrows form a fan centered on the saved direction; dragging any arrow rotates the entire fan. All drone-image and DSLR arrows sit 40 pixels from their camera point regardless of count or spacing; dense fans can overlap. Camera icons show a small numbered badge at the top right in both maps, numbered from 1 within each camera category. Points are identified only by category and number. Drag the grip beside a point up or down within its category to change its number, or focus the grip and press Up/Down. Drop onto another row to swap just those two points. Releasing between rows leaves the order unchanged. While dragging, the row lifts and follows the pointer while the other rows stay still. An outline marks the swap target. Release animates the point into place before saving. Escape cancels the preview. Reordering saves the new order; the crosshair centers the active map on that point without changing zoom or saving.

### Map editing

In either map, choose **Add 360 point**, **Add DSLR point**, or **Add drone image**, then place points repeatedly on the map. Click to place a 360 point. For DSLR and drone images, press to set the position, hold and drag to aim, then release to finish the point. The same tool stays active for the next point. **Right-click**, **Escape**, or **Cancel placement** stops placement and discards any unfinished point.

Drag a camera icon or the center move icon of the rig to reposition it. The rig interior can be clicked to select it. In ShadeMap, dragging the interior pans the map; middle-button dragging pans over the map, rig, and camera icons. Moving the rig itself uses its center icon. Hover or select the rig to reveal one edge dot for both scale and rotation, plus the oval handle on the minor-axis edge for ovalness. DSLR/drone direction arrows remain visible beside their camera icons. Drag an arrow to aim in the editor. Selecting an object keeps its handles visible. Drag the edge dot in/out to resize and around the center to rotate. The sidebar retains a radius spinner for circles and side-by-side biggest/smallest radius spinners for ovals; map handles also control ovalness and rotation. Camera selection exposes coordinates, direction where applicable, and removal action.

Movement previews are temporary until the drag ends; committed changes autosave and are included in exports. Placement, selection, and hover state are not saved. Loaded briefs display the same geometry with editing and adjustment handles disabled.

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

The current center and scale transfer in both directions, including fractional zoom: Google's 256 px tile convention maps to MapLibre zoom minus one (512 px). Brief coordinates are never rounded or rewritten. Google Maps remains mounted while hidden so returning does not reframe the scene. Provider choice, shadow time, and map movement are temporary view settings; exports and autosave are unaffected.

The slider spans 00:00–23:55 in five-minute steps on the brief's shoot date. Its displayed IANA timezone follows the viewed location, including daylight saving. For a nonexistent local clock time at a spring DST transition, the UI shows the resolved clock time and an adjustment notice. At the autumn repeated hour, the timezone library chooses one occurrence; this UI does not select between both occurrences.

ShadeMap provides shadow preview and object editing in the editor, with a read-only viewer. Both maps share camera icons, direction arrows, selection highlights, rig outlines, and adjustment controls. Search, camera placement, zoom, framing, and layer toggles work over both maps. Both maps use repeated press-drag-release placement for DSLR/drone cameras and one-click placement for 360 points; right-click, Escape, or Cancel placement stops and discards any unfinished point. Both maps support camera selection and dragging, arrow dragging to aim, rig center dragging, and scale/rotation/oval handles. ShadeMap drags commit on release; Escape or pointer cancellation discards the preview. Missing keys, failed map loading, and SDK license failures show a message while keeping the return control available.

The adapter waits for map tiles before querying buildings, explicitly retains MapLibre geometry getters, and removes duplicate tile-buffer polygons before sending plain GeoJSON to ShadeMap. Development keys are not documented as using lower-quality shadow rendering; paid plans primarily change deployment and usage allowances.

Building shadows depend on OpenStreetMap coverage and available height attributes; missing heights use a 3 m estimate, and buildings load at street-level zoom. Terrain resolution also limits detail. The preview is not a measured survey. Newbuild polygons currently have no height field and are outlines, not shadow-casting buildings. Image overlays remain unimplemented in both renderers.

Like the Google browser key, this Vite-prefixed key is visible to browsers. `.env.local` keeps it out of Git; restrict permitted domains with the provider and use your hosting environment for production configuration. API keys are never included in brief JSON or shared keys.

References: [ShadeMap SDK](https://github.com/ted-piotrowski/mapbox-gl-shadow-simulator), [OpenFreeMap](https://openfreemap.org/quick_start/).

## Persistence and export semantics

This skeleton has no server, database, account system, or disk-file writer. JSON is serialized to browser storage under `dronebrief:draft:v1:<id>`. The last draft is offered on the landing page. Clearing browser storage removes drafts. Keep an export key to retain a portable copy.

New export keys start with `DB2.` and contain the complete validated UTF-8 JSON snapshot, compressed with raw DEFLATE and encoded with base64url. Existing uncompressed `DB1.` keys still load. Brief JSON remains schema version 1. Older app versions cannot read DB2 keys. Compression preserves all values, including coordinate precision. Imports enforce the 2 MB JSON limit with a bounded decompression buffer. Embedded images can still produce large keys.

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
  pages/                     # landing, creation wizard, brief page
  components/
    ui/                      # official shadcn primitives
    layout/                  # shared app chrome
  features/
    briefs/
      model/brief.ts         # versioned Zod schema and inferred types
      state/                 # edit/view boundary; ephemeral visibility
      storage/               # JSON repository and portable export adapter
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
