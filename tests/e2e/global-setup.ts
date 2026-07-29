import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveE2eDatabaseUrl } from "../config/e2e-database-url.mjs";

const execFileAsync = promisify(execFile);
const pnpmCommand = "pnpm --filter @cowork/db exec tsx ../../tests/e2e/database-command.ts seed";

export default async function globalSetup() {
  resolveE2eDatabaseUrl();
  if (process.platform === "win32") await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", pnpmCommand], { env: process.env });
  else await execFileAsync("sh", ["-lc", pnpmCommand], { env: process.env });
}
