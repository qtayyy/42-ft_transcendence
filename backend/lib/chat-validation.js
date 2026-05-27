import { createValidationError } from "./local-play-validation.js";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

/**
 * Validates chat message content (trimmed, non-empty, max length).
 */
export function validateChatMessage(value) {
  const message = String(value ?? "").trim();

  if (!message) {
    throw createValidationError("Message cannot be empty.");
  }

  if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw createValidationError(
      `Message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or less.`,
    );
  }

  return message;
}

/**
 * Validates a chat recipient user id (positive integer).
 */
export function validateRecipientId(value) {
  const id =
    typeof value === "number" && Number.isInteger(value)
      ? value
      : parseInt(String(value ?? "").trim(), 10);

  if (!Number.isInteger(id) || id <= 0) {
    throw createValidationError("Invalid recipient ID.");
  }

  return id;
}
