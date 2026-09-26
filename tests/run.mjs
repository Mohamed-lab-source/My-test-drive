// Orchestrates the whole regression suite: starts a static server over the
// built public/ directory, waits for it to respond, runs every spec file in
// tests/specs/*.spec.mjs as its own Node process (each one exits 0 or 1),
// then tears the server down and reports a summary. Run via `npm test`
// (which builds first) or directly with `node tests/run.mjs` if public/ is
// already built.

import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const PORT = process.env.TEST_PORT || "8123";
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) reject(new Error(`Server at ${url} never came up`));
          else setTimeout(tryOnce, 200);
        });
    };
    tryOnce();
  });
}

async function main() {
  const server = spawn("npx", ["http-server", "public", "-p", PORT, "-c-1"], {
    cwd: rootDir,
    stdio: "ignore",
  });

  const specsDir = path.join(__dirname, "specs");
  const specFiles = readdirSync(specsDir)
    .filter((f) => f.endsWith(".spec.mjs"))
    .sort();

  let allPassed = true;
  try {
    await waitForServer(`${BASE_URL}/index.html`, 15000);

    for (const file of specFiles) {
      console.log(`\n--- ${file} ---`);
      const result = spawnSync("node", [path.join(specsDir, file)], {
        cwd: rootDir,
        stdio: "inherit",
        env: { ...process.env, TEST_BASE_URL: BASE_URL },
      });
      if (result.status !== 0) allPassed = false;
    }
  } finally {
    server.kill();
  }

  console.log(allPassed ? "\n=== ALL SPECS PASSED ===" : "\n=== ONE OR MORE SPECS FAILED ===");
  process.exit(allPassed ? 0 : 1);
}

main();
