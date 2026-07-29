import assert from "node:assert/strict";
import test from "node:test";

import { resolveE2eDatabaseUrl } from "./e2e-database-url.mjs";

test("requires an explicit E2E or test database URL", () => {
  assert.throws(() => resolveE2eDatabaseUrl({}), /E2E_DATABASE_URL or TEST_DATABASE_URL/);
});

test("rejects an E2E database that is the development database", () => {
  assert.throws(() => resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://user:password@db.example:5432/cowork", TEST_DATABASE_URL: "postgresql://user:password@db.example:5432/cowork" }), /separate E2E_DATABASE_URL/);
});

test("normalizes credentials, query strings, and PostgreSQL default ports before comparing", () => {
  assert.throws(() => resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://developer:one@db.example/cowork?sslmode=require", E2E_DATABASE_URL: "postgresql://tester:two@db.example:5432/cowork?application_name=e2e" }), /separate E2E_DATABASE_URL/);
});

test("rejects the development database name through localhost aliases", () => {
  assert.throws(() => resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://developer:password@localhost:5432/cowork", E2E_DATABASE_URL: "postgresql://tester:password@127.0.0.1:5432/cowork" }), /separate E2E_DATABASE_URL/);
  assert.throws(() => resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://developer:password@[::1]:5432/cowork", E2E_DATABASE_URL: "postgresql://tester:password@db.internal:5432/cowork/" }), /separate E2E_DATABASE_URL/);
});

test("accepts a distinct E2E database name across hosts", () => {
  assert.equal(resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://developer:password@localhost:5432/cowork", E2E_DATABASE_URL: "postgresql://tester:password@db.internal:5432/cowork_e2e" }), "postgresql://tester:password@db.internal:5432/cowork_e2e");
});

test("accepts a separate PostgreSQL database", () => {
  assert.equal(resolveE2eDatabaseUrl({ DATABASE_URL: "postgresql://developer:password@db.example:5432/cowork", E2E_DATABASE_URL: "postgresql://tester:password@db.example:5432/cowork_e2e" }), "postgresql://tester:password@db.example:5432/cowork_e2e");
});

test("prefers E2E_DATABASE_URL over TEST_DATABASE_URL", () => {
  assert.equal(resolveE2eDatabaseUrl({ TEST_DATABASE_URL: "postgresql://tester:password@db.example:5432/old_test", E2E_DATABASE_URL: "postgresql://tester:password@db.example:5432/e2e" }), "postgresql://tester:password@db.example:5432/e2e");
});
