# Team Cowork Product Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Team Cowork vertical slice where multiple users can sign in, access shared projects, create private tasks, and chat with a deterministic fake agent without exposing one user's task or conversation to another user.

**Architecture:** Create a TypeScript monorepo with a Next.js App Router frontend and a Fastify API backed by PostgreSQL through Prisma. Keep authentication, authorization, persistence, and the agent behind explicit interfaces so the next plan can replace the fake agent with Codex app-server without changing task or chat APIs.

**Tech Stack:** Node.js 22, pnpm 11, TypeScript, Turborepo, Next.js App Router, Fastify, PostgreSQL, Prisma ORM, Zod, Argon2, JWT in an HttpOnly cookie, Vitest, React Testing Library, Playwright.

---

## Preconditions

Run every command from:

```powershell
Set-Location -LiteralPath 'C:\Not_Onedrive_AI project\cowork'
```

The current machine has Node.js `v22.13.1` and pnpm `11.9.0`. Docker is not currently available. Install Docker Desktop before Task 4, or provide a PostgreSQL 17 connection and set `DATABASE_URL` to it. Do not substitute SQLite because authorization queries and future worker concurrency must be tested against PostgreSQL.

The approved design is:

```text
docs/superpowers/specs/2026-07-27-team-cowork-design.md
```

## Locked File Map

```text
apps/
├─ api/
│  ├─ src/
│  │  ├─ app.ts
│  │  ├─ server.ts
│  │  ├─ config.ts
│  │  ├─ plugins/auth.ts
│  │  ├─ modules/auth/
│  │  ├─ modules/projects/
│  │  ├─ modules/tasks/
│  │  └─ modules/chat/
│  └─ tests/
├─ web/
│  ├─ src/app/
│  ├─ src/components/
│  └─ src/lib/
packages/
├─ contracts/src/
├─ db/
│  ├─ prisma/schema.prisma
│  ├─ prisma/migrations/
│  ├─ src/client.ts
│  └─ src/seed.ts
├─ domain/src/
└─ testkit/src/
tests/
├─ repo-structure.test.mjs
└─ e2e/
```

Responsibilities are fixed:

- `contracts` owns transport schemas and inferred DTO types.
- `domain` owns pure authorization rules and agent interfaces.
- `db` owns Prisma and seed data.
- `api` owns HTTP, authentication, request authorization, and orchestration.
- `web` owns presentation and browser interaction.
- `testkit` owns deterministic user, project, task, and token fixtures.

## Task 1: Initialize the Repository and Quality Commands

**Files:**

- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `tests/repo-structure.test.mjs`

- [ ] **Step 1: Initialize Git**

Run:

```powershell
git init -b main
```

Expected: Git reports an empty repository initialized at `C:\Not_Onedrive_AI project\cowork\.git`.

- [ ] **Step 2: Write the failing repository-structure test**

Create `tests/repo-structure.test.mjs`:

```js
import { access } from "node:fs/promises";
import { test } from "node:test";

const requiredPaths = [
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "apps",
  "packages",
];

for (const path of requiredPaths) {
  test(`${path} exists`, async () => {
    await access(path);
  });
}
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```powershell
node --test tests/repo-structure.test.mjs
```

Expected: failures for `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `apps`, and `packages`.

- [ ] **Step 4: Create the root configuration**

Create `package.json`:

```json
{
  "name": "team-cowork",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "playwright test",
    "format": "prettier --write .",
    "db:generate": "pnpm --filter @cowork/db db:generate",
    "db:migrate": "pnpm --filter @cowork/db db:migrate",
    "db:seed": "pnpm --filter @cowork/db db:seed"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@types/node": "^22.0.0",
    "prettier": "^3.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build", "^test"],
      "outputs": ["coverage/**"]
    }
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

Create `.gitignore`:

```gitignore
node_modules/
.turbo/
.next/
dist/
coverage/
playwright-report/
test-results/
.env
.env.local
*.log
packages/db/src/generated/
data/
```

Create the package directories:

```powershell
New-Item -ItemType Directory -Force -Path 'apps','packages' | Out-Null
pnpm.cmd install
```

Expected: `pnpm-lock.yaml` is created.

- [ ] **Step 5: Run the repository test**

Run:

```powershell
node --test tests/repo-structure.test.mjs
```

Expected: six tests pass.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore .editorconfig package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tests/repo-structure.test.mjs
git commit -m "chore: initialize team cowork monorepo"
```

## Task 2: Create Shared Contracts and Domain Authorization

**Files:**

- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/authorization.ts`
- Create: `packages/domain/src/agent.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/authorization.test.ts`

- [ ] **Step 1: Write failing authorization tests**

Create `packages/domain/src/authorization.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canManageTeam,
  canReadPrivateTask,
  canUseProject,
} from "./authorization.js";

describe("authorization", () => {
  it("allows only TEAM_ADMIN to manage a team", () => {
    expect(canManageTeam("TEAM_ADMIN")).toBe(true);
    expect(canManageTeam("SKILL_CREATOR")).toBe(false);
    expect(canManageTeam("MEMBER")).toBe(false);
  });

  it("requires both team and project membership to use a project", () => {
    expect(canUseProject({ teamMember: true, projectMember: true })).toBe(true);
    expect(canUseProject({ teamMember: true, projectMember: false })).toBe(false);
    expect(canUseProject({ teamMember: false, projectMember: true })).toBe(false);
  });

  it("allows only the owner to read a private task", () => {
    expect(canReadPrivateTask("user-a", "user-a")).toBe(true);
    expect(canReadPrivateTask("user-b", "user-a")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd --dir packages/domain exec vitest run src/authorization.test.ts
```

Expected: failure because the package and implementation do not exist.

- [ ] **Step 3: Create the contracts package**

Create `packages/contracts/package.json`:

```json
{
  "name": "@cowork/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

Create `packages/contracts/src/index.ts`:

```ts
import { z } from "zod";

export const teamRoleSchema = z.enum([
  "MEMBER",
  "SKILL_CREATOR",
  "TEAM_ADMIN",
]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
});

export const createMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
```

- [ ] **Step 4: Create the domain package**

Create `packages/domain/package.json`:

```json
{
  "name": "@cowork/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@cowork/contracts": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

Create `packages/domain/src/authorization.ts`:

```ts
import type { TeamRole } from "@cowork/contracts";

export function canManageTeam(role: TeamRole): boolean {
  return role === "TEAM_ADMIN";
}

export function canUseProject(input: {
  teamMember: boolean;
  projectMember: boolean;
}): boolean {
  return input.teamMember && input.projectMember;
}

export function canReadPrivateTask(
  requestingUserId: string,
  taskOwnerId: string,
): boolean {
  return requestingUserId === taskOwnerId;
}
```

Create `packages/domain/src/agent.ts`:

```ts
export type AgentReplyInput = {
  taskId: string;
  userId: string;
  message: string;
};

export type AgentReply = {
  content: string;
};

export interface AgentPort {
  reply(input: AgentReplyInput): Promise<AgentReply>;
}

export class DeterministicFakeAgent implements AgentPort {
  async reply(input: AgentReplyInput): Promise<AgentReply> {
    return {
      content: `확인했습니다: ${input.message}`,
    };
  }
}
```

Create `packages/domain/src/index.ts`:

```ts
export * from "./agent.js";
export * from "./authorization.js";
```

- [ ] **Step 5: Install and run tests**

Run:

```powershell
pnpm.cmd install
pnpm.cmd --filter @cowork/domain test
pnpm.cmd --filter @cowork/contracts typecheck
```

Expected: all authorization tests pass and contracts typecheck succeeds.

- [ ] **Step 6: Commit**

```powershell
git add packages/contracts packages/domain pnpm-lock.yaml
git commit -m "feat: define cowork contracts and authorization rules"
```

## Task 3: Create the Fastify API Shell

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/vitest.config.ts`
- Test: `apps/api/tests/health.test.ts`

- [ ] **Step 1: Write the failing health test**

Create `apps/api/tests/health.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const apps: Array<ReturnType<typeof buildApp>> = [];

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps.length = 0;
});

describe("GET /health", () => {
  it("returns the service status", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd --dir apps/api exec vitest run tests/health.test.ts
```

Expected: failure because `apps/api` and `buildApp` do not exist.

- [ ] **Step 3: Create the API package**

Create `apps/api/package.json`:

```json
{
  "name": "@cowork/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@cowork/contracts": "workspace:*",
    "@cowork/domain": "workspace:*",
    "@fastify/cookie": "^11.0.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/jwt": "^10.0.0",
    "dotenv": "^17.0.0",
    "fastify": "^5.0.0",
    "fastify-plugin": "^5.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests/**/*.ts"]
}
```

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 10_000,
  },
});
```

Create `apps/api/src/config.ts`:

```ts
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const configSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://127.0.0.1:3000"),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
});

export type ApiConfig = z.infer<typeof configSchema>;

export function readConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  return configSchema.parse(environment);
}
```

Create `apps/api/src/app.ts`:

```ts
import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({
    status: "ok",
    service: "api",
  }));

  return app;
}
```

Create `apps/api/src/server.ts`:

```ts
import { buildApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const app = buildApp();

await app.listen({
  host: config.API_HOST,
  port: config.API_PORT,
});
```

- [ ] **Step 4: Install and run**

Run:

```powershell
pnpm.cmd install
pnpm.cmd --filter @cowork/api test
pnpm.cmd --filter @cowork/api typecheck
```

Expected: health test and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat: add fastify api shell"
```

## Task 4: Add PostgreSQL and the Initial Data Model

**Files:**

- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma.config.ts`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/seed.ts`
- Test: `packages/db/src/schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `packages/db/src/schema.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./client.js";

afterAll(async () => {
  await prisma.team.deleteMany({ where: { name: "Schema Team" } });
  await prisma.user.deleteMany({ where: { email: "schema@example.com" } });
  await prisma.$disconnect();
});

describe("initial schema", () => {
  it("stores one private task conversation per owner", async () => {
    const user = await prisma.user.create({
      data: {
        email: "schema@example.com",
        displayName: "Schema User",
        passwordHash: "not-a-real-login-hash",
      },
    });
    const team = await prisma.team.create({ data: { name: "Schema Team" } });
    await prisma.teamMembership.create({
      data: { teamId: team.id, userId: user.id, role: "TEAM_ADMIN" },
    });
    const project = await prisma.project.create({
      data: {
        teamId: team.id,
        createdById: user.id,
        name: "Schema Project",
        members: { create: { userId: user.id } },
      },
    });
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        ownerId: user.id,
        title: "Private Task",
        conversation: { create: { userId: user.id } },
      },
      include: { conversation: true },
    });

    expect(task.ownerId).toBe(user.id);
    expect(task.conversation?.userId).toBe(user.id);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd --dir packages/db exec vitest run src/schema.test.ts
```

Expected: failure because the database package and Prisma client do not exist.

- [ ] **Step 3: Add local PostgreSQL configuration**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: cowork
      POSTGRES_USER: cowork
      POSTGRES_PASSWORD: cowork
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cowork -d cowork"]
      interval: 2s
      timeout: 2s
      retries: 20
    volumes:
      - cowork-postgres:/var/lib/postgresql/data

volumes:
  cowork-postgres:
```

Create `.env.example`:

```dotenv
DATABASE_URL=postgresql://cowork:cowork@127.0.0.1:5432/cowork
JWT_SECRET=replace-with-at-least-32-random-characters
API_HOST=127.0.0.1
API_PORT=4000
WEB_ORIGIN=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000
```

- [ ] **Step 4: Create the database package**

Create `packages/db/package.json`:

```json
{
  "name": "@cowork/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/client.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "db:generate": "prisma generate --config prisma.config.ts",
    "db:migrate": "prisma migrate dev --config prisma.config.ts",
    "db:seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.0.0",
    "@prisma/client": "^7.0.0",
    "argon2": "^0.41.0",
    "dotenv": "^17.0.0",
    "pg": "^8.0.0"
  },
  "devDependencies": {
    "@types/pg": "^8.0.0",
    "prisma": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

Create `packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "prisma.config.ts"]
}
```

Create `packages/db/prisma.config.ts`:

```ts
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

Create `packages/db/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated"
}

datasource db {
  provider = "postgresql"
}

enum TeamRole {
  MEMBER
  SKILL_CREATOR
  TEAM_ADMIN
}

enum TaskStatus {
  OPEN
  COMPLETED
  CANCELLED
}

enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}

model User {
  id              String           @id @default(cuid())
  email           String           @unique
  displayName     String
  passwordHash    String
  memberships     TeamMembership[]
  projectMembers  ProjectMember[]
  createdProjects Project[]        @relation("ProjectCreator")
  ownedTasks      Task[]           @relation("TaskOwner")
  conversations   Conversation[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}

model Team {
  id          String           @id @default(cuid())
  name        String
  memberships TeamMembership[]
  projects    Project[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model TeamMembership {
  teamId    String
  userId    String
  role      TeamRole @default(MEMBER)
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([teamId, userId])
}

model Project {
  id          String          @id @default(cuid())
  teamId      String
  createdById String
  name        String
  team        Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  createdBy   User            @relation("ProjectCreator", fields: [createdById], references: [id])
  members     ProjectMember[]
  tasks       Task[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([teamId])
}

model ProjectMember {
  projectId String
  userId    String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([projectId, userId])
}

model Task {
  id           String        @id @default(cuid())
  projectId    String
  ownerId      String
  title        String
  status       TaskStatus    @default(OPEN)
  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  owner        User          @relation("TaskOwner", fields: [ownerId], references: [id])
  conversation Conversation?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([projectId, ownerId])
}

model Conversation {
  id        String    @id @default(cuid())
  taskId    String    @unique
  userId    String
  task      Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([userId])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           MessageRole
  content        String       @db.Text
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  createdAt      DateTime     @default(now())

  @@index([conversationId, createdAt])
}
```

Create `packages/db/src/client.ts`:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "./generated/client.js";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
export * from "./generated/client.js";
```

- [ ] **Step 5: Create deterministic seed data**

Create `packages/db/src/seed.ts`:

```ts
import argon2 from "argon2";
import { prisma } from "./client.js";

const passwordHash = await argon2.hash("CoworkDemo123!");

await prisma.message.deleteMany();
await prisma.conversation.deleteMany();
await prisma.task.deleteMany();
await prisma.projectMember.deleteMany();
await prisma.project.deleteMany();
await prisma.teamMembership.deleteMany();
await prisma.team.deleteMany();
await prisma.user.deleteMany();

const [alice, bob] = await Promise.all([
  prisma.user.create({
    data: {
      email: "alice@example.com",
      displayName: "Alice Admin",
      passwordHash,
    },
  }),
  prisma.user.create({
    data: {
      email: "bob@example.com",
      displayName: "Bob Member",
      passwordHash,
    },
  }),
]);

const team = await prisma.team.create({
  data: {
    name: "Demo Accounting",
    memberships: {
      create: [
        { userId: alice.id, role: "TEAM_ADMIN" },
        { userId: bob.id, role: "MEMBER" },
      ],
    },
  },
});

await prisma.project.create({
  data: {
    teamId: team.id,
    createdById: alice.id,
    name: "Client Operations",
    members: {
      create: [{ userId: alice.id }, { userId: bob.id }],
    },
  },
});

await prisma.$disconnect();
```

- [ ] **Step 6: Start PostgreSQL, migrate, and test**

Run:

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
docker compose up -d postgres
pnpm.cmd install
pnpm.cmd db:generate
pnpm.cmd --filter @cowork/db exec prisma migrate dev --config prisma.config.ts --name init
pnpm.cmd db:seed
pnpm.cmd --filter @cowork/db test
```

Expected: PostgreSQL becomes healthy, migration `init` is created, seed completes, and the schema test passes.

- [ ] **Step 7: Commit**

```powershell
git add docker-compose.yml .env.example packages/db pnpm-lock.yaml
git commit -m "feat: add postgres team and task data model"
```

## Task 5: Add Cookie Authentication

**Files:**

- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/modules/auth/password.ts`
- Create: `apps/api/src/modules/auth/routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/tests/auth.test.ts`

- [ ] **Step 1: Write failing login tests**

Create `apps/api/tests/auth.test.ts`:

```ts
import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@cowork/db";
import { buildApp } from "../src/app.js";

const app = buildApp({
  jwtSecret: "test-secret-that-is-longer-than-32-characters",
});

beforeAll(async () => {
  await app.ready();
  await prisma.user.upsert({
    where: { email: "login@example.com" },
    update: { passwordHash: await argon2.hash("CorrectPassword1!") },
    create: {
      email: "login@example.com",
      displayName: "Login User",
      passwordHash: await argon2.hash("CorrectPassword1!"),
    },
  });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("authentication", () => {
  it("sets an HttpOnly cookie for valid credentials", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "login@example.com",
        password: "CorrectPassword1!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.cookies[0]?.name).toBe("cowork_session");
    expect(response.cookies[0]?.httpOnly).toBe(true);
  });

  it("returns 401 without revealing which credential failed", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "login@example.com",
        password: "WrongPassword1!",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "INVALID_CREDENTIALS" });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
pnpm.cmd --filter @cowork/api test -- tests/auth.test.ts
```

Expected: failure because auth routes and the configurable `buildApp` do not exist.

- [ ] **Step 3: Implement password verification**

Create `apps/api/src/modules/auth/password.ts`:

```ts
import argon2 from "argon2";

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Implement the auth plugin and routes**

Create `apps/api/src/plugins/auth.ts`:

```ts
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

export type AuthenticatedUser = {
  userId: string;
  email: string;
};

declare module "fastify" {
  interface FastifyRequest {
    currentUser: AuthenticatedUser;
  }
}

export const authPlugin = fp(async function authPlugin(
  app: FastifyInstance,
  options: { jwtSecret: string },
): Promise<void> {
  await app.register(cookie);
  await app.register(jwt, {
    secret: options.jwtSecret,
    cookie: {
      cookieName: "cowork_session",
      signed: false,
    },
  });

  app.decorateRequest("currentUser");

  app.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest): Promise<void> {
      const payload = await request.jwtVerify<AuthenticatedUser>();
      request.currentUser = payload;
    },
  );
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }
}
```

Create `apps/api/src/modules/auth/routes.ts`:

```ts
import { loginInputSchema } from "@cowork/contracts";
import { prisma } from "@cowork/db";
import type { FastifyInstance } from "fastify";
import { verifyPassword } from "./password.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    const valid =
      user && (await verifyPassword(user.passwordHash, parsed.data.password));

    if (!user || !valid) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const token = await reply.jwtSign(
      { userId: user.id, email: user.email },
      { expiresIn: "8h" },
    );

    reply.setCookie("cowork_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie("cowork_session", { path: "/" });
    return reply.code(204).send();
  });

  app.get(
    "/me",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.currentUser.userId },
        select: { id: true, email: true, displayName: true },
      });

      if (!user) {
        return reply.code(401).send({ error: "UNAUTHENTICATED" });
      }

      return { user };
    },
  );
}
```

- [ ] **Step 5: Register authentication in the API**

Replace `apps/api/src/app.ts` with:

```ts
import cors from "@fastify/cors";
import Fastify from "fastify";
import { authRoutes } from "./modules/auth/routes.js";
import { authPlugin } from "./plugins/auth.js";

export type BuildAppOptions = {
  jwtSecret?: string;
  webOrigin?: string;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });
  const jwtSecret =
    options.jwtSecret ??
    process.env.JWT_SECRET ??
    "development-secret-change-before-production";
  const webOrigin =
    options.webOrigin ?? process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000";

  app.register(cors, {
    origin: webOrigin,
    credentials: true,
  });
  app.register(authPlugin, { jwtSecret });
  app.register(authRoutes);

  app.get("/health", async () => ({
    status: "ok",
    service: "api",
  }));

  return app;
}
```

Add the database and password dependencies:

```powershell
pnpm.cmd --filter @cowork/api add '@cowork/db@workspace:*' argon2
```

- [ ] **Step 6: Run tests**

Run:

```powershell
pnpm.cmd install
pnpm.cmd --filter @cowork/api test -- tests/auth.test.ts
pnpm.cmd --filter @cowork/api typecheck
```

Expected: valid login sets an HttpOnly cookie, invalid login returns the generic error, and typecheck passes.

- [ ] **Step 7: Commit**

```powershell
git add apps/api pnpm-lock.yaml
git commit -m "feat: add secure cookie authentication"
```

## Task 6: Add Project and Private Task APIs

**Files:**

- Create: `apps/api/src/modules/projects/routes.ts`
- Create: `apps/api/src/modules/tasks/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/projects-and-tasks.test.ts`

- [ ] **Step 1: Write the failing isolation test**

Create `apps/api/tests/projects-and-tasks.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@cowork/db";
import { buildApp } from "../src/app.js";

const app = buildApp({
  jwtSecret: "test-secret-that-is-longer-than-32-characters",
});

let aliceToken = "";
let bobToken = "";
let projectId = "";
let aliceTaskId = "";

beforeAll(async () => {
  await app.ready();
  const alice = await prisma.user.findUniqueOrThrow({
    where: { email: "alice@example.com" },
  });
  const bob = await prisma.user.findUniqueOrThrow({
    where: { email: "bob@example.com" },
  });
  const project = await prisma.project.findFirstOrThrow({
    where: { name: "Client Operations" },
  });

  projectId = project.id;
  aliceToken = app.jwt.sign({ userId: alice.id, email: alice.email });
  bobToken = app.jwt.sign({ userId: bob.id, email: bob.email });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("projects and private tasks", () => {
  it("allows both project members to see the shared project", async () => {
    const [aliceResponse, bobResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/projects",
        cookies: { cowork_session: aliceToken },
      }),
      app.inject({
        method: "GET",
        url: "/projects",
        cookies: { cowork_session: bobToken },
      }),
    ]);

    expect(aliceResponse.json().projects).toHaveLength(1);
    expect(bobResponse.json().projects).toHaveLength(1);
  });

  it("creates a private task for Alice", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/tasks`,
      cookies: { cowork_session: aliceToken },
      payload: { title: "Alice Private Task" },
    });

    expect(response.statusCode).toBe(201);
    aliceTaskId = response.json().task.id;
  });

  it("hides Alice's private task from Bob with 404", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/tasks/${aliceTaskId}`,
      cookies: { cowork_session: bobToken },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "TASK_NOT_FOUND" });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd db:seed
pnpm.cmd --filter @cowork/api test -- tests/projects-and-tasks.test.ts
```

Expected: failure because project and task routes do not exist.

- [ ] **Step 3: Implement project routes**

Create `apps/api/src/modules/projects/routes.ts`:

```ts
import { createProjectInputSchema } from "@cowork/contracts";
import { prisma } from "@cowork/db";
import type { FastifyInstance } from "fastify";

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/projects",
    { preHandler: app.authenticate },
    async (request) => {
      const projects = await prisma.project.findMany({
        where: {
          members: {
            some: { userId: request.currentUser.userId },
          },
          team: {
            memberships: {
              some: { userId: request.currentUser.userId },
            },
          },
        },
        select: { id: true, name: true, teamId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      return { projects };
    },
  );

  app.post(
    "/teams/:teamId/projects",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = request.params as { teamId: string };
      const input = createProjectInputSchema.safeParse(request.body);
      if (!input.success) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }

      const membership = await prisma.teamMembership.findUnique({
        where: {
          teamId_userId: {
            teamId: params.teamId,
            userId: request.currentUser.userId,
          },
        },
      });

      if (membership?.role !== "TEAM_ADMIN") {
        return reply.code(403).send({ error: "FORBIDDEN" });
      }

      const project = await prisma.project.create({
        data: {
          teamId: params.teamId,
          createdById: request.currentUser.userId,
          name: input.data.name,
          members: { create: { userId: request.currentUser.userId } },
        },
        select: { id: true, name: true, teamId: true, updatedAt: true },
      });

      return reply.code(201).send({ project });
    },
  );
}
```

- [ ] **Step 4: Implement private task routes**

Create `apps/api/src/modules/tasks/routes.ts`:

```ts
import { createTaskInputSchema } from "@cowork/contracts";
import { prisma } from "@cowork/db";
import type { FastifyInstance } from "fastify";

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/projects/:projectId/tasks",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const input = createTaskInputSchema.safeParse(request.body);
      if (!input.success) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }

      const project = await prisma.project.findFirst({
        where: {
          id: params.projectId,
          members: { some: { userId: request.currentUser.userId } },
          team: {
            memberships: {
              some: { userId: request.currentUser.userId },
            },
          },
        },
        select: { id: true },
      });

      if (!project) {
        return reply.code(404).send({ error: "PROJECT_NOT_FOUND" });
      }

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          ownerId: request.currentUser.userId,
          title: input.data.title,
          conversation: {
            create: { userId: request.currentUser.userId },
          },
        },
        select: { id: true, projectId: true, title: true, status: true },
      });

      return reply.code(201).send({ task });
    },
  );

  app.get(
    "/tasks/:taskId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = request.params as { taskId: string };
      const task = await prisma.task.findFirst({
        where: {
          id: params.taskId,
          ownerId: request.currentUser.userId,
          project: {
            members: { some: { userId: request.currentUser.userId } },
          },
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          conversation: {
            select: {
              id: true,
              messages: {
                select: {
                  id: true,
                  role: true,
                  content: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (!task) {
        return reply.code(404).send({ error: "TASK_NOT_FOUND" });
      }

      return { task };
    },
  );

  app.get(
    "/projects/:projectId/tasks",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const projectMembership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: params.projectId,
            userId: request.currentUser.userId,
          },
        },
      });

      if (!projectMembership) {
        return reply.code(404).send({ error: "PROJECT_NOT_FOUND" });
      }

      const tasks = await prisma.task.findMany({
        where: {
          projectId: params.projectId,
          ownerId: request.currentUser.userId,
        },
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });

      return { tasks };
    },
  );
}
```

- [ ] **Step 5: Register routes**

Add imports to `apps/api/src/app.ts`:

```ts
import { projectRoutes } from "./modules/projects/routes.js";
import { taskRoutes } from "./modules/tasks/routes.js";
```

Add registrations after `app.register(authRoutes);`:

```ts
app.register(projectRoutes);
app.register(taskRoutes);
```

- [ ] **Step 6: Run the tests**

Run:

```powershell
pnpm.cmd db:seed
pnpm.cmd --filter @cowork/api test -- tests/projects-and-tasks.test.ts
pnpm.cmd --filter @cowork/api typecheck
```

Expected: both users see the shared project, Alice creates a private task, and Bob receives 404 for Alice's task.

- [ ] **Step 7: Commit**

```powershell
git add apps/api
git commit -m "feat: add shared projects and private tasks"
```

## Task 7: Add Private Chat with a Fake Agent

**Files:**

- Create: `apps/api/src/modules/chat/routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/tests/chat.test.ts`

- [ ] **Step 1: Write the failing chat test**

Create `apps/api/tests/chat.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@cowork/db";
import { DeterministicFakeAgent } from "@cowork/domain";
import { buildApp } from "../src/app.js";

const app = buildApp({
  jwtSecret: "test-secret-that-is-longer-than-32-characters",
  agent: new DeterministicFakeAgent(),
});

let token = "";
let taskId = "";

beforeAll(async () => {
  await app.ready();
  const alice = await prisma.user.findUniqueOrThrow({
    where: { email: "alice@example.com" },
  });
  const project = await prisma.project.findFirstOrThrow({
    where: {
      name: "Client Operations",
      members: { some: { userId: alice.id } },
    },
  });
  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      ownerId: alice.id,
      title: "Chat Test",
      conversation: { create: { userId: alice.id } },
    },
  });
  token = app.jwt.sign({ userId: alice.id, email: alice.email });
  taskId = task.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("private task chat", () => {
  it("stores the user message and deterministic agent reply", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/tasks/${taskId}/messages`,
      cookies: { cowork_session: token },
      payload: { content: "이번 주 보고서를 정리해줘" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().messages).toMatchObject([
      { role: "USER", content: "이번 주 보고서를 정리해줘" },
      { role: "ASSISTANT", content: "확인했습니다: 이번 주 보고서를 정리해줘" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd db:seed
pnpm.cmd --filter @cowork/api test -- tests/chat.test.ts
```

Expected: failure because `agent` is not accepted by `buildApp` and the message route does not exist.

- [ ] **Step 3: Implement the message route**

Create `apps/api/src/modules/chat/routes.ts`:

```ts
import { createMessageInputSchema } from "@cowork/contracts";
import { prisma } from "@cowork/db";
import type { AgentPort } from "@cowork/domain";
import type { FastifyInstance } from "fastify";

export async function chatRoutes(
  app: FastifyInstance,
  agent: AgentPort,
): Promise<void> {
  app.post(
    "/tasks/:taskId/messages",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = request.params as { taskId: string };
      const input = createMessageInputSchema.safeParse(request.body);
      if (!input.success) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }

      const task = await prisma.task.findFirst({
        where: {
          id: params.taskId,
          ownerId: request.currentUser.userId,
        },
        select: {
          id: true,
          conversation: { select: { id: true } },
        },
      });

      if (!task?.conversation) {
        return reply.code(404).send({ error: "TASK_NOT_FOUND" });
      }

      const agentReply = await agent.reply({
        taskId: task.id,
        userId: request.currentUser.userId,
        message: input.data.content,
      });

      const messages = await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: task.conversation.id,
            role: "USER",
            content: input.data.content,
          },
          select: { id: true, role: true, content: true, createdAt: true },
        }),
        prisma.message.create({
          data: {
            conversationId: task.conversation.id,
            role: "ASSISTANT",
            content: agentReply.content,
          },
          select: { id: true, role: true, content: true, createdAt: true },
        }),
      ]);

      return reply.code(201).send({ messages });
    },
  );
}
```

- [ ] **Step 4: Inject the agent into the API**

Add imports to `apps/api/src/app.ts`:

```ts
import {
  DeterministicFakeAgent,
  type AgentPort,
} from "@cowork/domain";
import { chatRoutes } from "./modules/chat/routes.js";
```

Extend `BuildAppOptions`:

```ts
export type BuildAppOptions = {
  jwtSecret?: string;
  webOrigin?: string;
  agent?: AgentPort;
};
```

Inside `buildApp`, add:

```ts
const agent = options.agent ?? new DeterministicFakeAgent();
```

Register the chat route after task routes:

```ts
app.register(async (instance) => {
  await chatRoutes(instance, agent);
});
```

- [ ] **Step 5: Run the tests**

Run:

```powershell
pnpm.cmd db:seed
pnpm.cmd --filter @cowork/api test -- tests/chat.test.ts
pnpm.cmd --filter @cowork/api typecheck
```

Expected: the API stores one USER message and one deterministic ASSISTANT message.

- [ ] **Step 6: Commit**

```powershell
git add apps/api
git commit -m "feat: add private task chat through agent port"
```

## Task 8: Build the Next.js Cowork Shell

**Files:**

- Create: `apps/web/` with `create-next-app`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/vitest.config.ts`
- Replace: `apps/web/src/app/layout.tsx`
- Replace: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/login/page.tsx`
- Test: `apps/web/src/components/app-shell.test.tsx`

- [ ] **Step 1: Scaffold the web app**

Run:

```powershell
pnpm.cmd create next-app@latest apps/web --ts --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm --yes
```

Set the workspace name and add test commands and dependencies:

```powershell
pnpm.cmd --dir apps/web pkg set 'name=@cowork/web'
pnpm.cmd --dir apps/web pkg set 'scripts.typecheck=tsc --noEmit'
pnpm.cmd --dir apps/web pkg set 'scripts.test=vitest run'
pnpm.cmd --dir apps/web add -D '@testing-library/jest-dom@^6.0.0' '@testing-library/react@^16.0.0' '@vitejs/plugin-react@^5.0.0' 'jsdom@^26.0.0' 'vitest@^3.0.0'
```

Create `apps/web/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 2: Write the failing shell test**

Create `apps/web/src/components/app-shell.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders the primary navigation", () => {
    render(
      <AppShell userName="Alice">
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByText("Team Cowork")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd --dir apps/web exec vitest run src/components/app-shell.test.tsx --environment jsdom
```

Expected: failure because `AppShell` does not exist.

- [ ] **Step 4: Add the API client**

Create `apps/web/src/lib/api.ts`:

```ts
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `HTTP_${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
```

- [ ] **Step 5: Add the shell**

Create `apps/web/src/components/app-shell.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <Link href="/" className="font-semibold">
            Team Cowork
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/">Home</Link>
            <Link href="/projects">Projects</Link>
          </nav>
          <span className="ml-auto text-sm text-slate-600">{userName}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
```

Replace `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Cowork",
  description: "Team workspace powered by Codex",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Add Home and Login pages**

Replace `apps/web/src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="text-sm font-medium text-blue-700">Team Cowork</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        팀의 지식과 도구를 사용하는 업무 에이전트
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        프로젝트에서 개인 작업을 시작하고 필요한 결과만 팀에 공유하세요.
      </p>
      <Link
        href="/login"
        className="mt-8 w-fit rounded-lg bg-slate-950 px-5 py-3 text-white"
      >
        로그인
      </Link>
    </main>
  );
}
```

Create `apps/web/src/app/login/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("CoworkDemo123!");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/projects");
    } catch {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form onSubmit={submit} className="w-full space-y-4">
        <h1 className="text-2xl font-semibold">Team Cowork 로그인</h1>
        <label className="block">
          <span className="text-sm">이메일</span>
          <input
            aria-label="이메일"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm">비밀번호</span>
          <input
            aria-label="비밀번호"
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button className="w-full rounded-lg bg-slate-950 px-4 py-2 text-white">
          로그인
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Install and run tests**

Run:

```powershell
pnpm.cmd install
pnpm.cmd --dir apps/web exec vitest run src/components/app-shell.test.tsx --environment jsdom
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
```

Expected: shell test, typecheck, and lint pass.

- [ ] **Step 8: Commit**

```powershell
git add apps/web pnpm-lock.yaml
git commit -m "feat: add cowork web shell and login"
```

## Task 9: Add Project, Task, and Chat Pages

**Files:**

- Create: `apps/web/src/app/projects/page.tsx`
- Create: `apps/web/src/app/projects/[projectId]/page.tsx`
- Create: `apps/web/src/app/tasks/[taskId]/page.tsx`
- Create: `apps/web/src/components/projects-list.tsx`
- Create: `apps/web/src/components/task-chat.tsx`
- Test: `apps/web/src/components/task-chat.test.tsx`

- [ ] **Step 1: Write the failing chat component test**

Create `apps/web/src/components/task-chat.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskChat } from "./task-chat";

describe("TaskChat", () => {
  it("submits a message and renders the agent reply", async () => {
    const sendMessage = vi.fn().mockResolvedValue([
      { id: "u1", role: "USER", content: "보고서를 정리해줘" },
      { id: "a1", role: "ASSISTANT", content: "확인했습니다: 보고서를 정리해줘" },
    ]);

    render(
      <TaskChat
        initialMessages={[]}
        sendMessage={sendMessage}
      />,
    );

    fireEvent.change(screen.getByLabelText("메시지"), {
      target: { value: "보고서를 정리해줘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    await waitFor(() => {
      expect(screen.getByText("확인했습니다: 보고서를 정리해줘")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm.cmd --dir apps/web exec vitest run src/components/task-chat.test.tsx --environment jsdom
```

Expected: failure because `TaskChat` does not exist.

- [ ] **Step 3: Implement TaskChat**

Create `apps/web/src/components/task-chat.tsx`:

```tsx
"use client";

import { useState } from "react";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

export function TaskChat({
  initialMessages,
  sendMessage,
}: {
  initialMessages: Message[];
  sendMessage(content: string): Promise<Message[]>;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const created = await sendMessage(trimmed);
      setMessages((current) => [...current, ...created]);
      setContent("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3" aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "USER"
                ? "ml-auto max-w-2xl rounded-xl bg-blue-600 p-4 text-white"
                : "mr-auto max-w-2xl rounded-xl bg-white p-4 shadow-sm"
            }
          >
            {message.content}
          </article>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          aria-label="메시지"
          className="flex-1 rounded-lg border px-3 py-2"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <button
          disabled={sending}
          className="rounded-lg bg-slate-950 px-4 py-2 text-white"
        >
          보내기
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Implement the Projects page**

Create `apps/web/src/components/projects-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Project = {
  id: string;
  name: string;
};

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/projects")
      .then((result) => setProjects(result.projects))
      .catch(() => setProjects([]));
  }, []);

  return (
    <ul className="grid gap-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            className="block rounded-xl border bg-white p-5"
            href={`/projects/${project.id}`}
          >
            {project.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

Create `apps/web/src/app/projects/page.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";
import { ProjectsList } from "@/components/projects-list";

export default function ProjectsPage() {
  return (
    <AppShell userName="현재 사용자">
      <h1 className="mb-6 text-3xl font-semibold">Projects</h1>
      <ProjectsList />
    </AppShell>
  );
}
```

- [ ] **Step 5: Implement Project and Task pages**

Create `apps/web/src/app/projects/[projectId]/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/api";

type Task = {
  id: string;
  title: string;
  status: string;
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    apiFetch<{ tasks: Task[] }>(`/projects/${projectId}/tasks`).then((result) =>
      setTasks(result.tasks),
    );
  }, [projectId]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await apiFetch<{ task: Task }>(
      `/projects/${projectId}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({ title }),
      },
    );
    setTasks((current) => [result.task, ...current]);
    setTitle("");
  }

  return (
    <AppShell userName="현재 사용자">
      <h1 className="mb-6 text-3xl font-semibold">내 작업</h1>
      <form onSubmit={createTask} className="mb-8 flex gap-2">
        <input
          aria-label="작업 제목"
          className="flex-1 rounded-lg border px-3 py-2"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
          작업 만들기
        </button>
      </form>
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`}>{task.title}</Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
```

Create `apps/web/src/app/tasks/[taskId]/page.tsx`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TaskChat } from "@/components/task-chat";
import { apiFetch } from "@/lib/api";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

type Task = {
  id: string;
  title: string;
  conversation: {
    messages: Message[];
  };
};

export default function TaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    apiFetch<{ task: Task }>(`/tasks/${taskId}`).then((result) =>
      setTask(result.task),
    );
  }, [taskId]);

  if (!task) {
    return <main className="p-8">작업을 불러오는 중입니다.</main>;
  }

  return (
    <AppShell userName="현재 사용자">
      <h1 className="mb-6 text-3xl font-semibold">{task.title}</h1>
      <TaskChat
        initialMessages={task.conversation.messages}
        sendMessage={async (content) => {
          const result = await apiFetch<{ messages: Message[] }>(
            `/tasks/${task.id}/messages`,
            {
              method: "POST",
              body: JSON.stringify({ content }),
            },
          );
          return result.messages;
        }}
      />
    </AppShell>
  );
}
```

- [ ] **Step 6: Run component and type tests**

Run:

```powershell
pnpm.cmd --dir apps/web exec vitest run src/components/task-chat.test.tsx --environment jsdom
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
```

Expected: component test, typecheck, and lint pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web
git commit -m "feat: add project task and chat experience"
```

## Task 10: Prove Browser-Level User Isolation

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/team-cowork.spec.ts`
- Create: `docs/operations/local-development.md`
- Modify: `package.json`

- [ ] **Step 1: Write the failing end-to-end test**

Create `tests/e2e/team-cowork.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

async function login(
  page: import("@playwright/test").Page,
  email: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("CoworkDemo123!");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/projects$/);
}

test("two team users share a project but not private tasks", async ({
  browser,
}) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await login(alice, "alice@example.com");
  await alice.getByRole("link", { name: "Client Operations" }).click();
  await alice.getByLabel("작업 제목").fill("Alice Secret Task");
  await alice.getByRole("button", { name: "작업 만들기" }).click();
  await alice.getByRole("link", { name: "Alice Secret Task" }).click();
  const aliceTaskUrl = alice.url();
  await alice.getByLabel("메시지").fill("내부 보고서를 정리해줘");
  await alice.getByRole("button", { name: "보내기" }).click();
  await expect(
    alice.getByText("확인했습니다: 내부 보고서를 정리해줘"),
  ).toBeVisible();

  await login(bob, "bob@example.com");
  await bob.getByRole("link", { name: "Client Operations" }).click();
  await expect(bob.getByText("Alice Secret Task")).toHaveCount(0);
  await bob.goto(aliceTaskUrl);
  await expect(bob.getByText("내부 보고서를 정리해줘")).toHaveCount(0);

  await aliceContext.close();
  await bobContext.close();
});
```

- [ ] **Step 2: Create Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @cowork/api dev",
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: true,
      env: {
        DATABASE_URL:
          "postgresql://cowork:cowork@127.0.0.1:5432/cowork",
        JWT_SECRET: "local-development-secret-change-before-production",
        WEB_ORIGIN: "http://127.0.0.1:3000",
      },
    },
    {
      command: "pnpm --filter @cowork/web dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000",
      },
    },
  ],
});
```

- [ ] **Step 3: Run the end-to-end test**

Run:

```powershell
pnpm.cmd exec playwright install chromium
pnpm.cmd db:seed
pnpm.cmd test:e2e
```

Expected: the Chromium test passes. Alice's message is visible in Alice's task, while Bob sees the shared project but cannot see or open Alice's private task.

- [ ] **Step 4: Add local-development documentation**

Create `docs/operations/local-development.md`:

```md
# Local Development

## Requirements

- Node.js 20.9 or newer
- pnpm 11.9.0
- Docker Desktop with Docker Compose

## Start

1. Copy `.env.example` to `.env`.
2. Run `docker compose up -d postgres`.
3. Run `pnpm install`.
4. Run `pnpm db:generate`.
5. Run `pnpm db:migrate`.
6. Run `pnpm db:seed`.
7. Run `pnpm dev`.
8. Open `http://127.0.0.1:3000`.

## Demo users

- `alice@example.com` / `CoworkDemo123!`
- `bob@example.com` / `CoworkDemo123!`

The demo credentials are local seed data and must never be used in production.

## Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`

## Reset local data

Run `pnpm db:seed`. The seed deletes and recreates only data in the configured development database. Confirm `DATABASE_URL` points to the local `cowork` database before running it.
```

- [ ] **Step 5: Run all quality gates**

Run:

```powershell
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd test:e2e
pnpm.cmd build
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Review the migration and repository**

Run:

```powershell
git status --short
git diff --check
git log --oneline --decorate -10
```

Expected: no whitespace errors, no untracked secrets, and small commits corresponding to Tasks 1 through 9.

- [ ] **Step 7: Commit**

```powershell
git add playwright.config.ts tests/e2e docs/operations/local-development.md package.json
git commit -m "test: verify multi-user cowork isolation"
```

## Plan 1 Completion Criteria

Do not begin the Codex Task Runtime plan until every item passes:

- [ ] Alice and Bob can both sign in.
- [ ] Alice and Bob see the shared `Client Operations` project.
- [ ] Each user sees only their own private tasks.
- [ ] Direct access to another user's task returns 404.
- [ ] A user message and fake-agent response persist in one private conversation.
- [ ] Refreshing the task page preserves the conversation.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm test:e2e` passes.
- [ ] `pnpm build` passes.
- [ ] No `.env`, token, password hash, or generated data directory is committed.

## Official References

- Next.js installation and Node requirement: https://nextjs.org/docs/app/getting-started/installation
- Prisma PostgreSQL configuration: https://www.prisma.io/docs/orm/overview/databases/postgresql
- Codex app-server for the next implementation plan: https://learn.chatgpt.com/docs/app-server.md
