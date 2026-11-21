import { test } from "node:test";
import assert from "node:assert/strict";
import { authServerSchema } from "./auth-schema.server";
import { signUpSchema } from "./auth-schema.client";

test("new accounts stay within bcrypt's 72-byte password limit, including multibyte characters", () => {
  for (const [password, valid] of [["界".repeat(24), true], ["界".repeat(24) + "a", false]] as const) {
    const registration = { intent: "sign-up", email: "user@example.test", password, confirmPassword: password };
    assert.equal(signUpSchema.safeParse(registration).success, valid);
    assert.equal(authServerSchema.safeParse(registration).success, valid);
    assert.equal(authServerSchema.safeParse({ ...registration, intent: "sign-in" }).success, true);
  }
});
