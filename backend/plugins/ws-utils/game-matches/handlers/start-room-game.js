/*
===============================================================================
FILE PURPOSE
This module builds the `startRoomGame` Fastify decorator callback.
It creates a remote room match state and emits `GAME_MATCH_START` to both sides.
===============================================================================
*/

import {
  BALL_SIZE,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_DURATION,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
} from "../constants.js";

export function createStartRoomGameHandler({
  fastify,
  safeSend,
  serializeGameState,
}) {
  /**
   * Start a game from a remote room
   * Called when host clicks "Start Game" in the room lobby
   */
  return (roomId) => {
    const room = fastify.gameRooms.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.joinedPlayers.length < 2) throw new Error("Need at least 2 players");

    const player1 = room.joinedPlayers[0];
    const player2 = room.joinedPlayers[1];
    const matchId = `RS-${roomId}`;

    const initialGameState = {
      matchId: matchId,
      roomId: roomId,
      isRemote: true,
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: player1.id,
        username: player1.username,
        gamePaused: true,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: player2.id,
        username: player2.username,
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

    // Notify player 1 (left)
    const player1Socket = fastify.onlineUsers.get(player1.id);
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...serializeGameState(initialGameState), me: "LEFT" },
      },
      player1.id,
    );

    // Notify player 2 (right)
    const player2Socket = fastify.onlineUsers.get(player2.id);
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...serializeGameState(initialGameState), me: "RIGHT" },
      },
      player2.id,
    );

    console.log(
      `Remote game started: ${matchId} with ${player1.username} vs ${player2.username}`,
    );
    return matchId;
  };
}
