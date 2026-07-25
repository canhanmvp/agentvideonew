import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function parseEnvFile(path) {
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/**
 * Load project-local secrets without adding a dotenv dependency.
 * Shell variables always win. `.env` is preferred; `.env.local` remains a
 * compatibility fallback for developer machines and is already gitignored.
 */
export function loadProjectEnv(startDir = process.cwd(), maxParents = 5) {
  let dir = resolve(startDir);
  for (let i = 0; i < maxParents; i++) {
    for (const filename of [".env", ".env.local"]) {
      const path = join(dir, filename);
      if (existsSync(path)) {
        parseEnvFile(path);
        return path;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
