import { createMessageInputSchema } from "@cowork/contracts";
import type { PrismaClient } from "@cowork/db";
import type { AgentPort, AgentReply } from "@cowork/domain";
import type { FastifyInstance } from "fastify";

export type ChatDatabase = Pick<PrismaClient, "task" | "$transaction">;
const publicMessage = { id: true, role: true, content: true, createdAt: true } as const;

// MVP turn coordinator: process-local ordering avoids concurrent client multiplexing.
// Database row locks remain the cross-instance persistence guarantee; a distributed coordinator is future runtime work.
function createTaskSendLock() {
  const tails = new Map<string, Promise<void>>();
  return async <Result>(taskId: string, operation: () => Promise<Result>) => {
    const previous = tails.get(taskId);
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    tails.set(taskId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (tails.get(taskId) === current) tails.delete(taskId);
    }
  };
}

async function canUseTask(database: ChatDatabase, taskId: string, userId: string) {
  return database.task.findFirst({
    where: { id: taskId, ownerId: userId, conversation: { is: { userId } }, project: { is: { members: { some: { userId } }, team: { is: { memberships: { some: { userId } } } } } } },
    select: { id: true, conversation: { select: { messages: { select: { role: true, content: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 20 } } } },
  });
}

async function replyBeforeDeadline(agent: AgentPort, input: Parameters<AgentPort["reply"]>[0], timeoutMs: number) {
  const controller = new AbortController();
  return new Promise<AgentReply>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish(() => reject(new Error("Agent reply deadline exceeded")));
    }, timeoutMs);
    timer.unref?.();
    void Promise.resolve().then(() => agent.reply({ ...input, signal: controller.signal })).then(
      (assistant) => finish(() => resolve(assistant)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export function registerChatRoutes(app: FastifyInstance, database: ChatDatabase, agent: AgentPort, agentReplyTimeoutMs: number) {
  const withTaskSendLock = createTaskSendLock();
  app.post("/tasks/:taskId/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const parsed = createMessageInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const taskId = (request.params as { taskId: string }).taskId;
    return withTaskSendLock(taskId, async () => {
      const task = await canUseTask(database, taskId, user.userId);
      if (!task) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
      let assistant: { content: string };
      try { assistant = await replyBeforeDeadline(agent, { taskId, userId: user.userId, message: parsed.data.content, history: task.conversation?.messages ?? [] }, agentReplyTimeoutMs); }
      catch { return reply.code(502).send({ error: "AGENT_UNAVAILABLE" }); }
      const messages = await database.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ conversationId: string }>>`
        SELECT c."id" AS "conversationId" FROM "Task" AS t
        JOIN "Project" AS p ON p."id" = t."projectId"
        JOIN "ProjectMember" AS pm ON pm."projectId" = p."id" AND pm."userId" = ${user.userId}
        JOIN "TeamMembership" AS tm ON tm."teamId" = p."teamId" AND tm."userId" = ${user.userId}
        JOIN "Conversation" AS c ON c."taskId" = t."id" AND c."userId" = ${user.userId}
        WHERE t."id" = ${taskId} AND t."ownerId" = ${user.userId}
        FOR UPDATE OF t, p, pm, tm, c`;
      const conversationId = locked[0]?.conversationId;
      if (!conversationId) return null;
      const latest = await transaction.message.findFirst({ where: { conversationId }, select: { createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      const start = new Date(Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1));
      const userMessage = await transaction.message.create({ data: { conversationId, role: "USER", content: parsed.data.content, createdAt: start }, select: publicMessage });
      const assistantMessage = await transaction.message.create({ data: { conversationId, role: "ASSISTANT", content: assistant.content, createdAt: new Date(start.getTime() + 1) }, select: publicMessage });
      return [userMessage, assistantMessage];
      });
      if (!messages) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
      return reply.code(201).send({ messages });
    });
  });
}
