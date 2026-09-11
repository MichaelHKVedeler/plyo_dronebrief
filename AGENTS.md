# Contributor instructions

Applies to every file in this repository. Humans and AI assistants share the same architectural rules. Read README.md, this file, and the relevant feature before editing. This is a skeleton: preserve its small scope and distinguish working features from planned ones.

## Stack and UI

- Use React, strict TypeScript, Vite, and Tailwind v4. npm and package-lock.json are authoritative.
- Use ONLY shadcn/ui for application controls: buttons, inputs, labels, dialogs, tabs, switches, cards, alerts, etc. Install missing primitives with the shadcn CLI.
- Semantic HTML for layout and text is fine. Lucide icons and Google Maps geometry/canvas/attribution are allowed. Do not introduce another UI kit or handcraft substitutes for available shadcn controls.
- Keep official shadcn source in src/components/ui. Compose and style at call sites, and change shared theme tokens in src/styles/globals.css.
- Do not put business logic, repository calls, or map code in components/ui.
- Avoid new dependencies unless needed for the assigned feature. Commit lockfile changes alongside manifest changes.

## Boundaries

| Folder | Responsibility |
| --- | --- |
| src/pages | Screen composition and navigation callbacks |
| src/components/layout | Shared app chrome without brief-domain state |
| src/components/ui | shadcn primitives only |
| src/features/briefs/model | Zod schema, serializable domain types, factories |
| src/features/briefs/state | Session transitions and edit/view guarantees |
| src/features/briefs/storage | Persistence and share transport adapters |
| src/features/briefs/components | Brief-specific controls |
| src/features/map | Map SDK, geometry, rendering, interaction tools |
| src/lib | Small shared utilities without domain rules |
| src/test | Integration tests and test setup |

Use `@/` imports across features. Within a feature, relative imports are fine. Prefer named exports. Keep pages thin and extract new tools into focused files. Avoid broad barrel files and circular imports. Do not spread direct localStorage access through UI components.

## Data contract

- src/features/briefs/model/brief.ts is the single source of truth. Infer TypeScript types from Zod; do not duplicate interfaces elsewhere.
- Store plain JSON only: no Google Maps objects, class instances, Dates, Files, functions, DOM nodes or object URLs.
- Coordinates are WGS84 latitude/longitude. Distances and heights are meters. Direction is clockwise from north in [0, 360).
- A 360 angle has only a position and identifying metadata, never a direction. Drone image and DSLR angles have directions.
- Rig position is independent of project coordinates. See docs/data-model.md for oval convention.
- Asset uploads must eventually resolve to durable sources before exporting. Do not store temporary blob URLs in JSON.
- Keep schemaVersion and export prefix versioned. A breaking field change requires an explicit migration/version decision, tests, and documentation. Never silently reinterpret existing exports.
- Validate imported data before opening it. Preserve size limits and reject unsupported versions.
- Stored settings and ephemeral UI state are different: selections, tool mode, map pan/zoom, visibility, and dialogs do not belong in saved brief content.

## Edit/view and saving

- Every brief mutation must go through reduceSession, using an update action. Keep updates immutable and updater functions pure.
- View mode must reject update actions at the state boundary, not only hide buttons.
- Viewer loads and visibility toggles must not write drafts. New map tools must respect the same boundary.
- Persist committed edits through the repository adapter and show save failures. Do not claim success before a save completes.
- The current key is an unsigned portable snapshot, not a credential or backend ID. Do not describe the read-only UI as security or add authentication claims without a backend.
- Keep the app usable when Google Maps credentials are missing or map loading fails.

## Collaborating without conflicts

- Agree on a bounded feature and its owned files before concurrent work; use separate branches/worktrees when sharing a Git repository.
- Natural work areas are wizard/pages, map tools, brief schema/storage, and UI theme/components.
- Coordinate changes to App.tsx, model/brief.ts, components.json, theme tokens, package.json and the lockfile; they are shared integration points.
- Establish shared data types before separate map tools consume them. Keep schema changes separate from unrelated styling.
- Check git status and read existing changes before writing. Never discard another contributor's changes or use destructive reset/checkout operations to simplify a merge.
- Do not commit credentials, .env.local, node_modules, dist, generated test output, or personal brief data.
- Keep commits focused. Describe changed behavior, verification, and remaining limitations when handing off.
- These collaboration rules do not authorize automatically spawning agents.

## Checks before handoff

Run `npm run check` after meaningful changes. Add focused tests for schema compatibility, persistence, import/export, or the edit/view boundary when those behaviors change. Avoid tests that merely mirror markup. For UI changes, exercise the relevant screen and check a narrow viewport, keyboard labels, empty states, and error states.

Do not remove failing tests to make checks pass. Avoid changing the vendored shadcn code solely to silence lint. Keep READMEs accurate and update docs/roadmap.md when a placeholder becomes a working feature.
