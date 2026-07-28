import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    currentUser: { userId: string; email: string } | null;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const SESSION_COOKIE_NAME = "cowork_session";

export const authPlugin = fp(
  async (app, options: { jwtSecret: string }) => {
    await app.register(cookie);
    await app.register(jwt, {
      secret: options.jwtSecret,
      cookie: { cookieName: SESSION_COOKIE_NAME, signed: false },
    });

    app.decorateRequest("currentUser", null);
    app.decorate("authenticate", async (request, reply) => {
      try {
        const token = await request.jwtVerify<{ userId?: unknown; email?: unknown }>({ onlyCookie: true });
        if (typeof token.userId !== "string" || typeof token.email !== "string") throw new Error("Invalid token");
        request.currentUser = { userId: token.userId, email: token.email };
      } catch {
        void reply.code(401).send({ error: "UNAUTHENTICATED" });
      }
    });
  },
  { name: "cowork-auth" },
);
