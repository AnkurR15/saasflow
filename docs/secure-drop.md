# Secure Drop

Organization members can upload a file (1 byte–5 MiB), choose 1 hour, 24 hours,
or 7 days, and copy a one-time download link. Open an organization's **Secure
Drop** sidebar entry to start. Members can see the latest 100 drop records;
only the creator or an organization admin can revoke a drop. Each organization
can have up to 20 active drops.

Recipients need the complete link but no SaaSFlow account. Opening the page
does not consume the link. Clicking Download claims it atomically and clears
the stored payload. If the network fails after that claim, the sender must
create another drop. Revocation and expiry prevent further downloads but
cannot retract a file already delivered or an already claimed response.

## Setup

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Configure `DATABASE_URL` and `DIRECT_URL` in `packages/db/.env` for your
   PostgreSQL database. Run `pnpm --filter @repo/db db:generate`, then
   `pnpm --filter @repo/db exec prisma migrate deploy`.
3. Copy `apps/dashboard/.env.example` to `.env.local` in the same directory.
   Set the database URL, existing Auth.js settings, and a securely generated
   32-byte hex `SECURE_DROP_ENCRYPTION_KEY`. Store the key in your deployment's
   secret manager; do not commit it. All instances must use the same key.
4. Set `SECURE_DROP_APP_ORIGIN` to the exact browser-facing origin (no trailing
   slash), and align `AUTH_URL` and `NEXT_PUBLIC_APP_URL`. Use HTTPS outside
   localhost. Your hosting/proxy must allow 5 MiB request bodies.
5. Run `pnpm --filter dashboard dev`, sign in, select an organization, and open
   Secure Drop. Test the link in a signed-out browser. A second download should
   fail. Also verify expiry, revocation, and access with another organization.
6. Schedule `pnpm --filter @repo/db db:drop-cleanup` on the server at least hourly.
   It clears expired ciphertext and removes records 30 days after expiry.
   Uploading also clears expired payloads for that organization. Expiry is
   enforced on every download even before cleanup runs.

Run `pnpm --filter @repo/db test:secure-drop` for cryptography, configuration,
stream-size, and origin-check regression tests. Run dashboard `next typegen`
before `tsc --noEmit` to generate the app's route types.

For database regression tests, migrate a disposable PostgreSQL test database,
set `SECURE_DROP_TEST_DATABASE_URL` to its connection string, then run
`pnpm --filter @repo/db test:secure-drop:integration`. This tests simultaneous
claims, repeat downloads, expiry, revocation, unknown tokens, ciphertext
clearing, and recovery after an encryption configuration failure. It creates
and removes its own test organization. Without that variable it explicitly skips.

## Security boundaries

Files use server-side AES-256-GCM encryption with a unique nonce and the token
hash as authenticated associated data. Random 256-bit bearer tokens are stored
only as SHA-256 hashes. The raw token is returned once, kept in a URL fragment,
and submitted in a POST body when downloading. Do not add analytics to the
recipient page or log bodies at your reverse proxy. API responses disable
caching. Filenames, sizes, organization IDs, and timestamps are metadata and
remain visible to the server and organization members.

This is **not end-to-end encryption**, anonymous whistleblower software, or the
separate SecureDrop project. The app server can decrypt files. Anyone holding
the link can use it. There is no malware scanning or recipient identity check.
Database backups may retain old ciphertext; manage their retention separately.
Encryption key rotation requires a migration strategy for active files.
Apply ingress request/concurrency limits before exposing this publicly; the
per-file and per-organization quotas do not replace service-wide rate limits.

## Tailscale and Go

No Tailcat integration existed in the source branch. If “tailcat” means
Tailscale, serve the dashboard privately with Tailscale Serve, set the app's
origin settings to its HTTPS hostname, and restrict the underlying app port
to loopback. Keep application login and organization checks enabled. Recipients
must have access to that tailnet. Tailscale Funnel exposes the app publicly and
should only be enabled deliberately.

References: https://tailscale.com/docs/reference/tailscale-cli/serve and
https://tailscale.com/docs/features/tailscale-funnel.

Keep this small-file implementation in Next.js initially. A Go service is a
reasonable next step for streamed, resumable large transfers or a `tsnet`
gateway. That service would need authenticated internal calls, the same atomic
download/revocation rules, and a clear owner for storage and cleanup. Adding Go
solely for encryption would add operational work without improving this flow.

Useful next additions: recipient email verification, audit events, encrypted
object storage with lifecycle deletion, malware quarantine, project-linked
drops, and client-side encryption. The current flow supports temporary client
handoffs, support diagnostics, and internal document sharing.
