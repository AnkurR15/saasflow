# Secure Drop

Organization members can share files or a selected folder with an expiring
bearer link. Select an organization in the sidebar, open **Secure Drop**, and
optionally associate the share with a project in that organization. Uploads
accept ordinary business file types, including documents, spreadsheets, PDFs,
images and archives. A share can contain 1–200 non-empty files, each up to
5 GiB, and up to 20 GiB in total. Folder paths are preserved; browsers do not
supply empty directories through the folder picker.

Choose a lifetime of 1 hour, 24 hours or 7 days and either multiple downloads
or **once per file**. With the latter, each file may be claimed once, so a
recipient can choose different files from the same share. Opening the link and
viewing its file list does not consume a download. A claim happens before the
transfer finishes: a failed one-time transfer needs a new share. A sender sees
their own shares and can revoke them. Organization admins can see and revoke
their team's shares. Revocation and expiry block new downloads, but cannot
recall a response already started.

Uploads are divided into 4 MiB chunks, with progress shown in the browser.
The server verifies the declared path, size, order and completion of each
file before publishing the link. Interrupted chunk requests are retried, but
an interrupted browser session cannot currently be resumed. Expiry starts when
the link is created. Draft uploads expire after 24 hours. There can be up to
20 unexpired, non-revoked shares or drafts and 50 GiB of reserved file data per
organization. A completed one-time share still counts until it expires or is
revoked. The latest 100 new and 100 legacy shares are shown.

## Setup

1. Install dependencies with `pnpm install --frozen-lockfile`. Configure
   `DATABASE_URL` and `DIRECT_URL` in `packages/db/.env`, run
   `pnpm --filter @repo/db db:generate`, then
   `pnpm --filter @repo/db exec prisma migrate deploy`.
2. Configure the dashboard's database and Auth.js settings. Set
   `SECURE_DROP_ENCRYPTION_KEY` to a stable, securely generated 32-byte hex key
   and `SECURE_DROP_APP_ORIGIN` to the exact public HTTPS origin, without a
   trailing slash. HTTP is permitted only for local development.
3. Set `SECURE_DROP_STORAGE_DIR` to an absolute path on a **private, durable
   volume** with sufficient free space. All dashboard instances and the cleanup
   job must have read/write access to the same volume and use the same key.
   Do not serve this directory as static files. Back up the volume and database
   consistently. Local ephemeral/serverless filesystems are unsuitable.
4. Configure the proxy and hosting platform to accept at least 4 MiB request
   bodies and long-lived streaming download responses. Test the actual hosting
   timeouts and concurrent transfer capacity with representative large files.
5. Run `pnpm --filter dashboard dev`, sign in, and create a share. Open the
   link in a signed-out browser. Test the selected download policy, expiry,
   revocation, and a separate organization's access.
6. Schedule `pnpm --filter @repo/db db:drop-cleanup` at least hourly with the
   same database and `SECURE_DROP_STORAGE_DIR`. Expired or revoked share
   payloads are removed after a 24-hour grace period for in-flight downloads;
   old records are removed after 30 days. Orphaned directories from deleted
   organizations are also cleaned up. The grace period means physical disk
   usage can exceed the active-share quota. Monitor disk capacity and cleanup
   failures. Backups may retain data longer.

Deploy the immutable-chunk migration and dashboard code together: stop old
dashboard instances before enabling the new code, since older instances cannot
read the new chunk paths. Previously uploaded chunks remain readable. Failed
upload attempts may leave unreferenced encrypted chunks until their share is
cleaned up.

Existing legacy single-file links continue to work. Their database ciphertext
is cleared on expiry, revocation or one-time download, as before.

## Security and operational boundaries

Chunks are encrypted at rest with AES-256-GCM and authenticated against their
share, file and position. Tokens are random, stored only as hashes, and placed
in the URL fragment; the recipient submits the token in a POST body. File and
folder names, sizes, ownership and activity are metadata visible to the server
and authorized team members. Avoid logging request bodies and links.

The completion check is **not malware scanning**. Files are not scanned or
quarantined, and recipient identities are not verified. The server can decrypt
files; this is not end-to-end encryption or the separate SecureDrop project.
Anyone with the link can use it. Apply service-wide rate and concurrency limits,
monitor capacity, arrange malware scanning and abuse handling, and plan key
rotation and backup retention before offering this as a public service. A
storage failure during a one-time response may consume that file's claim.

Run `pnpm test` for unit tests and `pnpm lint` for lint. For database tests,
apply migrations to a disposable PostgreSQL database, set
`SECURE_DROP_TEST_DATABASE_URL`, and run `pnpm test:integration`. Set
`RUN_APP_SMOKE=1` after building all apps to additionally exercise the HTTP
flows. Without these settings the relevant suites are skipped.
