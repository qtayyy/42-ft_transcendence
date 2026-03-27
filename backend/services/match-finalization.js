import { PrismaClient } from "../generated/prisma/index.js";
import { persistMatchRecord } from "./match-persistence.js";
import { applyProfileProgression } from "./profile-progression.js";

const prisma = new PrismaClient();

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
export async function finalizeMatchResult(payload) {
    return prisma.$transaction(async (tx) => {
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