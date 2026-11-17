# SaaSFlow and Secure Drop: readiness and portfolio

> Update: Secure Drop now supports multiple files, folder paths, project-linked
> shares, and encrypted chunk storage for files up to 5 GiB. The historical
> 5 MiB descriptions and verification results below describe the earlier
> database-backed implementation; see [Secure Drop](secure-drop.md) for current
> limits, deployment requirements, and security boundaries.

## What is implemented

This is a Next.js/React/TypeScript monorepo with PostgreSQL, Prisma, Auth.js,
organization membership roles, projects, invitations, an admin app, and Secure
Drop. Secure Drop supports 1 byte–5 MiB files, expiring links, revocation,
server-side AES-256-GCM encryption, hashed bearer tokens, and atomic one-time
download claims. It is not end-to-end encrypted or the separate SecureDrop
whistleblower product.

The hardening pass also scopes membership mutations to the authenticated
organization, checks admin authority inside a serialized transaction, preserves
the last admin during concurrent changes, creates organizations and their first
admin atomically, and avoids slug collisions for repeated organization names.
Login preserves password whitespace. Secure Drop validates filenames, requires
an explicit HTTPS origin in production, and applies dashboard anti-framing and
referrer headers. Failed uploads retain the previous share link; revocation
clears the displayed link when it belongs to that drop.

## Verification and remaining checks

Updated results on `ar/project-improvements`: eight unit tests and four database/HTTP
integration suites passed against an isolated PostgreSQL database, with no skips
when app smoke tests were enabled. All three apps passed lint and fresh production
builds including TypeScript. No browser interaction flow was exercised. See the
[page-by-page audit](app-audit.md) for coverage, migration details and the required
`ADMIN_USER_ID` configuration change.

- `pnpm install --frozen-lockfile`
- `pnpm --filter @repo/db db:generate`
- `pnpm test`: cryptography, tampering, request limits, origins, filenames.
- `pnpm lint`: all three apps.
- `pnpm --filter dashboard exec next typegen`
- `pnpm --filter dashboard exec tsc --noEmit`
- `pnpm build`: requires app database/auth environment configuration.
- Migrate a disposable PostgreSQL database and set
  `SECURE_DROP_TEST_DATABASE_URL`, then run `pnpm test:integration`.
  Without that variable, database tests **skip**, which is not a successful
  verification of database behavior. Tests cover concurrent downloads, expiry,
  revocation, payload removal, configuration failure recovery, cross-organization
  member targets, unauthorized actors, and concurrent last-admin changes.

Before claiming everything works, exercise these flows with two organizations
and separate admin/member accounts in a configured environment:

1. Sign up, sign in, sign out; verify incorrect credentials and passwords with spaces.
2. Create two organizations with the same name; verify both creators are admins.
3. Create/update/delete projects; attempt each action from another organization.
4. Generate/regenerate/expire invites and accept one with a new or existing member.
5. Change/remove members; attempt a foreign membership ID and removal of the last admin.
6. Upload/download a file and compare bytes; repeat the download, revoke a link,
   expire a link, race two downloads, and exceed size/quota limits.
7. Test clipboard failure, failed upload, mobile layout, keyboard interaction,
   signed-out recipients, and restricted admin-app access.
8. Run cleanup and verify expired payloads are cleared. Verify backup restoration
   with the correct encryption key and confirm TLS and ingress limits in hosting.

## Priorities before offering public file sharing

1. **Abuse controls:** distributed rate limits for login, upload and public download;
   ingress body/concurrency limits; service-wide storage quotas and operational alerts.
2. **Reliable delivery:** run the database and browser acceptance checks above in
   CI; add route-level upload/revocation authorization tests. One-time claims can
   consume a link before a failed network transfer reaches the recipient.
3. **Recipient assurance:** optional verified-recipient email access, email verification
   for accounts, password reset, and security events without raw links or payloads.
4. **File handling:** quarantine and malware scanning before release; clearly label
   scan status. Move larger files to private encrypted object storage with lifecycle
   cleanup, preserving authorization and one-time claim semantics.
5. **Operations:** key rotation and backup retention policies, automated cleanup,
   deployment documentation, privacy/retention information and an abuse contact.

After those, add project-linked drops, search/pagination, activity history,
recipient notifications, and accessible upload progress. Consider client-side
encryption only with an explicit key-recovery and malware-scanning design.
Do not advertise unlimited size, guaranteed delivery, malware protection,
end-to-end encryption, compliance certification, or production readiness today.

## Resume wording

**SaaSFlow — Multi-tenant workspace with Secure Drop**  
Next.js, React, TypeScript, PostgreSQL, Prisma, Auth.js, pnpm/Turborepo

- Built a multi-tenant workspace with organization roles, project management,
  invitation flows, and an administrative interface.
- Implemented temporary file sharing with AES-256-GCM encryption at rest,
  SHA-256-hashed bearer tokens, expiring links, revocation, and atomic one-time claims.
- Hardened tenant authorization and concurrent membership changes; added
  regression tests for encryption integrity, origin validation, request limits,
  and database-backed access controls.

Use these bullets only for work you can explain and demonstrate. Label database
tests as added, not passing, until you run them. Add repository/demo links and
measured results once available; do not invent users, throughput or uptime.
For interviews, explain why encryption at rest differs from end-to-end encryption,
how concurrent claims are resolved, why tokens live in URL fragments, and the
tradeoff between one-time consumption and retrying failed downloads.
