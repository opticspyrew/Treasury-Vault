// Unit tests for the link-or-create logic in src/lib/social-oauth.ts.
//
// We mock the entire @workspace/db module so the tested function runs against
// an in-memory fake instead of the real Drizzle/Postgres stack.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";

type Row = Record<string, any>;

interface FakeDbState {
  users: Row[];
  providerIdentities: Row[];
  nextUserId: number;
  nextLinkId: number;
}

let state: FakeDbState;

function resetState() {
  state = { users: [], providerIdentities: [], nextUserId: 1, nextLinkId: 1 };
}

// A tiny query builder that mirrors just enough of Drizzle's chained API for
// the calls social-oauth.ts actually makes.
function makeDb() {
  type Predicate = (row: Row) => boolean;

  function select(_cols?: any) {
    return {
      from(table: { __name: "users" | "providerIdentities" }) {
        return {
          where(pred: Predicate) {
            const rows = state[table.__name].filter(pred);
            return {
              limit(_n: number) {
                return Promise.resolve(rows.slice(0, _n));
              },
              // Allow awaiting without .limit():
              then(resolve: any, reject: any) {
                return Promise.resolve(rows).then(resolve, reject);
              },
            };
          },
        };
      },
    };
  }

  function insert(table: { __name: "users" | "providerIdentities" }) {
    return {
      values(vals: Row | Row[]) {
        const arr = Array.isArray(vals) ? vals : [vals];
        const inserted = arr.map((v) => {
          if (table.__name === "users") {
            const row = {
              id: state.nextUserId++,
              passwordHash: null,
              passwordSalt: null,
              passwordIterations: null,
              kycStatus: "none",
              balanceBtc: 26.1683,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...v,
            };
            state.users.push(row);
            return row;
          } else {
            const row = {
              id: state.nextLinkId++,
              linkedAt: new Date(),
              ...v,
            };
            state.providerIdentities.push(row);
            return row;
          }
        });
        const builder = {
          returning() {
            return Promise.resolve(inserted);
          },
          then(resolve: any, reject: any) {
            return Promise.resolve(undefined).then(resolve, reject);
          },
        };
        return builder;
      },
    };
  }

  return { select, insert };
}

// Column proxies — the real social-oauth code calls eq(users.email, ...) and
// eq(providerIdentities.provider, ...). Our eq/and just need to return a
// predicate that operates on rows.
const usersTable: any = {
  __name: "users",
  id: { __col: "id" },
  email: { __col: "email" },
};
const providerIdentitiesTable: any = {
  __name: "providerIdentities",
  id: { __col: "id" },
  userId: { __col: "userId" },
  provider: { __col: "provider" },
  providerUserId: { __col: "providerUserId" },
};

function eq(col: { __col: string }, val: unknown) {
  return { kind: "eq" as const, col: col.__col, val };
}
function and(...preds: Array<{ kind: "eq"; col: string; val: unknown }>) {
  return { kind: "and" as const, preds };
}

function buildPredicate(node: any): (row: Row) => boolean {
  if (node.kind === "eq") {
    return (row: Row) => row[node.col] === node.val;
  }
  if (node.kind === "and") {
    const fns = node.preds.map(buildPredicate);
    return (row: Row) => fns.every((f: (r: Row) => boolean) => f(row));
  }
  return () => true;
}

// Patch makeDb to interpret the predicate nodes built above.
function makeDbWithPredicates() {
  const raw = makeDb();
  const wrappedSelect = (_cols?: any) => {
    const sel = raw.select(_cols);
    return {
      from(table: any) {
        const chain = sel.from(table);
        return {
          where(predNode: any) {
            return chain.where(buildPredicate(predNode));
          },
        };
      },
    };
  };
  return {
    select: wrappedSelect,
    insert: raw.insert,
    delete(_table: any) {
      return {
        where(_predNode: any) {
          return Promise.resolve(undefined);
        },
      };
    },
  };
}

// `before` runs once. We register the module mocks then dynamically import.
let resolveUserForProviderProfile: any;
let attachProviderToExistingUser: any;

before(async () => {
  resetState();

  // Pass through the real exports so unrelated callers (e.g. auth.ts) still
  // work, but override the table symbols and the db client used by the unit
  // under test.
  const realDb: any = await import("@workspace/db");
  const realDrizzle: any = await import("drizzle-orm");

  const fakeDb = makeDbWithPredicates();

  mock.module("@workspace/db", {
    namedExports: {
      ...realDb,
      db: fakeDb,
      users: usersTable,
      providerIdentities: providerIdentitiesTable,
    },
  });

  mock.module("drizzle-orm", {
    namedExports: {
      ...realDrizzle,
      eq,
      and,
    },
  });

  const mod = await import("../src/lib/social-oauth.js");
  resolveUserForProviderProfile = mod.resolveUserForProviderProfile;
  attachProviderToExistingUser = mod.attachProviderToExistingUser;
});

test("resolveUserForProviderProfile: existing provider link wins", async () => {
  resetState();
  state.users.push({
    id: 42,
    email: "alice@example.com",
    name: "Alice",
    passwordHash: "hash",
    passwordSalt: "salt",
    passwordIterations: 1000,
  });
  state.nextUserId = 43;
  state.providerIdentities.push({
    id: 1,
    userId: 42,
    provider: "google",
    providerUserId: "g-sub-1",
    emailAtLink: "alice@example.com",
  });
  state.nextLinkId = 2;

  const user = await resolveUserForProviderProfile({
    provider: "google",
    providerUserId: "g-sub-1",
    email: "different@example.com", // ignored: link wins
    emailVerified: true,
    name: "Different Name",
  });

  assert.equal(user.id, 42);
  assert.equal(user.email, "alice@example.com");
  // No new identity row created.
  assert.equal(state.providerIdentities.length, 1);
});

test("resolveUserForProviderProfile: verified-email auto-link to existing user", async () => {
  resetState();
  state.users.push({
    id: 7,
    email: "bob@example.com",
    name: "Bob",
    passwordHash: "hash",
    passwordSalt: "salt",
    passwordIterations: 1000,
  });
  state.nextUserId = 8;

  const user = await resolveUserForProviderProfile({
    provider: "google",
    providerUserId: "g-sub-bob",
    email: "BOB@example.com", // normalized to bob@example.com
    emailVerified: true,
    name: "Bob From Google",
  });

  assert.equal(user.id, 7, "should reuse existing user, not create a new one");
  assert.equal(state.users.length, 1);
  assert.equal(state.providerIdentities.length, 1);
  assert.equal(state.providerIdentities[0].userId, 7);
  assert.equal(state.providerIdentities[0].provider, "google");
  assert.equal(state.providerIdentities[0].providerUserId, "g-sub-bob");
});

test("resolveUserForProviderProfile: unverified email does NOT auto-link", async () => {
  resetState();
  state.users.push({
    id: 9,
    email: "carol@example.com",
    name: "Carol",
    passwordHash: "hash",
    passwordSalt: "salt",
    passwordIterations: 1000,
  });
  state.nextUserId = 10;

  const user = await resolveUserForProviderProfile({
    provider: "google",
    providerUserId: "g-sub-unverified",
    email: "carol@example.com",
    emailVerified: false, // critical: no auto-link
    name: "Carol",
  });

  // Should create a brand-new account instead of linking to existing carol.
  assert.notEqual(user.id, 9);
  assert.equal(state.users.length, 2, "a new user should have been created");
});

test("resolveUserForProviderProfile: new user fallback creates user + identity", async () => {
  resetState();

  const user = await resolveUserForProviderProfile({
    provider: "google",
    providerUserId: "g-new-sub",
    email: "newbie@example.com",
    emailVerified: true,
    name: "Newbie McNew",
  });

  assert.equal(state.users.length, 1);
  assert.equal(user.email, "newbie@example.com");
  assert.equal(user.name, "Newbie McNew");
  assert.equal(state.providerIdentities.length, 1);
  assert.equal(state.providerIdentities[0].userId, user.id);
});

test("resolveUserForProviderProfile: new user name falls back to email local-part when name missing", async () => {
  resetState();

  const user = await resolveUserForProviderProfile({
    provider: "google",
    providerUserId: "g-sub-noname",
    email: "noname@example.com",
    emailVerified: true,
    name: null,
  });

  assert.equal(user.name, "noname");
});

test("attachProviderToExistingUser: blocks when identity is already linked to a different user", async () => {
  resetState();
  state.users.push({ id: 1, email: "a@example.com", name: "A" });
  state.users.push({ id: 2, email: "b@example.com", name: "B" });
  state.nextUserId = 3;
  state.providerIdentities.push({
    id: 1,
    userId: 1,
    provider: "google",
    providerUserId: "shared-sub",
    emailAtLink: "a@example.com",
  });
  state.nextLinkId = 2;

  const result = await attachProviderToExistingUser(2, {
    provider: "google",
    providerUserId: "shared-sub",
    email: "b@example.com",
    emailVerified: true,
    name: "B",
  });

  assert.deepEqual(result, { ok: false, reason: "already_linked_to_other" });
  assert.equal(state.providerIdentities.length, 1, "should NOT create a duplicate link");
});

test("attachProviderToExistingUser: returns already_linked_to_self for re-link", async () => {
  resetState();
  state.users.push({ id: 5, email: "x@example.com", name: "X" });
  state.nextUserId = 6;
  state.providerIdentities.push({
    id: 1,
    userId: 5,
    provider: "google",
    providerUserId: "g-self",
    emailAtLink: "x@example.com",
  });
  state.nextLinkId = 2;

  const result = await attachProviderToExistingUser(5, {
    provider: "google",
    providerUserId: "g-self",
    email: "x@example.com",
    emailVerified: true,
    name: "X",
  });

  assert.deepEqual(result, { ok: false, reason: "already_linked_to_self" });
});

test("attachProviderToExistingUser: succeeds when identity is unused", async () => {
  resetState();
  state.users.push({ id: 11, email: "u@example.com", name: "U" });
  state.nextUserId = 12;

  const result = await attachProviderToExistingUser(11, {
    provider: "google",
    providerUserId: "g-fresh",
    email: "u@example.com",
    emailVerified: true,
    name: "U",
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(state.providerIdentities.length, 1);
  assert.equal(state.providerIdentities[0].userId, 11);
});
