import { buildApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const { prisma } = await import("@cowork/db");
const app = buildApp({ database: prisma, jwtSecret: config.JWT_SECRET, webOrigin: config.WEB_ORIGIN });

await app.listen({ host: config.API_HOST, port: config.API_PORT });
