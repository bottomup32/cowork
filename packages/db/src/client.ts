import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaPg({ connectionString });

import { PrismaClient } from './generated/client.js';

export * from './generated/client.js';

export const prisma = new PrismaClient({ adapter });
