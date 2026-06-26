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
  PADDLE_SPEED,
  PADDLE_WIDTH,
  WIN_SCORE,
} from "../constants.js";
import {
  assertRemoteRoomCanStartSingle,
  normalizeRemoteRoomId,
  normalizeRemoteUserId,
} from "../../../../lib/remote-play-validation.js";
import {
  initializeRemoteStartCountdown,
  scheduleRemoteStartCountdown,
} from "../start-countdown.js";

export function createStartRoomGameHandler({
  fastify,
  safeSend,
  serializeGameState,
  broadcastState,
  startGameLoop,
}) {
  /**
   * Start a game from a remote room
   * Called when host clicks "Start Game" in the room lobby
   * @param {string} roomId
   * @param {number} actingUserId — must be the room host (JWT user)
   */
  return (roomId, actingUserId) => {
    const normalizedRoomId = normalizeRemoteRoomId(roomId);
    const normalizedActorId = normalizeRemoteUserId(
      actingUserId,
      "Acting user ID",
    );
//     console.log(`🎮 [START_ROOM_GAME] Received request to start room: ${normalizedRoomId}`);

    const room = fastify.gameRooms.get(normalizedRoomId);
    if (!room) {
      console.error(`❌ [START_ROOM_GAME] Room ${normalizedRoomId} not found!`);
      console.error(`❌ [START_ROOM_GAME] Available rooms:`, Array.from(fastify.gameRooms.keys()));
      throw new Error("Room not found");
    }

    if (Number(room.hostId) !== normalizedActorId) {
      console.warn(
        `[START_ROOM_GAME] Rejected: user ${normalizedActorId} is not host of ${normalizedRoomId} (host=${room.hostId})`,
      );
      throw new Error("Only the room host can start the game");
    }

//     console.log(`✅ [START_ROOM_GAME] Room found:`, {
//       roomId: normalizedRoomId,
//       hostId: room.hostId,
//       maxPlayers: room.maxPlayers,
//       joinedPlayers: room.joinedPlayers.map((p) => ({
//         id: p.id,
//         username: p.username,
//       })),
//     });

    try {
      assertRemoteRoomCanStartSingle(room);
    } catch (err) {
      if (!room.isTournament && Array.isArray(room.joinedPlayers) && room.joinedPlayers.length < 2) {
        console.error(`❌ [START_ROOM_GAME] Not enough players! Only ${room.joinedPlayers.length} player(s) in room`);

        // Release stale pre-game room binding so players can receive/send new invites.
        const affectedUserIds = new Set([
          Number(room.hostId),
          ...room.joinedPlayers.map((p) => Number(p.id)),
          ...room.invitedPlayers.map((p) => Number(p.id)),
        ]);

        affectedUserIds.forEach((uid) => {
          fastify.currentRoom.delete(uid);
          const socket = fastify.onlineUsers.get(uid);
          safeSend(socket, { event: "LEAVE_ROOM" }, uid);
        });

        fastify.gameRooms.delete(normalizedRoomId);
      }
      throw err;
    }

    const player1 = room.joinedPlayers[0];
    const player2 = room.joinedPlayers[1];
    const matchId = `RS-${normalizedRoomId}`;

    const initialGameState = {
      matchId: matchId,
      roomId: normalizedRoomId,
      isRemote: true,
      progressionEligible: Boolean(room.isMatchmade && room.isPublic),
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: player1.id,
        username: player1.username,
        gamePaused: false,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: player2.id,
        username: player2.username,
        gamePaused: false,
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
        paddleSpeed: PADDLE_SPEED,
        ballSize: BALL_SIZE,
        winScore: WIN_SCORE,
        matchDuration: MATCH_DURATION,
      },
    };
    initializeRemoteStartCountdown(initialGameState);

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

    scheduleRemoteStartCountdown({
      fastify,
      gameState: initialGameState,
      broadcastState,
      startGameLoop,
    });

//     console.log(
//       `Remote game started: ${matchId} with ${player1.username} vs ${player2.username}`,
//     );
    return matchId;
  };
}
