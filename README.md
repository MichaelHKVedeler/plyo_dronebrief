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
- Tests covering Unicode exports, malformed keys, persistence failures, and read-only behavior.

Project and numeric fields commit on blur (clicking elsewhere or pressing Tab). New briefs start in Oslo (59.9139, 10.7522). Use the Google Maps location search above the map or enter coordinates before adding a rig. Saved and imported briefs keep their stored location. A rig has its own position; moving project coordinates does not silently move an existing rig. Use **Move rig to project location**.

## Google Maps setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_GOOGLE_MAPS_API_KEY` using your own Google Cloud project with Maps JavaScript API and Places API (New) enabled.
3. Optionally set `VITE_GOOGLE_MAPS_MAP_ID`; the skeleton otherwise uses `DEMO_MAP_ID`.
4. Restart Vite.

A Maps JavaScript API key is browser-visible. Restrict its allowed referrers and API in Google Cloud; do not put a server secret in any VITE variable. A working Google Cloud configuration, including any required billing, is your responsibility. Google Maps and Places suggestions were verified with the configured key. Automated tests cover selection, lookup failures, and leaving the editor during a pending lookup.

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
