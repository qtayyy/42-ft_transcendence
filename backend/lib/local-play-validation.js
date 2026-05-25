export const LOCAL_TOURNAMENT_MIN_PLAYERS = 3;
export const LOCAL_TOURNAMENT_MAX_PLAYERS = 8;
export const TEMP_PLAYER_NAME_MAX_LENGTH = 24;
export const PLAYER_NAME_MAX_LENGTH = 64;
export const MATCH_SCORE_MIN = 0;
export const MATCH_SCORE_MAX = 1000;

const SAFE_RUNTIME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TOURNAMENT_ID_PATTERN = /^(?:RT|local-tournament)-[A-Za-z0-9._:-]{1,120}$/;
const TEMP_PLAYER_ID_PATTERN = /^temp-[A-Za-z0-9._:-]{1,96}$/;
const DISALLOWED_NAME_CHARACTERS = /[\u0000-\u001f\u007f<>`"\\/]/u;
const VALID_OUTCOMES = new Set(["win", "draw", "bye", "walkover"]);
const VALID_AI_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

/**
 * Creates a route-friendly validation error while preserving plain Error
 * behavior for tests and callers.
 */
export function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * Normalizes display names so tournament standings and match cards receive
 * bounded, printable values.
 */
export function normalizeDisplayName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates URL/runtime identifiers used by local and remote tournament flows.
 */
export function normalizeRuntimeId(value, label = "ID") {
  const id = String(value ?? "").trim();
  if (!SAFE_RUNTIME_ID_PATTERN.test(id)) {
    throw createValidationError(`${label} is invalid.`);
  }
  return id;
}

/**
 * Keeps AI difficulty values inside the supported local runtime profiles.
 */
export function normalizeAIDifficulty(value) {
  const difficulty = String(value ?? "").trim().toLowerCase();
  return VALID_AI_DIFFICULTIES.has(difficulty) ? difficulty : "medium";
}

/**
 * Converts query-string booleans into strict local game flags.
 */
export function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/**
 * Validates and normalizes a tournament id supplied by the frontend.
 */
export function normalizeTournamentId(value, fallbackId = null) {
  const id = String(value ?? fallbackId ?? "").trim();
  if (!TOURNAMENT_ID_PATTERN.test(id)) {
    throw createValidationError("Tournament ID is invalid.");
  }
  return id;
}

function normalizePositiveInt(value, label) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createValidationError(`${label} must be a positive integer.`);
  }
  return normalized;
}

function normalizePlayerId(value, isTemp, index) {
  if (isTemp) {
    const id = String(value ?? "").trim();
    if (!TEMP_PLAYER_ID_PATTERN.test(id)) {
      throw createValidationError(`Temporary player ${index + 1} has an invalid ID.`);
    }
    return id;
  }

  return normalizePositiveInt(value, `Player ${index + 1} ID`);
}

function normalizePlayerName(value, index, isTemp) {
  const name = normalizeDisplayName(value);
  const maxLength = isTemp ? TEMP_PLAYER_NAME_MAX_LENGTH : PLAYER_NAME_MAX_LENGTH;

  if (!name) {
    throw createValidationError(`Player ${index + 1} name is required.`);
  }

  if (name.length > maxLength) {
    throw createValidationError(
      `Player ${index + 1} name must be ${maxLength} characters or less.`,
    );
  }

  if (DISALLOWED_NAME_CHARACTERS.test(name)) {
    throw createValidationError(
      `Player ${index + 1} name contains unsupported characters.`,
    );
  }

  return name;
}

/**
 * Validates the player list used to create a local or remote tournament.
 */
export function normalizeTournamentPlayers(players) {
  if (!Array.isArray(players)) {
    throw createValidationError("Tournament players must be an array.");
  }

  if (
    players.length < LOCAL_TOURNAMENT_MIN_PLAYERS ||
    players.length > LOCAL_TOURNAMENT_MAX_PLAYERS
  ) {
    throw createValidationError(
      `Tournament must have ${LOCAL_TOURNAMENT_MIN_PLAYERS}-${LOCAL_TOURNAMENT_MAX_PLAYERS} players.`,
    );
  }

  const seenIds = new Set();
  const seenNames = new Set();

  return players.map((player, index) => {
    if (!player || typeof player !== "object" || Array.isArray(player)) {
      throw createValidationError(`Player ${index + 1} must be an object.`);
    }

    const isTemp = Boolean(player.isTemp);
    const id = normalizePlayerId(player.id, isTemp, index);
    const name = normalizePlayerName(player.name, index, isTemp);
    const idKey = String(id);
    const nameKey = name.toLocaleLowerCase();

    if (seenIds.has(idKey)) {
      throw createValidationError(`Player ${index + 1} has a duplicate ID.`);
    }

    if (seenNames.has(nameKey)) {
      throw createValidationError(`Player ${index + 1} has a duplicate name.`);
    }

    seenIds.add(idKey);
    seenNames.add(nameKey);

    return { id, name, isTemp };
  });
}

/**
 * Validates the full tournament creation request body.
 */
export function normalizeTournamentCreatePayload(body, fallbackTournamentId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Tournament request body is invalid.");
  }

  return {
    players: normalizeTournamentPlayers(body.players),
    tournamentId: normalizeTournamentId(body.tournamentId, fallbackTournamentId),
  };
}

function normalizeOptionalPlayerRef(value, label) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return normalizePositiveInt(value, label);
  }

  const id = String(value).trim();
  if (/^\d+$/.test(id)) {
    return normalizePositiveInt(id, label);
  }

  if (!TEMP_PLAYER_ID_PATTERN.test(id)) {
    throw createValidationError(`${label} is invalid.`);
  }

  return id;
}

function normalizeScoreValue(value, label) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < MATCH_SCORE_MIN || score > MATCH_SCORE_MAX) {
    throw createValidationError(
      `${label} must be a whole number from ${MATCH_SCORE_MIN} to ${MATCH_SCORE_MAX}.`,
    );
  }
  return score;
}

function normalizeScore(score) {
  if (!score || typeof score !== "object" || Array.isArray(score)) {
    throw createValidationError("Score is required.");
  }

  return {
    p1: normalizeScoreValue(score.p1, "Player 1 score"),
    p2: normalizeScoreValue(score.p2, "Player 2 score"),
  };
}

function normalizeDurationSeconds(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) {
    throw createValidationError("Match duration is invalid.");
  }

  return Math.round(duration);
}

function assertSamePlayerRef(actual, expected, label) {
  if (String(actual) !== String(expected)) {
    throw createValidationError(`${label} does not match this tournament match.`);
  }
}

/**
 * Validates a result submission against the actual scheduled tournament match.
 */
export function normalizeTournamentMatchResultPayload(body, match) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createValidationError("Match result body is invalid.");
  }

  const matchId = normalizeRuntimeId(body.matchId, "Match ID");
  if (matchId !== match.matchId) {
    throw createValidationError("Match result does not belong to this match.");
  }

  const player1Id = normalizeOptionalPlayerRef(body.player1Id, "Player 1 ID");
  if (player1Id === null) {
    throw createValidationError("Player 1 ID is required.");
  }
  assertSamePlayerRef(player1Id, match.player1?.id, "Player 1 ID");

  const player2Id = normalizeOptionalPlayerRef(body.player2Id, "Player 2 ID");
  if (match.player2) {
    if (player2Id === null) {
      throw createValidationError("Player 2 ID is required.");
    }
    assertSamePlayerRef(player2Id, match.player2.id, "Player 2 ID");
  } else if (player2Id !== null) {
    throw createValidationError("Bye matches cannot include a second player.");
  }

  const score = normalizeScore(body.score);
  const outcome = String(body.outcome ?? "").trim().toLowerCase();
  if (!VALID_OUTCOMES.has(outcome)) {
    throw createValidationError("Match outcome is invalid.");
  }

  const winnerId = normalizeOptionalPlayerRef(body.winnerId, "Winner ID");
  if (winnerId !== null) {
    const validWinner =
      String(winnerId) === String(match.player1?.id) ||
      (match.player2 && String(winnerId) === String(match.player2.id));
    if (!validWinner) {
      throw createValidationError("Winner ID must be one of the match players.");
    }
  }

  if (outcome === "bye") {
    if (match.player2) {
      throw createValidationError("Only bye matches can use a bye outcome.");
    }
    if (score.p1 !== 0 || score.p2 !== 0) {
      throw createValidationError("Bye scores must be 0-0.");
    }
  } else {
    if (!match.player2) {
      throw createValidationError("Bye matches must use a bye outcome.");
    }
    if (outcome === "draw" && score.p1 !== score.p2) {
      throw createValidationError("Draw results must have equal scores.");
    }
    if (outcome === "win" && score.p1 === score.p2) {
      throw createValidationError("Win results must have different scores.");
    }
    if (outcome === "walkover" && winnerId === null) {
      throw createValidationError("Walkover results require a winner.");
    }
  }

  return {
    matchId,
    player1Id,
    player2Id,
    score,
    outcome,
    winnerId,
    durationSeconds: normalizeDurationSeconds(body.durationSeconds),
  };
}

/**
 * Validates local websocket paddle movement payloads before they touch runtime
 * state that is broadcast back to clients.
 */
export function normalizePaddleMoveMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  if (message.type !== "PADDLE_MOVE") {
    return null;
  }

  const player = Number(message.player);
  if (player !== 1 && player !== 2) {
    throw createValidationError("Paddle move player is invalid.");
  }

  if (
    message.direction !== "UP" &&
    message.direction !== "DOWN" &&
    message.direction !== null
  ) {
    throw createValidationError("Paddle move direction is invalid.");
  }

  return {
    type: "PADDLE_MOVE",
    player,
    direction: message.direction,
  };
}
