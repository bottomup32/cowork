import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { resolveE2eDatabaseUrl } from "./tests/config/e2e-database-url.mjs";

loadEnv({ path: ".env" });

const testDatabaseUrl = resolveE2eDatabaseUrl();

const apiUrl = "http://127.0.0.1:4100";
const webUrl = "http://127.0.0.1:3100";
const testJwtSecret = "playwright-test-jwt-secret-must-be-at-least-32-characters";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @cowork/api start",
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl, JWT_SECRET: testJwtSecret, API_HOST: "127.0.0.1", API_PORT: "4100", WEB_ORIGIN: webUrl },
    },
    {
      command: "pnpm --filter @cowork/web dev --hostname 127.0.0.1 --port 3100",
      url: `${webUrl}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
    },
  ],
});
