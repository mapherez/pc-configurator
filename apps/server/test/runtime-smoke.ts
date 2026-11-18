// Container-only artifact check, mounted from the compiled tests directory.
import assert from "node:assert/strict";
import { authFixture } from "./auth-fixture.js";
const fixture = await authFixture();
try {
  const owner = await fixture.signIn();
  const headers = {
    Cookie: owner.cookie,
    Origin: fixture.base,
    "X-CSRF-Token": owner.csrf,
    "Content-Type": "application/json",
  };
  assert.equal((await fetch(`${fixture.base}/api/admin/state`)).status, 401);
  const component = { ...fixture.store.snapshot().components[0], name: "Container draft" };
  const execute = (operation: string, input: unknown) =>
    fetch(`${fixture.base}/api/admin/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ operation, input }),
    });
  assert.equal((await execute("component_save", { component, expectedRevision: 0 })).status, 200);
  assert.notEqual(fixture.store.snapshot().components[0].name, component.name);
  assert.equal((await execute("component_publish", { id: component.id, revision: 1 })).status, 200);
  assert.equal(fixture.store.snapshot().components[0].name, component.name);
  const response = await fetch(`${fixture.base}/api/admin/delegations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Runtime check", scopes: ["pc:read"], hours: 1 }),
  });
  const delegation = (await response.json()) as { token: string };
  assert.equal(response.status, 200);
  const mcp = await fetch(`${fixture.base}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${delegation.token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  assert.equal(mcp.status, 200);
  const result = (await mcp.json()) as { result: { tools: { name: string }[] } };
  assert.ok(result.result.tools.some((tool) => tool.name === "pc_catalog_list"));
  assert.ok(!result.result.tools.some((tool) => tool.name === "pc_component_publish"));
  console.log("Management artifact check passed: NoX login, private API, draft/publish and MCP.");
} finally {
  await fixture.close();
}
