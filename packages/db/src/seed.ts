import argon2 from 'argon2';
import { pathToFileURL } from 'node:url';

import { PrismaClient, prisma } from './client.js';

export async function seedDemoData(client: PrismaClient) {
  const passwordHash = await argon2.hash('CoworkDemo123!');

  await client.$transaction(async (tx) => {
    const alice = await tx.user.upsert({
      where: { email: 'alice@example.com' },
      create: { email: 'alice@example.com', displayName: 'Alice', passwordHash },
      update: { displayName: 'Alice', passwordHash },
    });
    const bob = await tx.user.upsert({
      where: { email: 'bob@example.com' },
      create: { email: 'bob@example.com', displayName: 'Bob', passwordHash },
      update: { displayName: 'Bob', passwordHash },
    });
    const team =
      (await tx.team.findFirst({ where: { name: 'Demo Accounting' } })) ??
      (await tx.team.create({ data: { name: 'Demo Accounting' } }));

    await tx.teamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: alice.id } },
      create: { teamId: team.id, userId: alice.id, role: 'TEAM_ADMIN' },
      update: { role: 'TEAM_ADMIN' },
    });
    await tx.teamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: bob.id } },
      create: { teamId: team.id, userId: bob.id, role: 'MEMBER' },
      update: { role: 'MEMBER' },
    });

    const project =
      (await tx.project.findFirst({ where: { teamId: team.id, name: 'Client Operations' } })) ??
      (await tx.project.create({
        data: { teamId: team.id, createdById: alice.id, name: 'Client Operations' },
      }));

    for (const userId of [alice.id, bob.id]) {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId } },
        create: { projectId: project.id, userId },
        update: {},
      });
    }
  });
}

async function main() {
  await seedDemoData(prisma);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
