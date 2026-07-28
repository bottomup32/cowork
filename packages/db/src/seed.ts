import argon2 from 'argon2';
import { pathToFileURL } from 'node:url';

import type { PrismaClient } from './generated/client.js';

export const DEMO_USER_ALICE_ID = 'demo-user-alice';
export const DEMO_USER_BOB_ID = 'demo-user-bob';
export const DEMO_TEAM_ID = 'demo-team-accounting';
export const DEMO_PROJECT_ID = 'demo-project-client-operations';

export async function seedDemoData(client: PrismaClient) {
  const passwordHash = await argon2.hash('CoworkDemo123!');

  await client.$transaction(async (tx) => {
    const alice = await tx.user.upsert({
      where: { id: DEMO_USER_ALICE_ID },
      create: { id: DEMO_USER_ALICE_ID, email: 'alice@example.com', displayName: 'Alice', passwordHash },
      update: { displayName: 'Alice', passwordHash },
    });
    const bob = await tx.user.upsert({
      where: { id: DEMO_USER_BOB_ID },
      create: { id: DEMO_USER_BOB_ID, email: 'bob@example.com', displayName: 'Bob', passwordHash },
      update: { displayName: 'Bob', passwordHash },
    });
    const team = await tx.team.upsert({
      where: { id: DEMO_TEAM_ID },
      create: { id: DEMO_TEAM_ID, name: 'Demo Accounting' },
      update: { name: 'Demo Accounting' },
    });

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

    const project = await tx.project.upsert({
      where: { id: DEMO_PROJECT_ID },
      create: { id: DEMO_PROJECT_ID, teamId: team.id, createdById: alice.id, name: 'Client Operations' },
      update: { teamId: team.id, createdById: alice.id, name: 'Client Operations' },
    });

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
  const { prisma } = await import('./client.js');
  await seedDemoData(prisma);
  await prisma.$disconnect();
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
}
