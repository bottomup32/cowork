import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "@cowork/db/client-factory";
import { buildApp } from "../src/app.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for approval tests");
const prefix = `approval-${randomUUID()}`;
const ids = { admin: `${prefix}-admin`, member: `${prefix}-member`, team: `${prefix}-team`, project: `${prefix}-project`, task: `${prefix}-task` };
const password = "CorrectHorseBattery1!";
const prisma = createPrismaClient(databaseUrl);
const app = buildApp({ database: prisma, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });
const email = (id: string) => `${id}@example.com`;
const cookie = (header: string | string[] | undefined) => { const value = Array.isArray(header) ? header[0] : header; if (!value) throw new Error("cookie missing"); return value.split(";", 1)[0]; };
async function login(id: string) { const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: email(id), password } }); return cookie(response.headers["set-cookie"]); }

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.createMany({ data: [ids.admin, ids.member].map((id) => ({ id, email: email(id), displayName: id, passwordHash })) });
  await prisma.team.create({ data: { id: ids.team, name: "Approval Team", memberships: { create: [{ userId: ids.admin, role: "TEAM_ADMIN" }, { userId: ids.member, role: "MEMBER" }] }, projects: { create: { id: ids.project, name: "Approval project", createdById: ids.admin, members: { create: [{ userId: ids.admin }, { userId: ids.member }] }, tasks: { create: { id: ids.task, ownerId: ids.member, title: "Private task", conversation: { create: { userId: ids.member } } } } } } } });
  await app.ready();
});
afterAll(async () => { await app.close(); await prisma.team.deleteMany({ where: { id: ids.team } }); await prisma.user.deleteMany({ where: { id: { in: [ids.admin, ids.member] } } }); await prisma.$disconnect(); });

describe("risk approvals and audit", () => {
  it("audits reads, pauses risky actions, and accepts only team-admin decisions", async () => {
    const [member, admin] = await Promise.all([login(ids.member), login(ids.admin)]);
    const read = await app.inject({ method: "POST", url: `/tasks/${ids.task}/approvals`, headers: { cookie: member }, payload: { service: "notion", action: "notion.search", summary: "Search team knowledge" } });
    expect(read.json()).toEqual({ requiresApproval: false, risk: "READ" });
    const risky = await app.inject({ method: "POST", url: `/tasks/${ids.task}/approvals`, headers: { cookie: member }, payload: { service: "gmail", action: "gmail.send", summary: "Send exception report", payload: { to: "client@example.com" } } });
    expect(risky.statusCode).toBe(201);
    expect(risky.json()).toMatchObject({ requiresApproval: true, risk: "ALWAYS_APPROVE", status: "PENDING" });
    const approvalId = risky.json().id as string;
    expect((await app.inject({ method: "POST", url: `/approvals/${approvalId}`, headers: { cookie: member }, payload: { decision: "APPROVE" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: `/approvals/${approvalId}`, headers: { cookie: admin }, payload: { decision: "APPROVE" } })).json()).toEqual({ status: "APPROVED" });
    const dashboard = await app.inject({ method: "GET", url: "/approvals", headers: { cookie: member } });
    expect(dashboard.json().mine).toEqual([expect.objectContaining({ id: approvalId, status: "APPROVED" })]);
    expect(await prisma.auditEvent.count({ where: { taskId: ids.task } })).toBe(3);
  });
});
