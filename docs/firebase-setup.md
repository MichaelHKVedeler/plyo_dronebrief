# Firebase setup and operations

Blank Firebase web configuration retains the local-only workflow. Configured installations use Google Authentication, Standard `(default)` Firestore, Cloud Storage and trusted Functions in `europe-west1`. Map credentials are independent and optional.

## Plyo deployment

Project: `plyo-dronebrief` (project number `923952642548`). Site: https://plyo-dronebrief.web.app. The existing NOK billing account ending `730730` is linked with owner approval; this project uses the usage-billed Blaze plan.

Google sign-in is enabled. Authorized domains are `localhost`, `127.0.0.1`, `plyo-dronebrief.web.app` and `plyo-dronebrief.firebaseapp.com`. `michaelhkvedeler.github.io` was removed on 2026-11-18: every GitHub Pages site of that account shares the address, so a session kept there could be read by any of them. The GitHub Pages copy still opens public links and local drafts; sign in on `plyo-dronebrief.web.app`. The provider is declared in `firebase.json`; domain changes must also be applied in Firebase Authentication settings (the installed CLI's auth deploy does not apply an `authorizedDomains` field).

### Sign-in from Plyo Toolkits

Opening https://plyo-dronebrief.web.app from the Photo Brief card in Plyo Toolkits (`?plyo-connect=1`) signs the person in without a second Google prompt. The vendored `@plyo/accounts-client` (`vendor/`, built from the Plyo Toolkits repository) exchanges a one-time code with Plyo Accounts at `https://plyo-toolkits.web.app` for a Firebase custom token, and `src/features/cloud/auth/toolkits-login.ts` signs in with it before the app reads the URL. Direct Google sign-in is unchanged. When the browser already holds the Dronebrief session Toolkits made for that same Plyo account (the `plyo_accounts_uid` claim equals the `account` in the link), the app opens at once without the exchange. The Plyo loading screen from the same package (`plyoLoadingScreen()` in `vite.config.ts`) covers only these launches, until the account has loaded or the sign-in is refused.

Plyo Accounts signs the token for the Dronebrief user that already has the person's Google-verified email, so memberships, projects and collections stay with the same UID; a first-time person gets a new user and activates pending grants as usual. `principal()`, `firestore.rules` and `storage.rules` accept such a session only when it is a custom token with `plyo_tool == 'dronebrief'` and `plyo_accounts_project == 'plyo-accounts-prod'` and the user has a verified email. Organization membership is still required for all data.

Only the `https://plyo-dronebrief.web.app` origin is registered with Plyo Accounts; a launch on GitHub Pages or localhost fails with a message and a link to continue with Google sign-in. Signing out of Toolkits does not end an open Dronebrief session. The service account and IAM bindings this needs in `plyo-dronebrief` are listed in the Plyo Toolkits repository, `docs/production.md`. Deploy `api` and both rule sets before the site: an older backend rejects these sessions with "Sign in with a verified Google account."

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

## Releasing brief data-model changes

The browser and Cloud Functions both compile `src/features/briefs/model/brief.ts`. When adding a saved field such as `droneScan`, deploy the updated `api`, `processing` and `publicView` functions before releasing the frontend. An older backend strips fields its Zod schema does not recognize, which can acknowledge a save while dropping new content or omit it when loading. A GitHub push or GitHub Pages deployment only updates source/frontend content; it does not deploy Firebase Functions.

Run `npm run check`, then `npx firebase deploy --project plyo-dronebrief --only functions:dronebrief:api,functions:dronebrief:publicView` for the save/load and public-view handlers. Update other functions too if their behavior changed. Validate a save-and-reopen round trip after deployment. Existing data already stripped during a save cannot be recovered from that saved snapshot; re-add it or restore from an intact export.

## Administration and persistence

### Floorplan mask persistence — 2026-09-29

Deployed the shared `imageOverlays[].mask` schema to `api` and `publicView` in `plyo-dronebrief`. Their previous deployments predated the mask field; older body validation stripped it on save/load. Both function updates completed successfully. Deployment discovery required `FUNCTIONS_DISCOVERY_TIMEOUT=60` after the default ten-second timeout.

All 470 tests and frontend/backend builds passed, including a new cloud-body round-trip regression for creating, editing and removing masks. Firebase rules tests remain blocked by missing Java. A signed-in browser save/reload was not verified because the available browser session was signed out. Masks stripped by an earlier save must be redrawn or restored from an intact snapshot.

Bootstrap creates Plyo and pending admin grants for `kristian.nordahl@plyo.com` and `michael.vedeler@plyo.com`. Each activates only after a matching verified Google sign-in. Its persistent marker prevents reruns from restoring removed admins.

The members of the Plyo organization (`organizations/plyo`) are decided in Plyo Toolkits, under **Manage Users**: everyone there with the Dronebrief tool is a member, and owners and admins there are admins here. Whenever that list changes, the membership trigger of Plyo Accounts posts the whole list to the `accountsSync` function, which adds, re-ranks and removes grants until they match (`syncOrganization`). The function accepts only a Google-signed identity token of `shared-login-bridge@plyo-accounts-prod.iam.gserviceaccount.com` made for `https://plyo-dronebrief.web.app/accounts-sync`, and refuses an empty list. Anyone in the Plyo organization who is not in that list loses access at the next sync. Dronebrief has no member management of its own: the **Manage organization** page and its API operations (`organization`, `createOrganization`) were removed, so organizations can no longer be created or edited from the app.

Sign-in or **Refresh access** activates a matching grant. `manageOrganization` and `createOrganization` remain in `functions/src/organizations.ts` only because the emulator tests set up memberships through them; no client can call them. Removing membership revokes both its UID membership and email grant, while organization projects remain.

The backend validates identity, current membership, project state, schema, asset ownership, revision and operation identity. Client writes are denied. Conflicts preserve local working state and offer reload, new-project copy or snapshot export; no automatic merge or force overwrite exists. Retry reuses the same operation after uncertain acknowledgment. Unsaved cloud work is in memory: keep the page open or export before leaving.

Personal collections affect organization only, never permissions. Library search matches normalized name prefixes across project, client, creator, latest editor and personal collection. It is not full-text/typo-tolerant search. Backend pagination returns 50 entries with deterministic ordering. Projections are eventually consistent; refresh after indexing. Membership and deletion are independently rechecked before returning results.

### Startup performance

The 2026-09-28 production-build comparison reduced the entry point plus cloud-library static dependencies from 1,516,565 to 1,140,032 JavaScript bytes (468,577 to 352,443 bytes using Node's default gzip), about 25%. This excludes CSS and third-party map downloads and measures payload size, not end-to-end login latency. The editor loads only when opening a brief, alongside its project-data request.

Account initialization runs the profile write alongside the pending-grant lookup, then returns organizations after grant activation completes. Collection and creator lookups run together after the membership check. Sharp's native image processor is imported only when an image is optimized, rather than during every account/library cold start. Release these backend improvements by deploying `functions:dronebrief:api`; the frontend loading changes can be released independently and work with the existing API contract.

The API still scales to zero. Since 2026-11-18 image processing (`finalizeUpload`) has its own `processing` function with concurrency one for memory safety, and `api` shares its instances between requests, so requests sent together no longer each wait for a new instance. A first request after inactivity can therefore still wait for a cold start. If deployed startup timings remain too high, evaluate a separate lightweight account/library function or a minimum warm instance, accounting for the latter's ongoing cost. Do not raise shared API concurrency without measuring concurrent image-processing memory use. See [Firebase performance guidance](https://firebase.google.com/docs/functions/tips) and [scaling controls](https://firebase.google.com/docs/functions/manage-functions).

## Floorplans and public links

Inputs are single-frame JPG/PNG up to 30 MiB and 100 million pixels. Trusted processing applies orientation, strips metadata, converts to sRGB, preserves transparency and fits within 4096 pixels/eight megapixels. WebP first uses lossless encoding, then quality 90/85/80 to target 2 MiB. Results up to 4 MiB retain drawing detail; larger outputs retry at 3072/2048 pixels. No cropping, enlargement or local file modification occurs. Cloud originals are not archived.

Only finalized assets can enter saved manifests. Final files are immutable, versioned and never recompressed on open/save. Replacements preserve the old saved asset until commit. Cleanup removes abandoned uploads and unreferenced assets after 24 hours. Local draft migration retains the device draft; missing local files must be reconnected. Legacy embedded snapshots remain unchanged.

Migration keeps a recovery record in the local repository, scoped to account, organization and draft contents. Reopening the same migration reuses the cloud project and exact save operation, including after a lost acknowledgment. Do not clear browser storage until migration finishes.

Image processing (the `processing` function) uses a 2 GiB Functions instance, concurrency one, with a five-minute deadline; validate large representative inputs in staging before increasing concurrency. Public downloads use 512 MiB instances with concurrency eight. Both are capped at 20 instances. Track memory use and latency alongside storage savings.

Public links contain an unguessable token in the URL fragment, submitted to the backend in POST bodies. Responses use `no-store`; handlers do not log tokens. Public endpoints provide the current brief, necessary asset descriptors, display names and timestamps, excluding emails/memberships/personal collections. They stream optimized floorplans and reference images after token/project checks; anonymous direct Storage access remains denied. Public briefings refresh every 30 seconds and on returning to the tab, and show Google Maps with capture instructions rather than the editor chrome. Revocation prevents further requests; downloaded content cannot be recalled.

**View floorplan** opens the optimized image on a white preview surface, including when maps are unavailable. Verify representative small labels, thin lines and colored/transparent drawings over both real map providers in staging with valid provider credentials.

## Maintenance

### Request and image budgets

The API uses atomic, server-only Firestore counters in `rateLimits`. All budgets must admit a request before its operation runs. Exhausted callable requests return `resource-exhausted`; public requests return HTTP 429 with `Retry-After`. A limiter outage fails closed with a temporary-unavailable response. A bounded process-local cache can repeat a denial until its window ends, but never authorizes a request.

Defaults are defined in `functions/src/request-budget.ts`:

| Scope | Limit |
| --- | --- |
| API, all callers | 1,000/minute; 100,000/day |
| API, one user | 180/minute; 10,000/day |
| API, one network bucket | 600/minute |
| Account initialization, one user | 6/minute |
| Image optimization/copy, one user | 20/minute combined |
| Public requests, all callers | 1,000/minute; 50,000/day |
| Public requests, one network bucket / one share token | 120/minute / 240/minute |
| Public response bytes, all shares / one share | 16 GiB/day / 4 GiB/day |

Minute/day windows use UTC and can admit bursts across a boundary. Public request counts are checked before looking up a link. Transfer budgets are charged only after a valid link/resource is established: serialized brief bytes or the trusted optimized asset size, before sending/downloading it. Invalid links never consume transfer allowance. A failed delivery is not refunded. Normal 30-second public refreshes remain supported.

Network keys use only the last valid forwarding hop; forged prefixes and malformed headers do not create arbitrary buckets. This can group a platform proxy or a shared network, so UID/share/global quotas are the authoritative ceilings. It does not promise exact identification of each human client. Rejected requests, limiter reads, and infrastructure overhead can still incur charges; these controls bound admitted work, not total cloud spending. Monitor rejection rates and tune constants before raising limits. App Check or a trusted edge gate can provide additional abuse filtering.

Uninvited Google accounts no longer create user-profile documents. Member profiles only refresh `lastSeenAt` every 15 minutes unless their name/email changes; membership and grant activation are still checked on every admitted account request.

`prepareUpload` reserves 30 MiB per new original against 600 MiB/user/day and 3 GiB/organization/day (20 original-upload reservations/user/day if no copied bytes are charged). Copies consume their canonical optimized byte size against the same budgets. Charges are atomic, private, not refunded on failure/expiry, and not repeated for an identical operation retry. Quota documents in `uploadBudgets` use fixed per-user/org IDs. Limits are defined in `functions/src/upload-budget.ts`.

Each project holds at most 20 unexpired `pendingUploads` entries, bound to the initiating UID, a byte ceiling, and a 30-minute trusted expiry. Storage requires that reservation plus current membership and an active project. This reuses the project lookup to stay within Storage's two-Firestore-document access limit. Clients cannot edit reservations/counters. Preparation retries cannot extend expired reservations, change the file identity, or reuse a completed identifier. Start a new upload after expiry. Completed pre-expiry originals can still be finalized later while retained; originals created after expiry are rejected. Finalization is protected by a 10-minute processing lease and at most three attempts. A failed image decode ends its upload authority.

Gzip/other encoded originals are rejected by both Storage rules and backend metadata validation. Downloads disable automatic decompression before byte validation. Finalization removes upload authority before deleting the original, preventing reuse of its path. Pending-reservation changes alone do not trigger library projection fan-out. Failed/abandoned originals retain the existing daily cleanup policy.

`firestore.indexes.json` enables TTL on private counter `expiresAt` fields and exempts counter fields and project reservation maps from indexing. TTL cleanup is eventual; request authorization checks the stored window directly and never depends on TTL having run. Keep `scripts/build-indexes.mjs` in sync with these overrides.

Release this change in order: build and test; deploy `api`, `publicView`, `projectIndex`, and `janitor`; then deploy Storage rules and Firestore index/TTL configuration; then deploy the built frontend for clear temporary-limit messages. Existing clients already call `prepareUpload`, so no upload request schema change is required. Uploads prepared before this backend release have no reservation and must be restarted after the new rules become active. Pending legacy image-copy operations can be retried with a new destination if required.

Use `npm run check` for regression coverage. The additional `scripts/smoke-emulators.mjs` flow now verifies the actual callable account limit, public HTTP 429/`Retry-After`, and that invalid tokens do not consume transfer bytes. These probes pin Admin SDK access to local `demo-dronebrief`; they must never target production. If a shared emulator cache is locked on Windows, set `FIREBASE_EMULATORS_PATH` to an isolated cache directory before running checks.

`projectIndex` and `libraryIndex` perform retryable, paginated projection updates. Monitor failed invocations and outstanding `indexJobs` if indexing stalls. `janitor` runs daily and writes its completion to `maintenance/cleanup`. It clears expired unused assets and permanently deletes up to 100 projects past the 30-day recovery period per run. Retry failures safely. Monitor Functions failures, indexing backlog, cleanup completion, upload durations and Storage/Firestore usage.

Projects are marked as purging before physical cleanup, preventing restoration during deletion. Moving a project to Deleted projects revokes public sharing; restore never reactivates the old token. Administrators can restore a project from Deleted projects within 30 days or delete it permanently. Deploy backend operations and security rules together.

## Drone scan persistence verification - 2026-09-26

Updated the live `api` and `publicView` functions in `plyo-dronebrief` to include the drone scan schema. Verified the deployed API from the signed-in local app: created the separate **Drone scan persistence verification** project, added 500 m high-res and 800 m low-res circles, waited for Saved, and fully reloaded the project. Both circles and diameters remained. The test project remains in the library.

All 390 application/backend unit tests and both builds passed. Firestore/Storage emulator checks remain blocked by the local emulator startup socket error.

## Extra coverage verification - 2026-09-26

Deployed the updated `api` and `publicView` schema for `extra-coverage` points. In the existing synthetic **Drone scan persistence verification** project, placed a green point in ShadeMap, checked it in Google Maps, added a normal drone-image point, waited for Saved, and reloaded. Both point categories and the 500/800 m circles survived. A temporary public link opened with normal points only; Drone scan showed circles plus green coverage exclusively, and toggling it off restored normal points. The temporary link was revoked after verification. Checked the green control at 390 px without horizontal overflow.

The 396-test suite and frontend/backend builds passed; the expanded placement suite also passed afterward. The rules stage remains blocked by the local Java loopback/socket startup error. Frontend changes still require the normal release workflow.

## Verification status — 2026-09-19

- `npm run check` passed: 216 unit/integration tests, 14 Firestore/Storage emulator tests, frontend/backend type checks, clean lint and production builds. Emulator cases include 10,000-project search, filtering and sorting, multi-document bodies, conflicts, permissions and cleanup. Vite still reports large lazy-loaded Firebase/map bundles.
- The full-emulator smoke script passed through the actual callable HTTP handlers with an emulated verified Google identity, private uploads, optimization, idempotent saving and public endpoints. Bootstrap was run twice successfully.
- Chrome verified signed-out public viewing, optimized-image decoding and preview, keyboard-accessible dialog controls, missing-map behavior and a 390-pixel layout without horizontal page overflow. A synthetic transparent 4200 × 2400 drawing became 3741 × 2138 WebP, from 69,265 to 15,138 bytes. Browser checks found and fixed a StrictMode download cancellation race.
- `plyo-dronebrief` is provisioned and deployed: Google Authentication, 48 ready Firestore indexes, Firestore/Storage rules, five backend functions (including both indexing triggers and scheduled cleanup), and Firebase Hosting. First-deployment Eventarc permission propagation failures were resolved by retrying the affected functions.
- Deployment validation reran all 216 application tests, lint and frontend/backend builds. The rules stage of `npm run check` encountered existing local emulator ports; all 14 rules/backend tests then passed on isolated ports. After isolating local-workflow tests from the developer's live Firebase configuration, all 17 affected tests passed again.
- Chrome verified the real Google account chooser. The user completed Google sign-in in the local app connected to the live project, and Plyo admin access loaded successfully. A synthetic project was created, renamed with confirmed cloud autosave, listed in the library, and moved to recoverable Trash. Its library projection also changed to deleted, verifying the deployed indexing triggers. Unauthenticated API requests return 401 and unknown public links return 404. Live image-upload/public-image validation and separate Google Maps/ShadeMap credentials and provider comparisons remain outstanding.

References: [Google authentication](https://firebase.google.com/docs/auth/web/google-signin), [Storage rules](https://firebase.google.com/docs/storage/security/rules-conditions), [Sharp output](https://sharp.pixelplumbing.com/api-output/).
