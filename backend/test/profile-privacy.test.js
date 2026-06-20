import assert from "node:assert/strict";
import test from "node:test";

import {
  serializePublicProfile,
  validateShowEmail,
} from "../lib/profile-privacy.js";

test("public profiles hide email by default", () => {
  const result = serializePublicProfile({
    id: 7,
    username: "player-7",
    email: "private@example.com",
    showEmail: false,
  });

  assert.deepEqual(result, { id: 7, username: "player-7" });
  assert.equal(Object.hasOwn(result, "showEmail"), false);
});

test("public profiles include email only after explicit opt-in", () => {
  const result = serializePublicProfile({
    id: 7,
    username: "player-7",
    email: "public@example.com",
    showEmail: true,
  });

  assert.equal(result.email, "public@example.com");
  assert.equal(Object.hasOwn(result, "showEmail"), false);
});

test("email visibility accepts booleans only", () => {
  assert.equal(validateShowEmail(true), true);
  assert.equal(validateShowEmail(false), false);
  assert.throws(() => validateShowEmail("true"), /boolean/i);
});
