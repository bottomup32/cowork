import { Codex } from "@openai/codex-sdk";
import type { AgentPort, AgentReplyInput } from "@cowork/domain";

type ThreadRunner = { run(input: string, options?: { signal?: AbortSignal }): Promise<{ finalResponse: string }> };
type CodexRunner = {
  startThread(options: {
    model?: string;
    sandboxMode: "read-only";
    workingDirectory: string;
    skipGitRepoCheck: boolean;
    networkAccessEnabled: boolean;
    approvalPolicy: "never";
  }): ThreadRunner;
};

export class CodexSdkAgent implements AgentPort {
  constructor(
    private readonly codex: CodexRunner = new Codex() as unknown as CodexRunner,
    private readonly options: { model?: string; workingDirectory?: string } = {},
  ) {}

  async reply(input: AgentReplyInput) {
    const history = (input.history ?? []).slice(-20).map((item) => `${item.role}: ${item.content}`).join("\n");
    const prompt = [
      "You are the single Codex agent inside Team Cowork.",
      "Work only with the supplied conversation. Do not modify files, call external services, or claim an external action occurred.",
      "Respond in the user's language. Give a concise, useful work result.",
      history ? `Conversation so far:\n${history}` : "",
      `USER: ${input.message}`,
    ].filter(Boolean).join("\n\n");
    const thread = this.codex.startThread({
      ...(this.options.model ? { model: this.options.model } : {}),
      sandboxMode: "read-only",
      workingDirectory: this.options.workingDirectory ?? process.cwd(),
      skipGitRepoCheck: true,
      networkAccessEnabled: false,
      approvalPolicy: "never",
    });
    const result = await thread.run(prompt, input.signal ? { signal: input.signal } : undefined);
    const content = result.finalResponse.trim();
    if (!content) throw new Error("Codex returned an empty response");
    return { content };
  }
}
