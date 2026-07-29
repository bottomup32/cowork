import { describe, expect, it } from "vitest";

import { classifyAction } from "./policy.js";

describe("external action policy", () => {
  it("separates reads, writes, and actions that always need approval", () => {
    expect(classifyAction("notion.search")).toBe("READ");
    expect(classifyAction("google.sheets.update")).toBe("REVERSIBLE_WRITE");
    expect(classifyAction("gmail.send")).toBe("ALWAYS_APPROVE");
    expect(classifyAction("files.overwrite_original")).toBe("ALWAYS_APPROVE");
  });
});
