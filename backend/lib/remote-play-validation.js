export const REMOTE_SINGLE_PLAYER_COUNT = 2;
export const REMOTE_TOURNAMENT_MIN_PLAYERS = 3;
export const REMOTE_TOURNAMENT_MAX_PLAYERS = 8;
export const REMOTE_USERNAME_MAX_LENGTH = 80;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCHMAKING_MODES = new Set(["single", "tournament"]);

export function createRemoteValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * Normalizes room codes used by remote room URLs and WebSocket events.
 */
export function normalizeRemoteRoomId(value, label = "Room ID") {
  const roomId = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(roomId)) {
    throw createRemoteValidationError(`${label} must be a valid room code.`);
  }
  return roomId;
}

/**
 * Normalizes remote tournament IDs and optionally binds them to a room ID.
 */
export function normalizeRemoteTournamentId(value, roomId = null) {
  const tournamentId = String(value ?? "").trim();
  if (!tournamentId.startsWith("RT-")) {
    throw createRemoteValidationError("Tournament ID must start with RT-.");
  }

  const normalizedRoomId = normalizeRemoteRoomId(
    tournamentId.slice(3),
    "Tournament room ID",
  );

  if (roomId !== null && normalizedRoomId !== normalizeRemoteRoomId(roomId)) {
    throw createRemoteValidationError(
      "Tournament ID must match the room being started.",
    );
  }

  return `RT-${normalizedRoomId}`;
}

/**
 * Converts authenticated IDs into the numeric IDs used by room maps.
 */
export function normalizeRemoteUserId(value, label = "User ID") {
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createRemoteValidationError(`${label} must be a positive integer.`);
  }
  return userId;
}

/**
 * Keeps profile names printable and bounded before they enter room state.
 */
export function normalizeRemoteUsername(value, label = "Username") {
  const username = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!username) {
    throw createRemoteValidationError(`${label} is required.`);
  }

  if (username.length > REMOTE_USERNAME_MAX_LENGTH) {
    throw createRemoteValidationError(
      `${label} must be ${REMOTE_USERNAME_MAX_LENGTH} characters or less.`,
    );
  }

  return username;
}

function normalizeRemoteBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/**
 * Validates the supported remote matchmaking queues.
 */
export function normalizeRemoteMatchmakingMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  if (!MATCHMAKING_MODES.has(mode)) {
    throw createRemoteValidationError("Matchmaking mode is invalid.");
  }
  return mode;
}

/**
 * Enforces player-count rules for both complete rooms and open lobbies.
 */
export function normalizeRemotePlayerCount(
  value,
  mode,
  { allowLobby = false } = {},
) {
  const count = Number(value);
  if (!Number.isInteger(count)) {
    throw createRemoteValidationError("Player count is invalid.");
  }

  if (mode === "single") {
    if (allowLobby && count >= 1 && count <= REMOTE_SINGLE_PLAYER_COUNT) {
      return count;
    }
    if (count !== REMOTE_SINGLE_PLAYER_COUNT) {
      throw createRemoteValidationError("Remote single requires exactly 2 players.");
    }
    return count;
  }

  if (mode === "tournament") {
    const minPlayers = allowLobby ? 1 : REMOTE_TOURNAMENT_MIN_PLAYERS;
    if (count < minPlayers || count > REMOTE_TOURNAMENT_MAX_PLAYERS) {
      throw createRemoteValidationError(
        allowLobby
          ? `Remote tournament lobbies support 1-${REMOTE_TOURNAMENT_MAX_PLAYERS} players.`
          : `Remote tournaments require ${REMOTE_TOURNAMENT_MIN_PLAYERS}-${REMOTE_TOURNAMENT_MAX_PLAYERS} players.`,
      );
    }
    return count;
  }

  throw createRemoteValidationError("Remote play mode is invalid.");
}

/**
 * Validates room creation options before a room is written to memory.
 */
export function normalizeRemoteRoomOptions(maxPlayers, isTournament) {
  const normalizedIsTournament =
    typeof isTournament === "boolean"
      ? isTournament
      : normalizeRemoteBoolean(isTournament);
  const mode = normalizedIsTournament ? "tournament" : "single";
  return {
    maxPlayers: normalizeRemotePlayerCount(maxPlayers, mode),
    isTournament: normalizedIsTournament,
  };
}

/**
 * Normalizes the GET /game/room/create query string.
 */
export function normalizeRemoteRoomCreateQuery(query = {}) {
  const isTournament = normalizeRemoteBoolean(query.tournament);
  const fallbackMaxPlayers = isTournament
    ? REMOTE_TOURNAMENT_MAX_PLAYERS
    : REMOTE_SINGLE_PLAYER_COUNT;
  const maxPlayers =
    query.maxPlayers === undefined || query.maxPlayers === null || query.maxPlayers === ""
      ? fallbackMaxPlayers
      : query.maxPlayers;

  return normalizeRemoteRoomOptions(maxPlayers, isTournament);
}

/**
 * Validates a remote room join WebSocket payload.
 */
export function normalizeJoinRoomByCodePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRemoteValidationError("Join room payload is invalid.");
  }

  return {
    roomId: normalizeRemoteRoomId(payload.roomId),
  };
}

/**
 * Validates a remote single-game start WebSocket payload.
 */
export function normalizeStartRoomGamePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRemoteValidationError("Start room payload is invalid.");
  }

  return {
    roomId: normalizeRemoteRoomId(payload.roomId),
  };
}

/**
 * Validates a remote room leave WebSocket payload.
 */
export function normalizeLeaveRoomPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRemoteValidationError("Leave room payload is invalid.");
  }

  return {
    roomId: normalizeRemoteRoomId(payload.roomId),
  };
}

/**
 * Validates a remote tournament start WebSocket payload.
 */
export function normalizeStartTournamentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRemoteValidationError("Start tournament payload is invalid.");
  }

  const roomId = normalizeRemoteRoomId(payload.roomId);
  return {
    roomId,
    tournamentId: normalizeRemoteTournamentId(payload.tournamentId, roomId),
  };
}

/**
 * Validates a remote matchmaking WebSocket payload.
 */
export function normalizeJoinMatchmakingPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRemoteValidationError("Matchmaking payload is invalid.");
  }

  return {
    mode: normalizeRemoteMatchmakingMode(payload.mode),
  };
}

function assertRoomPlayerShape(room) {
  if (!room || typeof room !== "object" || Array.isArray(room)) {
    throw createRemoteValidationError("Room state is invalid.");
  }

  if (!Array.isArray(room.joinedPlayers)) {
    throw createRemoteValidationError("Room players are invalid.");
  }

  const seenPlayerIds = new Set();
  room.joinedPlayers.forEach((player, index) => {
    if (!player || typeof player !== "object" || Array.isArray(player)) {
      throw createRemoteValidationError(`Player ${index + 1} is invalid.`);
    }

    const playerId = normalizeRemoteUserId(player.id, `Player ${index + 1} ID`);
    if (seenPlayerIds.has(playerId)) {
      throw createRemoteValidationError(`Player ${index + 1} is duplicated.`);
    }

    seenPlayerIds.add(playerId);
    normalizeRemoteUsername(player.username, `Player ${index + 1} username`);
  });
}

/**
 * Ensures a remote single room is ready to start exactly one 1v1 match.
 */
export function assertRemoteRoomCanStartSingle(room) {
  assertRoomPlayerShape(room);

  if (room.isTournament) {
    throw createRemoteValidationError("Tournament rooms cannot start a single match.");
  }

  normalizeRemotePlayerCount(room.maxPlayers, "single");

  if (room.joinedPlayers.length !== REMOTE_SINGLE_PLAYER_COUNT) {
    throw createRemoteValidationError("Remote single requires exactly 2 players.");
  }
}

/**
 * Ensures a remote tournament room has a valid bracket-sized player list.
 */
export function assertRemoteRoomCanStartTournament(room) {
  assertRoomPlayerShape(room);

  if (!room.isTournament) {
    throw createRemoteValidationError("Single rooms cannot start a tournament.");
  }

  normalizeRemotePlayerCount(room.maxPlayers, "tournament");
  normalizeRemotePlayerCount(room.joinedPlayers.length, "tournament");
}
