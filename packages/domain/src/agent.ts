export interface AgentReplyInput {
  taskId: string;
  userId: string;
  message: string;
  history?: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
  signal?: AbortSignal;
}

export interface AgentReply {
  content: string;
}

export interface AgentPort {
  reply(input: AgentReplyInput): Promise<AgentReply>;
}

export class DeterministicFakeAgent implements AgentPort {
  async reply(input: AgentReplyInput): Promise<AgentReply> {
    return { content: `확인했습니다: ${input.message}` };
  }
}
