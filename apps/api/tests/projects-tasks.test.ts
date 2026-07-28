import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import argon2 from "argon2";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@cowork/db/client-factory";

import { buildApp, type AppDatabase } from "../src/app.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for project integration tests");

const id = `projects-${randomUUID()}`;
const aliceId = `${id}-alice`;
const bobId = `${id}-bob`;
const charlieId = `${id}-charlie`;
const teamId = `${id}-team`;
const projectId = `${id}-project`;
const password = "CorrectHorseBattery1!";
const prisma = createPrismaClient(databaseUrl);
const app = buildApp({ database: prisma, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });

function email(userId: string) {
  return `${userId}@example.com`;
}

function cookie(setCookie: string | string[] | undefined) {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!value) throw new Error("Session cookie was not set");
  return value.split(";", 1)[0];
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function awaitWithin(promise: Promise<void>, label: string) {
  await Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 1_000)),
  ]);
}

function instrumentTransactions(database: AppDatabase, onLockedQuery: () => Promise<void> | void, returnNoMembership = false): AppDatabase {
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      return async (callback: (transaction: AppDatabase) => unknown) => target.$transaction(async (transaction) => callback(new Proxy(transaction, {
        get(transactionTarget, transactionProperty, transactionReceiver) {
          if (transactionProperty !== "$queryRaw") return Reflect.get(transactionTarget, transactionProperty, transactionReceiver);
          return async (...args: unknown[]) => {
            await onLockedQuery();
            if (returnNoMembership) return [];
            return transactionTarget.$queryRaw(...(args as Parameters<typeof transactionTarget.$queryRaw>));
          };
        },
      }) as AppDatabase));
    },
  });
}

async function session(userId: string) {
  const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: email(userId), password } });
  expect(response.statusCode).toBe(200);
  return cookie(response.headers["set-cookie"]);
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.createMany({
    data: [aliceId, bobId, charlieId].map((userId) => ({ id: userId, email: email(userId), displayName: userId, passwordHash })),
  });
  await prisma.team.create({
    data: {
      id: teamId,
      name: `Team ${id}`,
      memberships: { create: [{ userId: aliceId, role: "TEAM_ADMIN" }, { userId: bobId, role: "MEMBER" }] },
      projects: { create: { id: projectId, name: "Shared project", createdById: aliceId, members: { create: [{ userId: aliceId }, { userId: bobId }] } } },
    },
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.team.deleteMany({ where: { id: teamId } });
  await prisma.user.deleteMany({ where: { id: { in: [aliceId, bobId, charlieId] } } });
  await prisma.$disconnect();
});

describe("shared projects and private tasks", () => {
  it("lists a shared project only for callers with both memberships", async () => {
    const [alice, bob, charlie] = await Promise.all([session(aliceId), session(bobId), session(charlieId)]);
    await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId: bobId } } });

    const [aliceResponse, bobResponse, charlieResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/projects", headers: { cookie: alice } }),
      app.inject({ method: "GET", url: "/projects", headers: { cookie: bob } }),
      app.inject({ method: "GET", url: "/projects", headers: { cookie: charlie } }),
    ]);

    expect(aliceResponse.statusCode).toBe(200);
    expect(aliceResponse.json()).toEqual([{ id: projectId, name: "Shared project", teamId, updatedAt: expect.any(String) }]);
    expect(bobResponse.json()).toEqual([]);
    expect(charlieResponse.json()).toEqual([]);
    const teamOnlyCreate = await app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, headers: { cookie: bob }, payload: { title: "Blocked task" } });
    expect(teamOnlyCreate.statusCode).toBe(404);
    expect(teamOnlyCreate.json()).toEqual({ error: "PROJECT_NOT_FOUND" });
    await prisma.projectMember.create({ data: { projectId, userId: bobId } });
  });

  it("orders every visible project by most recently updated", async () => {
    const alice = await session(aliceId);
    const olderProjectId = `${id}-older-project`;
    const newerProjectId = `${id}-newer-project`;
    await prisma.project.create({
      data: { id: olderProjectId, teamId, createdById: aliceId, name: "Older project", members: { create: { userId: aliceId } } },
    });
    await prisma.project.create({
      data: { id: newerProjectId, teamId, createdById: aliceId, name: "Newer project", members: { create: { userId: aliceId } } },
    });
    await prisma.project.update({ where: { id: olderProjectId }, data: { updatedAt: new Date("2025-01-01T00:00:00.000Z") } });
    await prisma.project.update({ where: { id: newerProjectId }, data: { updatedAt: new Date("2025-01-02T00:00:00.000Z") } });

    const response = await app.inject({ method: "GET", url: "/projects", headers: { cookie: alice } });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((project: { id: string }) => project.id)).toEqual(expect.arrayContaining([olderProjectId, newerProjectId]));
    expect(response.json().findIndex((project: { id: string }) => project.id === newerProjectId)).toBeLessThan(response.json().findIndex((project: { id: string }) => project.id === olderProjectId));
  });

  it("lets only the exact team admin create a project and joins them to it", async () => {
    const [alice, bob, charlie] = await Promise.all([session(aliceId), session(bobId), session(charlieId)]);
    const created = await app.inject({ method: "POST", url: `/teams/${teamId}/projects`, headers: { cookie: alice }, payload: { name: "Admin project" } });
    const member = await app.inject({ method: "POST", url: `/teams/${teamId}/projects`, headers: { cookie: bob }, payload: { name: "Nope" } });
    const nonmember = await app.inject({ method: "POST", url: `/teams/${teamId}/projects`, headers: { cookie: charlie }, payload: { name: "Nope" } });
    const invalid = await app.inject({ method: "POST", url: `/teams/${teamId}/projects`, headers: { cookie: alice }, payload: { name: "" } });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: "Admin project", teamId, id: expect.any(String), updatedAt: expect.any(String) });
    expect(await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: created.json().id, userId: aliceId } } })).not.toBeNull();
    expect(member.statusCode).toBe(403);
    expect(member.json()).toEqual({ error: "FORBIDDEN" });
    expect(nonmember.statusCode).toBe(403);
    expect(nonmember.json()).toEqual({ error: "FORBIDDEN" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "INVALID_INPUT" });
  });

  it("lists only Alice tasks in descending update order", async () => {
    const [alice, bob] = await Promise.all([session(aliceId), session(bobId)]);
    const [olderAlice, newerAlice, bobTask] = await Promise.all([
      prisma.task.create({ data: { projectId, ownerId: aliceId, title: "Older Alice", conversation: { create: { userId: aliceId } } } }),
      prisma.task.create({ data: { projectId, ownerId: aliceId, title: "Newer Alice", conversation: { create: { userId: aliceId } } } }),
      prisma.task.create({ data: { projectId, ownerId: bobId, title: "Bob private", conversation: { create: { userId: bobId } } } }),
    ]);
    await prisma.task.update({ where: { id: olderAlice.id }, data: { updatedAt: new Date("2025-02-01T00:00:00.000Z") } });
    await prisma.task.update({ where: { id: newerAlice.id }, data: { updatedAt: new Date("2025-02-02T00:00:00.000Z") } });
    await prisma.task.update({ where: { id: bobTask.id }, data: { updatedAt: new Date("2025-02-03T00:00:00.000Z") } });

    const [aliceList, bobList] = await Promise.all([
      app.inject({ method: "GET", url: `/projects/${projectId}/tasks`, headers: { cookie: alice } }),
      app.inject({ method: "GET", url: `/projects/${projectId}/tasks`, headers: { cookie: bob } }),
    ]);

    const aliceIds = aliceList.json().map((task: { id: string }) => task.id);
    expect(aliceIds).toContain(olderAlice.id);
    expect(aliceIds).toContain(newerAlice.id);
    expect(aliceIds).not.toContain(bobTask.id);
    expect(aliceIds.indexOf(newerAlice.id)).toBeLessThan(aliceIds.indexOf(olderAlice.id));
    expect(bobList.json().map((task: { id: string }) => task.id)).toContain(bobTask.id);
  });

  it("creates a caller-private task and keeps it hidden from another project member", async () => {
    const [alice, bob] = await Promise.all([session(aliceId), session(bobId)]);
    const create = await app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, headers: { cookie: alice }, payload: { title: "Alice private task" } });
    expect(create.statusCode).toBe(201);
    const taskId = create.json().id as string;
    expect(create.json()).toEqual({ id: taskId, projectId, title: "Alice private task", status: "OPEN" });
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { taskId, userId: aliceId } });
    await prisma.message.createMany({ data: [{ conversationId: conversation.id, role: "USER", content: "First", createdAt: new Date("2025-01-01T00:00:00.000Z") }, { conversationId: conversation.id, role: "ASSISTANT", content: "Second", createdAt: new Date("2025-01-01T00:00:01.000Z") }] });
    const invalid = await app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, headers: { cookie: alice }, payload: { title: "" } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "INVALID_INPUT" });

    const aliceTask = await app.inject({ method: "GET", url: `/tasks/${taskId}`, headers: { cookie: alice } });
    const bobTask = await app.inject({ method: "GET", url: `/tasks/${taskId}`, headers: { cookie: bob } });
    const bobList = await app.inject({ method: "GET", url: `/projects/${projectId}/tasks`, headers: { cookie: bob } });
    expect(aliceTask.statusCode).toBe(200);
    expect(aliceTask.json()).toMatchObject({ id: taskId, projectId, title: "Alice private task", status: "OPEN", conversation: { messages: [{ content: "First" }, { content: "Second" }] } });
    expect(bobTask.statusCode).toBe(404);
    expect(bobTask.json()).toEqual({ error: "TASK_NOT_FOUND" });
    expect(bobList.json().map((listedTask: { id: string }) => listedTask.id)).not.toContain(taskId);
  });

  it("hides project and task access after project or team membership is revoked", async () => {
    const alice = await session(aliceId);
    const task = await app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, headers: { cookie: alice }, payload: { title: "Revocation task" } });
    const taskId = task.json().id as string;
    await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId: aliceId } } });
    const missingProject = await app.inject({ method: "GET", url: `/projects/${projectId}/tasks`, headers: { cookie: alice } });
    const missingTask = await app.inject({ method: "GET", url: `/tasks/${taskId}`, headers: { cookie: alice } });
    expect(missingProject.json()).toEqual({ error: "PROJECT_NOT_FOUND" });
    expect(missingTask.json()).toEqual({ error: "TASK_NOT_FOUND" });
    await prisma.projectMember.create({ data: { projectId, userId: aliceId } });
    await prisma.teamMembership.delete({ where: { teamId_userId: { teamId, userId: aliceId } } });
    const revokedTeam = await app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, headers: { cookie: alice }, payload: { title: "Blocked" } });
    expect(revokedTeam.statusCode).toBe(404);
    expect(revokedTeam.json()).toEqual({ error: "PROJECT_NOT_FOUND" });
  });

  it("blocks every project and task capability when team membership is lost", async () => {
    const bob = await session(bobId);
    const task = await prisma.task.create({ data: { projectId, ownerId: bobId, title: "Bob inaccessible", conversation: { create: { userId: bobId } } } });
    await prisma.teamMembership.delete({ where: { teamId_userId: { teamId, userId: bobId } } });
    try {
      const projects = await app.inject({ method: "GET", url: "/projects", headers: { cookie: bob } });
      const create = await app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, headers: { cookie: bob }, payload: { title: "Denied" } });
      const detail = await app.inject({ method: "GET", url: `/tasks/${task.id}`, headers: { cookie: bob } });
      const list = await app.inject({ method: "GET", url: `/projects/${projectId}/tasks`, headers: { cookie: bob } });
      expect(projects.json()).toEqual(expect.not.arrayContaining([expect.objectContaining({ id: projectId })]));
      expect(create.statusCode).toBe(404);
      expect(create.json()).toEqual({ error: "PROJECT_NOT_FOUND" });
      expect(detail.json()).toEqual({ error: "TASK_NOT_FOUND" });
      expect(detail.statusCode).toBe(404);
      expect(list.statusCode).toBe(404);
      expect(list.json()).toEqual({ error: "PROJECT_NOT_FOUND" });
    } finally {
      await prisma.teamMembership.create({ data: { teamId, userId: bobId, role: "MEMBER" } });
    }
  });

  it("requires authentication for every protected project and task route", async () => {
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/projects" }),
      app.inject({ method: "POST", url: `/teams/${teamId}/projects`, payload: { name: "No session" } }),
      app.inject({ method: "POST", url: `/projects/${projectId}/tasks`, payload: { title: "No session" } }),
      app.inject({ method: "GET", url: `/tasks/${id}-missing` }),
      app.inject({ method: "GET", url: `/projects/${projectId}/tasks` }),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "UNAUTHENTICATED" });
    }
  });

  it("guards detail and list reads with both membership predicates", async () => {
    const routes = await readFile(fileURLToPath(new URL("../src/modules/tasks/routes.ts", import.meta.url)), "utf8");

    expect(routes).toMatch(/project:\s*\{\s*is:\s*\{[\s\S]*members:\s*\{\s*some:\s*\{\s*userId:[\s\S]*team:\s*\{\s*is:\s*\{\s*memberships:\s*\{\s*some:/);
    expect(routes).toMatch(/database\.\$transaction[\s\S]*FOR SHARE OF p, pm, tm[\s\S]*transaction\.task\.findMany/);
  });

  it("does not authorize project or task creation once a synchronized authorization check observes revocation", async () => {
    const concurrentId = `${id}-concurrent`;
    const concurrentTeamId = `${concurrentId}-team`;
    const concurrentProjectId = `${concurrentId}-project`;
    const concurrentUserId = `${concurrentId}-user`;
    const passwordHash = await argon2.hash(password);
    await prisma.user.create({ data: { id: concurrentUserId, email: email(concurrentUserId), displayName: "Concurrent fixture", passwordHash } });
    await prisma.team.create({
      data: { id: concurrentTeamId, name: concurrentTeamId, memberships: { create: { userId: concurrentUserId, role: "TEAM_ADMIN" } } },
    });
    const projectQueryReached = deferred();
    const releaseProjectQuery = deferred();
    const lockedApp = buildApp({ database: instrumentTransactions(prisma, async () => {
      projectQueryReached.resolve();
      await releaseProjectQuery.promise;
    }, true), jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
    await lockedApp.ready();
    const login = await lockedApp.inject({ method: "POST", url: "/auth/login", payload: { email: email(concurrentUserId), password } });
    const concurrentCookie = cookie(login.headers["set-cookie"]);

    try {
      const pendingProject = lockedApp.inject({ method: "POST", url: `/teams/${concurrentTeamId}/projects`, headers: { cookie: concurrentCookie }, payload: { name: "Must not exist" } });
      let projectSettled = false;
      void pendingProject.finally(() => { projectSettled = true; });
      await awaitWithin(projectQueryReached.promise, "the project authorization lock query");
      await Promise.resolve();
      expect(projectSettled).toBe(false);
      releaseProjectQuery.resolve();
      const projectResponse = await pendingProject;
      expect(projectResponse.json()).toEqual({ error: "FORBIDDEN" });
      expect(projectResponse.statusCode).toBe(403);
      expect(await prisma.project.count({ where: { teamId: concurrentTeamId } })).toBe(0);

      await prisma.project.create({
        data: { id: concurrentProjectId, teamId: concurrentTeamId, createdById: concurrentUserId, name: "Concurrent project", members: { create: { userId: concurrentUserId } } },
      });
      const taskLockedQueryReached = deferred();
      const releaseTaskQuery = deferred();
      const taskLockedApp = buildApp({ database: instrumentTransactions(prisma, async () => {
        taskLockedQueryReached.resolve();
        await releaseTaskQuery.promise;
      }, true), jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
      await taskLockedApp.ready();
      const pendingTask = taskLockedApp.inject({ method: "POST", url: `/projects/${concurrentProjectId}/tasks`, headers: { cookie: concurrentCookie }, payload: { title: "Must not exist" } });
      let taskSettled = false;
      void pendingTask.finally(() => { taskSettled = true; });
      await awaitWithin(taskLockedQueryReached.promise, "the task authorization lock query");
      await Promise.resolve();
      expect(taskSettled).toBe(false);
      releaseTaskQuery.resolve();
      const taskResponse = await pendingTask;
      expect(taskResponse.statusCode).toBe(404);
      expect(taskResponse.json()).toEqual({ error: "PROJECT_NOT_FOUND" });
      expect(await prisma.task.count({ where: { projectId: concurrentProjectId } })).toBe(0);
      await taskLockedApp.close();
    } finally {
      await lockedApp.close();
      const cleanupPrisma = createPrismaClient(databaseUrl);
      await cleanupPrisma.team.deleteMany({ where: { id: concurrentTeamId } });
      await cleanupPrisma.user.deleteMany({ where: { id: concurrentUserId } });
      await cleanupPrisma.$disconnect();
    }
  });
});
