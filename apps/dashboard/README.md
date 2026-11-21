# SaaSFlow dashboard

Members create organizations, invite teammates, manage projects and share files or folders. Signed-out recipients open temporary links at `/drop`.

From the repository root, run `pnpm --filter dashboard dev` and open `http://localhost:3001`. The dashboard requires PostgreSQL and Auth.js configuration. Secure Drop also requires a stable encryption key, the dashboard origin and a private durable volume. [Workspace setup](../../README.md) · [Secure Drop operations](../../docs/secure-drop.md)
