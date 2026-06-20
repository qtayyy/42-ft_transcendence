import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRetryAfterSeconds,
  hashProfileCreationIp,
  PROFILE_CREATION_WINDOW_MS,
} from "../services/profile-creation-quota.js";

test("profile creation IPs are stored as deterministic HMAC hashes", () => {
  const first = hashProfileCreationIp("203.0.113.10", "test-secret");
  const second = hashProfileCreationIp("203.0.113.10", "test-secret");

  assert.equal(first, second);
  assert.notEqual(first, "203.0.113.10");
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("quota retry time reflects the remaining 24-hour window", () => {
  const now = 2_000_000;
  const startedTwelveHoursAgo = now - PROFILE_CREATION_WINDOW_MS / 2;

  assert.equal(
    calculateRetryAfterSeconds(startedTwelveHoursAgo, now),
    12 * 60 * 60,
  );
  assert.equal(calculateRetryAfterSeconds(now - PROFILE_CREATION_WINDOW_MS, now), 1);
});
