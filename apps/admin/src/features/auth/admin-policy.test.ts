import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlatformAdmin } from "./admin-policy";

test("platform administration requires an explicitly trusted user ID", () => {
  const previous = process.env.ADMIN_USER_ID;
  try {
    delete process.env.ADMIN_USER_ID;
    assert.equal(isPlatformAdmin({ id: "trusted" }), false);
    process.env.ADMIN_USER_ID = "trusted";
    assert.equal(isPlatformAdmin(null), false);
    assert.equal(isPlatformAdmin({ id: "attacker" }), false);
    assert.equal(isPlatformAdmin({ id: "trusted" }), true);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = previous;
  }
});
