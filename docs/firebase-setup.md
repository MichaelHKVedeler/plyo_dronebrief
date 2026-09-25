# Firebase setup and operations

Blank Firebase web configuration retains the local-only workflow. Configured installations use Google Authentication, Standard `(default)` Firestore, Cloud Storage and trusted Functions in `europe-west1`. Map credentials are independent and optional.

## Plyo deployment

Project: `plyo-dronebrief` (project number `923952642548`). Site: https://plyo-dronebrief.web.app. The existing NOK billing account ending `730730` is linked with owner approval; this project uses the usage-billed Blaze plan.

Google sign-in is enabled. Authorized domains are `localhost`, `127.0.0.1`, `plyo-dronebrief.web.app`, `plyo-dronebrief.firebaseapp.com`, and `michaelhkvedeler.github.io`. The provider is declared in `firebase.json`; domain changes must also be applied in Firebase Authentication settings (the installed CLI's auth deploy does not apply an `authorizedDomains` field).

The Standard `(default)` Firestore database and private `plyo-dronebrief.firebasestorage.app` bucket are in `europe-west1`. Bucket versioning and soft deletion are disabled. CORS permits image reads from the two Firebase hosted domains, `https://michaelhkvedeler.github.io`, and local port 5173. Storage's service agent has the Firestore rules integration role. The Plyo bootstrap has run; Kristian and Michael's documented admin grants activate on their verified Google sign-ins.

The ignored `.env.local` contains the web app configuration and `VITE_FIREBASE_EMULATORS=false`. Restart Vite after changing configuration, and remove shell-level emulator variables, which override `.env.local`. Do not replace these values with the demo configuration below unless intentionally testing emulators. Google Maps and ShadeMap still need their separate provider keys.

For later releases, run `npm run check`, then `npx -y firebase-tools@latest deploy --project plyo-dronebrief --only auth,firestore,storage,functions,hosting`. Build output is served from `dist`; hash routes are supported. Complete the build before deployment. New retry-enabled indexing functions require the CLI's `--force` acknowledgement after reviewing the retry policy. Container build images have a one-day cleanup policy.

## Development and verification

Install Node 22 LTS (22.12+), npm and Java 21+. Run `npm ci`, then `npm run check`. The check includes existing/new tests, frontend/backend TypeScript builds, lint, web build and Firestore/Storage emulator tests, including 10,000 project summaries. First-run emulator downloads require network access. Ports 8080 and 9199 must be free.

If Java reports `Unable to establish loopback connection` inside a Windows packaged application, run from a normal terminal, or set a process-local `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/dronebrief-no-unix-sockets` before starting the emulators. That directory must not exist; this makes the JDK use TCP for its internal selector pipe. Remove this workaround outside the affected environment.

Start all development emulators with `npm run emulators`. Create an ignored `.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-dronebrief.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-dronebrief
VITE_FIREBASE_STORAGE_BUCKET=demo-dronebrief.appspot.com
VITE_FIREBASE_APP_ID=demo-app
VITE_FIREBASE_EMULATORS=true
```

In a second PowerShell terminal, bootstrap the emulator and start Vite:

```powershell
$env:GCLOUD_PROJECT = 'demo-dronebrief'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIREBASE_CONFIG = '{"projectId":"demo-dronebrief","storageBucket":"demo-dronebrief.appspot.com"}'
npm run bootstrap
npm run dev
```

Use the Auth emulator's Google popup with a bootstrapped email. Emulator connections are allowed only in Vite development builds. Use a separate staging project to test production builds. Stop development emulators before `npm run check`.

With all emulators running and bootstrapped, `node scripts/smoke-emulators.mjs` exercises the actual callable HTTP boundary with an emulated verified Google identity, save retries, Storage upload/optimization, and anonymous public endpoints. It creates only synthetic data in `demo-dronebrief` and prints a local public-viewer URL. This is additional to the isolated rules suite.

The root workspace lockfile controls development. The Functions deployment has its own npm lockfile; update both for backend dependency changes. `functions/lib` is ignored compiled output, built locally by Firebase's predeploy hook from the shared Zod schemas. `gcp-build` is disabled because that deployment already contains compiled shared modules.

Finish deploying both indexing triggers before the first user signs in. Firestore create triggers do not replay jobs that existed before deployment. If initial setup is interrupted, an authenticated operator can run the compiled `processIndexJob(id)` for those specific pending jobs; it is idempotent. The first Plyo membership job was recovered this way during initial provisioning.

## Provisioning and deployment

The following steps apply when provisioning another installation. The Plyo installation above has already been provisioned; do not create duplicate resources for it.

1. Authenticate with `npx -y firebase-tools@latest login`. Create the intended project with `npx -y firebase-tools@latest projects:create YOUR_PROJECT_ID --display-name "Plyo Dronebrief"`. Configure billing for Storage, Functions and scheduled cleanup.
2. Inspect databases with `npx -y firebase-tools@latest firestore:databases:list --project YOUR_PROJECT_ID`. Create a **Standard**, native **(default)** database in **europe-west1**. Storage rules consult membership/project records in this default database.
3. Create a private Firebase Storage bucket in **europe-west1**. Use its actual name, potentially ending in `.firebasestorage.app`, rather than assuming `.appspot.com`. Do not enable public object access or permanent download tokens. Keep object versioning off and configure zero-day soft-delete retention to avoid retaining deleted originals, where organization policy permits; otherwise document the provider retention window and its storage cost. The application's 30-day project recovery window is independent of bucket soft deletion.
4. Enable Google Authentication and configure its support email and authorized frontend domains. Matching Workspace domains do not grant membership.
5. Register a web app; obtain configuration using `npx -y firebase-tools@latest apps:sdkconfig WEB YOUR_APP_ID --project YOUR_PROJECT_ID`. Put values only in ignored `.env.local` or build environment settings. Never put service-account credentials in `VITE_` variables.
6. Configure Storage CORS to allow `GET` from the exact frontend origins, using the trusted Google Cloud operator tooling. For example: `[{"origin":["https://YOUR_FRONTEND_DOMAIN"],"method":["GET"],"maxAgeSeconds":3600}]`.
7. Run `npm run check`, then `npx -y firebase-tools@latest deploy --project YOUR_PROJECT_ID --only firestore,storage,functions`. Allow the prompted Storage-to-Firestore rules integration and wait for indexes to build.
8. Clear emulator variables. Configure Application Default Credentials, `GCLOUD_PROJECT=YOUR_PROJECT_ID`, and Firebase configuration identifying the real bucket. Run `npm run bootstrap`. This is an operator command, never an HTTP endpoint.
9. Build Vite and deploy with `npx -y firebase-tools@latest deploy --project YOUR_PROJECT_ID --only hosting`. The configured Firebase Hosting root is `dist`. Verify real Google sign-in, membership, uploads, public links and cleanup before relying on a new installation.

## Administration and persistence

Bootstrap creates Plyo and pending admin grants for `kristian.nordahl@plyo.com` and `michael.vedeler@plyo.com`. Each activates only after a matching verified Google sign-in. Its persistent marker prevents reruns from restoring removed admins.

Admins add emails through **Manage organization**. Sign-in or **Refresh access** activates a matching grant. No invitation is sent. Admins may manage roles/remove members but cannot remove the last active admin; pending grants do not satisfy that invariant. Existing admins can create other organizations. Removing membership revokes both its UID membership and email grant, while organization projects remain.

The backend validates identity, current membership, project state, schema, asset ownership, revision and operation identity. Client writes are denied. Conflicts preserve local working state and offer reload, new-project copy or snapshot export; no automatic merge or force overwrite exists. Retry reuses the same operation after uncertain acknowledgment. Unsaved cloud work is in memory: keep the page open or export before leaving.

Personal collections affect organization only, never permissions. Library search matches normalized name prefixes across project, client, creator, latest editor and personal collection. It is not full-text/typo-tolerant search. Backend pagination returns 50 entries with deterministic ordering. Projections are eventually consistent; refresh after indexing. Membership and deletion are independently rechecked before returning results.

## Floorplans and public links

Inputs are single-frame JPG/PNG up to 30 MiB and 100 million pixels. Trusted processing applies orientation, strips metadata, converts to sRGB, preserves transparency and fits within 4096 pixels/eight megapixels. WebP first uses lossless encoding, then quality 90/85/80 to target 2 MiB. Results up to 4 MiB retain drawing detail; larger outputs retry at 3072/2048 pixels. No cropping, enlargement or local file modification occurs. Cloud originals are not archived.

Only finalized assets can enter saved manifests. Final files are immutable, versioned and never recompressed on open/save. Replacements preserve the old saved asset until commit. Cleanup removes abandoned uploads and unreferenced assets after 24 hours. Local draft migration retains the device draft; missing local files must be reconnected. Legacy embedded snapshots remain unchanged.

Migration keeps a recovery record in the local repository, scoped to account, organization and draft contents. Reopening the same migration reuses the cloud project and exact save operation, including after a lost acknowledgment. Do not clear browser storage until migration finishes.

Image processing uses a 2 GiB Functions instance, concurrency one, with a five-minute deadline; validate large representative inputs in staging before increasing concurrency. Public downloads use 512 MiB instances with concurrency eight. Both are capped at 20 instances. Track memory use and latency alongside storage savings.

Public links contain an unguessable token in the URL fragment, submitted to the backend in POST bodies. Responses use `no-store`; handlers do not log tokens. Public endpoints provide the current brief, necessary asset descriptors, display names and timestamps, excluding emails/memberships/personal collections. They stream optimized floorplans and reference images after token/project checks; anonymous direct Storage access remains denied. Public briefings refresh every 30 seconds and on returning to the tab, and show Google Maps with capture instructions rather than the editor chrome. Revocation prevents further requests; downloaded content cannot be recalled.

**View floorplan** opens the optimized image on a white preview surface, including when maps are unavailable. Verify representative small labels, thin lines and colored/transparent drawings over both real map providers in staging with valid provider credentials.

## Maintenance

`projectIndex` and `libraryIndex` perform retryable, paginated projection updates. Monitor failed invocations and outstanding `indexJobs` if indexing stalls. `janitor` runs daily and writes its completion to `maintenance/cleanup`. It clears expired unused assets and permanently deletes up to 100 projects past the 30-day recovery period per run. Retry failures safely. Monitor Functions failures, indexing backlog, cleanup completion, upload durations and Storage/Firestore usage.

Projects are marked as purging before physical cleanup, preventing restoration during deletion. Moving a project to Deleted projects revokes public sharing; restore never reactivates the old token. Administrators can restore a project from Deleted projects within 30 days or delete it permanently. Deploy backend operations and security rules together.

## Verification status — 2026-09-19

- `npm run check` passed: 216 unit/integration tests, 14 Firestore/Storage emulator tests, frontend/backend type checks, clean lint and production builds. Emulator cases include 10,000-project search, filtering and sorting, multi-document bodies, conflicts, permissions and cleanup. Vite still reports large lazy-loaded Firebase/map bundles.
- The full-emulator smoke script passed through the actual callable HTTP handlers with an emulated verified Google identity, private uploads, optimization, idempotent saving and public endpoints. Bootstrap was run twice successfully.
- Chrome verified signed-out public viewing, optimized-image decoding and preview, keyboard-accessible dialog controls, missing-map behavior and a 390-pixel layout without horizontal page overflow. A synthetic transparent 4200 × 2400 drawing became 3741 × 2138 WebP, from 69,265 to 15,138 bytes. Browser checks found and fixed a StrictMode download cancellation race.
- `plyo-dronebrief` is provisioned and deployed: Google Authentication, 48 ready Firestore indexes, Firestore/Storage rules, five backend functions (including both indexing triggers and scheduled cleanup), and Firebase Hosting. First-deployment Eventarc permission propagation failures were resolved by retrying the affected functions.
- Deployment validation reran all 216 application tests, lint and frontend/backend builds. The rules stage of `npm run check` encountered existing local emulator ports; all 14 rules/backend tests then passed on isolated ports. After isolating local-workflow tests from the developer's live Firebase configuration, all 17 affected tests passed again.
- Chrome verified the real Google account chooser. The user completed Google sign-in in the local app connected to the live project, and Plyo admin access loaded successfully. A synthetic project was created, renamed with confirmed cloud autosave, listed in the library, and moved to recoverable Trash. Its library projection also changed to deleted, verifying the deployed indexing triggers. Unauthenticated API requests return 401 and unknown public links return 404. Live image-upload/public-image validation and separate Google Maps/ShadeMap credentials and provider comparisons remain outstanding.

References: [Google authentication](https://firebase.google.com/docs/auth/web/google-signin), [Storage rules](https://firebase.google.com/docs/storage/security/rules-conditions), [Sharp output](https://sharp.pixelplumbing.com/api-output/).
