// Residue guardrail: proves the test suites leave no leftover accounts.
//
// The integration suites (social-disconnect, kyc-flow, ...) create users and
// admin_clients with recognizable test emails and delete them again in their
// after() hooks. Nothing, until now, automatically guarded against that cleanup
// silently breaking — e.g. a new endpoint creating an untracked admin_client,
// or an after() hook that stops covering a table. This check catches that.
//
// How it works:
//   1. Count the test-pattern rows (social-%@example.com / kycflow-%@example.com)
//      in `users` and `admin_clients` BEFORE a full suite run.
//   2. Run the full api-server test suite once, in a child process.
//   3. Count the same rows AFTER the run.
//   4. Assert no category grew. If a suite stopped cleaning up after itself,
//      the after-count exceeds the before-count and this fails loudly.
//
// This file is deliberately named `*.guard.mjs` (not `*.test.mjs`) so the
// default `pnpm test` glob never picks it up — otherwise spawning `pnpm test`
// from inside it would recurse forever. Run it explicitly with
// `pnpm --filter @workspace/api-server test:guard`. It must run as its own
// invocation (not alongside the other suites) because the default runner
// executes test files in parallel subprocesses, which would create and delete
// these rows concurrently and make the before/after counts non-deterministic.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "@workspace/db";

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The email prefixes the tracked suites use for the accounts they create.
// social-disconnect.test.mjs -> social-<rnd>@example.com
// kyc-flow.test.mjs          -> kycflow-<rnd>@example.com
const PATTERNS = [
  "social-%@example.com",
  "kycflow-%@example.com",
  "intake-amt-%@example.com",
  "recovery-flow-%@example.com",
];
const TABLES = ["users", "admin_clients"];

// Returns a map like { "users|social-%@example.com": 3, ... } so each
// (table, pattern) category can be compared independently.
async function countResidue() {
  const counts = {};
  for (const table of TABLES) {
    for (const pattern of PATTERNS) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM ${table} WHERE email LIKE $1`,
        [pattern],
      );
      counts[`${table}|${pattern}`] = rows[0].n;
    }
  }
  return counts;
}

before(async () => {
  // Fail clearly if the DB isn't reachable rather than emitting a confusing
  // count error mid-test.
  await pool.query("SELECT 1");
});

test("the full test suite leaves no leftover test accounts", async () => {
  const before = await countResidue();

  // Run the full api-server suite (the default `test` script, which excludes
  // this guard file). stdio is inherited so the child's output is visible.
  //
  // NODE_TEST_CONTEXT must be stripped: the node:test runner sets it for
  // processes it spawns, and if the child `node --test` sees it inherited it
  // assumes it's a nested runner and SKIPS executing the test files entirely
  // ("run() is being called recursively"). That would make the child a no-op
  // and turn this guardrail into a false pass.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync("pnpm", ["test"], {
    cwd: PACKAGE_DIR,
    stdio: "inherit",
    env: childEnv,
  });

  assert.equal(
    result.status,
    0,
    "the test suite must pass before residue can be meaningfully checked",
  );

  const after = await countResidue();

  const grew = [];
  for (const key of Object.keys(after)) {
    if (after[key] > before[key]) {
      grew.push(`${key}: ${before[key]} -> ${after[key]} (+${after[key] - before[key]})`);
    }
  }

  assert.deepEqual(
    grew,
    [],
    grew.length > 0
      ? `A test suite stopped cleaning up after itself — leftover test accounts:\n  ${grew.join("\n  ")}`
      : "no residue",
  );
});
