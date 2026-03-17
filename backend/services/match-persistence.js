import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const MATCH_MODE_FALLBACK = "LOCAL";
const MATCH_MODE_VALUES = new Set([
  "LOCAL",
  "LOCAL_TOURNAMENT",
  "REMOTE",
  "REMOTE_TOURNAMENT",
  "AI",
]);

/**
 * Convert external request/runtime data into a Prisma-safe optional integer.
 * Non-numeric values such as "guest" are treated as null so guest player slots
 * remain representable without breaking persistence.
 */
function toOptionalInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

/**
 * Player 1 is required for persisted matches. We validate that explicitly so
 * auth/user-resolution bugs fail fast instead of silently creating bad rows.
 */
function toRequiredPlayerId(value) {
  const playerId = toOptionalInt(value);
  if (!playerId) {
    throw new Error("A valid player1Id is required to save a match");
  }
  return playerId;
}

/**
 * Match mode comes from mixed callers (legacy WS runtime and HTTP fallback),
 * so we normalize casing/format before it reaches Prisma's enum layer.
 */
function toMatchMode(value) {
  if (typeof value !== "string") {
    return MATCH_MODE_FALLBACK;
  }

  const normalized = value.trim().toUpperCase().replace(/-/g, "_");
  return MATCH_MODE_VALUES.has(normalized) ? normalized : MATCH_MODE_FALLBACK;
}

/**
 * The runtime match id is our durable idempotency key. Blank values are treated
 * as absent so legacy callers without an external id still persist successfully.
 */
function toExternalMatchId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Keep duration storage stable across callers by coercing finite values to a
 * rounded non-negative number of seconds.
 */
function toDurationSeconds(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return null;
  }

  return Math.max(0, Math.round(normalized));
}

/**
 * Persist a match result with optional idempotency. When an external runtime
 * id is present, repeated saves update the existing row instead of inserting a
 * duplicate, which lets backend and frontend save paths safely coexist.
 */
export async function persistMatchRecord({
  externalMatchId,
  player1Id,
  player2Id,
  score1,
  score2,
  durationSeconds,
  mode,
  tournamentId,
}) {
  const normalizedExternalMatchId = toExternalMatchId(externalMatchId);
  const normalizedTournamentId = toOptionalInt(tournamentId);
  const data = {
    player1Id: toRequiredPlayerId(player1Id),
    player2Id: toOptionalInt(player2Id),
    score1: Math.max(0, Math.round(Number(score1) || 0)),
    score2: Math.max(0, Math.round(Number(score2) || 0)),
    durationSeconds: toDurationSeconds(durationSeconds),
    mode: toMatchMode(mode),
    tournamentId: normalizedTournamentId,
  };

  if (!normalizedExternalMatchId) {
    const match = await prisma.match.create({ data });
    return { match, reusedExisting: false };
  }

  const existing = await prisma.match.findUnique({
    where: { externalMatchId: normalizedExternalMatchId },
    select: { id: true },
  });

  const match = await prisma.match.upsert({
    where: { externalMatchId: normalizedExternalMatchId },
    update: data,
    create: {
      ...data,
      externalMatchId: normalizedExternalMatchId,
    },
  });

  return { match, reusedExisting: Boolean(existing) };
}
