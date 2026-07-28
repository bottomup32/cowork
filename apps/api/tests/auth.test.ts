import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import argon2 from "argon2";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@cowork/db/client-factory";

import { buildApp } from "../src/app.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for authentication integration tests");
}

const fixtureId = `auth-${randomUUID()}`;
const email = `${fixtureId}@example.com`;
const malformedEmail = `malformed-${fixtureId}@example.com`;
const deletedUserId = `deleted-${fixtureId}`;
const deletedUserEmail = `${deletedUserId}@example.com`;
const password = "CorrectHorseBattery1!";
const prisma = createPrismaClient(databaseUrl);
const app = buildApp({
  database: prisma,
  jwtSecret: "test-secret-that-is-longer-than-thirty-two-characters",
  webOrigin: "http://127.0.0.1:3000",
} as never);

function sessionCookie(setCookie: string | string[] | undefined) {
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookie) throw new Error("Session cookie was not set");
  return cookie.split(";", 1)[0];
}

beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: fixtureId,
      email,
      displayName: "Auth Fixture",
      passwordHash: await argon2.hash(password),
    },
  });
  await prisma.user.create({
    data: {
      id: `malformed-${fixtureId}`,
      email: malformedEmail,
      displayName: "Malformed Hash",
      passwordHash: "not-an-argon2-hash",
    },
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.user.deleteMany({ where: { id: { in: [fixtureId, `malformed-${fixtureId}`, deletedUserId] } } });
  await prisma.$disconnect();
});

describe("cookie authentication", () => {
  it("logs in with a normalized email and a secure session cookie", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: email.toUpperCase(), password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: fixtureId, email, displayName: "Auth Fixture" });
    expect(response.headers["set-cookie"]).toContain("cowork_session=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(response.headers["set-cookie"]).toContain("Path=/");
    expect(response.headers["set-cookie"]).toContain("Max-Age=28800");
    expect(response.headers["set-cookie"]).not.toContain("Secure");
  });

  it("returns identical credentials errors for a wrong password and unknown email", async () => {
    const wrongPassword = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "WrongPassword1!" } });
    const unknownEmail = await app.inject({ method: "POST", url: "/auth/login", payload: { email: `unknown-${fixtureId}@example.com`, password } });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual({ error: "INVALID_CREDENTIALS" });
    expect(unknownEmail.json()).toEqual(wrongPassword.json());
  });

  it("rejects invalid login input", async () => {
    const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "not-an-email", password: "short" } });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "INVALID_INPUT" });
  });

  it("returns the current public user only with a valid session", async () => {
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
    const authorized = await app.inject({ method: "GET", url: "/me", headers: { cookie: sessionCookie(login.headers["set-cookie"]) } });
    const unauthenticated = await app.inject({ method: "GET", url: "/me" });

    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toEqual({ id: fixtureId, email, displayName: "Auth Fixture" });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("rejects a retained session after its exact user is deleted", async () => {
    await prisma.user.create({
      data: {
        id: deletedUserId,
        email: deletedUserEmail,
        displayName: "Deleted Auth Fixture",
        passwordHash: await argon2.hash(password),
      },
    });
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: deletedUserEmail, password },
    });
    await prisma.user.delete({ where: { id: deletedUserId } });
    const response = await app.inject({
      method: "GET",
      url: "/me",
      headers: { cookie: sessionCookie(login.headers["set-cookie"]) },
    });

    expect(login.statusCode).toBe(200);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("clears the session cookie on logout", async () => {
    const response = await app.inject({ method: "POST", url: "/auth/logout" });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("cowork_session=;");
    expect(response.headers["set-cookie"]).toContain("Path=/");
  });

  it("treats a malformed stored password hash as invalid credentials", async () => {
    const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email: malformedEmail, password } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "INVALID_CREDENTIALS" });
  });
});
