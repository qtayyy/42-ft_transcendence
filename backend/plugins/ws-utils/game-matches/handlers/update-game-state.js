import { applyPaddleStep } from "../engine.js";

/*
===============================================================================
FILE PURPOSE
This module builds the `updateGameState` Fastify decorator callback.
It handles player input, ready state, pause/resume coordination, and loop start.
===============================================================================
*/

export function createUpdateGameStateHandler({
  fastify,
  safeSend,
  broadcastState,
  startGameLoop,
}) {
  return (matchId, userId, keyEvent) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) {
      console.warn(
        `[updateGameState] Match ${matchId} not found for user ${userId}. available: [${[...fastify.gameStates.keys()].join(", ")}]`,
      );
      return; // Early return to prevent crash, but log the issue
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
      return; // Just ignore invalid input
    }

    const currentPlayer =
      player === "LEFT" ? gameState.leftPlayer : gameState.rightPlayer;

    // SPACE = Pause/Resume game (requires mutual agreement for resume)
    if (keyEvent === "PAUSE") {
      // Only allow pause when game is actually running (both players ready and game started)
      const gameRunning = gameState.gameStarted && !gameState.paused;

      if (gameState.paused) {
        // Mark this player as ready to resume
        if (!gameState.resumeReady) {
          gameState.resumeReady = { LEFT: false, RIGHT: false };
        }
        gameState.resumeReady[player] = true;

        // Check if BOTH players are ready to resume
        if (gameState.resumeReady.LEFT && gameState.resumeReady.RIGHT) {
          // Both players agreed to resume - actually resume the game
          if (gameState.pausedAt) {
            const pauseDuration = Date.now() - gameState.pausedAt;

            // Adjust timer start time to effectively "freeze" the timer during pause
            if (gameState.timer && gameState.timer.startTime) {
              gameState.timer.startTime += pauseDuration;
            }

            // Adjust active effect expiry time
            if (gameState.activeEffect && gameState.activeEffect.expiresAt) {
              gameState.activeEffect.expiresAt += pauseDuration;
            }

            gameState.pausedAt = null;
          }

          gameState.paused = false;
          gameState.disconnectedPlayer = null;
          gameState.resumeReady = null; // Clear resume states

          // Notify both players that game is resuming via specialized events
          // for tactical immediate feedback (e.g. toasts)
          const leftSocket = fastify.onlineUsers.get(
            Number(gameState.leftPlayer.id),
          );
          const rightSocket = fastify.onlineUsers.get(
            Number(gameState.rightPlayer.id),
          );
          safeSend(
            leftSocket,
            { event: "GAME_RESUMED", payload: { matchId } },
            gameState.leftPlayer.id,
          );
          safeSend(
            rightSocket,
            { event: "GAME_RESUMED", payload: { matchId } },
            gameState.rightPlayer.id,
          );

          // CRITICAL: Also broadcast the FULL state immediately so both players'
          // draw loops see the unpaused state right away
          broadcastState(gameState, fastify);
        } else {
          // One player ready, notify the other
          const otherPlayerId =
            player === "LEFT"
              ? gameState.rightPlayer.id
              : gameState.leftPlayer.id;
          const otherSocket = fastify.onlineUsers.get(Number(otherPlayerId));
          safeSend(
            otherSocket,
            {
              event: "OPPONENT_READY_TO_RESUME",
              payload: {
                matchId,
                readyPlayer: player,
                waitingFor: player === "LEFT" ? "RIGHT" : "LEFT",
              },
            },
            otherPlayerId,
          );

          // Also notify the player who pressed space that they're waiting
          const currentSocket = fastify.onlineUsers.get(Number(uid));
          safeSend(
            currentSocket,
            {
              event: "WAITING_FOR_RESUME",
              payload: {
                matchId,
                yourReady: true,
                waitingFor: player === "LEFT" ? "RIGHT" : "LEFT",
              },
            },
            uid,
          );
        }

        // Broadcast the updated state (including resumeReady) so both players see the update
        broadcastState(gameState, fastify);
      } else if (gameRunning) {
        // Prevent accidental rapid re-pause if user just resumed but is still holding SPACE
        // (Minimum 1 second between manual pause actions)
        const lastPauseAction = gameState.lastPauseActionAt || 0;
        if (Date.now() - lastPauseAction < 1000) {
          return;
        }

        // Pause the game - any player can pause
        gameState.paused = true;
        gameState.pausedAt = Date.now();
        gameState.lastPauseActionAt = gameState.pausedAt;
        gameState.pausedBy = player;
        gameState.resumeReady = { LEFT: false, RIGHT: false }; // Reset resume states

        // Notify both players about pause via specialized event
        const leftSocket = fastify.onlineUsers.get(
          Number(gameState.leftPlayer.id),
        );
        const rightSocket = fastify.onlineUsers.get(
          Number(gameState.rightPlayer.id),
        );
        const pausePayload = {
          event: "GAME_PAUSED",
          payload: {
            matchId,
            pausedBy: player,
            pausedByName: currentPlayer.username,
          },
        };
        safeSend(leftSocket, pausePayload, gameState.leftPlayer.id);
        safeSend(rightSocket, pausePayload, gameState.rightPlayer.id);

        // Also notify spectators
        if (fastify.matchSpectators) {
          const spectators = fastify.matchSpectators.get(matchId);
          if (spectators) {
            spectators.forEach((spectatorId) => {
              const spectatorSocket = fastify.onlineUsers.get(
                Number(spectatorId),
              );
              safeSend(spectatorSocket, pausePayload, spectatorId);
            });
          }
        }

        // CRITICAL: Call broadcastState immediately so UI updates right away
        broadcastState(gameState, fastify);
      }
    }
    // ENTER = Ready toggle (pre-game only)
    else if (keyEvent === "START") {
      // Only allow ready toggle if game hasn't started yet
      // Once gameStarted is true, ENTER should not toggle ready state
      if (!gameState.gameStarted) {
        currentPlayer.gamePaused = !currentPlayer.gamePaused;
        // Broadcast immediately so UI updates for both players
        broadcastState(gameState, fastify);
      }
      // Note: ENTER no longer resumes from pause - use SPACE instead
    } else if (keyEvent !== "PAUSE") {
      const canMovePaddle = gameState.gameStarted && !gameState.paused;

      if (canMovePaddle && (keyEvent === "UP" || keyEvent === "DOWN")) {
        applyPaddleStep(gameState, player, keyEvent);
      }

      currentPlayer.moving = "";
      currentPlayer.movingExpiresAt = 0;
    }

    // Start game ONLY when both unpaused (= ready)
    if (
      !gameState.leftPlayer.gamePaused &&
      !gameState.rightPlayer.gamePaused &&
      !gameState.paused
    ) {
      // Mark game as started - prevents ENTER from toggling ready state again
      if (!gameState.gameStarted) {
        gameState.gameStarted = true;
      }
      startGameLoop(gameState);
    }

    if (
      gameState.leftPlayer.gamePaused ||
      gameState.rightPlayer.gamePaused ||
      gameState.paused
    ) {
      // Broadcast state change (e.g. one player ready) so UI updates
      broadcastState(gameState, fastify);
    }
  };
}
