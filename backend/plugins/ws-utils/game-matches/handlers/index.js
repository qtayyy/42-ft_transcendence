/*
===============================================================================
FILE PURPOSE
This module assembles all remote game-match decorator handlers from
smaller handler files into a single object for plugin registration.
===============================================================================
*/

import { createDispatchMatchesHandler } from "./dispatch-matches.js";
import { createForfeitMatchHandler } from "./forfeit-match.js";
import { createGetGameStateHandler } from "./get-game-state.js";
import { createHandleLobbyReadyHandler } from "./handle-lobby-ready.js";
import { createPlayerPresenceHandlers } from "./player-presence.js";
import { createStartRematchHandler } from "./start-rematch.js";
import { createStartRoomGameHandler } from "./start-room-game.js";
import { createStartTournamentMatchHandler } from "./start-tournament-match.js";
import { createUpdateGameStateHandler } from "./update-game-state.js";

export function createGameMatchHandlers({
  fastify,
  safeSend,
  serializeGameState,
  broadcastState,
  startGameLoop,
  endGame,
}) {
  const { handlePlayerNavigatingAway, handlePlayerDisconnecting, handlePlayerReconnecting } =
    createPlayerPresenceHandlers({
      fastify,
      safeSend,
      broadcastState,
      endGame,
    });

  return {
    dispatchMatches: createDispatchMatchesHandler({
      fastify,
      safeSend,
      serializeGameState,
    }),
    updateGameState: createUpdateGameStateHandler({
      fastify,
      safeSend,
      broadcastState,
      startGameLoop,
    }),
    forfeitMatch: createForfeitMatchHandler({
      fastify,
      safeSend,
      endGame,
    }),
    handlePlayerNavigatingAway,
    handlePlayerDisconnecting,
    handlePlayerReconnecting,
    startRoomGame: createStartRoomGameHandler({
      fastify,
      safeSend,
      serializeGameState,
    }),
    startRematch: createStartRematchHandler({
      fastify,
      safeSend,
      serializeGameState,
    }),
    handleLobbyReady: createHandleLobbyReadyHandler({
      fastify,
      safeSend,
    }),
    startTournamentMatch: createStartTournamentMatchHandler({
      fastify,
      safeSend,
      serializeGameState,
    }),
    getGameState: createGetGameStateHandler({
      fastify,
      safeSend,
      serializeGameState,
    }),
  };
}
