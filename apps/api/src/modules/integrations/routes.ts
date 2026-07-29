import type { FastifyInstance } from "fastify";
import type { IntegrationPort, IntegrationProvider } from "./service.js";

export function registerIntegrationRoutes(app: FastifyInstance, integrations: IntegrationPort) {
  app.get("/integrations", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.currentUser) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    return integrations.status();
  });

  app.post("/integrations/:provider/connect", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const provider = (request.params as { provider: string }).provider;
    if (provider !== "google" && provider !== "notion") return reply.code(404).send({ error: "INTEGRATION_NOT_FOUND" });
    try { return await integrations.connect(provider as IntegrationProvider, user.userId); }
    catch { return reply.code(503).send({ error: "INTEGRATION_NOT_CONFIGURED" }); }
  });

  app.get("/integrations/notion/search", { preHandler: app.authenticate }, async (request, reply) => {
    if (!request.currentUser) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const query = (request.query as { q?: string }).q?.trim();
    if (!query) return reply.code(400).send({ error: "QUERY_REQUIRED" });
    try { return await integrations.searchNotion(query); }
    catch { return reply.code(503).send({ error: "NOTION_NOT_CONFIGURED" }); }
  });
}
