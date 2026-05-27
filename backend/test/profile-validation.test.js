import assert from "node:assert/strict";
import test from "node:test";

import {
  AVATAR_MAX_BYTES,
  BIO_MAX_LENGTH,
  REGION_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  stripDisallowedProfileUpdates,
  validateAvatarFileSize,
  validateBio,
  validateDob,
  validateRegion,
  validateUsername,
} from "../lib/profile-validation.js";

test("validateUsername enforces trimmed length bounds", () => {
  assert.equal(validateUsername("  Ada  "), "Ada");
  assert.equal(
    validateUsername("a".repeat(USERNAME_MIN_LENGTH)),
    "a".repeat(USERNAME_MIN_LENGTH),
  );
  assert.throws(
    () => validateUsername("ab"),
    new RegExp(`${USERNAME_MIN_LENGTH}`),
  );
  assert.throws(
    () => validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1)),
    new RegExp(`${USERNAME_MAX_LENGTH}`),
  );
  assert.throws(() => validateUsername("   "), /empty/i);
});

test("validateBio and validateRegion enforce max lengths", () => {
  assert.equal(validateBio(""), "");
  assert.equal(validateBio("a".repeat(BIO_MAX_LENGTH)), "a".repeat(BIO_MAX_LENGTH));
  assert.throws(
    () => validateBio("a".repeat(BIO_MAX_LENGTH + 1)),
    new RegExp(`${BIO_MAX_LENGTH}`),
  );

  assert.equal(validateRegion(""), "");
  assert.equal(
    validateRegion("a".repeat(REGION_MAX_LENGTH)),
    "a".repeat(REGION_MAX_LENGTH),
  );
  assert.throws(
    () => validateRegion("a".repeat(REGION_MAX_LENGTH + 1)),
    new RegExp(`${REGION_MAX_LENGTH}`),
  );
});

test("validateDob accepts empty values and rejects invalid or future dates", () => {
  assert.equal(validateDob(""), null);
  assert.equal(validateDob(null), null);

  const past = new Date("2000-01-01");
  assert.equal(validateDob("2000-01-01").toISOString(), past.toISOString());

  assert.throws(() => validateDob("not-a-date"), /invalid/i);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.throws(() => validateDob(tomorrow.toISOString()), /future/i);
});

test("stripDisallowedProfileUpdates removes email", () => {
  assert.deepEqual(
    stripDisallowedProfileUpdates({
      username: "player",
      email: "hacker@evil.com",
      bio: "hi",
    }),
    { username: "player", bio: "hi" },
  );
});

test("validateAvatarFileSize enforces 5MB limit", () => {
  assert.equal(validateAvatarFileSize(1024), 1024);
  assert.equal(validateAvatarFileSize(AVATAR_MAX_BYTES), AVATAR_MAX_BYTES);
  assert.throws(
    () => validateAvatarFileSize(AVATAR_MAX_BYTES + 1),
    /5MB/i,
  );
  assert.throws(() => validateAvatarFileSize(0), /required/i);
});
