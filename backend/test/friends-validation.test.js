import assert from "node:assert/strict";
import test from "node:test";

import {
  FRIEND_SEARCH_MAX_LENGTH,
  FRIEND_SEARCH_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateFriendRequestUsername,
  validateFriendSearchQuery,
} from "../lib/friends-validation.js";

test("validateFriendSearchQuery enforces trimmed length bounds", () => {
  assert.equal(validateFriendSearchQuery("  ab  "), "ab");
  assert.equal(
    validateFriendSearchQuery("a".repeat(FRIEND_SEARCH_MIN_LENGTH)),
    "a".repeat(FRIEND_SEARCH_MIN_LENGTH),
  );
  assert.equal(
    validateFriendSearchQuery("a".repeat(FRIEND_SEARCH_MAX_LENGTH)),
    "a".repeat(FRIEND_SEARCH_MAX_LENGTH),
  );

  assert.throws(() => validateFriendSearchQuery(""), /required/i);
  assert.throws(() => validateFriendSearchQuery("a"), /at least/i);
  assert.throws(
    () => validateFriendSearchQuery("a".repeat(FRIEND_SEARCH_MAX_LENGTH + 1)),
    new RegExp(`${FRIEND_SEARCH_MAX_LENGTH}`),
  );
});

test("validateFriendRequestUsername matches profile username rules", () => {
  assert.equal(validateFriendRequestUsername("  player1  "), "player1");
  assert.equal(
    validateFriendRequestUsername("a".repeat(USERNAME_MIN_LENGTH)),
    "a".repeat(USERNAME_MIN_LENGTH),
  );

  assert.throws(
    () => validateFriendRequestUsername("ab"),
    new RegExp(`${USERNAME_MIN_LENGTH}`),
  );
  assert.throws(
    () => validateFriendRequestUsername("a".repeat(USERNAME_MAX_LENGTH + 1)),
    new RegExp(`${USERNAME_MAX_LENGTH}`),
  );
  assert.throws(() => validateFriendRequestUsername("   "), /empty/i);
});
