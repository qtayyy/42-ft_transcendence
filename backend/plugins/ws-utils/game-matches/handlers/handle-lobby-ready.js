/*
===============================================================================
FILE PURPOSE
This module builds the `handleLobbyReady` Fastify decorator callback.
It updates tournament lobby ready states and starts matches when both are ready.
===============================================================================
*/

export function createHandleLobbyReadyHandler({ fastify, safeSend }) {
  /**
   * Handle player clicking "Ready" in the lobby
   */
  return (tournamentId, matchId, userId) => {
    if (!fastify.activeTournaments) return;
    const tournament = fastify.activeTournaments.get(tournamentId);
    if (!tournament) {
      console.error(`[handleLobbyReady] Tournament ${tournamentId} not found`);
      const socket = fastify.onlineUsers.get(Number(userId));
      if (socket)
        safeSend(
          socket,
          {
            event: "TOURNAMENT_ERROR",
            payload: { message: "Tournament not found" },
          },
          userId,
        );
      return;
    }

    const match = tournament.matches.find((m) => m.matchId === matchId);
    if (!match) {
      console.error(`[handleLobbyReady] Match ${matchId} not found`);
      const socket = fastify.onlineUsers.get(Number(userId));
      if (socket)
        safeSend(
          socket,
          {
            event: "TOURNAMENT_ERROR",
            payload: { message: "Match not found" },
          },
          userId,
        );
      return;
    }

    // Check if opponent is withdrawn (left the tournament)
    const uid = Number(userId);
    const isP1 = Number(match.player1.id) === uid;
    const opponentId = isP1
      ? match.player2
        ? Number(match.player2.id)
        : null
      : Number(match.player1.id);

    if (opponentId && tournament.isPlayerWithdrawn(opponentId)) {
      // Opponent has withdrawn - auto-win for the ready player
      console.log(
        `[handleLobbyReady] Opponent ${opponentId} is withdrawn, auto-winning match ${matchId} for ${userId}`,
      );

      tournament.updateMatchResult(matchId, { p1: 0, p2: 0 }, "walkover", uid);

      // Broadcast tournament update
      const tournamentData = tournament.getSummary();
      tournament.players.forEach((player) => {
        const socket = fastify.onlineUsers.get(Number(player.id));
        if (socket) {
          safeSend(
            socket,
            {
              event: "TOURNAMENT_UPDATE",
              payload: tournamentData,
            },
            Number(player.id),
          );
        }
      });

      // Notify the ready player about the walkover
      const socket = fastify.onlineUsers.get(uid);
      if (socket) {
        safeSend(
          socket,
          {
            event: "MATCH_WALKOVER",
            payload: {
              matchId,
              winnerId: uid,
              reason: "Opponent left the tournament",
            },
          },
          uid,
        );
      }
      return;
    }

    const result = tournament.setLobbyReady(matchId, userId);
    if (!result.success) {
      console.error(
        `[handleLobbyReady] Failed to set ready state for match ${matchId}`,
      );
      return;
    }

    console.log(
      `[LobbyReady] Player ${userId} ready for match ${matchId}. AllReady: ${result.allReady}`,
    );

    if (result.allReady) {
      // Both players ready - Start the match
      // Handle Bye case (player2 might be null) - though Bye is auto-ready usually
      if (!match.player2) {
        // Auto-process bye? Usually byes are processed by TournamentManager immediately or end-round.
        // But if a bye player clicks ready... actually bye matches should be auto-processed or just wait.
        // My TournamentManager logic sets p1Ready=true for Bye.
        console.log("Bye match ready? Should verify logic.");
        return;
      }

      fastify.startTournamentMatch(
        match.matchId,
        match.tournamentId,
        match.player1.id,
        match.player1.username || match.player1.name, // TournamentManager uses 'username', fallback to 'name'
        match.player2.id,
        match.player2.username || match.player2.name, // TournamentManager uses 'username', fallback to 'name'
      );
    } else {
      // Broadcast update so other player sees the checkmark
      const tournamentData = tournament.getSummary();
      tournament.players.forEach((player) => {
        const socket = fastify.onlineUsers.get(Number(player.id));
        if (socket) {
          safeSend(
            socket,
            {
              event: "TOURNAMENT_UPDATE",
              payload: tournamentData,
            },
            Number(player.id),
          );
        }
      });
    }
  };
}
