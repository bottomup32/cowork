import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { createPrismaClient, MessageRole } from './client.js';
import { seedDemoData } from './seed.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for database integration tests');
}

const identifier = randomUUID();
const email = `schema-${identifier}@example.com`;
const teamName = `Schema Team ${identifier}`;
const sentinelEmail = `seed-sentinel-${identifier}@example.com`;
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
    const demoTeam = await prisma.team.findFirst({ where: { name: 'Demo Accounting' } });
    if (demoTeam) {
      await prisma.team.delete({ where: { id: demoTeam.id } });
    }
    await prisma.user.deleteMany({ where: { email: { in: ['alice@example.com', 'bob@example.com', sentinelEmail] } } });
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
      data: { email: sentinelEmail, displayName: 'Seed Sentinel', passwordHash: 'hash' },
    });

    await seedDemoData(prisma);
    await seedDemoData(prisma);

    expect(await prisma.user.count({ where: { email: sentinelEmail } })).toBe(1);
    expect(await prisma.user.count({ where: { email: { in: ['alice@example.com', 'bob@example.com'] } } })).toBe(2);
    expect(await prisma.team.count({ where: { name: 'Demo Accounting' } })).toBe(1);
    expect(await prisma.project.count({ where: { name: 'Client Operations' } })).toBe(1);
  });
});
