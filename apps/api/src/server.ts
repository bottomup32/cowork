import { buildApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const app = buildApp();

await app.listen({ host: config.API_HOST, port: config.API_PORT });
