/*
===============================================================================
FILE PURPOSE
This module builds the `dispatchMatches` Fastify decorator callback.
It initializes tournament match game states and notifies both players.
===============================================================================
*/

import {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_DURATION,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
} from "../constants.js";

export function createDispatchMatchesHandler({
  fastify,
  safeSend,
  serializeGameState,
}) {
  /**
   * For each match in matches, send the event "GAME_MATCH_START to each player"
   * To-do: Change this to handle > 2 players.
   */
  return (matches) => {
    matches.forEach((match) => {
      // Ensure player IDs are numeric — Prisma can return BigInt/String from DB
      const p1Id = Number(match.player1Id);
      const p2Id = Number(match.player2Id);

      const initialGameState = {
        tournamentId: match.tournamentId,
        matchId: match.id,
        isRemote: true,
        isTournamentMatch: true,
        ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
        leftPlayer: {
          id: p1Id, // Always numeric
          username: match.player1.username,
          gamePaused: true,
          score: match.score1,
          paddleX: 0,
          paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
          paddleHeight: PADDLE_HEIGHT,
          moving: "",
        },
        rightPlayer: {
          id: p2Id, // Always numeric
          username: match.player2.username,
          gamePaused: true,
          score: match.score2,
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
          paddleSpeed: PADDLE_SPEED,
          ballSize: BALL_SIZE,
          matchDuration: MATCH_DURATION,
        },
      };
      fastify.gameStates.set(match.id, initialGameState);

      console.log(
        `[dispatchMatches] Dispatching match ${match.id}: p1=${p1Id} vs p2=${p2Id}`,
      );

      const player1Socket = fastify.onlineUsers.get(p1Id);
      if (!player1Socket) {
        console.warn(`[dispatchMatches] p1 socket not found for userId=${p1Id}`);
      }
      safeSend(
        player1Socket,
        {
          event: "GAME_MATCH_START",
          payload: { ...serializeGameState(initialGameState), me: "LEFT" },
        },
        p1Id,
      );

      const player2Socket = fastify.onlineUsers.get(p2Id);
      if (!player2Socket) {
        console.warn(`[dispatchMatches] p2 socket not found for userId=${p2Id}`);
      }
      safeSend(
        player2Socket,
        {
          event: "GAME_MATCH_START",
          payload: { ...serializeGameState(initialGameState), me: "RIGHT" },
        },
        p2Id,
      );
    });
  };
}
