import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const configSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default("http://127.0.0.1:3000"),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
});

export type ApiConfig = z.infer<typeof configSchema>;

export function readConfig(environment = process.env): ApiConfig {
  return configSchema.parse(environment);
}
