export const CHAT_MESSAGE_MAX_LENGTH = 2000;

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

/**
 * Validates chat message content (trimmed, non-empty, max length).
 */
export function validateChatMessage(
	value: unknown,
): ValidationResult<string> {
	const message = String(value ?? "").trim();

	if (!message) {
		return { ok: false, error: "Message cannot be empty." };
	}

	if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
		return {
			ok: false,
			error: `Message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or less.`,
		};
	}

	return { ok: true, value: message };
}

/**
 * Validates a chat recipient user id (positive integer).
 */
export function validateRecipientId(value: unknown): ValidationResult<number> {
	const id =
		typeof value === "number" && Number.isInteger(value)
			? value
			: parseInt(String(value ?? "").trim(), 10);

	if (!Number.isInteger(id) || id <= 0) {
		return { ok: false, error: "Invalid recipient ID." };
	}

	return { ok: true, value: id };
}
