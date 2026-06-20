/** Validate the owner-controlled public email preference. */
export function validateShowEmail(value) {
  if (typeof value !== "boolean") {
    const error = new Error("showEmail must be a boolean.");
    error.statusCode = 400;
    throw error;
  }
  return value;
}

/**
 * Remove privacy metadata and expose an email only when its owner explicitly
 * opted in. This function is kept at the response boundary so callers cannot
 * accidentally spread the full Prisma profile into a public response.
 */
export function serializePublicProfile(profile) {
  const { showEmail, email, ...publicProfile } = profile;
  return showEmail ? { ...publicProfile, email } : publicProfile;
}
