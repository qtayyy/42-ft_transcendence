import { applyPaddleStep } from "../engine.js";

/*
===============================================================================
FILE PURPOSE
This module builds the authoritative remote-game input handler. Remote matches
accept ready and paddle actions, while pause state is owned exclusively by the
server-side disconnect/reconnection lifecycle.
===============================================================================
*/

/**
 * Creates the handler that validates a remote player and applies one input.
 * Manual PAUSE messages are intentionally ignored even when sent by a modified
 * client; only presence handlers may freeze a remote match.
 */
export function createUpdateGameStateHandler({
  fastify,
  broadcastState,
  startGameLoop,
}) {
  return (matchId, userId, keyEvent) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) {
      console.warn(
        `[updateGameState] Match ${matchId} not found for user ${userId}. available: [${[...fastify.gameStates.keys()].join(", ")}]`,
      );
      return;
    }

    const uid = Number(userId);
    const leftId = Number(gameState.leftPlayer.id);
    const rightId = Number(gameState.rightPlayer.id);
    let player;

    if (uid === leftId) player = "LEFT";
    else if (uid === rightId) player = "RIGHT";
    else {
      console.warn(
        `[updateGameState] User ${uid} not found in players for match ${matchId}. players: [${leftId}, ${rightId}]`,
      );
      return;
    }

    // Enforce the fairness policy on the server, not only in the frontend.
    if (keyEvent === "PAUSE") return;

    const currentPlayer =
      player === "LEFT" ? gameState.leftPlayer : gameState.rightPlayer;

    // ENTER toggles ready state only before play begins.
    if (keyEvent === "START") {
      if (!gameState.gameStarted) {
        currentPlayer.gamePaused = !currentPlayer.gamePaused;
        broadcastState(gameState, fastify);
      }
    } else {
      const canMovePaddle = gameState.gameStarted && !gameState.paused;
      if (canMovePaddle && (keyEvent === "UP" || keyEvent === "DOWN")) {
        applyPaddleStep(gameState, player, keyEvent);
      }

      currentPlayer.moving = "";
      currentPlayer.movingExpiresAt = 0;
    }

    const bothPlayersReady =
      !gameState.leftPlayer.gamePaused && !gameState.rightPlayer.gamePaused;
    if (bothPlayersReady && !gameState.paused) {
      if (!gameState.gameStarted) gameState.gameStarted = true;
      startGameLoop(gameState);
    }

    if (!bothPlayersReady || gameState.paused) {
      broadcastState(gameState, fastify);
    }
  };
}
