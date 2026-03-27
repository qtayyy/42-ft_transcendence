import TournamentManager, {
  activeTournaments,
} from "../../../game/TournamentManager.js";
import { finalizeMatchResult } from "../../../services/match-finalization.js";

// Keep the route base as /api/tournament even though this file no longer uses
// the generic "index.js" name.
export const autoPrefix = "/";

export default async function (fastify, opts) {
  const isLocalTournamentId = (id) =>
    typeof id === "string" && id.startsWith("local-tournament-");

  /**
   * Local tournaments are device-scoped and should not be blocked by auth expiry.
   * Remote tournaments still require authentication.
   */
  const authenticateTournamentRequest = async (request, reply) => {
    const bodyTournamentId =
      request.body && typeof request.body === "object"
        ? request.body.tournamentId
        : null;
    const paramTournamentId =
      request.params && typeof request.params === "object"
        ? request.params.id
        : null;
    const tournamentId = bodyTournamentId || paramTournamentId;

    if (isLocalTournamentId(tournamentId)) return;
    await fastify.authenticate(request, reply);
  };

  // Expose activeTournaments to fastify instance for other plugins (ws-game-matches)
  // fastify.decorate("activeTournaments", activeTournaments); // Already decorated in websockets.js

  // Periodic cleanup for stale tournaments
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 60 minutes
  const TOURNAMENT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  const COMPLETED_TTL = 60 * 60 * 1000; // 1 hour

  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [tournamentId, tournament] of activeTournaments.entries()) {
      const shouldClean =
        // Remove completed tournaments after 1 hour
        (tournament.isComplete() &&
          tournament.completedAt &&
          now - tournament.completedAt > COMPLETED_TTL) ||
        // Remove inactive tournaments after 24 hours
        (tournament.createdAt && now - tournament.createdAt > TOURNAMENT_TTL);

      if (shouldClean) {
        activeTournaments.delete(tournamentId);
        cleanedCount++;
        console.log(`[Cleanup] Removed stale tournament: ${tournamentId}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Cleanup] Removed ${cleanedCount} stale tournament(s)`);
    }
  }, CLEANUP_INTERVAL);

  /**
   * Create a new tournament
   * POST /api/tournament/create
   */
  fastify.post(
    "/create",
    {
      preHandler: [authenticateTournamentRequest],
    },
    async (request, reply) => {
      console.log(
        `[POST /create] Tournament creation request. Body: ${JSON.stringify(request.body)}`,
      );
      try {
        const { players, tournamentId: customTournamentId } = request.body; // Array of {id, name, isTemp}

        if (!players || players.length < 3 || players.length > 8) {
          return reply.code(400).send({
            error: "Tournament must have 3-8 players",
          });
        }

        if (
          customTournamentId &&
          (customTournamentId.length < 3 || customTournamentId.length > 64)
        ) {
          return reply.code(400).send({
            error: "Tournament name/ID must be between 3 and 64 characters",
          });
        }

        // Use custom tournamentId if provided, otherwise generate one
        const tournamentId = customTournamentId || `RT-${Date.now()}`;

        // Check if tournament already exists
        if (activeTournaments.has(tournamentId)) {
          // Return existing tournament data
          const existingTournament = activeTournaments.get(tournamentId);
          return reply.code(200).send({
            success: true,
            tournamentId: tournamentId,
            format: existingTournament.format,
            totalRounds: existingTournament.totalRounds,
            matches: existingTournament.matches,
            leaderboard: existingTournament.getLeaderboard(),
            currentRound: existingTournament.currentRound,
          });
        }

        // Create tournament manager
        const tournament = new TournamentManager(tournamentId, players);

        // Generate initial matches based on format
        if (tournament.format === "round-robin") {
          tournament.matches = tournament.generateRoundRobinPairings();
        } else if (tournament.format === "swiss") {
          tournament.matches = tournament.generateSwissPairings(1);
        }

        // Store tournament
        activeTournaments.set(tournamentId, tournament);

        return reply.code(200).send({
          success: true,
          tournamentId: tournamentId,
          format: tournament.format,
          totalRounds: tournament.totalRounds,
          matches: tournament.matches,
          leaderboard: tournament.getLeaderboard(),
        });
      } catch (error) {
        console.error("Error creating tournament:", error);
        return reply.code(500).send({ error: "Failed to create tournament" });
      }
    },
  );

  /**
   * Get tournament status
   * GET /api/tournament/:id
   */
  fastify.get(
    "/:id",
    {
      preHandler: [authenticateTournamentRequest],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const tournament = activeTournaments.get(id);

        if (!tournament) {
          return reply.code(404).send({ error: "Tournament not found" });
        }

        return reply.code(200).send(tournament.getSummary());
      } catch (error) {
        console.error("Error fetching tournament:", error);
        return reply.code(500).send({ error: "Failed to fetch tournament" });
      }
    },
  );

  /**
   * Update match result and standings
   * POST /api/tournament/:id/match-result
   */
  fastify.post(
    "/:id/match-result",
    {
      preHandler: [authenticateTournamentRequest],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const {
          matchId,
          player1Id,
          player2Id,
          score,
          outcome,
          winnerId,
          durationSeconds,
        } =
          request.body;

        const tournament = activeTournaments.get(id);

        if (!tournament) {
          return reply.code(404).send({ error: "Tournament not found" });
        }

        // Find and update the match
        const match = tournament.matches.find((m) => m.matchId === matchId);
        if (!match) {
          return reply.code(404).send({ error: "Match not found" });
        }

        // Idempotency: duplicate submissions can happen after reconnect/retry.
        // Let TournamentManager handle status transitions + round advancement safely.
        const wasAlreadyCompleted = match.status === "completed";
        const updateResult = tournament.updateMatchResult(
          matchId,
          score,
          outcome,
          winnerId || null,
        );
        if (!updateResult.success) {
          return reply.code(400).send({ error: "Failed to update match result" });
        }

        // Persist match to database (only when at least player1 is a registered user)
        if (!wasAlreadyCompleted && player1Id) {
          try {
            await finalizeMatchResult({
              externalMatchId: matchId,
              player1Id,
              player2Id: player2Id || null,
              score1: score.p1,
              score2: score.p2,
              durationSeconds,
              mode: "LOCAL_TOURNAMENT",
              tournamentId: id,
            });
          } catch (dbError) {
            console.error("Failed to persist local tournament match:", dbError);
          }
        }

        return reply.code(200).send({
          success: true,
          leaderboard: tournament.getLeaderboard(),
          isComplete: tournament.isComplete(),
          currentRound: tournament.currentRound,
          nextMatches: tournament.matches.filter((m) => m.status === "pending"),
        });
      } catch (error) {
        console.error("Error updating match result:", error);
        return reply.code(500).send({ error: "Failed to update match result" });
      }
    },
  );

  /**
   * Get current leaderboard
   * GET /api/tournament/:id/leaderboard
   */
  fastify.get(
    "/:id/leaderboard",
    {
      preHandler: [authenticateTournamentRequest],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const tournament = activeTournaments.get(id);

        if (!tournament) {
          return reply.code(404).send({ error: "Tournament not found" });
        }

        return reply.code(200).send({
          leaderboard: tournament.getLeaderboard(),
          format: tournament.format,
          currentRound: tournament.currentRound,
          totalRounds: tournament.totalRounds,
        });
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return reply.code(500).send({ error: "Failed to fetch leaderboard" });
      }
    },
  );

  /**
   * Get next match to play
   * GET /api/tournament/:id/next-match
   */
  fastify.get(
    "/:id/next-match",
    {
      preHandler: [authenticateTournamentRequest],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const tournament = activeTournaments.get(id);

        if (!tournament) {
          return reply.code(404).send({ error: "Tournament not found" });
        }

        const nextMatch = tournament.getNextMatch();

        return reply.code(200).send({
          nextMatch: nextMatch || null,
          isComplete: tournament.isComplete(),
          currentRound: tournament.currentRound,
        });
      } catch (error) {
        console.error("Error fetching next match:", error);
        return reply.code(500).send({ error: "Failed to fetch next match" });
      }
    },
  );
}
