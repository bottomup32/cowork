import { config as loadEnv } from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import AxeBuilder from "@axe-core/playwright";
import ExcelJS from "exceljs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resolveE2eDatabaseUrl } from "../config/e2e-database-url.mjs";

loadEnv({ path: ".env" });

resolveE2eDatabaseUrl();

const demoPassword = "CoworkDemo123!";
const projectPath = "/projects/demo-project-client-operations";
const createdTaskIds = new Set<string>();
const createdSkillIds = new Set<string>();
const execFileAsync = promisify(execFile);

async function login(context: BrowserContext, email: string) {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(demoPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL("/");
  return page;
}

async function createTask(page: Page, title: string) {
  await page.goto(projectPath);
  await expect(page.getByRole("heading", { name: "Client Operations" })).toBeVisible();
  await page.getByLabel("작업 제목").fill(title);
  await page.getByRole("button", { name: "작업 만들기" }).click();
  await expect(page).toHaveURL(/\/tasks\/[^/]+$/);
  const taskId = new URL(page.url()).pathname.match(/^\/tasks\/([^/]+)$/)?.[1];
  expect(taskId).toBeTruthy();
  createdTaskIds.add(taskId!);
  return taskId!;
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
}

test.afterEach(async () => {
  if (!createdTaskIds.size && !createdSkillIds.size) return;
  try {
    const command = `pnpm --filter @cowork/db exec tsx ../../tests/e2e/database-command.ts cleanup ${[...createdTaskIds].join(",") || "-"} ${[...createdSkillIds].join(",") || "-"}`;
    if (process.platform === "win32") await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], { env: process.env });
    else await execFileAsync("sh", ["-lc", command], { env: process.env });
  } finally {
    createdTaskIds.clear();
    createdSkillIds.clear();
  }
});

test("skill publishing, Excel upload, risk approval, and integration status form one usable workflow", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await login(context, "alice@example.com");
    await page.goto("/skills");
    await page.getByLabel("Skill 이름").fill(`Invoice review ${Date.now()}`);
    await page.getByLabel("업무 목표").fill("Excel 청구서를 검토하고 예외 보고서를 작성해줘.");
    const skillResponse = page.waitForResponse((response) => response.url().endsWith("/teams/demo-team-accounting/skills") && response.request().method() === "POST");
    await page.getByRole("button", { name: "초안 생성" }).click();
    const skill = await (await skillResponse).json() as { id: string };
    createdSkillIds.add(skill.id);
    await expect(page.getByText("v1 · DRAFT")).toBeVisible();
    await page.getByRole("button", { name: "안전 테스트" }).click();
    await expect(page.getByText("v1 · TESTED")).toBeVisible();
    await page.getByRole("button", { name: "승인 요청" }).click();
    await expect(page.getByText("v1 · REVIEW")).toBeVisible();
    await page.getByRole("button", { name: "승인·배포" }).click();
    await expect(page.getByText("v1 · 배포됨")).toBeVisible();

    const taskId = await createTask(page, `Excel approval E2E ${Date.now()}`);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Invoices");
    sheet.addRow(["Invoice", "Amount"]);
    sheet.addRow(["INV-1", 125]);
    const workbookBytes = Buffer.from(await workbook.xlsx.writeBuffer());
    await page.getByLabel("Excel 파일 선택").setInputFiles({ name: "invoices.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbookBytes });
    await expect(page.getByText("invoices.xlsx")).toBeVisible();
    await expect(page.getByText("Invoices 2행")).toBeVisible();

    const approval = await context.request.post(`http://127.0.0.1:4100/tasks/${taskId}/approvals`, {
      data: { service: "gmail", action: "gmail.send", summary: "Send Excel summary", payload: { to: "client@example.com" } },
    });
    expect(approval.status()).toBe(201);
    await page.goto("/approvals");
    const approvalCard = page.locator(".approval-card").filter({ hasText: "Send Excel summary" });
    await expect(approvalCard).toBeVisible();
    await approvalCard.getByRole("button", { name: "승인" }).click();
    await expect(page.getByText("APPROVED")).toBeVisible();

    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: "Notion" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Google Docs & Sheets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Composio" })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  } finally {
    await context.close();
  }
});

test("team members keep private tasks isolated in the browser", async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  try {
    const alice = await login(aliceContext, "alice@example.com");
    const bob = await login(bobContext, "bob@example.com");
    await bob.goto("/projects");
    await expect(bob.getByRole("link", { name: "Client Operations" })).toBeVisible();

    const taskId = await createTask(alice, `Alice private E2E ${Date.now()}`);
    await alice.getByLabel("메시지").fill("이번 주 보고서를 정리해줘");
    await alice.getByRole("button", { name: "보내기" }).click();
    await expect(alice.getByText("확인했습니다: 이번 주 보고서를 정리해줘", { exact: true })).toBeVisible();

    await bob.goto(projectPath);
    await expect(bob.getByText(`Alice private E2E`, { exact: false })).toHaveCount(0);
    await bob.goto(`/tasks/${taskId}`);
    await expect(bob.getByRole("heading", { name: "작업을 찾을 수 없습니다" })).toBeVisible();
    await expect(bob.getByText("이번 주 보고서를 정리해줘", { exact: true })).toHaveCount(0);
  } finally {
    await aliceContext.close();
    await bobContext.close();
  }
});

test("login and authenticated workspace routes have no serious accessibility violations", async ({ browser }) => {
  const loginContext = await browser.newContext();
  const loginPage = await loginContext.newPage();
  await loginPage.goto("/login");
  await expectNoSeriousAxeViolations(loginPage);
  await loginContext.close();

  const context = await browser.newContext();
  try {
    const page = await login(context, "alice@example.com");
    const taskId = await createTask(page, `Axe private E2E ${Date.now()}`);
    for (const path of ["/", "/projects", `/tasks/${taskId}`, "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousAxeViolations(page);
    }
  } finally {
    await context.close();
  }
});

test("desktop, tablet, and mobile layouts avoid horizontal overflow", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await login(context, "alice@example.com");
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(projectPath);
      await expect(page.getByRole("heading", { name: "Client Operations" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole("button", { name: "메뉴 열기" });
    await menu.click();
    await expect(page.getByRole("complementary", { name: "주 메뉴" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();

    const taskId = await createTask(page, `Mobile private E2E ${Date.now()}`);
    const conversation = page.locator(".task-chat");
    const composer = page.locator(".chat-composer");
    for (let index = 1; index <= 5; index++) {
      const message = `모바일 스티키 작성기 검증 ${index}: 이번 주 보고서를 정리하고 담당자, 마감일, 위험 요소를 구체적으로 기록해줘.`;
      await page.getByLabel("메시지").fill(message);
      await page.getByRole("button", { name: "보내기" }).click();
      await expect(page.getByText(`확인했습니다: ${message}`, { exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    expect(await conversation.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await conversation.evaluate((element) => { element.scrollTop = 0; });
    const [conversationBox, composerBox] = await Promise.all([conversation.boundingBox(), composer.boundingBox()]);
    expect(conversationBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y).toBeGreaterThanOrEqual(conversationBox!.y);
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(conversationBox!.y + conversationBox!.height);
    await expect(page.getByLabel("메시지")).toBeInViewport();
    await page.getByLabel("메시지").fill("스티키 작성기 사용 가능");
    await expect(page.getByRole("button", { name: "보내기" })).toBeVisible();
    await conversation.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByText("확인했습니다: 모바일 스티키 작성기 검증 5: 이번 주 보고서를 정리하고 담당자, 마감일, 위험 요소를 구체적으로 기록해줘.", { exact: true })).toBeVisible();
    await page.screenshot({ path: `output/playwright/mobile-task-${taskId}.png`, fullPage: true });
  } finally {
    await context.close();
  }
});
