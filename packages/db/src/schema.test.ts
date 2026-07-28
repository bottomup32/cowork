import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

import { createPrismaClient } from './client-factory.js';
import { MessageRole } from './generated/client.js';
import { DEMO_PROJECT_ID, DEMO_TEAM_ID, DEMO_USER_ALICE_ID, DEMO_USER_BOB_ID, seedDemoData } from './seed.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for database integration tests');
}

const identifier = randomUUID();
const email = `schema-${identifier}@example.com`;
const teamName = `Schema Team ${identifier}`;
const sentinelEmail = `seed-sentinel-${identifier}@example.com`;
const sentinelId = `seed-sentinel-${identifier}`;
const unrelatedTeamId = `unrelated-team-${identifier}`;
const prisma = createPrismaClient(testDatabaseUrl);

describe('team, project, task, and conversation persistence', () => {
  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { team: { name: teamName } } });
    await prisma.projectMember.deleteMany({ where: { project: { team: { name: teamName } } } });
    await prisma.message.deleteMany({ where: { conversation: { task: { project: { team: { name: teamName } } } } } });
    await prisma.conversation.deleteMany({ where: { task: { project: { team: { name: teamName } } } } });
    await prisma.task.deleteMany({ where: { project: { team: { name: teamName } } } });
    await prisma.project.deleteMany({ where: { team: { name: teamName } } });
    await prisma.team.deleteMany({ where: { name: teamName } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.project.deleteMany({ where: { id: DEMO_PROJECT_ID } });
    await prisma.team.deleteMany({ where: { id: { in: [DEMO_TEAM_ID, unrelatedTeamId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [DEMO_USER_ALICE_ID, DEMO_USER_BOB_ID, sentinelId] } } });
    await prisma.$disconnect();
  });

  it('persists a team admin, project member, private task, and its conversation', async () => {
    expect(MessageRole.USER).toBe('USER');

    const user = await prisma.user.create({
      data: { email, displayName: 'Schema User', passwordHash: 'hash' },
    });
    const team = await prisma.team.create({
      data: { name: teamName, memberships: { create: { userId: user.id, role: 'TEAM_ADMIN' } } },
    });
    const project = await prisma.project.create({
      data: {
        teamId: team.id,
        createdById: user.id,
        name: 'Schema Project',
        members: { create: { userId: user.id } },
      },
    });
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        ownerId: user.id,
        title: 'Private task',
        conversation: { create: { userId: user.id } },
      },
      include: { conversation: true },
    });

    const membership = await prisma.teamMembership.findUniqueOrThrow({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
    });
    const projectMember = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });

    expect(membership.role).toBe('TEAM_ADMIN');
    expect(projectMember.userId).toBe(user.id);
    expect(task.conversation?.userId).toBe(user.id);
  });

  it('seeds demo data idempotently without deleting unrelated rows', async () => {
    await prisma.user.create({
      data: { id: sentinelId, email: sentinelEmail, displayName: 'Seed Sentinel', passwordHash: 'hash' },
    });
    await prisma.team.create({ data: { id: unrelatedTeamId, name: 'Demo Accounting' } });

    await seedDemoData(prisma);
    await seedDemoData(prisma);

    expect(await prisma.user.count({ where: { id: sentinelId } })).toBe(1);
    expect(await prisma.team.count({ where: { id: unrelatedTeamId } })).toBe(1);
    expect(await prisma.team.count({ where: { id: DEMO_TEAM_ID } })).toBe(1);
    expect(await prisma.project.count({ where: { id: DEMO_PROJECT_ID } })).toBe(1);
    expect(await prisma.user.count({ where: { id: { in: [DEMO_USER_ALICE_ID, DEMO_USER_BOB_ID] } } })).toBe(2);
  });
});
