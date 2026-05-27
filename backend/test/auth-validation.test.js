import assert from "node:assert/strict";
import test from "node:test";

import {
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  OTP_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  validateFullName,
  validateOtp,
  validatePasswordForLogin,
  validatePasswordForSet,
} from "../lib/auth-validation.js";

test("normalizeEmail trims, lowercases, and accepts valid addresses", () => {
  assert.equal(normalizeEmail("  User@Example.COM  "), "user@example.com");
  assert.equal(normalizeEmail("a.b+c@sub.example.co.uk"), "a.b+c@sub.example.co.uk");
});

test("normalizeEmail rejects empty, invalid, and overlong values", () => {
  assert.throws(() => normalizeEmail(""), /Email is required/);
  assert.throws(() => normalizeEmail("not-an-email"), /invalid/i);
  assert.throws(
    () => normalizeEmail(`${"a".repeat(EMAIL_MAX_LENGTH)}@example.com`),
    /too long/i,
  );
});

test("validatePasswordForSet enforces length and composition", () => {
  assert.equal(validatePasswordForSet("Secret1a"), "Secret1a");
  assert.throws(
    () => validatePasswordForSet("short1"),
    new RegExp(`${PASSWORD_MIN_LENGTH}`),
  );
  assert.throws(() => validatePasswordForSet("allletters"), /digit/i);
  assert.throws(() => validatePasswordForSet("12345678"), /letter/i);
  assert.throws(
    () => validatePasswordForSet("a1" + "x".repeat(PASSWORD_MAX_LENGTH)),
    new RegExp(`${PASSWORD_MAX_LENGTH}`),
  );
  assert.throws(() => validatePasswordForSet("   "), /required/i);
});

test("validatePasswordForLogin only requires a non-empty trimmed password", () => {
  assert.equal(validatePasswordForLogin("legacy6"), "legacy6");
  assert.equal(validatePasswordForLogin("  abc  "), "abc");
  assert.throws(() => validatePasswordForLogin(""), /required/i);
  assert.throws(() => validatePasswordForLogin("   "), /required/i);
});

test("validateOtp requires exactly six digits", () => {
  assert.equal(validateOtp("123456"), "123456");
  assert.equal(validateOtp(" 654321 "), "654321");
  assert.throws(() => validateOtp("12345"), new RegExp(`${OTP_LENGTH}`));
  assert.throws(() => validateOtp("12a456"), new RegExp(`${OTP_LENGTH}`));
  assert.throws(() => validateOtp(""), /required/i);
});

test("validateFullName enforces trimmed length bounds", () => {
  assert.equal(validateFullName("  Ada  "), "Ada");
  assert.equal(validateFullName("a".repeat(FULL_NAME_MIN_LENGTH)), "a".repeat(FULL_NAME_MIN_LENGTH));
  assert.throws(
    () => validateFullName("ab"),
    new RegExp(`${FULL_NAME_MIN_LENGTH}`),
  );
  assert.throws(
    () => validateFullName("a".repeat(FULL_NAME_MAX_LENGTH + 1)),
    new RegExp(`${FULL_NAME_MAX_LENGTH}`),
  );
  assert.throws(() => validateFullName("   "), /required/i);
});
