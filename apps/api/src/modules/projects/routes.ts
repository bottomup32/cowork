import { createProjectInputSchema } from "@cowork/contracts";
import type { PrismaClient } from "@cowork/db";
import type { FastifyInstance } from "fastify";

export type ProjectDatabase = Pick<PrismaClient, "project" | "$transaction">;

const publicProject = { id: true, name: true, teamId: true, updatedAt: true } as const;

export function registerProjectRoutes(app: FastifyInstance, database: ProjectDatabase) {
  app.get("/projects", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });

    return database.project.findMany({
      where: { members: { some: { userId: user.userId } }, team: { memberships: { some: { userId: user.userId } } } },
      select: publicProject,
      orderBy: { updatedAt: "desc" },
    });
  });

  app.post("/teams/:teamId/projects", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const parsed = createProjectInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });

    const teamId = (request.params as { teamId: string }).teamId;
    const project = await database.$transaction(async (transaction) => {
      const memberships = await transaction.$queryRaw<Array<{ role: string }>>`
        SELECT "role" FROM "TeamMembership"
        WHERE "teamId" = ${teamId} AND "userId" = ${user.userId}
        FOR UPDATE
      `;
      if (memberships[0]?.role !== "TEAM_ADMIN") return null;

      return transaction.project.create({
        data: { teamId, name: parsed.data.name, createdById: user.userId, members: { create: { userId: user.userId } } },
        select: publicProject,
      });
    });
    if (!project) return reply.code(403).send({ error: "FORBIDDEN" });
    return reply.code(201).send(project);
  });
}
