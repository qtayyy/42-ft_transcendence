import { createValidationError } from "./local-play-validation.js";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from "./profile-validation.js";

export { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH };

export const FRIEND_SEARCH_MIN_LENGTH = 2;
export const FRIEND_SEARCH_MAX_LENGTH = 80;

/**
 * Validates friend search query (trimmed, 2–80 chars).
 */
export function validateFriendSearchQuery(value) {
  const query = String(value ?? "").trim();

  if (!query) {
    throw createValidationError("Search query is required.");
  }

  if (query.length < FRIEND_SEARCH_MIN_LENGTH) {
    throw createValidationError(
      `Search query must be at least ${FRIEND_SEARCH_MIN_LENGTH} characters.`,
    );
  }

  if (query.length > FRIEND_SEARCH_MAX_LENGTH) {
    throw createValidationError(
      `Search query must be ${FRIEND_SEARCH_MAX_LENGTH} characters or less.`,
    );
  }

  return query;
}

/**
 * Validates username when sending a friend request (3–20 chars, same as profile).
 */
export function validateFriendRequestUsername(value) {
  return validateUsername(value);
}
