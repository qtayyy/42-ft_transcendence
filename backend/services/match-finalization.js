import { PrismaClient } from "../generated/prisma/index.js";
import { persistMatchRecord } from "./match-persistence.js";
import { applyProfileProgression } from "./progression-profile.js";

const prisma = new PrismaClient();
const PROGRESSION_ELIGIBLE_MODES = new Set(["REMOTE", "REMOTE_TOURNAMENT"]);

/** Normalize a persisted/caller mode before applying progression policy. */
function normalizeMatchMode(mode) {
    return typeof mode === "string"
        ? mode.trim().toUpperCase().replace(/-/g, "_")
        : "LOCAL";
}

/** Only server-authoritative remote matches may alter profile progression. */
export function isProgressionEligibleMode(mode) {
    return PROGRESSION_ELIGIBLE_MODES.has(normalizeMatchMode(mode));
}

function toPositiveIntOrNull(value) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized <= 0) {
        return null;
    }
    return normalized;
}

/**
 * Finalize a match consistently across all write paths:
 * 1) Persist match idempotently
 * 2) Apply profile progression exactly once per logical match
 */
export async function finalizeMatchResult(payload, options = {}) {
    const prismaClient = options.prismaClient ?? prisma;

    return prismaClient.$transaction(async (tx) => {
        const { match, reusedExisting } = await persistMatchRecord(payload, {
            prismaClient: tx,
        });

        if (reusedExisting) {
            return {
                match,
                reusedExisting,
                progressionApplied: false,
                playerUpdates: [],
            };
        }

        // Local, local-tournament, and AI matches remain available in match
        // history, but cannot change XP, level, competitive records, or
        // achievements. This must be enforced here because callers are mixed.
        if (
            options.progressionEligible !== true ||
            !isProgressionEligibleMode(match.mode ?? payload.mode)
        ) {
            return {
                match,
                reusedExisting,
                progressionApplied: false,
                playerUpdates: [],
            };
        }

        const player1Id = toPositiveIntOrNull(payload.player1Id);
        const player2Id = toPositiveIntOrNull(payload.player2Id);
        const score1 = Number(payload.score1) || 0;
        const score2 = Number(payload.score2) || 0;
        const matchMode = payload.mode;
        const playerUpdates = [];

        if (player1Id) {
            const player1Update = await applyProfileProgression({
                prismaClient: tx,
                profileId: player1Id,
                playerScore: score1,
                opponentScore: score2,
                matchMode,
            });
            playerUpdates.push({ profileId: player1Id, ...player1Update });
        }

        if (player2Id) {
            const player2Update = await applyProfileProgression({
                prismaClient: tx,
                profileId: player2Id,
                playerScore: score2,
                opponentScore: score1,
                matchMode,
            });
            playerUpdates.push({ profileId: player2Id, ...player2Update });
        }

        return {
            match,
            reusedExisting,
            progressionApplied: true,
            playerUpdates,
        };
    });
}
