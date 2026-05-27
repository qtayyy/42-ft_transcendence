import { createValidationError } from "./local-play-validation.js";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BIO_MAX_LENGTH = 500;
export const REGION_MAX_LENGTH = 100;
export const AVATAR_MAX_BYTES = 5_242_880;

/**
 * Validates profile username (3–20 chars, trimmed, non-empty).
 */
export function validateUsername(value) {
  const username = String(value ?? "").trim();

  if (!username) {
    throw createValidationError("Username cannot be empty.");
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    throw createValidationError(
      `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    );
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    throw createValidationError(
      `Username must be ${USERNAME_MAX_LENGTH} characters or less.`,
    );
  }

  return username;
}

/**
 * Validates bio text when provided (empty string allowed).
 */
export function validateBio(value) {
  const bio = String(value ?? "");

  if (bio.length > BIO_MAX_LENGTH) {
    throw createValidationError(
      `Bio must be ${BIO_MAX_LENGTH} characters or less.`,
    );
  }

  return bio;
}

/**
 * Validates region text when provided (empty string allowed).
 */
export function validateRegion(value) {
  const region = String(value ?? "");

  if (region.length > REGION_MAX_LENGTH) {
    throw createValidationError(
      `Region must be ${REGION_MAX_LENGTH} characters or less.`,
    );
  }

  return region;
}

/**
 * Validates date of birth: parseable and not in the future. Null/empty allowed.
 */
export function validateDob(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw createValidationError("Date of birth is invalid.");
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    throw createValidationError("Date of birth cannot be in the future.");
  }

  return parsed;
}

/**
 * Removes fields that must not be updated via profile PUT (e.g. email).
 */
export function stripDisallowedProfileUpdates(updates) {
  const sanitized = { ...updates };
  delete sanitized.email;
  return sanitized;
}

/**
 * Validates avatar upload size on the client before upload.
 */
export function validateAvatarFileSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) {
    throw createValidationError("Avatar file is required.");
  }
  if (size > AVATAR_MAX_BYTES) {
    throw createValidationError("Avatar file must be 5MB or less.");
  }
  return size;
}
