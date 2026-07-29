# Local development

## Requirements

Use Node.js 22 or newer and pnpm 11.9.0 (the version pinned in `package.json`). A local PostgreSQL instance is required for the development and test databases.

## Environment

Copy `.env.example` to `.env` and set both `DATABASE_URL` and `TEST_DATABASE_URL`. Keep them as separate databases. Set `JWT_SECRET` to a random value of at least 32 characters.

## Database

Generate the Prisma client with:

```powershell
pnpm db:generate
```

For ordinary local development, run Prisma migrations in a detached terminal so the development server remains available:

```powershell
pnpm db:migrate
```

If the local Prisma development workflow cannot connect, apply the committed SQL files without resetting data:

```powershell
Get-ChildItem packages/db/prisma/migrations/*/migration.sql | ForEach-Object { pnpm --filter @cowork/db exec prisma db execute --config prisma.config.ts --file $_.FullName }
```

Seed the demo team, Alice, Bob, and Client Operations project:

```powershell
pnpm db:seed
```

## Run and verify

Start the API and web app together:

```powershell
pnpm dev
```

Run unit checks:

```powershell
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## Browser E2E database

Run browser E2E checks against a separate real PostgreSQL database, never the development database. Prisma-dev/PGlite is useful for local experiments but can close Prisma adapter connections with `P1017`; it is not the E2E database.

Set a separate `E2E_DATABASE_URL` in the terminal (or `TEST_DATABASE_URL` as a fallback) with a distinct database name, such as `cowork_e2e`. The runner accepts `E2E_DATABASE_URL` first and then `TEST_DATABASE_URL`; it never falls back to `DATABASE_URL`, and refuses to run if either E2E value uses the same PostgreSQL database name as `DATABASE_URL`, even through another hostname.

In PowerShell, set the real PostgreSQL E2E URL (replace the placeholder; do not commit it), temporarily point `DATABASE_URL` at that same isolated database while applying every committed migration SQL in order, then seed and test. The final line restores the prior development `DATABASE_URL` in the current shell.

```powershell
$previousDatabaseUrl = $env:DATABASE_URL
$env:E2E_DATABASE_URL = 'postgresql://E2E_USER:E2E_PASSWORD@127.0.0.1:5432/cowork_e2e'
$env:DATABASE_URL = $env:E2E_DATABASE_URL
Get-ChildItem packages/db/prisma/migrations -Recurse -Filter migration.sql | Sort-Object FullName | ForEach-Object { pnpm --filter @cowork/db exec prisma db execute --config prisma.config.ts --file $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.FullName)" } }
$env:DATABASE_URL = $previousDatabaseUrl
pnpm --filter @cowork/db exec tsx ../../tests/e2e/database-command.ts seed
pnpm exec playwright install chromium
pnpm test:e2e
```
