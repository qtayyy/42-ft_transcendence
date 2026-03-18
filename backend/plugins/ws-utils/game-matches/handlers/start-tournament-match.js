/*
===============================================================================
FILE PURPOSE
This module builds the `startTournamentMatch` Fastify decorator callback.
It initializes a tournament match game state and notifies both players.
===============================================================================
*/

import {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_DURATION,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  WIN_SCORE,
} from "../constants.js";

export function createStartTournamentMatchHandler({
  fastify,
  safeSend,
  serializeGameState,
}) {
  /**
   * Start a tournament match between two players
   * This creates the game state and notifies both players to start playing
   */
  return (
    matchId,
    tournamentId,
    player1Id,
    player1Name,
    player2Id,
    player2Name,
  ) => {
    // Ensure numeric IDs for socket lookup
    const p1Id = Number(player1Id);
    const p2Id = Number(player2Id);

    console.log(
      `[startTournamentMatch] Attempting to start match ${matchId} (${player1Name} vs ${player2Name})`,
    );

    const player1Socket = fastify.onlineUsers.get(p1Id);
    const player2Socket = fastify.onlineUsers.get(p2Id);

    if (!player1Socket || !player2Socket) {
      console.error(
        `Cannot start tournament match - one or both players offline: P1:${p1Id}(${!!player1Socket}) P2:${p2Id}(${!!player2Socket})`,
      );

      // Notify the player who tried to start it (we don't know who triggered it here easily without passing userId,
      // but usually the active player triggers it. We'll try to notify both if online).
      const errorPayload = {
        message: "Cannot start match: Opponent is offline or disconnected.",
      };
      if (player1Socket)
        safeSend(
          player1Socket,
          { event: "TOURNAMENT_ERROR", payload: errorPayload },
          p1Id,
        );
      if (player2Socket)
        safeSend(
          player2Socket,
          { event: "TOURNAMENT_ERROR", payload: errorPayload },
          p2Id,
        );

      return null;
    }

    // Update match status in tournament to 'inprogress' safely
    if (fastify.activeTournaments && tournamentId) {
      const tournament = fastify.activeTournaments.get(tournamentId);
      if (tournament) {
        const marked = tournament.markMatchInProgress(matchId);
        console.log(
          `[startTournamentMatch] Marked match ${matchId} in progress: ${marked}`,
        );
      } else {
        console.error(
          `[startTournamentMatch] Tournament ${tournamentId} not found!`,
        );
      }
    }

    const initialGameState = {
      matchId: matchId,
      tournamentId: tournamentId,
      isRemote: true,
      isTournamentMatch: true,
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: p1Id,
        username: player1Name,
        gamePaused: true,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: p2Id,
        username: player2Name,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      // Timer will be initialized when game loop starts
      timer: null,
      // Power-ups and effects
      powerUps: [],
      activeEffect: null,
      // Explicitly initialize disconnect/pause fields to prevent false positives
      paused: false,
      pausedAt: null,
      disconnectedPlayer: null,
      disconnectedPlayers: new Set(),
      gameStarted: false,
      gameOver: false,
      // Game constants for frontend rendering
      constant: {
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        ballSize: BALL_SIZE,
        winScore: WIN_SCORE,
        matchDuration: MATCH_DURATION,
      },
    };

    fastify.gameStates.set(matchId, initialGameState);

    // Notify player 1 (left)
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...serializeGameState(initialGameState), me: "LEFT" },
      },
      p1Id,
    );

    // Notify player 2 (right)
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...serializeGameState(initialGameState), me: "RIGHT" },
      },
      p2Id,
    );

    console.log(
      `Tournament match started: ${matchId} (${tournamentId}) - ${player1Name} vs ${player2Name}`,
    );
    return matchId;
  };
}
