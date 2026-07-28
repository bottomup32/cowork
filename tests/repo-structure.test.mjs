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
