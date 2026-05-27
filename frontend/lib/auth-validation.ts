export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const FULL_NAME_MIN_LENGTH = 3;
export const FULL_NAME_MAX_LENGTH = 20;
export const OTP_LENGTH = 6;

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

const EMAIL_PATTERN =
	/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u;

const OTP_PATTERN = /^\d{6}$/;

/**
 * Normalizes and validates an email address for auth flows.
 */
export function normalizeEmail(value: unknown): ValidationResult<string> {
	const email = String(value ?? "")
		.trim()
		.toLowerCase();

	if (!email) {
		return { ok: false, error: "Email is required." };
	}

	if (email.length > EMAIL_MAX_LENGTH) {
		return { ok: false, error: "Email is too long." };
	}

	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, error: "Email format is invalid." };
	}

	return { ok: true, value: email };
}

/**
 * Validates passwords when setting a new value (signup, change, reset).
 */
export function validatePasswordForSet(
	value: unknown,
): ValidationResult<string> {
	const password = String(value ?? "").trim();

	if (!password) {
		return { ok: false, error: "Password is required." };
	}

	if (password.length < PASSWORD_MIN_LENGTH) {
		return {
			ok: false,
			error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
		};
	}

	if (password.length > PASSWORD_MAX_LENGTH) {
		return {
			ok: false,
			error: `Password must be ${PASSWORD_MAX_LENGTH} characters or less.`,
		};
	}

	if (!/[A-Za-z]/.test(password)) {
		return {
			ok: false,
			error: "Password must contain at least one letter.",
		};
	}

	if (!/\d/.test(password)) {
		return {
			ok: false,
			error: "Password must contain at least one digit.",
		};
	}

	return { ok: true, value: password };
}

/**
 * Validates passwords on login only (grandfather weak legacy passwords).
 */
export function validatePasswordForLogin(
	value: unknown,
): ValidationResult<string> {
	const password = String(value ?? "").trim();

	if (!password) {
		return { ok: false, error: "Password is required." };
	}

	return { ok: true, value: password };
}

/**
 * Validates a 6-digit OTP for reset and 2FA flows.
 */
export function validateOtp(value: unknown): ValidationResult<string> {
	const otp = String(value ?? "").trim();

	if (!otp) {
		return { ok: false, error: "OTP is required." };
	}

	if (!OTP_PATTERN.test(otp)) {
		return {
			ok: false,
			error: `OTP must be exactly ${OTP_LENGTH} digits.`,
		};
	}

	return { ok: true, value: otp };
}

/**
 * Validates signup display name (stored as username).
 */
export function validateFullName(value: unknown): ValidationResult<string> {
	const fullName = String(value ?? "").trim();

	if (!fullName) {
		return { ok: false, error: "Full name is required." };
	}

	if (fullName.length < FULL_NAME_MIN_LENGTH) {
		return {
			ok: false,
			error: `Full name must be at least ${FULL_NAME_MIN_LENGTH} characters.`,
		};
	}

	if (fullName.length > FULL_NAME_MAX_LENGTH) {
		return {
			ok: false,
			error: `Full name must be ${FULL_NAME_MAX_LENGTH} characters or less.`,
		};
	}

	return { ok: true, value: fullName };
}
