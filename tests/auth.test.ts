import assert from "node:assert/strict"
import { test } from "node:test"
import authConfig, { authSecretConfigured, signInProviders } from "../src/auth.config"
import { safeAuthRedirect } from "../src/lib/auth-redirect"

test("sign-in retains an invitation or project destination within the app", () => {
  const invitation = `/join/${"a1".repeat(32)}`
  for (const path of ["/", invitation, "/projects", "/projects/project-123", "/projects?view=mine#tasks"]) {
    assert.equal(safeAuthRedirect(path), path)
  }
})

test("sign-in rejects external, ambiguous, malformed, and recursive destinations", () => {
  for (const path of [
    undefined, null, 7, ["/projects"], "", "projects", "https://evil.example/path",
    "http://evil.example", "javascript:alert(1)", "//evil.example", "///evil.example",
    "/\\evil.example", "/projects\\evil.example", "/%5cevil.example", "/%2f/evil.example",
    "/%252f%252fevil.example", "/%", "/%0d%0aLocation:https://evil.example", "/\nevil.example",
    " /projects", "/login", "/login?callbackUrl=/projects", "/api/auth/signout", "/projects/../login",
  ]) {
    assert.equal(safeAuthRedirect(path), "/", `Unexpected destination accepted: ${JSON.stringify(path)}`)
  }
})

test("Google and Microsoft are enabled by the isolated test configuration", () => {
  assert.equal(authSecretConfigured, true, "Run the auth tests using npm test.")
  assert.deepEqual(signInProviders.map(({ id, configured }) => ({ id, configured })), [
    { id: "google", configured: true },
    { id: "microsoft-entra-id", configured: true },
  ])
  const providers = authConfig.providers.map((provider) => typeof provider === "function" ? provider() : provider)
  assert.deepEqual(providers.map((provider) => provider.id), ["google", "microsoft-entra-id"])
  const microsoft = providers.find((provider) => provider.id === "microsoft-entra-id")
  assert.ok(microsoft && microsoft.type === "oidc")
  assert.equal(microsoft.options?.issuer, "https://login.microsoftonline.com/common/v2.0")
  assert.notEqual(microsoft.allowDangerousEmailAccountLinking, true)
  assert.notEqual(microsoft.options?.allowDangerousEmailAccountLinking, true)
})

test("database sessions expose the database user ID needed for ownership checks", async () => {
  assert.equal(authConfig.session.strategy, "database")
  const result = await authConfig.callbacks.session({
    session: {
      user: { name: "Study User", email: "study@example.test" },
      expires: "2030-01-01T00:00:00.000Z",
    },
    user: { id: "database-owner-id", email: "study@example.test", emailVerified: null },
  } as Parameters<typeof authConfig.callbacks.session>[0])
  assert.equal(result.user.id, "database-owner-id")
})
