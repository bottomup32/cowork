import { loginInputSchema } from "@cowork/contracts";
import type { PrismaClient } from "@cowork/db";
import type { FastifyInstance } from "fastify";

import { SESSION_COOKIE_NAME } from "../../plugins/auth.js";
import { verifyPassword } from "./password.js";

export type AuthDatabase = Pick<PrismaClient, "user">;

const sessionDurationSeconds = 60 * 60 * 8;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: sessionDurationSeconds,
  secure: process.env.NODE_ENV === "production",
};

export function registerAuthRoutes(app: FastifyInstance, database: AuthDatabase) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });

    const email = parsed.data.email.toLowerCase();
    const user = await database.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, passwordHash: true },
    });
    const passwordMatches = await verifyPassword(user?.passwordHash, parsed.data.password);

    if (!user || !passwordMatches) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

    const token = await reply.jwtSign({ userId: user.id, email: user.email }, { expiresIn: "8h" });
    reply.setCookie(SESSION_COOKIE_NAME, token, cookieOptions);
    return { id: user.id, email: user.email, displayName: user.displayName };
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const currentUser = request.currentUser;
    if (!currentUser) return reply.code(401).send({ error: "UNAUTHENTICATED" });

    const user = await database.user.findUnique({
      where: { id: currentUser.userId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });

    return user;
  });
}
