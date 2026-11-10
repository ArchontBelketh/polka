import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { loadModule } from "./helpers/load-module.mjs"

function authFixture(record) {
  let callbacks
  loadModule("src/lib/auth.ts", { mocks: {
    "next-auth": (config) => { callbacks = config.callbacks; return {} },
    "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
    "next-auth/providers/credentials": (config) => config,
    "@/lib/db": { db: { user: { findUnique: async () => record } } },
    "@/lib/telegram-auth": {}, "@/lib/email-normalize": {},
  } })
  return callbacks
}

test("a legacy JWT is preserved only while the account remains at version zero", async () => {
  const user = { role: "DEVELOPER", isBanned: false, sessionVersion: 0 }
  const callbacks = authFixture(user)
  const token = await callbacks.jwt({ token: { id: "user-1" } })
  assert.equal(token.sessionVersion, 0)
  user.sessionVersion++
  assert.equal(await callbacks.jwt({ token: { id: "user-1" } }), null)
})

test("blocking a signed-in account immediately rejects its JWT", async () => {
  const callbacks = authFixture({ role: "DEVELOPER", isBanned: true, sessionVersion: 0 })
  assert.equal(await callbacks.jwt({ token: { id: "user-1", sessionVersion: 0 } }), null)
})

test("unblocking does not restore sessions revoked during the ban", async () => {
  const callbacks = authFixture({ role: "DEVELOPER", isBanned: false, sessionVersion: 1 })
  assert.equal(await callbacks.jwt({ token: { id: "user-1", sessionVersion: 0 } }), null)
})

test("changing the password rejects stale JWTs even for session.update", async () => {
  const callbacks = authFixture({ role: "BUYER", isBanned: false, sessionVersion: 2 })
  assert.equal(await callbacks.jwt({ token: { id: "user-1", sessionVersion: 1 }, trigger: "update" }), null)
})

test("a new login gets the current version and current role", async () => {
  const callbacks = authFixture({ role: "BUYER", isBanned: false, sessionVersion: 4 })
  const token = await callbacks.jwt({ token: {}, user: { id: "user-1", role: "ADMIN" } })
  assert.equal(token.sessionVersion, 4)
  assert.equal(token.role, "BUYER")
})

test("session access refreshes privileges from the database", async () => {
  const callbacks = authFixture({ role: "BUYER", isBanned: false, sessionVersion: 0 })
  const token = await callbacks.jwt({ token: { id: "user-1", role: "ADMIN", sessionVersion: 0 } })
  assert.equal(token.role, "BUYER")
})

test("deleted accounts cannot keep using an old JWT", async () => {
  assert.equal(await authFixture(null).jwt({ token: { id: "removed-user" } }), null)
})

test("two simultaneous password resets consume the token once and revoke sessions once", async () => {
  const token = "test-only-password-reset-token"
  const hash = crypto.createHash("sha256").update(token).digest("hex")
  let storedHash = hash
  let version = 0
  const { POST } = loadModule("src/app/api/auth/reset/route.ts", { mocks: {
    bcryptjs: { hash: async () => { await Promise.resolve(); return "test-only-password-hash" } },
    "@/lib/db": { db: { user: {
      findFirst: async () => ({ id: "user-1" }),
      updateMany: async ({ where, data }) => {
        if (where.resetTokenHash !== storedHash) return { count: 0 }
        storedHash = data.resetTokenHash
        version += data.sessionVersion.increment
        return { count: 1 }
      },
    } } },
  } })
  const req = () => new Request("http://localhost/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password: "test-only-new-password" }) })
  const responses = await Promise.all([POST(req()), POST(req())])
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400])
  assert.equal(version, 1)
  assert.equal(storedHash, null)
})

test("changing a password revokes existing sessions and clears pending reset tokens", async () => {
  let update
  const { POST } = loadModule("src/app/api/settings/password/route.ts", { mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "user-1" } }) },
    bcryptjs: { compare: async () => true, hash: async () => "new-test-only-hash" },
    "@/lib/db": { db: { user: { findUnique: async () => ({ passwordHash: "old-test-only-hash" }), updateMany: async (args) => { update = args; return { count: 1 } } } } },
  } })
  const response = await POST(new Request("http://localhost/api/settings/password", { method: "POST", body: JSON.stringify({ current: "current-password", next: "new-password" }) }))
  assert.equal(response.status, 200)
  assert.equal(update.where.passwordHash, "old-test-only-hash")
  assert.equal(update.data.sessionVersion.increment, 1)
  assert.equal(update.data.resetTokenHash, null)
  assert.equal(update.data.resetTokenExpiresAt, null)
})

test("the administrative ban endpoint revokes sessions across a subsequent unban", async () => {
  const target = { id: "user-1", role: "DEVELOPER", isBanned: false, sessionVersion: 0 }
  const callbacks = authFixture(target)
  const { PATCH } = loadModule("src/app/api/admin/users/[id]/route.ts", { mocks: {
    "@/lib/auth": { auth: async () => ({ user: { id: "admin-1" } }) },
    "@/lib/db": { db: { user: {
      findUnique: async ({ where }) => where.id === "admin-1" ? { role: "ADMIN" } : target,
      async update({ data }) { for (const [key, value] of Object.entries(data)) target[key] = value && typeof value === "object" && "increment" in value ? target[key] + value.increment : value },
    } } },
  } })
  const patch = (action) => PATCH(new Request("http://localhost/api/admin/users/user-1", { method: "PATCH", body: JSON.stringify({ action }) }), { params: Promise.resolve({ id: "user-1" }) })
  assert.equal((await patch("ban")).status, 200)
  assert.equal(target.sessionVersion, 1)
  assert.equal((await patch("unban")).status, 200)
  assert.equal(target.isBanned, false)
  assert.equal(await callbacks.jwt({ token: { id: "user-1", sessionVersion: 0 } }), null)
})
