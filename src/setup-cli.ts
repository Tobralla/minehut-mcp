import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cliPath = require.resolve("playwright/cli.js");

const res = spawnSync(process.execPath, [cliPath, "install", "chromium"], {
  stdio: "inherit",
});
process.exit(res.status ?? 1);