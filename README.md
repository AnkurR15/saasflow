# SaaSFlow

SaaSFlow is a team workspace for managing organizations, projects and temporary file handoffs. The public website, member dashboard and platform administration console are separate Next.js apps backed by shared Auth.js credentials and a PostgreSQL database.

| App | Local address | What you can do |
| --- | --- | --- |
| Web | `http://localhost:3000` | Explore the product, create an account or go to sign-in. |
| Dashboard | `http://localhost:3001` | Sign up, sign in or out, switch organizations, manage projects and membership, and send or receive files. |
| Admin | `http://localhost:3002` | The configured platform administrator can review organizations, member roles and emails, projects, creation dates and file-share counts. |

## Team workspaces

- Creating an organization makes its creator the first admin. A user can belong to several organizations.
- Admins can generate or replace a seven-day invitation link, promote or demote teammates, and remove members. Acceptance adds a member and preserves an existing member's role. The last admin is protected.
- Members, moderators and admins can create and edit project names and descriptions. A project's creator, a moderator or an admin can delete it.
- Organization roles apply within that organization. Platform administration requires an exact match with the configured trusted user ID.

## Secure Drop

Choose files or a folder in the dashboard and optionally associate the share with a project. The browser preserves relative paths, shows upload progress and retries interrupted chunks. After publication, copy the link and send it to the recipient. A signed-out recipient can inspect the file list and download individual files.

| Limit | Value |
| --- | --- |
| Per file, inclusive | **1 byte to 5 GiB** (5,368,709,120 bytes) |
| Per share | **1–200 files**, up to **20 GiB** (21,474,836,480 bytes) |
| Upload request | 4 MiB chunks, with a shorter final chunk as needed |
| Link lifetime | 1 hour, 24 hours or 7 days from publication |
| Download policy | Once per file or repeat downloads until expiry or revocation |
| Per organization | 20 active shares or drafts, 50 GiB reserved for chunked shares |

The sender can see status, download counts and expiry and can revoke access. Organization admins can also see and revoke team shares. Listing files preserves one-time claims. Starting the download claims that file, so a failed transfer can require a new link. Revocation stops new downloads. A running response can finish.

Files are encrypted on the server with AES-256-GCM. Only a hash of the share token is stored in the database. The secret is in the URL fragment and is submitted in a POST body. Anyone holding the link can use it. File names, sizes and ownership are server-visible. Recipients should trust the sender because the service does not scan for malware or verify recipient identity. The folder picker omits empty directories. Closing the browser interrupts an unfinished upload. Legacy database-backed single-file drops have a separate 5 MiB ceiling.

## Run locally

Use Node.js 24 LTS (24.12 or later in the 24.x line) or a compatible version listed in the root manifest, pnpm 10.12.1, PostgreSQL and a private writable directory for file contents.

1. From the repository root, run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env` in `apps/web`, `apps/dashboard`, `apps/admin` and `packages/db`. Fill in the settings below. If Zeke already copied local configuration, use the existing files.
3. Generate the Prisma client and apply the tracked migrations to your intended database.

   ```sh
   pnpm --filter @repo/db db:generate
   pnpm --filter @repo/db exec prisma migrate deploy
   ```

4. Run `pnpm dev`, open the website and create a dashboard account. Create an organization to access its projects, member list and Secure Drop. To start a single app, use `pnpm --filter dashboard dev`, replacing `dashboard` with `web` or `admin` as needed.

| Setting | Where and why |
| --- | --- |
| `DATABASE_URL` | Dashboard, admin and DB tooling. Use the same PostgreSQL database. |
| `DIRECT_URL` | DB tooling. Direct connection for migrations when runtime traffic uses a pooler. |
| `AUTH_SECRET`, `AUTH_URL` | Dashboard and admin. Configure a strong session secret and the canonical origin for each app. Use separate secrets and hostnames for independent production sessions. |
| `NEXT_PUBLIC_DASHBOARD_URL` | Web. Dashboard URL used by the landing page at build time. |
| `NEXT_PUBLIC_APP_URL` | Dashboard. Public dashboard URL used in invitation links. |
| `ADMIN_USER_ID` | Admin. ID of an existing trusted account. Leaving this empty denies platform access. |
| `SECURE_DROP_ENCRYPTION_KEY` | Dashboard. Stable 64-character hex encoding of 32 random bytes. Preserve it for existing files and backups. |
| `SECURE_DROP_APP_ORIGIN` | Dashboard. Exact public HTTPS origin in production, without a trailing slash. Local development supports HTTP. |
| `SECURE_DROP_STORAGE_DIR` | Dashboard and DB cleanup job. Absolute path to the same private, durable volume on every instance. |
| `ARCJET_KEY` | Dashboard and admin. Enables Arcjet rate limiting. Without a key the apps enforce limits through PostgreSQL. |
| `RATE_LIMIT_IP_HEADER` | Dashboard and admin. Name of a single-IP header that your trusted ingress always overwrites. With no trusted address, anonymous requests share a bucket. |

Generate independent random values for the encryption key and session secrets with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep the values in your local environment or deployment secret store.

## Deployment and security

Use TLS, strip client-supplied copies of the trusted IP header at ingress and restrict direct access to the app servers. Allow upload bodies of at least 4 MiB and long-lived streamed downloads. Keep the storage volume outside the web root. Ephemeral per-instance disks cannot hold shares across instances or restarts.

| Operation | Default request budget | Counted by |
| --- | --- | --- |
| Credential checks, including the direct Auth.js callback | 10 per minute | Client address |
| Account creation | 5 per 10 minutes | Client address |
| Create a share or legacy drop | 30 per minute | Signed-in account |
| Publish or revoke | 60 per minute | Signed-in account |
| Upload chunks | 160 per 10 seconds | Signed-in account |
| Open or refresh a recipient file list | 60 per minute | Client address |
| Start a download, including legacy files | 240 per minute | Client address |

Arcjet receives a policy name and a keyed hash identifying the bucket. File bodies, passwords, cookies and bearer links are excluded. When configured, a decision-service error blocks the protected operation temporarily. The PostgreSQL fallback uses atomic counters shared across app instances. Both modes apply limits before file processing or credential verification. File APIs return HTTP 429 with a retry interval when a budget is exhausted. Sign-in and signup forms display a retry message.

Schedule `pnpm --filter @repo/db db:drop-cleanup` at least hourly. Drafts expire after 24 hours. Encrypted chunk files have a 24-hour grace period after expiry or revocation. Their reservation is released after file removal succeeds. Old share records are removed after 30 days past expiry. The job also clears stale rate-limit counters. Monitor free space, cleanup failures, concurrent transfers and egress, and back up the database, encryption key and volume together. The application enforces declared reservations. Encryption overhead, failed writes, older drops and backups also use disk space. [Secure Drop operations](docs/secure-drop.md)

The branch security review updated Next.js and vulnerable dependencies, removed a duplicate password check in the dashboard, and enforced bcrypt's 72-byte input limit for new registrations. Project writes check the actor's organization membership and role in the mutation. Secure Drop rechecks membership inside the write transaction so demotion or removal takes effect even for waiting requests. Orphan cleanup checks generated identifiers and chunk layout before removing directories. Account email verification, self-service password reset and malware scanning are outside the current feature set.

## Verification

```sh
pnpm test
pnpm test:hooks
pnpm lint
pnpm build
pnpm audit
```

For integration tests, migrate a **disposable PostgreSQL database**, set `SECURE_DROP_TEST_DATABASE_URL` to its connection URL and run `pnpm test:integration`. The suites exercise invitation and membership concurrency, tenant isolation, encryption, retention and one-time downloads. Database suites skip when the test URL is absent.

In the November 2026 branch review, a Chrome sender and a separate signed-out Chrome session round-tripped a one-byte folder entry and a 5,368,709,120-byte file. The three-app HTTP suite also round-tripped four files of that size in one share. All byte counts and SHA-256 hashes matched on local Windows storage and PostgreSQL.

Set `RUN_APP_SMOKE=1` after building to exercise the three apps on ports 3330–3332. The HTTP suite transfers a one-byte file and a 200-file share, compares the downloaded hashes, and rejects zero-byte, oversized and over-count manifests. Set **`RUN_SECURE_DROP_LARGE=1` as well** to send four complete 5 GiB files in one 20 GiB share, download each stream, and compare byte counts and SHA-256 hashes. Allow more than 20 GiB of free temporary disk and time for 40 GiB of local HTTP traffic. These checks use local storage and a disposable database. Deployment ingress and network timeouts need verification on the target host.

## Zeke and Git worktrees

This workspace pins Zeke 0.2.2 with a Windows compatibility patch. The upstream version compares Git's forward-slash worktree path directly with the native Windows path and can report that a valid source is missing. The patch normalizes that comparison and lets Git for Windows run existing hooks with their declared interpreter. It explicitly forwards stdin through `git hook run --to-stdin`, including the refs checked by pre-push hooks, and removes temporary input files after the hook finishes. `pnpm test:hooks` verifies Windows forwarding, arguments, exit status and cleanup; it skips on other platforms.

After installing dependencies, run **`pnpm exec zeke install`** once for the repository. Use `pnpm exec zeke doctor` to check it, `pnpm exec zeke sync` for missing ignored environment files in an existing worktree, or `pnpm exec zeke uninstall` to restore the previous hooks. These commands select the patched project copy. Existing destination files are preserved. Git 2.36+ and a supported Node or Bun runtime are required. [Upstream Zeke documentation](https://github.com/pruven/zeke)

On Windows with Bun 1.4.4+, `bun ./node_modules/@pruven/zeke/dist/bin/zeke.js install` records the installed Bun executable for the Git hooks.

## Repository layout

- `apps/web`, `apps/dashboard`, `apps/admin` contain the three Next.js App Router applications.
- `packages/auth` contains shared credential verification, JWT sessions and request protection.
- `packages/db` contains the PostgreSQL schema, migrations, Prisma client configuration, data factories and cleanup job.
- `packages/types` contains shared action types and transfer limits. `packages/ui` contains the shared React components and Tailwind styles.
- pnpm manages the workspace and lockfile. Turborepo runs development and production build tasks.
