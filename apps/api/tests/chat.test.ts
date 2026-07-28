import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import argon2 from "argon2";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@cowork/db/client-factory";
import type { AgentPort } from "@cowork/domain";

import { buildApp } from "../src/app.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for chat integration tests");

const fixture = `chat-${randomUUID()}`;
const aliceId = `${fixture}-alice`;
const bobId = `${fixture}-bob`;
const teamId = `${fixture}-team`;
const projectId = `${fixture}-project`;
const taskId = `${fixture}-task`;
const password = "CorrectHorseBattery1!";
const prisma = createPrismaClient(databaseUrl);

class RecordingAgent implements AgentPort {
  readonly calls: Array<{ taskId: string; userId: string; message: string }> = [];
  async reply(input: { taskId: string; userId: string; message: string }) {
    this.calls.push({ taskId: input.taskId, userId: input.userId, message: input.message });
    return { content: `reply: ${input.message}` };
  }
}

const agent = new RecordingAgent();
const app = buildApp({ database: prisma, agent, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });

const email = (userId: string) => `${userId}@example.com`;
const cookie = (setCookie: string | string[] | undefined) => {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!value) throw new Error("Session cookie was not set");
  return value.split(";", 1)[0];
};

async function session(userId: string) {
  const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: email(userId), password } });
  expect(response.statusCode).toBe(200);
  return cookie(response.headers["set-cookie"]);
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.createMany({ data: [aliceId, bobId].map((id) => ({ id, email: email(id), displayName: id, passwordHash })) });
  await prisma.team.create({ data: {
    id: teamId, name: fixture,
    memberships: { create: [{ userId: aliceId, role: "TEAM_ADMIN" }, { userId: bobId, role: "MEMBER" }] },
    projects: { create: { id: projectId, name: fixture, createdById: aliceId, members: { create: [{ userId: aliceId }, { userId: bobId }] } } },
  } });
  await prisma.task.create({ data: { id: taskId, projectId, ownerId: aliceId, title: fixture, conversation: { create: { userId: aliceId } } } });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.team.deleteMany({ where: { id: teamId } });
  await prisma.user.deleteMany({ where: { id: { in: [aliceId, bobId] } } });
  await prisma.$disconnect();
});

describe("private task chat", () => {
  it("stores the user and assistant pair and returns it from task detail in chronological order", async () => {
    const alice = await session(aliceId);
    const posted = await app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Hello" } });

    expect(posted.statusCode).toBe(201);
    expect(posted.json()).toEqual({ messages: [
      { id: expect.any(String), role: "USER", content: "Hello", createdAt: expect.any(String) },
      { id: expect.any(String), role: "ASSISTANT", content: "reply: Hello", createdAt: expect.any(String) },
    ] });
    expect(agent.calls).toEqual([{ taskId, userId: aliceId, message: "Hello" }]);

    const detail = await app.inject({ method: "GET", url: `/tasks/${taskId}`, headers: { cookie: alice } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().conversation.messages.map((message: { role: string; content: string }) => [message.role, message.content]))
      .toEqual([["USER", "Hello"], ["ASSISTANT", "reply: Hello"]]);
  });

  it("rejects unauthenticated, invalid, unauthorized, and revoked-membership sends before agent work", async () => {
    const alice = await session(aliceId);
    const bob = await session(bobId);
    const calls = agent.calls.length;
    const [unauthenticated, invalid, otherUser] = await Promise.all([
      app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, payload: { content: "No session" } }),
      app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "" } }),
      app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: bob }, payload: { content: "Not mine" } }),
    ]);
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toEqual({ error: "UNAUTHENTICATED" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "INVALID_INPUT" });
    expect(otherUser.statusCode).toBe(404);
    expect(otherUser.json()).toEqual({ error: "TASK_NOT_FOUND" });
    expect(agent.calls).toHaveLength(calls);

    await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId: aliceId } } });
    const projectRevoked = await app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "No project" } });
    expect(projectRevoked.statusCode).toBe(404);
    await prisma.projectMember.create({ data: { projectId, userId: aliceId } });
    await prisma.teamMembership.delete({ where: { teamId_userId: { teamId, userId: aliceId } } });
    const teamRevoked = await app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "No team" } });
    expect(teamRevoked.statusCode).toBe(404);
    await prisma.teamMembership.create({ data: { teamId, userId: aliceId, role: "TEAM_ADMIN" } });
    expect(agent.calls).toHaveLength(calls);
  });

  it("does not persist any message when the agent is unavailable", async () => {
    const failingApp = buildApp({ database: prisma, agent: { reply: async () => { throw new Error("unavailable"); } }, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
    await failingApp.ready();
    try {
      const alice = await session(aliceId);
      const before = await prisma.message.count({ where: { conversation: { taskId } } });
      const response = await failingApp.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Must not save" } });
      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({ error: "AGENT_UNAVAILABLE" });
      expect(await prisma.message.count({ where: { conversation: { taskId } } })).toBe(before);
    } finally { await failingApp.close(); }
  });

  it("releases a failed task turn so the next turn can proceed", async () => {
    const recoveryTaskId = `${fixture}-recovery-task`;
    let attempts = 0;
    const recoveryApp = buildApp({ database: prisma, agent: { reply: async ({ message }) => {
      attempts += 1;
      if (attempts === 1) throw new Error("first turn failed");
      return { content: `recovered: ${message}` };
    } }, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
    await prisma.task.create({ data: { id: recoveryTaskId, projectId, ownerId: aliceId, title: "Recovery", conversation: { create: { userId: aliceId } } } });
    await recoveryApp.ready();
    try {
      const alice = await session(aliceId);
      const failed = await recoveryApp.inject({ method: "POST", url: `/tasks/${recoveryTaskId}/messages`, headers: { cookie: alice }, payload: { content: "First" } });
      const recovered = await recoveryApp.inject({ method: "POST", url: `/tasks/${recoveryTaskId}/messages`, headers: { cookie: alice }, payload: { content: "Second" } });
      expect(failed.statusCode).toBe(502);
      expect(recovered.statusCode).toBe(201);
      expect(recovered.json().messages.map((message: { content: string }) => message.content)).toEqual(["Second", "recovered: Second"]);
    } finally {
      await recoveryApp.close();
      await prisma.task.deleteMany({ where: { id: recoveryTaskId } });
    }
  });

  it("aborts a hung agent turn and releases the same-task queue", async () => {
    const timeoutTaskId = `${fixture}-timeout-task`;
    let started!: () => void;
    let resolveLate!: (reply: { content: string }) => void;
    let signal: AbortSignal | undefined;
    let attempts = 0;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const timeoutApp = buildApp({
      database: prisma,
      agentReplyTimeoutMs: 25,
      agent: { reply: async (input: { signal?: AbortSignal }) => {
        attempts += 1;
        signal = input.signal;
        if (attempts > 1) return { content: `recovered: ${input.message}` };
        started();
        return new Promise<{ content: string }>((resolve) => { resolveLate = resolve; });
      } },
      jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters",
    });
    await prisma.task.create({ data: { id: timeoutTaskId, projectId, ownerId: aliceId, title: "Timeout", conversation: { create: { userId: aliceId } } } });
    await timeoutApp.ready();
    try {
      const alice = await session(aliceId);
      const before = await prisma.message.count({ where: { conversation: { taskId: timeoutTaskId } } });
      const pending = timeoutApp.inject({ method: "POST", url: `/tasks/${timeoutTaskId}/messages`, headers: { cookie: alice }, payload: { content: "Never resolves" } });
      await startedPromise;
      await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
      const timedOut = await pending;
      expect(signal?.aborted).toBe(true);
      expect(timedOut.statusCode).toBe(502);
      expect(timedOut.json()).toEqual({ error: "AGENT_UNAVAILABLE" });
      expect(await prisma.message.count({ where: { conversation: { taskId: timeoutTaskId } } })).toBe(before);
      const recovered = await timeoutApp.inject({ method: "POST", url: `/tasks/${timeoutTaskId}/messages`, headers: { cookie: alice }, payload: { content: "Next turn" } });
      expect(recovered.statusCode).toBe(201);
      resolveLate({ content: "late reply" });
    } finally {
      await timeoutApp.close();
      await prisma.task.deleteMany({ where: { id: timeoutTaskId } });
    }
  });

  it("uses the default agent and preserves its exact Korean UTF-8 reply", async () => {
    const defaultTaskId = `${fixture}-default-agent-task`;
    const defaultApp = buildApp({ database: prisma, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
    await prisma.task.create({ data: { id: defaultTaskId, projectId, ownerId: aliceId, title: "Default agent", conversation: { create: { userId: aliceId } } } });
    await defaultApp.ready();
    try {
      const alice = await session(aliceId);
      const response = await defaultApp.inject({ method: "POST", url: `/tasks/${defaultTaskId}/messages`, headers: { cookie: alice }, payload: { content: "안녕하세요" } });
      expect(response.statusCode).toBe(201);
      expect(response.json().messages.map((message: { content: string }) => message.content)).toEqual(["안녕하세요", "확인했습니다: 안녕하세요"]);
    } finally {
      await defaultApp.close();
      await prisma.task.deleteMany({ where: { id: defaultTaskId } });
    }
  });

  it("rejects a task whose conversation belongs to a different user before calling the agent", async () => {
    const alice = await session(aliceId);
    const calls = agent.calls.length;
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { taskId } });
    const before = await prisma.message.count({ where: { conversationId: conversation.id } });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { userId: bobId } });
    try {
      const response = await app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Wrong conversation owner" } });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "TASK_NOT_FOUND" });
      expect(agent.calls).toHaveLength(calls);
      expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(before);
    } finally {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { userId: aliceId } });
    }
  });

  it("rechecks authorization after agent work and commits no pair after revocation", async () => {
    let release!: () => void;
    let reached!: () => void;
    const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
    const releasePromise = new Promise<void>((resolve) => { release = resolve; });
    const gatedApp = buildApp({ database: prisma, agent: { reply: async () => { reached(); await releasePromise; return { content: "late" }; } }, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
    await gatedApp.ready();
    try {
      const alice = await session(aliceId);
      const before = await prisma.message.count({ where: { conversation: { taskId } } });
      const pending = gatedApp.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Revoked after call" } });
      await reachedPromise;
      await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId: aliceId } } });
      release();
      const response = await pending;
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "TASK_NOT_FOUND" });
      expect(await prisma.message.count({ where: { conversation: { taskId } } })).toBe(before);
    } finally {
      await prisma.projectMember.upsert({ where: { projectId_userId: { projectId, userId: aliceId } }, create: { projectId, userId: aliceId }, update: {} });
      await gatedApp.close();
    }
  });

  it("keeps simultaneous request pairs contiguous and deterministically ordered", async () => {
    const alice = await session(aliceId);
    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Concurrent one" } }),
      app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Concurrent two" } }),
    ]);
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const detail = await app.inject({ method: "GET", url: `/tasks/${taskId}`, headers: { cookie: alice } });
    const messages = detail.json().conversation.messages as Array<{ role: string; content: string; createdAt: string }>;
    const submitted = messages.filter((message) => message.content === "Concurrent one" || message.content === "Concurrent two" || message.content === "reply: Concurrent one" || message.content === "reply: Concurrent two");
    expect(submitted).toHaveLength(4);
    expect(submitted.map((message) => message.role)).toEqual(["USER", "ASSISTANT", "USER", "ASSISTANT"]);
    expect(new Set(submitted.map((message) => message.createdAt)).size).toBe(4);
    for (let index = 0; index < submitted.length; index += 2) {
      expect(submitted[index + 1].content).toBe(`reply: ${submitted[index].content}`);
    }
  });

  it("keeps back-to-back sends in exact chronological user-assistant pairs", async () => {
    const alice = await session(aliceId);
    const first = await app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Sequential one" } });
    const second = await app.inject({ method: "POST", url: `/tasks/${taskId}/messages`, headers: { cookie: alice }, payload: { content: "Sequential two" } });
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const detail = await app.inject({ method: "GET", url: `/tasks/${taskId}`, headers: { cookie: alice } });
    const sequence = (detail.json().conversation.messages as Array<{ role: string; content: string }>)
      .filter((message) => message.content.startsWith("Sequential") || message.content.startsWith("reply: Sequential"))
      .map((message) => [message.role, message.content]);
    expect(sequence).toEqual([
      ["USER", "Sequential one"], ["ASSISTANT", "reply: Sequential one"],
      ["USER", "Sequential two"], ["ASSISTANT", "reply: Sequential two"],
    ]);
  });
});
