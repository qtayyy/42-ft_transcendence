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

// Track finished single remote matches briefly so result-screen rematch/leave
// actions can still be validated after the live game state is cleaned up.
const postGameRematchSessions = new Map(); // matchId -> session
const POST_GAME_REMATCH_SESSION_TTL_MS = 10 * 60 * 1000;

// Periodic diagnostic to monitor for memory leaks
setInterval(() => {
  if (gameLoops.size > 0) {
    console.log(
      `[Game Loop Monitor] Active game loops: ${gameLoops.size} | Matches: [${Array.from(gameLoops.keys()).join(", ")}]`,
    );
  }
}, 30000); // Log every 30 seconds if there are active loops

function clearPostGameRematchSession(matchId) {
  const session = postGameRematchSessions.get(matchId);
  if (!session) return;

  clearTimeout(session.timeout);
  postGameRematchSessions.delete(matchId);
}

function registerPostGameRematchSession(gameState) {
  if (gameState.tournamentId || !gameState.isRemote) return;

  const matchId = gameState.matchId;
  clearPostGameRematchSession(matchId);

  const session = {
    matchId,
    leftId: Number(gameState.leftPlayer.id),
    rightId: Number(gameState.rightPlayer.id),
    leftLeft: false,
    rightLeft: false,
    timeout: null,
  };
  session.timeout = setTimeout(() => {
    postGameRematchSessions.delete(matchId);
  }, POST_GAME_REMATCH_SESSION_TTL_MS);
  postGameRematchSessions.set(matchId, session);
}

function getPostGameRematchSession(matchId) {
  return postGameRematchSessions.get(matchId) || null;
}

function markPostGamePlayerLeft(matchId, userId) {
  const session = getPostGameRematchSession(matchId);
  if (!session) return null;

  const uid = Number(userId);
  if (uid !== session.leftId && uid !== session.rightId) return null;

  if (uid === session.leftId) {
    session.leftLeft = true;
    return { session, opponentId: session.rightId };
  }

  session.rightLeft = true;
  return { session, opponentId: session.leftId };
}

function canStartPostGameRematch(matchId, player1Id, player2Id) {
  const session = getPostGameRematchSession(matchId);
  if (!session) {
    return { ok: false, reason: "Rematch expired" };
  }

  const p1 = Number(player1Id);
  const p2 = Number(player2Id);
  const samePlayers =
    (p1 === session.leftId && p2 === session.rightId) ||
    (p1 === session.rightId && p2 === session.leftId);

  if (!samePlayers) {
    return { ok: false, reason: "Rematch not allowed" };
  }

  if (session.leftLeft || session.rightLeft) {
    return { ok: false, reason: "Opponent has left the game" };
  }

  return { ok: true };
}

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
  fastify.decorate("registerPostGameRematchSession", registerPostGameRematchSession);
  fastify.decorate("markPostGamePlayerLeft", markPostGamePlayerLeft);
  fastify.decorate("canStartPostGameRematch", canStartPostGameRematch);
  fastify.decorate("clearPostGameRematchSession", clearPostGameRematchSession);

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
