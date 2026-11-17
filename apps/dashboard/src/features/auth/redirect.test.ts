import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirect } from "./redirect";

test("login destinations preserve invite and dashboard paths only", () => {
  assert.equal(safeRedirect("/invite/test-token"), "/invite/test-token");
  assert.equal(safeRedirect("/dashboard/organizations/team/projects?view=all"), "/dashboard/organizations/team/projects?view=all");
  for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/auth/sign-in", "/invite/../../api/auth", "/dashboard\n"]) {
    assert.equal(safeRedirect(value), "/dashboard");
  }
});
