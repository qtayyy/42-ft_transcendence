"use client";

export const REMOTE_ROOM_CODE_MAX_LENGTH = 36;
export const REMOTE_SINGLE_PLAYER_COUNT = 2;
export const REMOTE_TOURNAMENT_MIN_PLAYERS = 3;
export const REMOTE_TOURNAMENT_MAX_PLAYERS = 8;

export type RemoteMatchmakingMode = "single" | "tournament";

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCHMAKING_MODES = new Set<RemoteMatchmakingMode>([
	"single",
	"tournament",
]);

export function normalizeRemoteRoomCode(value: unknown) {
	return String(value ?? "").trim().toLowerCase();
}

export function validateRemoteRoomCode(
	value: unknown,
	label = "Room code"
): ValidationResult<string> {
	const roomCode = normalizeRemoteRoomCode(value);

	if (!roomCode) {
		return { ok: false, error: `${label} is required.` };
	}

	if (roomCode.length > REMOTE_ROOM_CODE_MAX_LENGTH) {
		return { ok: false, error: `${label} is too long.` };
	}

	if (!UUID_PATTERN.test(roomCode)) {
		return { ok: false, error: `${label} must be a valid UUID.` };
	}

	return { ok: true, value: roomCode };
}

export function validateRemoteTournamentId(
	value: unknown,
	expectedRoomCode?: unknown
): ValidationResult<string> {
	const tournamentId = String(value ?? "").trim();
	if (!tournamentId.startsWith("RT-")) {
		return { ok: false, error: "Tournament ID must start with RT-." };
	}

	const tournamentRoomCode = validateRemoteRoomCode(
		tournamentId.slice(3),
		"Tournament room code"
	);
	if (!tournamentRoomCode.ok) return tournamentRoomCode;
	if (expectedRoomCode !== undefined) {
		const expectedRoomCodeResult = validateRemoteRoomCode(
			expectedRoomCode,
			"Tournament room code"
		);
		if (!expectedRoomCodeResult.ok) return expectedRoomCodeResult;
		if (tournamentRoomCode.value !== expectedRoomCodeResult.value) {
			return {
				ok: false,
				error: "Tournament ID must match the room code.",
			};
		}
	}

	return { ok: true, value: `RT-${tournamentRoomCode.value}` };
}

export function buildRemoteTournamentId(roomCode: string) {
	return `RT-${normalizeRemoteRoomCode(roomCode)}`;
}

export function validateRemoteMatchmakingMode(
	value: unknown
): ValidationResult<RemoteMatchmakingMode> {
	const mode = String(value ?? "").trim().toLowerCase();
	if (!MATCHMAKING_MODES.has(mode as RemoteMatchmakingMode)) {
		return { ok: false, error: "Matchmaking mode is invalid." };
	}

	return { ok: true, value: mode as RemoteMatchmakingMode };
}

export function validateRemotePlayerCount(
	value: unknown,
	mode: RemoteMatchmakingMode
): ValidationResult<number> {
	const count = Number(value);
	if (!Number.isInteger(count)) {
		return { ok: false, error: "Player count is invalid." };
	}

	if (mode === "single") {
		return count === REMOTE_SINGLE_PLAYER_COUNT
			? { ok: true, value: count }
			: { ok: false, error: "Remote single requires exactly 2 players." };
	}

	if (
		count < REMOTE_TOURNAMENT_MIN_PLAYERS ||
		count > REMOTE_TOURNAMENT_MAX_PLAYERS
	) {
		return {
			ok: false,
			error: `Remote tournaments require ${REMOTE_TOURNAMENT_MIN_PLAYERS}-${REMOTE_TOURNAMENT_MAX_PLAYERS} players.`,
		};
	}

	return { ok: true, value: count };
}
