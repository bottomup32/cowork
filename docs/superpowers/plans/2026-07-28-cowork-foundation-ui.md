# Cowork Foundation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved bright monochrome Team Cowork web experience with restrained blue-gradient accents on top of the existing authentication, project, private-task, and chat APIs.

**Architecture:** Add a Next.js 16 App Router workspace package. Keep network access in a typed browser API module, session state in one provider, presentational components independent from data-loading pages, and protected pages inside a route group. The first UI slice exposes only behavior supported by the API; Skills, Approvals, and Integrations receive honest empty/status screens until their backend plan is implemented.

**Tech Stack:** Node.js 22, pnpm 11, Next.js 16.2, React 19.2, TypeScript, Tailwind CSS 4.3, Lucide React, Vitest 3, React Testing Library, Playwright.

---

## Scope and file map

```text
apps/web/
├─ src/app/
│  ├─ (workspace)/
│  │  ├─ layout.tsx                 # authenticated shell boundary
│  │  ├─ page.tsx                   # home and new-task composer
│  │  ├─ projects/page.tsx          # shared projects
│  │  ├─ projects/[projectId]/page.tsx
│  │  ├─ tasks/page.tsx             # current user's private tasks
│  │  ├─ tasks/[taskId]/page.tsx    # task timeline and chat
│  │  ├─ skills/page.tsx            # honest MVP status screen
│  │  ├─ approvals/page.tsx         # honest MVP status screen
│  │  ├─ integrations/page.tsx      # connector status screen
│  │  └─ settings/page.tsx          # current account
│  ├─ login/page.tsx
│  ├─ globals.css                   # approved tokens and responsive shell
│  └─ layout.tsx
├─ src/components/
│  ├─ app-shell.tsx
│  ├─ login-form.tsx
│  ├─ new-task-composer.tsx
│  ├─ projects-list.tsx
│  ├─ project-tasks.tsx
│  ├─ task-chat.tsx
│  ├─ status-page.tsx
│  └─ ui/button.tsx
├─ src/lib/
│  ├─ api.ts                        # credentials-included typed fetch
│  ├─ session.tsx                   # /me, logout, protected state
│  └─ types.ts                      # exact current API DTOs
├─ vitest.config.ts
└─ vitest.setup.ts
tests/e2e/
├─ global-setup.ts
└─ team-cowork-ui.spec.ts
```

The current API returns projects, task lists, created tasks, task details, and
users directly. Only message creation is wrapped as `{ messages }`. The UI must
not reintroduce the obsolete `{ projects }`, `{ tasks }`, `{ task }`, or
`{ user }` response assumptions.

## Task 1: Scaffold the web package and theme primitives

**Files:**
- Create: `apps/web/**` with Create Next App
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Replace: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/ui/button.tsx`
- Test: `apps/web/src/components/ui/button.test.tsx`

- [ ] **Step 1: Scaffold the current supported Next.js package**

```powershell
pnpm.cmd dlx create-next-app@16.2.12 apps/web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
pnpm.cmd --dir apps/web pkg set "name=@cowork/web"
pnpm.cmd --dir apps/web pkg set "scripts.typecheck=tsc --noEmit"
pnpm.cmd --dir apps/web pkg set "scripts.test=vitest run"
pnpm.cmd --dir apps/web add lucide-react@1.27.0
pnpm.cmd --dir apps/web add -D vitest@^3.0.0 @vitejs/plugin-react@^5.0.0 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.0 jsdom@30.0.0
```

Expected: `@cowork/web` appears in the pnpm workspace and Node 22 satisfies the
Next.js runtime requirement.

- [ ] **Step 2: Write the failing primary-button test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("uses the branded primary treatment and preserves button semantics", () => {
    render(<Button type="submit">실행</Button>);
    const button = screen.getByRole("button", { name: "실행" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("button-primary");
  });
});
```

- [ ] **Step 3: Add the test harness and verify RED**

```ts
// apps/web/vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

```ts
// apps/web/vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

Run:

```powershell
pnpm.cmd --dir apps/web test -- src/components/ui/button.test.tsx
```

Expected: FAIL because `Button` does not exist.

- [ ] **Step 4: Implement the theme tokens and button**

Define centralized CSS variables in `globals.css`:

```css
@import "tailwindcss";

:root {
  --app-bg: #f7f7f5;
  --surface: #ffffff;
  --surface-muted: #f2f2f0;
  --text: #242321;
  --text-muted: #74736f;
  --border: #e5e5e1;
  --border-strong: #d6d6d1;
  --blue-start: #1d4ed8;
  --blue-end: #2563eb;
  --blue-soft: #eff6ff;
  --danger: #b42318;
  --radius-control: 12px;
  --radius-panel: 18px;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--app-bg);
  color: var(--text);
  font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
}
.button-primary {
  background: linear-gradient(135deg, var(--blue-start), var(--blue-end));
  color: white;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
}
```

```tsx
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`button-primary rounded-xl px-4 py-2.5 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Verify and commit**

```powershell
pnpm.cmd --dir apps/web test -- src/components/ui/button.test.tsx
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
git add apps/web pnpm-lock.yaml
git commit -m "feat: scaffold themed cowork web app"
```

Expected: component test, typecheck, and lint pass.

## Task 2: Add typed API access, session state, and login

**Files:**
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/lib/session.tsx`
- Create: `apps/web/src/components/login-form.tsx`
- Replace: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/login/page.tsx`
- Test: `apps/web/src/components/login-form.test.tsx`
- Test: `apps/web/src/lib/api.test.ts`

- [ ] **Step 1: Write failing API and login tests**

The API test must prove `credentials: "include"`, JSON parsing, 204 handling,
and typed `ApiError(status, code)`. The form test uses an injected login
function and verifies Korean generic failure text without exposing server
details:

```tsx
const login = vi.fn().mockRejectedValue(new Error("INVALID_CREDENTIALS"));
render(<LoginForm login={login} />);
fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "alice@example.com" } });
fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "WrongPassword1!" } });
fireEvent.click(screen.getByRole("button", { name: "로그인" }));
expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호를 확인해 주세요.");
```

Run:

```powershell
pnpm.cmd --dir apps/web test -- src/lib/api.test.ts src/components/login-form.test.tsx
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Define exact API DTOs**

```ts
export type User = { id: string; email: string; displayName: string };
export type Project = { id: string; name: string; teamId: string; updatedAt: string };
export type TaskSummary = {
  id: string;
  projectId: string;
  title: string;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
};
export type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};
export type TaskDetail = TaskSummary & {
  conversation: { messages: Message[] } | null;
};
```

- [ ] **Step 3: Implement the API boundary**

```ts
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `HTTP_${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
```

- [ ] **Step 4: Implement session and login**

`SessionProvider` calls `GET /me` once, exposes
`{ user, loading, refresh, logout }`, and clears state after `POST
/auth/logout`. `LoginForm` calls `POST /auth/login` and routes to `/`.
Never prefill production credentials.

```tsx
// core login action
await apiFetch<User>("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
router.replace("/");
router.refresh();
```

The root layout uses `lang="ko"`, the approved metadata, and one
`SessionProvider`. The login screen uses the white panel, fine border, and one
blue-gradient submit button.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm.cmd --dir apps/web test -- src/lib/api.test.ts src/components/login-form.test.tsx
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
git add apps/web
git commit -m "feat: add cowork web authentication"
```

## Task 3: Build the responsive shell and Home composer

**Files:**
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/new-task-composer.tsx`
- Create: `apps/web/src/app/(workspace)/layout.tsx`
- Replace: `apps/web/src/app/(workspace)/page.tsx`
- Remove: scaffolded `apps/web/src/app/page.tsx`
- Test: `apps/web/src/components/app-shell.test.tsx`
- Test: `apps/web/src/components/new-task-composer.test.tsx`

- [ ] **Step 1: Write failing shell and composer tests**

Assert that the shell renders Home, Projects, My Tasks, Skills, Approvals,
Integrations, Settings, the current user, and a keyboard-named mobile menu.
Assert the composer requires a project and title, calls:

```ts
createTask("project-1", "7월 마감 보고서")
```

then routes to `/tasks/task-1`.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd --dir apps/web test -- src/components/app-shell.test.tsx src/components/new-task-composer.test.tsx
```

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement AppShell**

Use Lucide line icons and these navigation targets:

```ts
const navigation = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "My Tasks" },
  { href: "/skills", label: "Skills" },
  { href: "/approvals", label: "Approvals" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
] as const;
```

The desktop shell uses a 272 px persistent sidebar; tablet collapses to an icon
rail; mobile uses a labelled drawer. Active rows remain neutral with a small
blue-gradient marker. Logout stays in the user menu.

- [ ] **Step 4: Implement the protected layout and Home**

The workspace layout displays a neutral loading skeleton while `/me` loads and
redirects 401 sessions to `/login`. Home includes:

- a personal greeting;
- quick cards for new task, Excel upload, team Skills, and approvals;
- the bottom-centered `NewTaskComposer`;
- honest labels for features whose backend follows in Task 9.

`NewTaskComposer` loads `Project[]`, posts a `TaskSummary` directly from
`POST /projects/:projectId/tasks`, and routes to the task. It shows inline
Korean errors and never invents a successful task.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm.cmd --dir apps/web test -- src/components/app-shell.test.tsx src/components/new-task-composer.test.tsx
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
git add apps/web
git commit -m "feat: add cowork shell and home workspace"
```

## Task 4: Add project, private-task, and chat screens

**Files:**
- Create: `apps/web/src/components/projects-list.tsx`
- Create: `apps/web/src/components/project-tasks.tsx`
- Create: `apps/web/src/components/task-chat.tsx`
- Create: `apps/web/src/app/(workspace)/projects/page.tsx`
- Create: `apps/web/src/app/(workspace)/projects/[projectId]/page.tsx`
- Create: `apps/web/src/app/(workspace)/tasks/[taskId]/page.tsx`
- Test: `apps/web/src/components/projects-list.test.tsx`
- Test: `apps/web/src/components/project-tasks.test.tsx`
- Test: `apps/web/src/components/task-chat.test.tsx`

- [ ] **Step 1: Write failing component tests**

Projects must show loading, an empty state, API failure with retry, and project
links. Project tasks must create a task and show only the API-returned private
list. Chat must:

```tsx
fireEvent.change(screen.getByLabelText("메시지"), {
  target: { value: "이번 주 보고서를 정리해줘" },
});
fireEvent.click(screen.getByRole("button", { name: "보내기" }));
expect(await screen.findByText("확인했습니다: 이번 주 보고서를 정리해줘")).toBeVisible();
```

Also assert duplicate submit is disabled, failure preserves the draft, and
messages use labels in addition to color.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd --dir apps/web test -- src/components/projects-list.test.tsx src/components/project-tasks.test.tsx src/components/task-chat.test.tsx
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement data-loading pages with current response shapes**

```ts
const projects = await apiFetch<Project[]>("/projects");
const tasks = await apiFetch<TaskSummary[]>(`/projects/${projectId}/tasks`);
const task = await apiFetch<TaskDetail>(`/tasks/${taskId}`);
const created = await apiFetch<TaskSummary>(`/projects/${projectId}/tasks`, {
  method: "POST",
  body: JSON.stringify({ title }),
});
const result = await apiFetch<{ messages: Message[] }>(`/tasks/${taskId}/messages`, {
  method: "POST",
  body: JSON.stringify({ content }),
});
```

Do not use obsolete wrapper objects. A 401 redirects to login; a 404 renders a
private-safe “작업을 찾을 수 없습니다” state without revealing ownership.

- [ ] **Step 4: Implement TaskChat**

The timeline renders USER, ASSISTANT, and SYSTEM labels. The elevated composer
is sticky at the bottom, uses a textarea, shows sending state, retains the draft
on error, appends only the server-returned atomic pair, and exposes the error
through `role="alert"`.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm.cmd --dir apps/web test
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
pnpm.cmd --filter @cowork/web build
git add apps/web
git commit -m "feat: add private task and chat experience"
```

## Task 5: Complete navigation destinations and accessibility states

**Files:**
- Create: `apps/web/src/components/status-page.tsx`
- Create: `apps/web/src/app/(workspace)/tasks/page.tsx`
- Create: `apps/web/src/app/(workspace)/skills/page.tsx`
- Create: `apps/web/src/app/(workspace)/approvals/page.tsx`
- Create: `apps/web/src/app/(workspace)/integrations/page.tsx`
- Create: `apps/web/src/app/(workspace)/settings/page.tsx`
- Test: `apps/web/src/components/status-page.test.tsx`
- Test: `apps/web/src/app/(workspace)/tasks/tasks-page.test.tsx`

- [ ] **Step 1: Write failing destination tests**

The My Tasks test loads projects and then their task lists sequentially, merges
only returned private tasks, and links each result. Status-page tests verify
heading, description, semantic status label, and that unavailable actions are
not rendered as enabled controls.

- [ ] **Step 2: Implement current-user task aggregation**

Avoid concurrent local Prisma-dev requests:

```ts
const projects = await apiFetch<Project[]>("/projects");
const collected: TaskSummary[] = [];
for (const project of projects) {
  collected.push(...await apiFetch<TaskSummary[]>(`/projects/${project.id}/tasks`));
}
```

Render project context, status text, empty state, and retry. No teammate task can
appear because the API list is owner-scoped.

- [ ] **Step 3: Implement honest status destinations**

- Skills: “아직 배포된 팀 Skill이 없습니다” and explain draft/approval is the
  next product slice.
- Approvals: “승인 대기 작업이 없습니다”; no fake approval records.
- Integrations: Notion, Google Workspace, and Composio cards labelled
  “연결 준비 중”; no enabled connect button before backend support.
- Settings: current `displayName` and `email`, plus working logout.

Each state uses text and icon, not color alone.

- [ ] **Step 4: Verify responsive and accessible behavior**

Run component tests plus an automated accessibility pass using
`@axe-core/playwright` in Task 6. Manually verify visible focus, keyboard drawer
operation, `aria-current`, labelled icon buttons, reduced motion, and Korean
wrapping before commit.

```powershell
pnpm.cmd --dir apps/web test
pnpm.cmd --filter @cowork/web typecheck
pnpm.cmd --filter @cowork/web lint
pnpm.cmd --filter @cowork/web build
git add apps/web
git commit -m "feat: complete cowork navigation states"
```

## Task 6: Prove browser behavior, isolation, and visual quality

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/team-cowork-ui.spec.ts`
- Create: `docs/operations/local-development.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the failing end-to-end isolation test**

Use two independent browser contexts. Alice and Bob log in to the same demo
project; Alice creates a uniquely named task and sends a Korean message; Bob
must not see the task and must get the private-safe not-found screen when
navigating directly to Alice’s task URL.

```ts
await alice.getByLabel("작업 제목").fill(taskTitle);
await alice.getByRole("button", { name: "작업 만들기" }).click();
await alice.getByLabel("메시지").fill("이번 주 보고서를 정리해줘");
await alice.getByRole("button", { name: "보내기" }).click();
await expect(alice.getByText("확인했습니다: 이번 주 보고서를 정리해줘")).toBeVisible();

await bob.goto(aliceTaskUrl);
await expect(bob.getByText("작업을 찾을 수 없습니다")).toBeVisible();
await expect(bob.getByText("이번 주 보고서를 정리해줘")).toHaveCount(0);
```

Cleanup deletes only the exact E2E task ID through a test client.

- [ ] **Step 2: Configure isolated services**

Install the browser-only test dependencies at the workspace root:

```powershell
pnpm.cmd add -Dw dotenv@^17.0.0 @axe-core/playwright@^4.0.0
```

Load `.env` in Playwright config, require `TEST_DATABASE_URL`, seed fixed demo
identities in global setup, run API on `127.0.0.1:4100` with
`DATABASE_URL=TEST_DATABASE_URL`, and run web on `127.0.0.1:3100` with
`NEXT_PUBLIC_API_URL=http://127.0.0.1:4100`. Never point browser tests at the
development database.

Add `@axe-core/playwright` and run an accessibility scan on Login, Home,
Projects, Task, and Settings with no serious or critical violations.

- [ ] **Step 3: Run browser and visual QA**

Use the Playwright skill to inspect desktop (1440×1000), tablet (834×1112), and
mobile (390×844). Capture screenshots for Home, Projects, Task chat, and
Integrations. Verify:

- off-white shell and white workspace;
- 272 px desktop sidebar and usable mobile drawer;
- restrained blue gradient only on primary actions and active/progress accents;
- no clipped Korean text or horizontal overflow;
- sticky composer does not cover the newest message;
- keyboard focus and error states remain visible.

- [ ] **Step 4: Document and run the full gate**

`docs/operations/local-development.md` contains exact commands for Prisma-dev,
migration SQL fallback, seeding, API, web, and E2E. Do not add deployment or CI
configuration.

```powershell
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd test:e2e
git diff --check
git add playwright.config.ts tests/e2e docs/operations package.json pnpm-lock.yaml
git commit -m "test: prove cowork browser isolation"
```

Expected: unit/integration tests, typecheck, lint, production build, browser
isolation test, and accessibility scan all pass.
