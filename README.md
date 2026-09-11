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
- Two-step wizard: project/client, then date and multiple times.
- Separate editor and read-only viewer modes.
- Basic editor: rename project, coordinates, circle/oval rig settings, camera height arrays.
- JSON autosave in browser localStorage after every committed editor change.
- Export/import of portable snapshot keys, with schema validation and size limits.
- Layer visibility switches, kept separate from saved brief content.
- Optional Google Maps adapter: project location, circle/oval outlines, camera markers and polygons.
- Map placement for 360, DSLR, and drone images, with distinct icons and camera directions.
- Drag cameras and the circle rig to move them; rig handles adjust radius, rotation, and ovalness, and camera handles adjust direction.
- Satellite toggle and mouse-wheel zoom without Ctrl in both editor and viewer. These view preferences do not modify the brief JSON.
- Editor/viewer fit the browser window. The details panel has its own shadcn scrollbar; on narrow screens it sits below the map.
- Tests covering Unicode exports, malformed keys, persistence failures, and read-only behavior.

Project and numeric fields commit on blur (clicking elsewhere or pressing Tab). Initial coordinates are 0, 0; set the shoot location before adding a rig. A rig has its own position; moving project coordinates does not silently move an existing rig. Use **Move rig to project location**.

### Map editing

In the Project panel, choose **Add 360 point**, **Add DSLR point**, or **Add drone image**, then click a position on the map. A 360 point is complete immediately. For DSLR and drone images, click a second location to choose where the camera points. **Escape** or **Cancel placement** discards an unfinished placement.

Drag any camera icon, the rig center, or the rig interior to move it. Hover or select the rig to reveal one edge dot for both scale and rotation, plus the inside oval handle for ovalness. Hover or select a DSLR/drone camera to reveal its direction arrow, then drag the arrow to aim. Selecting an object keeps its handles visible. Drag the edge dot in/out to resize and around the center to rotate. Use the numeric settings in the sidebar for precise adjustments or keyboard input. Camera selection exposes its label, coordinates, direction where applicable, and removal action.

Movement previews are temporary until the drag ends; committed changes autosave and are included in exports. Placement, selection, and hover state are not saved. Loaded briefs display the same geometry with editing and adjustment handles disabled.

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
- Confirm Maps JavaScript API is enabled and the Google Cloud project has the required billing configuration.

The dev server stays on port 5173 and reports an error if that port is occupied, so it cannot silently switch to an origin excluded by your key restrictions. Before deploying, use a separately restricted production key and allow the exact production website origin. Configure it in your hosting provider's build environment; never commit it. Vite includes browser-prefixed values in the client build, so `.env.local` prevents source-control exposure, not browser visibility.

See [Google's API key restriction guidance](https://developers.google.com/maps/api-security-best-practices).

A Maps JavaScript API key is browser-visible. Restrict its allowed referrers and API in Google Cloud; do not put a server secret in any VITE variable. A working Google Cloud configuration, including any required billing, is your responsibility. Verify live map loading on each deployment using its restricted key.

Without a key, the map shows a clear placeholder. All application controls use shadcn/ui. The Google Maps canvas, attribution, and geographic shapes are the necessary mapping exception.

## Persistence and export semantics

This skeleton has no server, database, account system, or disk-file writer. JSON is serialized to browser storage under `dronebrief:draft:v1:<id>`. The last draft is offered on the landing page. Clearing browser storage removes drafts. Keep an export key to retain a portable copy.

An export key starts with `DB1.` and contains the complete validated UTF-8 JSON snapshot encoded with base64url. It works in another browser or on another device running this app. It is longer than a database lookup key, is not encrypted or signed, and is not a live link. Anyone with it can read its content; later edits require another export. Export/import is limited to 2 MB of JSON. Embedded images will increase key size.

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
