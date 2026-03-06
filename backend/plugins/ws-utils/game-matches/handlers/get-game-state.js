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
      console.log(`[getGameState] No game state found for match ${matchId}`);
      return;
    }

    // Verify user is part of the game or a spectator
    const isPlayer =
      String(gameState.leftPlayer?.id) === String(userId) ||
      String(gameState.rightPlayer?.id) === String(userId);
    const isSpectator = fastify.matchSpectators?.get(matchId)?.has(Number(userId));

    if (!isPlayer && !isSpectator) {
      // Optional: check if user is admin or just allow it?
      // For now, let's allow it but log it
      console.log(
        `[getGameState] User ${userId} requested state for ${matchId} but is not player/spectator`,
      );
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
          },
        },
        Number(userId),
      );
    }
  };
}
