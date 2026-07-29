import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import argon2 from "argon2";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@cowork/db/client-factory";
import { buildApp } from "../src/app.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for skill integration tests");

const prefix = `skills-${randomUUID()}`;
const ids = { admin: `${prefix}-admin`, creator: `${prefix}-creator`, member: `${prefix}-member`, team: `${prefix}-team` };
const password = "CorrectHorseBattery1!";
const prisma = createPrismaClient(databaseUrl);
const app = buildApp({ database: prisma, jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters" });

function email(id: string) { return `${id}@example.com`; }
function cookie(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) throw new Error("Missing session cookie");
  return header.split(";", 1)[0];
}
async function login(id: string) {
  const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: email(id), password } });
  return cookie(response.headers["set-cookie"]);
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password);
  await prisma.user.createMany({ data: Object.values(ids).filter((id) => id !== ids.team).map((id) => ({ id, email: email(id), displayName: id, passwordHash })) });
  await prisma.team.create({ data: { id: ids.team, name: "Skill Team", memberships: { create: [
    { userId: ids.admin, role: "TEAM_ADMIN" },
    { userId: ids.creator, role: "SKILL_CREATOR" },
    { userId: ids.member, role: "MEMBER" },
  ] } } });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.team.deleteMany({ where: { id: ids.team } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.admin, ids.creator, ids.member] } } });
  await prisma.$disconnect();
});

describe("skill studio", () => {
  it("keeps drafts private and restricts creation to creators", async () => {
    const [creator, member] = await Promise.all([login(ids.creator), login(ids.member)]);
    const created = await app.inject({ method: "POST", url: `/teams/${ids.team}/skills`, headers: { cookie: creator }, payload: { name: "Invoice review", goal: "Review invoices and create an exception report." } });
    const denied = await app.inject({ method: "POST", url: `/teams/${ids.team}/skills`, headers: { cookie: member }, payload: { name: "Denied", goal: "Must not exist" } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: "Invoice review", latestVersion: { version: 1, status: "DRAFT" } });
    expect(denied.statusCode).toBe(403);
    const memberList = await app.inject({ method: "GET", url: "/skills", headers: { cookie: member } });
    expect(memberList.json().drafts).toEqual([]);
    expect(memberList.json().published).toEqual([]);
  });

  it("tests without external changes, submits, and allows only an admin to publish", async () => {
    const [creator, admin, member] = await Promise.all([login(ids.creator), login(ids.admin), login(ids.member)]);
    const skill = await prisma.skill.findFirstOrThrow({ where: { teamId: ids.team, createdById: ids.creator }, include: { versions: true } });
    const versionId = skill.versions[0]!.id;

    const tested = await app.inject({ method: "POST", url: `/skill-versions/${versionId}/test`, headers: { cookie: creator } });
    expect(tested.json()).toMatchObject({ passed: true, result: { externalChanges: false } });
    const submitted = await app.inject({ method: "POST", url: `/skill-versions/${versionId}/submit`, headers: { cookie: creator } });
    expect(submitted.statusCode).toBe(201);
    const reviewId = submitted.json().id as string;
    const creatorApproval = await app.inject({ method: "POST", url: `/skill-reviews/${reviewId}`, headers: { cookie: creator }, payload: { decision: "APPROVE" } });
    expect(creatorApproval.statusCode).toBe(403);
    const approved = await app.inject({ method: "POST", url: `/skill-reviews/${reviewId}`, headers: { cookie: admin }, payload: { decision: "APPROVE", note: "Ready" } });
    expect(approved.statusCode).toBe(200);
    const memberList = await app.inject({ method: "GET", url: "/skills", headers: { cookie: member } });
    expect(memberList.json().published).toEqual([expect.objectContaining({ id: skill.id, activeVersion: expect.objectContaining({ id: versionId, status: "PUBLISHED" }) })]);
  });

  it("creates immutable revisions and supports admin disable and rollback", async () => {
    const [creator, admin, member] = await Promise.all([login(ids.creator), login(ids.admin), login(ids.member)]);
    const skill = await prisma.skill.findFirstOrThrow({ where: { teamId: ids.team, createdById: ids.creator }, include: { versions: { orderBy: { version: "asc" } } } });
    const original = skill.versions[0]!;
    const revised = await app.inject({ method: "POST", url: `/skills/${skill.id}/versions`, headers: { cookie: creator }, payload: { change: "Add a CSV summary." } });
    expect(revised.json()).toMatchObject({ version: 2, status: "DRAFT" });
    expect((await prisma.skillVersion.findUniqueOrThrow({ where: { id: original.id } })).definition).toEqual(original.definition);
    const disabled = await app.inject({ method: "POST", url: `/skills/${skill.id}/disable`, headers: { cookie: admin } });
    expect(disabled.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/skills", headers: { cookie: member } })).json().published).toEqual([]);
    const restored = await app.inject({ method: "POST", url: `/skills/${skill.id}/activate/${original.id}`, headers: { cookie: admin } });
    expect(restored.statusCode).toBe(204);
  });
});
