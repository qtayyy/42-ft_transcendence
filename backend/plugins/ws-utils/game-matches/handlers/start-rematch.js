/*
===============================================================================
FILE PURPOSE
This module builds the `startRematch` Fastify decorator callback.
It starts a new remote match for the same two players without creating a room.
===============================================================================
*/

import crypto from "crypto";
import {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_DURATION,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
} from "../constants.js";

export function createStartRematchHandler({
  fastify,
  safeSend,
  serializeGameState,
}) {
  /**
   * Start a rematch with the same players (no room needed)
   */
  return (player1Id, player1Username, player2Id, player2Username) => {
    // Check if both players are still online
    const player1Socket = fastify.onlineUsers.get(player1Id);
    const player2Socket = fastify.onlineUsers.get(player2Id);

    if (!player1Socket || !player2Socket) {
      // One or both players left - notify the remaining player
      if (player1Socket) {
        safeSend(
          player1Socket,
          {
            event: "REMATCH_FAILED",
            payload: { reason: "Opponent has left the game" },
          },
          player1Id,
        );
      }
      if (player2Socket) {
        safeSend(
          player2Socket,
          {
            event: "REMATCH_FAILED",
            payload: { reason: "Opponent has left the game" },
          },
          player2Id,
        );
      }
      return null;
    }

    const roomId = crypto.randomUUID();
    const matchId = `RS-${roomId}`;

    const initialGameState = {
      matchId: matchId,
      roomId: null, // No room for rematch
      isRemote: true,
      isRematch: true,
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: player1Id,
        username: player1Username,
        gamePaused: true,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: player2Id,
        username: player2Username,
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
        matchDuration: MATCH_DURATION,
      },
    };

    fastify.gameStates.set(matchId, initialGameState);

    // Notify player 1 (left) - reuse socket from online check
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...serializeGameState(initialGameState), me: "LEFT" },
      },
      player1Id,
    );

    // Notify player 2 (right) - reuse socket from online check
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...serializeGameState(initialGameState), me: "RIGHT" },
      },
      player2Id,
    );

    console.log(
      `Rematch started: ${matchId} with ${player1Username} vs ${player2Username}`,
    );
    return matchId;
  };
}
