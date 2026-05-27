export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BIO_MAX_LENGTH = 500;
export const REGION_MAX_LENGTH = 100;
export const AVATAR_MAX_BYTES = 5_242_880;

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

/**
 * Validates profile username (3–20 chars, trimmed, non-empty).
 */
export function validateUsername(value: unknown): ValidationResult<string> {
	const username = String(value ?? "").trim();

	if (!username) {
		return { ok: false, error: "Username cannot be empty." };
	}

	if (username.length < USERNAME_MIN_LENGTH) {
		return {
			ok: false,
			error: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
		};
	}

	if (username.length > USERNAME_MAX_LENGTH) {
		return {
			ok: false,
			error: `Username must be ${USERNAME_MAX_LENGTH} characters or less.`,
		};
	}

	return { ok: true, value: username };
}

/**
 * Validates bio text when provided (empty string allowed).
 */
export function validateBio(value: unknown): ValidationResult<string> {
	const bio = String(value ?? "");

	if (bio.length > BIO_MAX_LENGTH) {
		return {
			ok: false,
			error: `Bio must be ${BIO_MAX_LENGTH} characters or less.`,
		};
	}

	return { ok: true, value: bio };
}

/**
 * Validates region text when provided (empty string allowed).
 */
export function validateRegion(value: unknown): ValidationResult<string> {
	const region = String(value ?? "");

	if (region.length > REGION_MAX_LENGTH) {
		return {
			ok: false,
			error: `Region must be ${REGION_MAX_LENGTH} characters or less.`,
		};
	}

	return { ok: true, value: region };
}

/**
 * Validates date of birth: parseable and not in the future. Null/empty allowed.
 */
export function validateDob(value: unknown): ValidationResult<Date | null> {
	if (value === null || value === undefined || value === "") {
		return { ok: true, value: null };
	}

	const parsed = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(parsed.getTime())) {
		return { ok: false, error: "Date of birth is invalid." };
	}

	const today = new Date();
	today.setHours(23, 59, 59, 999);
	if (parsed > today) {
		return { ok: false, error: "Date of birth cannot be in the future." };
	}

	return { ok: true, value: parsed };
}

/**
 * Removes fields that must not be updated via profile PUT (e.g. email).
 */
export function stripDisallowedProfileUpdates<T extends Record<string, unknown>>(
	updates: T,
): Omit<T, "email"> {
	const { email: _email, ...rest } = updates;
	return rest;
}

/**
 * Validates avatar upload size before upload.
 */
export function validateAvatarFileSize(
	sizeBytes: unknown,
): ValidationResult<number> {
	const size = Number(sizeBytes);

	if (!Number.isFinite(size) || size <= 0) {
		return { ok: false, error: "Avatar file is required." };
	}

	if (size > AVATAR_MAX_BYTES) {
		return { ok: false, error: "Avatar file must be 5MB or less." };
	}

	return { ok: true, value: size };
}
