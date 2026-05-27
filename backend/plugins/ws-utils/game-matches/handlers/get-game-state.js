/*
===============================================================================
FILE PURPOSE
This module builds the `getGameState` Fastify decorator callback.
It returns the latest game state snapshot to a player or spectator.
===============================================================================
*/

export function createGetGameStateHandler({ fastify, safeSend, serializeGameState }) {
  return (matchId, userId) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) {
//       console.log(`[getGameState] No game state found for match ${matchId}`);
      return;
    }

    // Verify user is part of the game or a spectator
    const isPlayer =
      String(gameState.leftPlayer?.id) === String(userId) ||
      String(gameState.rightPlayer?.id) === String(userId);
    const isSpectator = fastify.matchSpectators?.get(matchId)?.has(Number(userId));

    if (!isPlayer && !isSpectator) {
      console.warn(
        `[getGameState] Denied: user ${userId} is not a player or spectator for ${matchId}`,
      );
      const socket = fastify.onlineUsers.get(Number(userId));
      if (socket) {
        safeSend(
          socket,
          {
            event: "GAME_STATE_DENIED",
            payload: { matchId, reason: "not_authorized" },
          },
          Number(userId),
        );
      }
      return;
    }

    const socket = fastify.onlineUsers.get(Number(userId));
    if (socket) {
      safeSend(
        socket,
        {
          event: "GAME_STATE",
          payload: {
            ...serializeGameState(gameState),
            me:
              String(gameState.leftPlayer?.id) === String(userId)
                ? "LEFT"
                : "RIGHT",
            ...(isSpectator && !isPlayer ? { spectatorMode: true } : {}),
          },
        },
        Number(userId),
      );
    }
  };
}
