import { createTaskInputSchema } from "@cowork/contracts";
import type { PrismaClient } from "@cowork/db";
import type { FastifyInstance } from "fastify";

export type TaskDatabase = Pick<PrismaClient, "project" | "task" | "$transaction">;

const publicTask = { id: true, projectId: true, title: true, status: true } as const;

async function accessibleProject(database: TaskDatabase, projectId: string, userId: string) {
  return database.project.findFirst({
    where: { id: projectId, members: { some: { userId } }, team: { memberships: { some: { userId } } } },
    select: { id: true },
  });
}

export function registerTaskRoutes(app: FastifyInstance, database: TaskDatabase) {
  app.post("/projects/:projectId/tasks", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const parsed = createTaskInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const projectId = (request.params as { projectId: string }).projectId;
    const task = await database.$transaction(async (transaction) => {
      const projects = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT p."id"
        FROM "Project" AS p
        JOIN "ProjectMember" AS pm ON pm."projectId" = p."id" AND pm."userId" = ${user.userId}
        JOIN "TeamMembership" AS tm ON tm."teamId" = p."teamId" AND tm."userId" = ${user.userId}
        WHERE p."id" = ${projectId}
        FOR UPDATE OF p, pm, tm
      `;
      if (!projects[0]) return null;

      return transaction.task.create({
        data: { projectId, ownerId: user.userId, title: parsed.data.title, conversation: { create: { userId: user.userId } } },
        select: publicTask,
      });
    });
    if (!task) return reply.code(404).send({ error: "PROJECT_NOT_FOUND" });
    return reply.code(201).send(task);
  });

  app.get("/projects/:projectId/tasks", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const projectId = (request.params as { projectId: string }).projectId;
    const tasks = await database.$transaction(async (transaction) => {
      const projects = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT p."id"
        FROM "Project" AS p
        JOIN "ProjectMember" AS pm ON pm."projectId" = p."id" AND pm."userId" = ${user.userId}
        JOIN "TeamMembership" AS tm ON tm."teamId" = p."teamId" AND tm."userId" = ${user.userId}
        WHERE p."id" = ${projectId}
        FOR SHARE OF p, pm, tm
      `;
      if (!projects[0]) return null;
      return transaction.task.findMany({ where: { projectId, ownerId: user.userId }, select: publicTask, orderBy: { updatedAt: "desc" } });
    });
    if (!tasks) return reply.code(404).send({ error: "PROJECT_NOT_FOUND" });
    return tasks;
  });

  app.get("/tasks/:taskId", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const taskId = (request.params as { taskId: string }).taskId;
    const task = await database.task.findFirst({
      where: {
        id: taskId,
        ownerId: user.userId,
        project: {
          is: {
            members: { some: { userId: user.userId } },
            team: { is: { memberships: { some: { userId: user.userId } } } },
          },
        },
      },
      select: { ...publicTask, conversation: { select: { messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, createdAt: true } } } } },
    });
    if (!task) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
    return task;
  });
}
