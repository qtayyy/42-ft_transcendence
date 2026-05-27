import {
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	validateUsername,
} from "@/lib/profile-validation";

export const FRIEND_SEARCH_MIN_LENGTH = 2;
export const FRIEND_SEARCH_MAX_LENGTH = 80;

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

/**
 * Validates friend search query (trimmed, 2–80 chars).
 */
export function validateFriendSearchQuery(
	value: unknown,
): ValidationResult<string> {
	const query = String(value ?? "").trim();

	if (!query) {
		return { ok: false, error: "Search query is required." };
	}

	if (query.length < FRIEND_SEARCH_MIN_LENGTH) {
		return {
			ok: false,
			error: `Search query must be at least ${FRIEND_SEARCH_MIN_LENGTH} characters.`,
		};
	}

	if (query.length > FRIEND_SEARCH_MAX_LENGTH) {
		return {
			ok: false,
			error: `Search query must be ${FRIEND_SEARCH_MAX_LENGTH} characters or less.`,
		};
	}

	return { ok: true, value: query };
}

/**
 * Validates username when sending a friend request (3–20 chars, same as profile).
 */
export function validateFriendRequestUsername(
	value: unknown,
): ValidationResult<string> {
	return validateUsername(value);
}

export { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH };
