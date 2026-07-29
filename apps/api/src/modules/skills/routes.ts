import { createSkillInputSchema, reviewSkillInputSchema, reviseSkillInputSchema, type TeamRole } from "@cowork/contracts";
import type { PrismaClient } from "@cowork/db";
import { canCreateSkill, canPublishSkill, compileSkillDraft, validateSkillDefinition, type SkillDefinition } from "@cowork/domain";
import type { FastifyInstance, FastifyReply } from "fastify";

export type SkillDatabase = Pick<PrismaClient, "teamMembership" | "skill" | "skillVersion" | "skillTestRun" | "skillReview" | "$transaction">;

const versionSelect = { id: true, version: true, status: true, definition: true, changeNote: true, createdAt: true } as const;
const publicSkillSelect = {
  id: true, teamId: true, name: true, disabledAt: true, updatedAt: true,
  activeVersion: { select: versionSelect },
} as const;

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function membership(database: SkillDatabase, teamId: string, userId: string) {
  return database.teamMembership.findUnique({ where: { teamId_userId: { teamId, userId } }, select: { role: true, team: { select: { name: true } } } });
}

function requireUser(request: { currentUser: { userId: string; email: string } | null }, reply: FastifyReply) {
  if (!request.currentUser) {
    void reply.code(401).send({ error: "UNAUTHENTICATED" });
    return null;
  }
  return request.currentUser;
}

export function registerSkillRoutes(app: FastifyInstance, database: SkillDatabase) {
  app.get("/skills", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const memberships = await database.teamMembership.findMany({ where: { userId: user.userId }, select: { teamId: true, role: true, team: { select: { name: true } } } });
    const teamIds = memberships.map((item) => item.teamId);
    const adminTeamIds = memberships.filter((item) => item.role === "TEAM_ADMIN").map((item) => item.teamId);
    const [drafts, published, reviews] = await Promise.all([
      database.skill.findMany({
        where: { createdById: user.userId },
        select: { id: true, teamId: true, name: true, updatedAt: true, versions: { orderBy: { version: "desc" }, take: 1, select: versionSelect } },
        orderBy: { updatedAt: "desc" },
      }),
      database.skill.findMany({ where: { teamId: { in: teamIds }, activeVersionId: { not: null }, disabledAt: null }, select: publicSkillSelect, orderBy: { updatedAt: "desc" } }),
      adminTeamIds.length ? database.skillReview.findMany({
        where: { status: "PENDING", skillVersion: { skill: { teamId: { in: adminTeamIds } } } },
        select: { id: true, status: true, createdAt: true, skillVersion: { select: { ...versionSelect, skill: { select: { id: true, name: true, teamId: true } } } }, requestedBy: { select: { displayName: true } } },
        orderBy: { createdAt: "asc" },
      }) : Promise.resolve([]),
    ]);
    return { memberships, drafts: drafts.map((skill) => ({ ...skill, latestVersion: skill.versions[0], versions: undefined })), published, reviews };
  });

  app.post("/teams/:teamId/skills", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const parsed = createSkillInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const teamId = (request.params as { teamId: string }).teamId;
    const member = await membership(database, teamId, user.userId);
    if (!member || !canCreateSkill(member.role as TeamRole)) return reply.code(403).send({ error: "FORBIDDEN" });
    const definition = compileSkillDraft(parsed.data.name, parsed.data.goal);
    const skill = await database.skill.create({
      data: { teamId, createdById: user.userId, name: parsed.data.name, versions: { create: { version: 1, createdById: user.userId, definition: json(definition), changeNote: "Initial conversational draft" } } },
      select: { id: true, teamId: true, name: true, versions: { take: 1, select: versionSelect } },
    });
    return reply.code(201).send({ id: skill.id, teamId: skill.teamId, name: skill.name, latestVersion: skill.versions[0] });
  });

  app.post("/skills/:skillId/versions", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const parsed = reviseSkillInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const skillId = (request.params as { skillId: string }).skillId;
    const created = await database.$transaction(async (transaction) => {
      const skill = await transaction.skill.findFirst({ where: { id: skillId, createdById: user.userId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
      if (!skill || !skill.versions[0]) return null;
      const previous = skill.versions[0].definition as unknown as SkillDefinition;
      return transaction.skillVersion.create({
        data: { skillId, createdById: user.userId, version: skill.versions[0].version + 1, definition: json(compileSkillDraft(skill.name, previous.goal, parsed.data.change)), changeNote: parsed.data.change },
        select: versionSelect,
      });
    });
    if (!created) return reply.code(404).send({ error: "SKILL_NOT_FOUND" });
    return reply.code(201).send(created);
  });

  app.post("/skill-versions/:versionId/test", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const versionId = (request.params as { versionId: string }).versionId;
    const version = await database.skillVersion.findFirst({ where: { id: versionId, skill: { createdById: user.userId } } });
    if (!version) return reply.code(404).send({ error: "SKILL_VERSION_NOT_FOUND" });
    if (version.status !== "DRAFT" && version.status !== "TESTED") return reply.code(409).send({ error: "INVALID_SKILL_STATE" });
    const errors = validateSkillDefinition(version.definition as unknown as SkillDefinition);
    const result = { externalChanges: false, mode: "DRY_RUN", validationErrors: errors, preview: "Inputs → isolated execution → output preview" };
    const run = await database.$transaction(async (transaction) => {
      const created = await transaction.skillTestRun.create({ data: { skillVersionId: version.id, createdById: user.userId, passed: errors.length === 0, result }, select: { id: true, passed: true, result: true, createdAt: true } });
      if (errors.length === 0) await transaction.skillVersion.update({ where: { id: version.id }, data: { status: "TESTED" } });
      return created;
    });
    return run;
  });

  app.post("/skill-versions/:versionId/submit", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const versionId = (request.params as { versionId: string }).versionId;
    const version = await database.skillVersion.findFirst({ where: { id: versionId, status: "TESTED", skill: { createdById: user.userId } } });
    if (!version) return reply.code(409).send({ error: "SKILL_MUST_PASS_TEST" });
    const review = await database.$transaction(async (transaction) => {
      await transaction.skillVersion.update({ where: { id: versionId }, data: { status: "REVIEW" } });
      return transaction.skillReview.create({ data: { skillVersionId: versionId, requestedById: user.userId }, select: { id: true, status: true, createdAt: true } });
    });
    return reply.code(201).send(review);
  });

  app.post("/skill-reviews/:reviewId", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const parsed = reviewSkillInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const reviewId = (request.params as { reviewId: string }).reviewId;
    const review = await database.skillReview.findUnique({ where: { id: reviewId }, include: { skillVersion: { include: { skill: true } } } });
    if (!review || review.status !== "PENDING") return reply.code(404).send({ error: "REVIEW_NOT_FOUND" });
    const member = await membership(database, review.skillVersion.skill.teamId, user.userId);
    if (!member || !canPublishSkill(member.role as TeamRole)) return reply.code(403).send({ error: "FORBIDDEN" });
    await database.$transaction(async (transaction) => {
      const approved = parsed.data.decision === "APPROVE";
      await transaction.skillReview.update({ where: { id: review.id }, data: {
        status: approved ? "APPROVED" : "REJECTED",
        ...(parsed.data.note === undefined ? {} : { note: parsed.data.note }),
        reviewedById: user.userId,
        reviewedAt: new Date(),
      } });
      await transaction.skillVersion.update({ where: { id: review.skillVersionId }, data: { status: approved ? "PUBLISHED" : "TESTED" } });
      if (approved) await transaction.skill.update({ where: { id: review.skillVersion.skillId }, data: { activeVersionId: review.skillVersionId, disabledAt: null } });
    });
    return { status: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED" };
  });

  app.post("/skills/:skillId/disable", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const skill = await database.skill.findUnique({ where: { id: (request.params as { skillId: string }).skillId }, select: { id: true, teamId: true } });
    if (!skill) return reply.code(404).send({ error: "SKILL_NOT_FOUND" });
    const member = await membership(database, skill.teamId, user.userId);
    if (!member || !canPublishSkill(member.role as TeamRole)) return reply.code(403).send({ error: "FORBIDDEN" });
    await database.skill.update({ where: { id: skill.id }, data: { activeVersionId: null, disabledAt: new Date() } });
    return reply.code(204).send();
  });

  app.post("/skills/:skillId/activate/:versionId", { preHandler: app.authenticate }, async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const params = request.params as { skillId: string; versionId: string };
    const version = await database.skillVersion.findFirst({ where: { id: params.versionId, skillId: params.skillId, status: "PUBLISHED" }, include: { skill: { select: { teamId: true } } } });
    if (!version) return reply.code(404).send({ error: "SKILL_VERSION_NOT_FOUND" });
    const member = await membership(database, version.skill.teamId, user.userId);
    if (!member || !canPublishSkill(member.role as TeamRole)) return reply.code(403).send({ error: "FORBIDDEN" });
    await database.skill.update({ where: { id: params.skillId }, data: { activeVersionId: params.versionId, disabledAt: null } });
    return reply.code(204).send();
  });
}
