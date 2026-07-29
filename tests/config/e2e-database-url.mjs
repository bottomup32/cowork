function databaseIdentity(value, requireNonMaintenance = false) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Set a separate E2E_DATABASE_URL using a PostgreSQL URL.");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("Set a separate E2E_DATABASE_URL using a PostgreSQL URL.");
  }
  const database = decodeURIComponent(parsed.pathname).replace(/^\/+|\/+$/g, "");
  if (!database || (requireNonMaintenance && ["postgres", "template0", "template1"].includes(database.toLowerCase()))) {
    throw new Error("Set a separate E2E_DATABASE_URL using a non-maintenance PostgreSQL database.");
  }
  return {
    protocol: parsed.protocol === "postgres:" ? "postgresql:" : parsed.protocol,
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    database,
  };
}

function sameDatabase(left, right) {
  return left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port && left.database === right.database;
}

export function resolveE2eDatabaseUrl(environment = process.env) {
  const databaseUrl = environment.E2E_DATABASE_URL ?? environment.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("E2E_DATABASE_URL or TEST_DATABASE_URL is required for Playwright E2E tests.");
  const candidate = databaseIdentity(databaseUrl, true);
  const development = environment.DATABASE_URL ? databaseIdentity(environment.DATABASE_URL) : undefined;
  if (development && (candidate.database === development.database || sameDatabase(candidate, development))) {
    throw new Error("Set a separate E2E_DATABASE_URL for browser tests; it must not target the development database.");
  }
  return databaseUrl;
}
