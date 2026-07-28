import argon2 from 'argon2';

import { prisma } from './client.js';

async function main() {
  const passwordHash = await argon2.hash('CoworkDemo123!');

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();

  const team = await prisma.team.create({
    data: {
      name: 'Demo Accounting',
      memberships: {
        create: [
          {
            role: 'TEAM_ADMIN',
            user: {
              create: {
                email: 'alice@example.com',
                displayName: 'Alice',
                passwordHash,
              },
            },
          },
          {
            role: 'MEMBER',
            user: {
              create: {
                email: 'bob@example.com',
                displayName: 'Bob',
                passwordHash,
              },
            },
          },
        ],
      },
    },
    include: { memberships: true },
  });

  const [alice, bob] = team.memberships.sort((left, right) =>
    left.role === 'TEAM_ADMIN' ? -1 : right.role === 'TEAM_ADMIN' ? 1 : 0,
  );

  if (!alice || !bob) {
    throw new Error('Expected seeded Alice and Bob memberships');
  }

  await prisma.project.create({
    data: {
      teamId: team.id,
      createdById: alice.userId,
      name: 'Client Operations',
      members: { create: [{ userId: alice.userId }, { userId: bob.userId }] },
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
