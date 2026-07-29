import { createPrismaClient } from "../../packages/db/src/client-factory.ts";
import { seedDemoData } from "../../packages/db/src/seed.ts";
import { resolveE2eDatabaseUrl } from "../config/e2e-database-url.mjs";

const databaseUrl = resolveE2eDatabaseUrl();

async function main() {
  const prisma = createPrismaClient(databaseUrl);
  try {
    if (process.argv[2] === "seed") {
      await seedDemoData(prisma);
    } else if (process.argv[2] === "cleanup") {
      const taskIds = (process.argv[3] ?? "").split(",").filter(Boolean);
      if (!taskIds.every((taskId) => typeof taskId === "string")) throw new Error("Task cleanup accepts only task IDs.");
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    } else {
      throw new Error("Expected seed or cleanup database command.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
