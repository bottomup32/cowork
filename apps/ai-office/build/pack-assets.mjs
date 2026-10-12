// assets/**/*.glb → assets/models.json ({ "furniture/desk.glb": "<base64>", ... })
// 아티팩트/정적 호스팅이 .glb를 서빙하지 않아도 되도록 하나의 JSON 팩으로 묶는다.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
const root = new URL("../assets/", import.meta.url).pathname;
const out = {}; let total = 0;
function walk(dir) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith(".glb") && !n.startsWith("RobotExpressive")) { const buf = readFileSync(p); out[relative(root, p).replace(/\\/g, "/")] = buf.toString("base64"); total += buf.length; } } }
walk(root);
writeFileSync(join(root, "models.json"), JSON.stringify(out));
console.log(Object.keys(out).length, "models,", (total / 1024).toFixed(0), "KB raw →", (statSync(join(root, "models.json")).size / 1024).toFixed(0), "KB json");
