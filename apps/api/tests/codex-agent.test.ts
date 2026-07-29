import { describe, expect, it, vi } from "vitest";
import { CodexSdkAgent } from "../src/modules/agent/codex-agent.js";

describe("Codex SDK agent", () => {
  it("runs a read-only, no-network turn with isolated conversation context", async () => {
    const run = vi.fn().mockResolvedValue({ finalResponse: "정리했습니다." });
    const startThread = vi.fn().mockReturnValue({ run });
    const agent = new CodexSdkAgent({ startThread });
    await expect(agent.reply({ taskId: "task-1", userId: "user-1", message: "계속해줘", history: [{ role: "USER", content: "보고서를 만들어줘" }] })).resolves.toEqual({ content: "정리했습니다." });
    expect(startThread).toHaveBeenCalledWith(expect.objectContaining({ sandboxMode: "read-only", networkAccessEnabled: false, approvalPolicy: "never" }));
    expect(run.mock.calls[0][0]).toContain("보고서를 만들어줘");
    expect(run.mock.calls[0][0]).toContain("계속해줘");
  });
});
