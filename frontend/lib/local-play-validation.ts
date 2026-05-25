"use client";

export const LOCAL_GUEST_NAME_MAX_LENGTH = 24;
export const LOCAL_PLAYER_NAME_MAX_LENGTH = 64;
export const LOCAL_TOURNAMENT_MIN_PLAYERS = 3;
export const LOCAL_TOURNAMENT_MAX_PLAYERS = 8;
export const LOCAL_SCORE_MIN = 0;
export const LOCAL_SCORE_MAX = 1000;

export type LocalAIDifficulty = "easy" | "medium" | "hard";
export type LocalTournamentOutcome = "win" | "draw" | "bye" | "walkover";

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

type LocalTournamentResultInput = {
	matchId?: unknown;
	player1Id?: unknown;
	player2Id?: unknown;
	score?: unknown;
	outcome?: unknown;
	durationSeconds?: unknown;
};

const VALID_AI_DIFFICULTIES = new Set<LocalAIDifficulty>([
	"easy",
	"medium",
	"hard",
]);
const VALID_TOURNAMENT_OUTCOMES = new Set<LocalTournamentOutcome>([
	"win",
	"draw",
	"bye",
	"walkover",
]);
const DISALLOWED_NAME_CHARACTERS = /[\u0000-\u001f\u007f<>`"\\/]/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * Normalizes local display names before they are written to localStorage or sent
 * to the backend tournament API.
 */
export function normalizeLocalPlayerName(value: unknown) {
	return String(value ?? "")
		.replace(/[\u0000-\u001f\u007f]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Validates a guest/player display name and prevents confusing duplicates in a
 * local match or tournament lobby.
 */
export function validateLocalPlayerName(
	value: unknown,
	existingNames: string[] = [],
	label = "Player name",
	maxLength = LOCAL_GUEST_NAME_MAX_LENGTH
): ValidationResult<string> {
	const name = normalizeLocalPlayerName(value);

	if (!name) {
		return { ok: false, error: `${label} is required.` };
	}

	if (name.length > maxLength) {
		return {
			ok: false,
			error: `${label} must be ${maxLength} characters or less.`,
		};
	}

	if (DISALLOWED_NAME_CHARACTERS.test(name)) {
		return {
			ok: false,
			error: `${label} cannot contain control characters, quotes, slashes, or angle brackets.`,
		};
	}

	const normalizedName = name.toLocaleLowerCase();
	const hasDuplicate = existingNames
		.map((existingName) => normalizeLocalPlayerName(existingName).toLocaleLowerCase())
		.includes(normalizedName);

	if (hasDuplicate) {
		return { ok: false, error: `${label} must be unique.` };
	}

	return { ok: true, value: name };
}

/**
 * Converts any AI difficulty-like value into one of the supported runtime modes.
 */
export function normalizeLocalAIDifficulty(value: unknown): LocalAIDifficulty {
	const normalized = String(value ?? "").trim().toLowerCase();
	return VALID_AI_DIFFICULTIES.has(normalized as LocalAIDifficulty)
		? (normalized as LocalAIDifficulty)
		: "medium";
}

function normalizeSafeId(value: unknown, label: string): ValidationResult<string> {
	const id = String(value ?? "").trim();

	if (!SAFE_ID_PATTERN.test(id)) {
		return { ok: false, error: `${label} is invalid.` };
	}

	return { ok: true, value: id };
}

function normalizeOptionalPlayerId(value: unknown, label: string): ValidationResult<string | number | null> {
	if (value === null || value === undefined || value === "") {
		return { ok: true, value: null };
	}

	if (typeof value === "number") {
		return Number.isInteger(value) && value > 0
			? { ok: true, value }
			: { ok: false, error: `${label} is invalid.` };
	}

	return normalizeSafeId(value, label);
}

function normalizeScoreValue(value: unknown, label: string): ValidationResult<number> {
	const score = Number(value);

	if (
		!Number.isInteger(score) ||
		score < LOCAL_SCORE_MIN ||
		score > LOCAL_SCORE_MAX
	) {
		return {
			ok: false,
			error: `${label} must be a whole number from ${LOCAL_SCORE_MIN} to ${LOCAL_SCORE_MAX}.`,
		};
	}

	return { ok: true, value: score };
}

/**
 * Normalizes a local tournament result before replaying/submitting it.
 */
export function normalizeLocalTournamentResultPayload(
	input: LocalTournamentResultInput
): ValidationResult<{
	matchId: string;
	player1Id: string | number | null;
	player2Id: string | number | null;
	score: { p1: number; p2: number };
	outcome: LocalTournamentOutcome;
	durationSeconds?: number;
}> {
	const matchId = normalizeSafeId(input.matchId, "Match ID");
	if (!matchId.ok) return matchId;

	const player1Id = normalizeOptionalPlayerId(input.player1Id, "Player 1 ID");
	if (!player1Id.ok) return player1Id;

	const player2Id = normalizeOptionalPlayerId(input.player2Id, "Player 2 ID");
	if (!player2Id.ok) return player2Id;

	const scoreInput =
		input.score && typeof input.score === "object"
			? (input.score as { p1?: unknown; p2?: unknown })
			: null;
	if (!scoreInput) {
		return { ok: false, error: "Score is required." };
	}

	const p1 = normalizeScoreValue(scoreInput.p1, "Player 1 score");
	if (!p1.ok) return p1;

	const p2 = normalizeScoreValue(scoreInput.p2, "Player 2 score");
	if (!p2.ok) return p2;

	const outcome = String(input.outcome ?? "").trim().toLowerCase();
	if (!VALID_TOURNAMENT_OUTCOMES.has(outcome as LocalTournamentOutcome)) {
		return { ok: false, error: "Tournament result outcome is invalid." };
	}

	const normalizedOutcome = outcome as LocalTournamentOutcome;
	if (normalizedOutcome === "draw" && p1.value !== p2.value) {
		return { ok: false, error: "Draw results must have equal scores." };
	}

	if (normalizedOutcome === "bye" && player2Id.value !== null) {
		return { ok: false, error: "Bye results cannot include a second player." };
	}

	const payload: {
		matchId: string;
		player1Id: string | number | null;
		player2Id: string | number | null;
		score: { p1: number; p2: number };
		outcome: LocalTournamentOutcome;
		durationSeconds?: number;
	} = {
		matchId: matchId.value,
		player1Id: player1Id.value,
		player2Id: player2Id.value,
		score: { p1: p1.value, p2: p2.value },
		outcome: normalizedOutcome,
	};

	if (input.durationSeconds !== undefined) {
		const durationSeconds = Number(input.durationSeconds);
		if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400) {
			return { ok: false, error: "Match duration is invalid." };
		}
		payload.durationSeconds = Math.round(durationSeconds);
	}

	return { ok: true, value: payload };
}
