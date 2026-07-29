import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { CodexSdkAgent } from "./modules/agent/codex-agent.js";

const config = readConfig();
const { prisma } = await import("@cowork/db");
const app = buildApp({
  database: prisma,
  jwtSecret: config.JWT_SECRET,
  webOrigin: config.WEB_ORIGIN,
  ...(config.CODEX_AGENT_MODE === "codex" ? { agent: new CodexSdkAgent(undefined, config.CODEX_MODEL ? { model: config.CODEX_MODEL } : {}) } : {}),
});

await app.listen({ host: config.API_HOST, port: config.API_PORT });
