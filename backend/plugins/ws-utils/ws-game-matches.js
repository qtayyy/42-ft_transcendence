/*
===============================================================================
FILE PURPOSE
This Fastify plugin manages remote WebSocket game matches:
- Match creation/start and state lifecycle
- Real-time game loop broadcasting
- Pause/resume, reconnect, disconnect and forfeit handling
- Tournament/lobby coordination for remote matches
===============================================================================
*/

import fp from "fastify-plugin";
import {
  safeSend,
  serializeGameState,
  serializeRoutineGameTick,
} from "../../utils/ws-utils.js";
import { activeTournaments } from "../../game/TournamentManager.js";
import { createGameLifecycle } from "./game-matches/lifecycle.js";
import { createGameMatchHandlers } from "./game-matches/handlers/index.js";

// Track running game loops per match
const gameLoops = new Map(); // matchId -> intervalHandle

// Track spectators per match
const matchSpectators = new Map(); // matchId -> Set of spectatorIds

// Periodic diagnostic to monitor for memory leaks
setInterval(() => {
  if (gameLoops.size > 0) {
    console.log(
      `[Game Loop Monitor] Active game loops: ${gameLoops.size} | Matches: [${Array.from(gameLoops.keys()).join(", ")}]`,
    );
  }
}, 30000); // Log every 30 seconds if there are active loops

function buildDisconnectCountdown(gameState) {
  // Compute disconnect countdown if game is paused due to disconnect
  if (gameState.paused && gameState.disconnectedPlayer && gameState.pausedAt) {
    const gracePeriodEndsAt = gameState.pausedAt + 30000; // 30 second grace period
    return {
      disconnectedPlayer: gameState.disconnectedPlayer,
      gracePeriodEndsAt,
      countdown: Math.max(0, Math.ceil((gracePeriodEndsAt - Date.now()) / 1000)),
    };
  }

  return null;
}

function buildFullStatePayload(gameState) {
  // Build base payload - use helper to convert Set to array for JSON serialization
  return {
    ...serializeGameState(gameState),
    disconnectCountdown: buildDisconnectCountdown(gameState),
  };
}

function broadcastState(gameState, fastify) {
  const leftId = Number(gameState.leftPlayer.id);
  const rightId = Number(gameState.rightPlayer.id);
  const leftPlayerSocket = fastify.onlineUsers.get(leftId);
  const rightPlayerSocket = fastify.onlineUsers.get(rightId);
  const basePayload = buildFullStatePayload(gameState);

  // Send to players
  safeSend(
    leftPlayerSocket,
    {
      event: "GAME_STATE",
      payload: { ...basePayload, me: "LEFT" },
    },
    leftId,
  );
  safeSend(
    rightPlayerSocket,
    {
      event: "GAME_STATE",
      payload: { ...basePayload, me: "RIGHT" },
    },
    rightId,
  );

  // Send to spectators
  const spectators = matchSpectators.get(gameState.matchId);
  if (spectators && spectators.size > 0) {
    const spectatorPayload = { ...basePayload, spectatorMode: true };
    spectators.forEach((spectatorId) => {
      const spectatorSocket = fastify.onlineUsers.get(spectatorId);
      safeSend(
        spectatorSocket,
        { event: "GAME_STATE", payload: spectatorPayload },
        spectatorId,
      );
    });
  }
}

function broadcastGameplayTick(
  gameState,
  fastify,
  { includeSpectators = true } = {},
) {
  const leftId = Number(gameState.leftPlayer.id);
  const rightId = Number(gameState.rightPlayer.id);
  const leftPlayerSocket = fastify.onlineUsers.get(leftId);
  const rightPlayerSocket = fastify.onlineUsers.get(rightId);
  const routinePayload = serializeRoutineGameTick(gameState);

  safeSend(
    leftPlayerSocket,
    { event: "GAME_TICK", payload: routinePayload },
    leftId,
  );
  safeSend(
    rightPlayerSocket,
    { event: "GAME_TICK", payload: routinePayload },
    rightId,
  );

  const spectators = matchSpectators.get(gameState.matchId);
  if (includeSpectators && spectators && spectators.size > 0) {
    spectators.forEach((spectatorId) => {
      const spectatorSocket = fastify.onlineUsers.get(spectatorId);
      safeSend(
        spectatorSocket,
        { event: "GAME_TICK", payload: routinePayload },
        spectatorId,
      );
    });
  }
}

// Fastify plugin
export default fp(async (fastify) => {
  // Expose matchSpectators to fastify instance
  fastify.decorate("matchSpectators", matchSpectators);

  const { endGame, startGameLoop } = createGameLifecycle({
    fastify,
    gameLoops,
    matchSpectators,
    safeSend,
    activeTournaments,
    broadcastState,
    broadcastGameplayTick,
  });

  const handlers = createGameMatchHandlers({
    fastify,
    safeSend,
    serializeGameState,
    broadcastState,
    startGameLoop,
    endGame,
  });

  fastify.decorate("dispatchMatches", handlers.dispatchMatches);
  fastify.decorate("updateGameState", handlers.updateGameState);
  fastify.decorate("forfeitMatch", handlers.forfeitMatch);
  fastify.decorate("handlePlayerNavigatingAway", handlers.handlePlayerNavigatingAway);
  fastify.decorate("handlePlayerDisconnecting", handlers.handlePlayerDisconnecting);
  fastify.decorate("handlePlayerReconnecting", handlers.handlePlayerReconnecting);
  fastify.decorate("startRoomGame", handlers.startRoomGame);
  fastify.decorate("startRematch", handlers.startRematch);
  fastify.decorate("handleLobbyReady", handlers.handleLobbyReady);
  fastify.decorate("startTournamentMatch", handlers.startTournamentMatch);
  fastify.decorate("getGameState", handlers.getGameState);
});
