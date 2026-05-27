import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_MESSAGE_MAX_LENGTH,
  validateChatMessage,
  validateRecipientId,
} from "../lib/chat-validation.js";

test("validateChatMessage trims, accepts max length, and rejects empty", () => {
  assert.equal(validateChatMessage("  hello  "), "hello");
  assert.equal(
    validateChatMessage("a".repeat(CHAT_MESSAGE_MAX_LENGTH)),
    "a".repeat(CHAT_MESSAGE_MAX_LENGTH),
  );

  assert.throws(() => validateChatMessage(""), /empty/i);
  assert.throws(() => validateChatMessage("   "), /empty/i);
  assert.throws(
    () => validateChatMessage("a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1)),
    new RegExp(`${CHAT_MESSAGE_MAX_LENGTH}`),
  );
});

test("validateRecipientId accepts positive integers and rejects invalid values", () => {
  assert.equal(validateRecipientId(42), 42);
  assert.equal(validateRecipientId("7"), 7);

  assert.throws(() => validateRecipientId(0), /recipient/i);
  assert.throws(() => validateRecipientId(-1), /recipient/i);
  assert.throws(() => validateRecipientId("abc"), /recipient/i);
  assert.throws(() => validateRecipientId(""), /recipient/i);
});
