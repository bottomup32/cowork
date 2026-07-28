import { randomInt } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children: ReturnType<typeof spawn>[] = [];

afterEach(async () => {
  await Promise.all(children.splice(0).map(async (child) => {
    if (child.exitCode !== null) return;
    if (process.platform === "win32" && child.pid) {
      const taskkill = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      await new Promise<void>((resolveExit) => taskkill.once("exit", () => resolveExit()));
      return;
    }
    child.kill();
    await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
  }));
});

describe("production start command", () => {
  it("starts the API through the advertised start command", async () => {
    const port = randomInt(42_000, 48_000);
    const child = spawn(pnpmCommand, ["start"], {
      cwd: apiDirectory,
      env: {
        ...process.env,
        API_HOST: "127.0.0.1",
        API_PORT: String(port),
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        JWT_SECRET: "test-secret-that-is-longer-than-thirty-two-characters",
        WEB_ORIGIN: "http://127.0.0.1:3000",
      },
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    children.push(child);

    let response: Response | undefined;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`);
        break;
      } catch {
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
    }

    expect(response?.status).toBe(200);
    if (!response) throw new Error("API did not start");
    expect(await response.json()).toEqual({ status: "ok", service: "api" });
  });
});
