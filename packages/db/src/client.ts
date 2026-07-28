import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

import { createPrismaClient } from './client-factory.js';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export * from './client-factory.js';
export * from './generated/client.js';

export const prisma = createPrismaClient(connectionString);
