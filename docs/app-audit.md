# Three-app review — ar/project-improvements

This branch descends from `t3/secure-file-sharing-improvements`, including its
Secure Drop implementation and the preceding uncommitted hardening changes.
All 17 original `page.tsx` files were reviewed; the project edit page is new.

This is a historical review. The [current README](../README.md) covers
chunked sharing, verified transfer boundaries and distributed rate limiting.

## Page coverage

### Web (port 3000)

- `/`: added Secure Drop to the feature list, fixed undefined dashboard links
  for local development, and removed unnecessary new-tab navigation. Set
  `NEXT_PUBLIC_DASHBOARD_URL` to the deployed dashboard URL before building for
  production. Updated the root metadata from the starter template.

### Dashboard (port 3001)

- `/`: replaced the Next.js starter page with session-aware routing.
- `/auth/sign-in`, `/auth/sign-up`: preserve safe dashboard/invite destinations,
  link between auth pages, and validate before dispatching form actions.
- `/invite/[token]`: correct invalid-link messaging; expired/replaced links are
  rejected transactionally; repeated acceptance preserves existing roles.
- `/drop`: retained explicit download consent, no-index/referrer protection,
  single-use behavior, and the malware-scanning disclosure.
- `/dashboard`: reviewed zero/one/multiple organization behavior.
- `/dashboard/organizations/new`: atomic organization/admin creation, unique
  slugs and validation before submitting.
- `/dashboard/organizations/[slug]`: added projects, members and file-sharing links.
- `.../members`: scoped role changes/removal, serialized last-admin protection,
  admin-only invite access, visible action and clipboard errors.
- `.../projects`: exposed editing alongside existing creation/deletion controls.
- `.../projects/new`: fixed async validation and blank-name validation.
- `.../projects/[id]/edit` (new): checks organization membership and project
  ownership before showing the shared edit/create form. All organization members
  may edit, matching the existing update action's policy.
- `.../secure-drop`: reviewed metadata-only listing, expiry/revocation status and
  creator/admin revoke controls; retained filename/origin/size/quota protections.

### Admin (port 3002)

- `/`: authorization also runs at the data-access boundary; added file-drop counts.
- `/organizations/[id]`: guarded data access, back navigation and empty states.
- `/auth/sign-in`: accessible input labels and handled credential failures.
- `/unauthorized`: offers sign-out to recover from using the wrong account.

**Required configuration change:** set `ADMIN_USER_ID` to an existing trusted
`User.id`. `ADMIN_EMAIL` no longer grants platform access, because signup does
not verify email ownership. An unset ID denies admin access. Protect the admin
account and use separate app/session configuration as appropriate for deployment.

## Database changes

`20261117000000_project_improvements` adds indexes for organization roles,
project listing/creator lookups, and active invite lookups. It adds file-size,
expiry and token-hash check constraints. Constraints use `NOT VALID` to avoid
rejecting migration because of historical rows, but enforce invariants for new
or updated rows. Inspect and repair historical data before validating those
constraints in an existing deployment.

Invitation rotation, acceptance and membership changes share an organization
transaction lock. Rotation cannot leave multiple newly generated active links;
acceptance rechecks the token after taking the lock and uses membership upsert.
Organization and first-admin creation use a nested atomic write.

All three migrations were applied to an isolated PostgreSQL 17 container. No
existing user/deployment database was modified. Deploy the migration with
`pnpm --filter @repo/db exec prisma migrate deploy` after setting `DIRECT_URL`
(or `DATABASE_URL` if no direct connection is needed).

## Verification results

- Prisma schema validation and client generation passed.
- All three migrations applied successfully to a fresh PostgreSQL database.
- Eight unit tests passed (crypto, body limits, origins, filenames, redirects,
  platform-admin policy).
- Four integration suites passed with no skips when `RUN_APP_SMOKE=1`: database
  download races, membership races/tenant boundaries, invitation rotation and
  acceptance, and HTTP checks against all three built apps.
- HTTP checks cover authenticated pages including project edit, denied foreign
  organization access, trusted/untrusted admin sessions, upload authorization,
  malformed filenames, origin rejection, upload/download byte equality,
  clearing ciphertext, one-time consumption and revocation.
- Lint passed for all three apps. Fresh production builds and their TypeScript
  checks passed for all three apps.

To repeat: install dependencies, generate Prisma, configure and migrate a
disposable database, run `pnpm test`, `pnpm lint`, and `pnpm build`. Set
`SECURE_DROP_TEST_DATABASE_URL` to that database and run `pnpm test:integration`.
Also set `RUN_APP_SMOKE=1` to include the HTTP suite after building. The HTTP
suite temporarily uses ports 3330–3332, generates ephemeral session/encryption
keys, and removes its fixtures and servers afterward. It uses synthetic signed
sessions; it does not replace browser testing of credential submission.

Browser interaction, clipboard behavior, keyboard/mobile layouts, signup/login
form submission, password reset/email verification and deployment-specific
limits were not verified. Do not infer that every possible feature is tested.
Public-launch priorities remain distributed rate limiting, malware scanning,
recipient verification, storage/retention operations and browser automation.
