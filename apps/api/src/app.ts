import Fastify from "fastify";
import cors from "@fastify/cors";

import { authPlugin } from "./plugins/auth.js";
import { registerAuthRoutes, type AuthDatabase } from "./modules/auth/routes.js";
import { registerProjectRoutes, type ProjectDatabase } from "./modules/projects/routes.js";
import { registerTaskRoutes, type TaskDatabase } from "./modules/tasks/routes.js";

export type AppDatabase = AuthDatabase & ProjectDatabase & TaskDatabase;

export interface BuildAppOptions {
  database?: AppDatabase;
  jwtSecret?: string;
  webOrigin?: string;
}

const unavailableDatabase = new Proxy({}, { get: () => new Proxy({}, { get: () => () => { throw new Error("Database is required for application routes"); } }) }) as AppDatabase;

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });

  void app.register(cors, { origin: options.webOrigin ?? "http://127.0.0.1:3000", credentials: true });
  void app.register(authPlugin, {
    jwtSecret: options.jwtSecret ?? "development-only-secret-must-be-replaced",
  });

  app.get("/health", () => ({ status: "ok", service: "api" }));
  void app.register((instance, _options, done) => {
    registerAuthRoutes(instance, options.database ?? unavailableDatabase);
    registerProjectRoutes(instance, options.database ?? unavailableDatabase);
    registerTaskRoutes(instance, options.database ?? unavailableDatabase);
    done();
  });

  return app;
}
