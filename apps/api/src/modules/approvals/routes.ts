import { decideApprovalInputSchema, requestApprovalInputSchema } from "@cowork/contracts";
import type { PrismaClient } from "@cowork/db";
import { classifyAction } from "@cowork/domain";
import type { FastifyInstance } from "fastify";

export type ApprovalDatabase = Pick<PrismaClient, "task" | "teamMembership" | "approvalRequest" | "auditEvent" | "$transaction">;

const json = (value: unknown) => JSON.parse(JSON.stringify(value));

const approvalSelect = {
  id: true, taskId: true, teamId: true, service: true, action: true, summary: true,
  payload: true, risk: true, status: true, note: true, createdAt: true, decidedAt: true,
} as const;

export function registerApprovalRoutes(app: FastifyInstance, database: ApprovalDatabase) {
  app.post("/tasks/:taskId/approvals", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const parsed = requestApprovalInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const taskId = (request.params as { taskId: string }).taskId;
    const task = await database.task.findFirst({
      where: { id: taskId, ownerId: user.userId, project: { members: { some: { userId: user.userId } }, team: { memberships: { some: { userId: user.userId } } } } },
      select: { id: true, project: { select: { teamId: true } } },
    });
    if (!task) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
    const risk = classifyAction(parsed.data.action);
    if (risk === "READ") {
      await database.auditEvent.create({ data: { teamId: task.project.teamId, taskId, actorId: user.userId, eventType: "ACTION_READ_ALLOWED", subjectType: "external_action", subjectId: parsed.data.action, metadata: { service: parsed.data.service, summary: parsed.data.summary } } });
      return { requiresApproval: false, risk };
    }
    const approval = await database.$transaction(async (transaction) => {
      const created = await transaction.approvalRequest.create({
        data: { teamId: task.project.teamId, taskId, requestedById: user.userId, service: parsed.data.service, action: parsed.data.action, summary: parsed.data.summary, payload: json(parsed.data.payload), risk },
        select: approvalSelect,
      });
      await transaction.auditEvent.create({ data: { teamId: task.project.teamId, taskId, actorId: user.userId, eventType: "APPROVAL_REQUESTED", subjectType: "approval", subjectId: created.id, metadata: { service: created.service, action: created.action, risk } } });
      return created;
    });
    return reply.code(201).send({ ...approval, requiresApproval: true });
  });

  app.get("/approvals", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const memberships = await database.teamMembership.findMany({ where: { userId: user.userId }, select: { teamId: true, role: true } });
    const adminTeamIds = memberships.filter((item) => item.role === "TEAM_ADMIN").map((item) => item.teamId);
    const [mine, pending] = await Promise.all([
      database.approvalRequest.findMany({ where: { requestedById: user.userId }, select: approvalSelect, orderBy: { createdAt: "desc" } }),
      adminTeamIds.length ? database.approvalRequest.findMany({ where: { teamId: { in: adminTeamIds }, status: "PENDING" }, select: { ...approvalSelect, requestedBy: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    ]);
    return { mine, pending };
  });

  app.post("/approvals/:approvalId", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const parsed = decideApprovalInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const approvalId = (request.params as { approvalId: string }).approvalId;
    const approval = await database.approvalRequest.findUnique({ where: { id: approvalId }, select: { id: true, teamId: true, taskId: true, status: true } });
    if (!approval || approval.status !== "PENDING") return reply.code(404).send({ error: "APPROVAL_NOT_FOUND" });
    const member = await database.teamMembership.findUnique({ where: { teamId_userId: { teamId: approval.teamId, userId: user.userId } }, select: { role: true } });
    if (member?.role !== "TEAM_ADMIN") return reply.code(403).send({ error: "FORBIDDEN" });
    const status = parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await database.$transaction(async (transaction) => {
      await transaction.approvalRequest.update({ where: { id: approval.id }, data: { status, decidedById: user.userId, decidedAt: new Date(), ...(parsed.data.note === undefined ? {} : { note: parsed.data.note }) } });
      await transaction.auditEvent.create({ data: { teamId: approval.teamId, taskId: approval.taskId, actorId: user.userId, eventType: `APPROVAL_${status}`, subjectType: "approval", subjectId: approval.id, metadata: {} } });
    });
    return { status };
  });
}
