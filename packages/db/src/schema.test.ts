import { afterAll, describe, expect, it } from 'vitest';

import { MessageRole, prisma } from './client.js';

describe('team, project, task, and conversation persistence', () => {
  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { team: { name: 'Schema Team' } } });
    await prisma.projectMember.deleteMany({ where: { project: { team: { name: 'Schema Team' } } } });
    await prisma.message.deleteMany({ where: { conversation: { task: { project: { team: { name: 'Schema Team' } } } } } });
    await prisma.conversation.deleteMany({ where: { task: { project: { team: { name: 'Schema Team' } } } } });
    await prisma.task.deleteMany({ where: { project: { team: { name: 'Schema Team' } } } });
    await prisma.project.deleteMany({ where: { team: { name: 'Schema Team' } } });
    await prisma.team.deleteMany({ where: { name: 'Schema Team' } });
    await prisma.user.deleteMany({ where: { email: 'schema@example.com' } });
    await prisma.$disconnect();
  });

  it('persists a team admin, project member, private task, and its conversation', async () => {
    expect(MessageRole.USER).toBe('USER');

    const user = await prisma.user.create({
      data: { email: 'schema@example.com', displayName: 'Schema User', passwordHash: 'hash' },
    });
    const team = await prisma.team.create({
      data: { name: 'Schema Team', memberships: { create: { userId: user.id, role: 'TEAM_ADMIN' } } },
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
});
