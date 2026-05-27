import { createValidationError } from "./local-play-validation.js";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const FULL_NAME_MIN_LENGTH = 3;
export const FULL_NAME_MAX_LENGTH = 20;
export const OTP_LENGTH = 6;

/** Practical email check (not exhaustive RFC 5322). */
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u;

const OTP_PATTERN = /^\d{6}$/;

/**
 * Normalizes and validates an email address for auth flows.
 */
export function normalizeEmail(value) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw createValidationError("Email is required.");
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    throw createValidationError("Email is too long.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw createValidationError("Email format is invalid.");
  }

  return email;
}

/**
 * Validates passwords when setting a new value (signup, change, reset).
 */
export function validatePasswordForSet(value) {
  const password = String(value ?? "").trim();

  if (!password) {
    throw createValidationError("Password is required.");
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createValidationError(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    throw createValidationError(
      `Password must be ${PASSWORD_MAX_LENGTH} characters or less.`,
    );
  }

  if (!/[A-Za-z]/.test(password)) {
    throw createValidationError("Password must contain at least one letter.");
  }

  if (!/\d/.test(password)) {
    throw createValidationError("Password must contain at least one digit.");
  }

  return password;
}

/**
 * Validates passwords on login only (grandfather weak legacy passwords).
 */
export function validatePasswordForLogin(value) {
  const password = String(value ?? "").trim();

  if (!password) {
    throw createValidationError("Password is required.");
  }

  return password;
}

/**
 * Validates a 6-digit OTP for reset and 2FA flows.
 */
export function validateOtp(value) {
  const otp = String(value ?? "").trim();

  if (!otp) {
    throw createValidationError("OTP is required.");
  }

  if (!OTP_PATTERN.test(otp)) {
    throw createValidationError(`OTP must be exactly ${OTP_LENGTH} digits.`);
  }

  return otp;
}

/**
 * Validates signup display name (stored as username).
 */
export function validateFullName(value) {
  const fullName = String(value ?? "").trim();

  if (!fullName) {
    throw createValidationError("Full name is required.");
  }

  if (fullName.length < FULL_NAME_MIN_LENGTH) {
    throw createValidationError(
      `Full name must be at least ${FULL_NAME_MIN_LENGTH} characters.`,
    );
  }

  if (fullName.length > FULL_NAME_MAX_LENGTH) {
    throw createValidationError(
      `Full name must be ${FULL_NAME_MAX_LENGTH} characters or less.`,
    );
  }

  return fullName;
}

/**
 * Sends a 400 response when error came from createValidationError.
 * @returns {boolean} true if the response was sent
 */
export function replyIfValidationError(error, reply) {
  if (error?.statusCode === 400) {
    reply.code(400).send({ error: error.message });
    return true;
  }
  return false;
}
