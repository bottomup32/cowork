import Fastify from "fastify";
import cors from "@fastify/cors";

import { authPlugin } from "./plugins/auth.js";
import { registerAuthRoutes, type AuthDatabase } from "./modules/auth/routes.js";

export interface BuildAppOptions {
  database?: AuthDatabase;
  jwtSecret?: string;
  webOrigin?: string;
}

const unavailableDatabase: AuthDatabase = {
  user: {
    async findUnique() {
      throw new Error("Database is required for authentication routes");
    },
  },
} as unknown as AuthDatabase;

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  void app.register(cors, { origin: options.webOrigin ?? "http://127.0.0.1:3000", credentials: true });
  void app.register(authPlugin, {
    jwtSecret: options.jwtSecret ?? "development-only-secret-must-be-replaced",
  });

  app.get("/health", () => ({ status: "ok", service: "api" }));
  void app.register((instance, _options, done) => {
    registerAuthRoutes(instance, options.database ?? unavailableDatabase);
    done();
  });

  return app;
}
