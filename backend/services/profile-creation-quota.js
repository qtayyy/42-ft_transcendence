import crypto from "node:crypto";

export const PROFILE_CREATION_LIMIT = 5;
export const PROFILE_CREATION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Hash an IP before persistence so the quota table stores no raw addresses. */
export function hashProfileCreationIp(ip, secret = process.env.SECURITY_PEPPER) {
  if (!secret) throw new Error("SECURITY_PEPPER is required for IP hashing");
  return crypto
    .createHmac("sha256", secret)
    .update(String(ip || "unknown"))
    .digest("hex");
}

/** Build the quota error shared by password and OAuth profile creation. */
function createQuotaError(retryAfterSeconds) {
  const error = new Error(
    "Too many profiles were created from this network. Try again later.",
  );
  error.code = "PROFILE_CREATION_LIMIT";
  error.statusCode = 429;
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

/** Calculate how long remains in an existing fixed quota window. */
export function calculateRetryAfterSeconds(windowStartedAt, now = Date.now()) {
  const remaining =
    Number(windowStartedAt) + PROFILE_CREATION_WINDOW_MS - Number(now);
  return Math.max(1, Math.ceil(remaining / 1000));
}

/**
 * Atomically reserve one successful-creation slot. The conditional SQLite
 * upsert cannot increment beyond the limit even when requests arrive together.
 */
export async function reserveProfileCreationSlot(prisma, ip, now = Date.now()) {
  const ipHash = hashProfileCreationIp(ip);
  const currentTime = BigInt(now);
  const expiredBefore = BigInt(now - PROFILE_CREATION_WINDOW_MS);

  const rows = await prisma.$queryRaw`
    INSERT INTO "ProfileCreationQuota" ("ipHash", "windowStartedAt", "count")
    VALUES (${ipHash}, ${currentTime}, 1)
    ON CONFLICT("ipHash") DO UPDATE SET
      "windowStartedAt" = CASE
        WHEN "windowStartedAt" <= ${expiredBefore} THEN ${currentTime}
        ELSE "windowStartedAt"
      END,
      "count" = CASE
        WHEN "windowStartedAt" <= ${expiredBefore} THEN 1
        ELSE "count" + 1
      END
    WHERE "windowStartedAt" <= ${expiredBefore}
       OR "count" < ${PROFILE_CREATION_LIMIT}
    RETURNING "windowStartedAt", "count"
  `;

  if (rows.length === 0) {
    const quota = await prisma.profileCreationQuota.findUnique({
      where: { ipHash },
      select: { windowStartedAt: true },
    });
    throw createQuotaError(
      calculateRetryAfterSeconds(quota?.windowStartedAt ?? currentTime, now),
    );
  }

  return { ipHash, windowStartedAt: rows[0].windowStartedAt };
}

/** Release a reservation when the corresponding profile creation fails. */
export async function releaseProfileCreationSlot(prisma, reservation) {
  if (!reservation) return;
  await prisma.$executeRaw`
    UPDATE "ProfileCreationQuota"
    SET "count" = "count" - 1
    WHERE "ipHash" = ${reservation.ipHash}
      AND "windowStartedAt" = ${reservation.windowStartedAt}
      AND "count" > 0
  `;
}

/** Convert quota errors into a consistent HTTP 429 response. */
export function replyIfProfileCreationLimited(error, reply) {
  if (error?.code !== "PROFILE_CREATION_LIMIT") return false;
  reply
    .header("Retry-After", String(error.retryAfterSeconds))
    .code(429)
    .send({
      error: error.message,
      code: error.code,
      retryAfter: error.retryAfterSeconds,
    });
  return true;
}
