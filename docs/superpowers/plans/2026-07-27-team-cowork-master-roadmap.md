# Team Cowork MVP Master Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, multi-user Team Cowork product in six independently testable implementation plans, starting with a working project/task/chat vertical slice and ending with an accounting-firm pilot.

**Architecture:** Use a TypeScript monorepo with a Next.js web client, Fastify API, PostgreSQL persistence, and a separate worker for long-running Codex tasks. Codex app-server is the agent boundary; Notion, Composio, object storage, Skill execution, approvals, and audit controls are added behind explicit ports in later plans so the first vertical slice remains runnable with local fakes.

**Tech Stack:** Node.js 20.9+, TypeScript, pnpm workspaces, Turborepo, Next.js App Router, Fastify, PostgreSQL, Prisma ORM, Redis, BullMQ, S3-compatible object storage, Codex app-server, Vitest, React Testing Library, Playwright, Docker Compose.

---

## Source Design

All implementation plans must remain consistent with:

- `docs/superpowers/specs/2026-07-27-team-cowork-design.md`

The design decisions that cannot be changed silently are:

- Codex is the only core agent.
- Team knowledge and approved Skills are shared.
- Chats, task histories, draft files, and Skill drafts are private by default.
- Notion is a knowledge base, not mandatory file storage.
- Google Docs and Sheets are accessed through Composio.
- Local Excel files are uploaded to an isolated task workspace.
- Risky external actions require approval.
- The operator-wide customer, billing, and usage management platform is excluded.

## Repository Map

```text
cowork/
├─ apps/
│  ├─ web/                 # Next.js user interface
│  ├─ api/                 # Fastify HTTP/SSE API and authorization boundary
│  └─ worker/              # Codex app-server and long-running Task Run execution
├─ packages/
│  ├─ contracts/           # Shared Zod request, response, and event schemas
│  ├─ db/                  # Prisma schema, migrations, and database client
│  ├─ domain/              # Domain state machines and authorization policies
│  ├─ agent/               # Codex app-server port and client
│  ├─ integrations/        # Notion, Composio, and object-storage adapters
│  ├─ skills/              # Skill schema, compiler, test runner, and versions
│  └─ testkit/             # Builders, fakes, fixtures, and integration helpers
├─ tests/
│  └─ e2e/                 # Cross-application Playwright scenarios
├─ docs/
│  ├─ superpowers/specs/
│  ├─ superpowers/plans/
│  └─ operations/
├─ docker-compose.yml
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

Each package owns one responsibility. Cross-package imports follow the dependency direction below:

```text
web -> contracts
api -> contracts + domain + db
worker -> agent + domain + db + integrations + skills
agent -> contracts
integrations -> contracts
skills -> domain + contracts
db -> no application package
domain -> contracts only
```

No package may import from an application directory.

## Plan 1: Product Foundation Vertical Slice

**Detailed plan:** `docs/superpowers/plans/2026-07-27-team-cowork-foundation.md`

### Deliverable

A locally runnable web product where two seeded users can sign in, see only their authorized projects, create private tasks, and chat with a deterministic fake agent. The database enforces team, project, and task ownership relations, and an end-to-end test proves that one user cannot read another user's task or conversation.

### Exit gate

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` pass.
- Alice can create a project and task, then receive a fake agent response.
- Bob receives HTTP 404 for Alice's private task and cannot see it in the UI.
- The UI has Home, Projects, Project, and Task pages.
- The repository has a clean initial migration and reproducible local setup.

## Plan 2: Codex Task Runtime

### Scope

- Add `apps/worker`.
- Run Codex app-server over stdio.
- Generate TypeScript protocol schemas from the installed Codex version.
- Map one private Cowork conversation to one Codex thread.
- Persist Task Run, Turn, streamed event, and final-response state.
- Stream normalized events to the web client through the API.
- Support cancel, retry, and resume from persisted checkpoints.
- Keep a fake Codex adapter for deterministic tests.

### Required tests

- Protocol initialization and thread start.
- User message to Codex turn mapping.
- Event ordering and reconnect without duplication.
- Worker restart and Task Run resume.
- User cancellation.
- Cross-user thread access denial.

### Exit gate

A task created in the web UI runs through Codex app-server, streams progress, stores the final response, and survives an API or browser restart without exposing another user's thread.

## Plan 3: Knowledge, External Services, and Files

### Scope

- Add Notion knowledge-source configuration per project.
- Add Composio connection records for team and personal connections.
- Add Google Drive, Docs, and Sheets read operations.
- Add S3-compatible object storage and per-task file metadata.
- Add local Excel upload, validation, versioning, isolated processing, and download.
- Create a context assembler that passes only project-authorized Notion excerpts, external references, and task files to Codex.
- Keep provider interfaces and deterministic fakes for tests.

### Required tests

- Notion project-scope filtering.
- Team versus personal Composio connection visibility.
- Google Sheets read and copy-before-write behavior.
- Excel original preservation and new-version download.
- Unsupported, oversized, macro-enabled, and malicious-file rejection.
- Cross-project object-storage key isolation.

### Exit gate

One task can combine Notion knowledge, a Google Sheet, and an uploaded Excel file while preserving the original file and preventing cross-project access.

## Plan 4: Skill Studio and Runtime

### Scope

- Define the versioned Skill schema.
- Build conversational Skill drafting.
- Accept example files and demonstration traces.
- Validate required inputs, allowed tools, output contract, and approval policy.
- Add dry-run and constrained-test modes.
- Implement `DRAFT -> TESTED -> REVIEW -> PUBLISHED -> DISABLED`.
- Pin a published Skill version to each Task Run.
- Add rollback without mutating historical runs.

### Required tests

- Natural-language changes produce a new immutable version.
- Invalid tools or missing approval rules block review.
- Draft Skills remain private.
- Only Team Admin can publish.
- Existing Task Runs remain pinned after a new version publishes.
- Disabled Skills cannot start new runs.

### Exit gate

A Skill Creator can build and test a Skill conversationally, an administrator can publish it, and a member can run the published version with an auditable version reference.

## Plan 5: Policy, Approval, Audit, and Security

### Scope

- Classify tool calls as read, reversible write, or always-approve.
- Pause Task Runs before risky actions.
- Show a structured before/after preview.
- Record approve, reject, modify, expiry, and approver identity.
- Use idempotency keys for external writes.
- Add immutable audit events separate from private chat content.
- Add prompt-injection boundaries and untrusted-content labeling.
- Add token and secret redaction.
- Add retention jobs for temporary files and execution data.

### Required tests

- Email send, delete, permission change, accounting write, and original overwrite never run without approval.
- Approval from an unauthorized user is rejected.
- A repeated worker job cannot repeat an external side effect.
- Instructions inside Notion, email, Google documents, or Excel cannot override system or Skill policy.
- Audit events contain execution facts but not private chat bodies.

### Exit gate

Risky operations pause with a clear preview, execute once after a valid approval, and leave a complete audit trail without leaking secrets or private conversation text.

## Plan 6: Accounting Pilot and Release Hardening

### Scope

- Publish the first three accounting Skills:
  - receivables report
  - monthly expense summary
  - weekly client-work report
- Add onboarding for a pilot accounting team.
- Add realistic fixture data and golden output comparisons.
- Add accessibility, observability, backup, recovery, and deployment checks.
- Run user acceptance tests with actual weekly workflows.

### Required tests

- Golden-file comparison for each accounting Skill.
- Korean text, dates, currencies, and spreadsheet formulas.
- Five concurrent team users.
- Provider outage and partial-success recovery.
- Backup restore and migration rollback rehearsal.
- Full browser journey from login through approval and shared result.

### Exit gate

At least one pilot accounting team repeats one Skill in a real weekly workflow, all security gates pass, and operators can diagnose and recover a failed run from documented procedures.

## Cross-Plan Quality Gates

Every plan must finish with:

- [ ] No unresolved placeholders in code, tests, configuration, or documentation.
- [ ] Tests prove tenant, project, and user isolation for all new data.
- [ ] Provider integrations have fakes and contract tests.
- [ ] External writes are idempotent.
- [ ] Database migrations have forward and rollback notes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] A relevant Playwright workflow passes.
- [ ] Documentation describes setup, verification, and failure recovery.
- [ ] Changes are committed in small, reviewable commits.

## Official References

- Codex app-server: https://learn.chatgpt.com/docs/app-server.md
- Codex SDK comparison: https://learn.chatgpt.com/docs/codex-sdk.md
- Next.js installation: https://nextjs.org/docs/app/getting-started/installation
- Prisma PostgreSQL connector: https://www.prisma.io/docs/orm/overview/databases/postgresql
