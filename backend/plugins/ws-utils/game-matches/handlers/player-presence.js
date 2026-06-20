/*
===============================================================================
FILE PURPOSE
This module builds player presence-related match handlers:
- `handlePlayerNavigatingAway`
- `handlePlayerDisconnecting`
- `handlePlayerReconnecting`
It coordinates pause/disconnect grace behavior and forced forfeits.
===============================================================================
*/

import {
  DISCONNECT_GRACE_PERIOD,
  RECONNECT_RESUME_DELAY,
} from "../constants.js";

export function createPlayerPresenceHandlers({
  fastify,
  safeSend,
  broadcastState,
  endGame,
  reconnectResumeDelay = RECONNECT_RESUME_DELAY,
}) {
  const markPlayerDisconnected = (gameState, disconnectedPlayer, matchId, userId) => {
    // A fresh disconnect cancels any pending automatic resume.
    if (gameState.reconnectResumeTimeout) {
      clearTimeout(gameState.reconnectResumeTimeout);
      gameState.reconnectResumeTimeout = null;
    }
    gameState.resumeAt = null;

    // Preserve the beginning of the server-controlled pause while additional
    // players disconnect, so the match clock is frozen for the full outage.
    if (!gameState.paused || !gameState.pausedAt) {
      gameState.pausedAt = Date.now();
    }
    gameState.paused = true;
    gameState.resumeReady = null;

    if (!gameState.disconnectedPlayers) {
      gameState.disconnectedPlayers = new Set();
    }
    gameState.disconnectedPlayers.add(disconnectedPlayer);
    gameState.disconnectedPlayer = disconnectedPlayer;

    const opponentSide = disconnectedPlayer === "LEFT" ? "RIGHT" : "LEFT";
    const opponentId =
      opponentSide === "LEFT"
        ? gameState.leftPlayer?.id
        : gameState.rightPlayer?.id;
    const opponentSocket = fastify.onlineUsers.get(Number(opponentId));

    safeSend(
      opponentSocket,
      {
        event: "OPPONENT_DISCONNECTED",
        payload: {
          matchId,
          disconnectedPlayer,
          userId,
          gracePeriodEndsAt: gameState.pausedAt + DISCONNECT_GRACE_PERIOD,
        },
      },
      opponentId,
    );
  };

  const resetDisconnectTimeout = (
    gameState,
    disconnectedPlayer,
    matchId,
    onExpire,
  ) => {
    const timeoutKey =
      disconnectedPlayer === "LEFT"
        ? "leftDisconnectTimeout"
        : "rightDisconnectTimeout";

    if (gameState[timeoutKey]) {
      clearTimeout(gameState[timeoutKey]);
      gameState[timeoutKey] = null;
    }

    gameState[timeoutKey] = setTimeout(() => {
//       console.log(
//         `[Disconnect] Grace period expired for ${disconnectedPlayer} in match ${matchId}`,
//       );

      const bothDisconnected = gameState.disconnectedPlayers?.size >= 2;
      if (bothDisconnected) {
        gameState.gameOver = true;
        gameState.winner = null;
        gameState.winnerId = null;
        gameState.doubleForfeit = true;
        gameState.forfeit = true;
      } else {
        const winner = disconnectedPlayer === "LEFT" ? "RIGHT" : "LEFT";
        const winnerId =
          disconnectedPlayer === "LEFT"
            ? gameState.rightPlayer?.id
            : gameState.leftPlayer?.id;
        gameState.gameOver = true;
        gameState.winner = winner;
        gameState.winnerId = winnerId;
        gameState.forfeit = true;
      }

      endGame(gameState).catch(console.error);
      gameState[timeoutKey] = null;
      if (onExpire) onExpire();
    }, DISCONNECT_GRACE_PERIOD);
  };

  /**
   * Handle player navigating away from game page
   * Pauses the game and starts disconnect timer
   */
  const handlePlayerNavigatingAway = (matchId, userId) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) {
//       console.log(`[Navigate Away] No game state found for match ${matchId}`);
      return;
    }

    const uid = Number(userId);
    let disconnectedPlayer = null;

    if (uid === gameState.leftPlayer?.id) {
      disconnectedPlayer = "LEFT";
    } else if (uid === gameState.rightPlayer?.id) {
      disconnectedPlayer = "RIGHT";
    } else {
//       console.log(`[Navigate Away] User ${userId} not in match ${matchId}`);
      return;
    }

    // Don't pause if game is already over or hasn't started yet
    if (gameState.gameOver || !gameState.gameStarted) {
//       console.log(
//         `[Navigate Away] Game ${matchId} not in progress (gameOver=${gameState.gameOver}, gameStarted=${gameState.gameStarted}), ignoring`,
//       );
      return;
    }

//     console.log(
//       `[Navigate Away] User ${userId} (${disconnectedPlayer}) left match ${matchId}`,
//     );

    markPlayerDisconnected(gameState, disconnectedPlayer, matchId, userId);

    // Notify ALL participants (including this player's other tabs and spectators)
    broadcastState(gameState, fastify);

    // Set timeout for auto-forfeit
    resetDisconnectTimeout(
      gameState,
      disconnectedPlayer,
      matchId,
      () => {
        // Properly clean up disconnected user from server state since they won't trigger LEAVE_ROOM
        const disconnectedId =
          disconnectedPlayer === "LEFT"
            ? gameState.leftPlayer?.id
            : gameState.rightPlayer?.id;
        if (disconnectedId) {
//           console.log(
//             `[Navigate Away] Evicting disconnected user ${disconnectedId} from room ${gameState.roomId}`,
//           );
          fastify.leaveRoom(gameState.roomId, disconnectedId);
        }
      },
    );
  };

  /**
   * Handle player returning to game (reconnecting)
   * Only processes if the player was actually marked as disconnected
   */
  const handlePlayerDisconnecting = (matchId, userId) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState || gameState.gameOver || !gameState.gameStarted) return;

    const uid = Number(userId);
    let disconnectedPlayer = null;

    if (uid === gameState.leftPlayer?.id) {
      disconnectedPlayer = "LEFT";
    } else if (uid === gameState.rightPlayer?.id) {
      disconnectedPlayer = "RIGHT";
    } else {
      return;
    }

//     console.log(
//       `[Disconnect] Hard disconnect for user ${userId} (${disconnectedPlayer}) from match ${matchId}`,
//     );

    markPlayerDisconnected(gameState, disconnectedPlayer, matchId, userId);

    resetDisconnectTimeout(gameState, disconnectedPlayer, matchId);

    // Broadcast update to everyone
    broadcastState(gameState, fastify);
  };

  const handlePlayerReconnecting = (matchId, userId) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) return;

    const uid = Number(userId);
    let reconnectedPlayer = null;

    if (uid === gameState.leftPlayer?.id) {
      reconnectedPlayer = "LEFT";
    } else if (uid === gameState.rightPlayer?.id) {
      reconnectedPlayer = "RIGHT";
    } else {
      return;
    }

    // Only process reconnection if this player was actually disconnected
    // This prevents false positives on initial game load
    if (
      !gameState.disconnectedPlayers ||
      !gameState.disconnectedPlayers.has(reconnectedPlayer)
    ) {
//       console.log(
//         `[Reconnect] User ${userId} (${reconnectedPlayer}) not in disconnected set, ignoring`,
//       );
      return;
    }

//     console.log(
//       `[Reconnect] User ${userId} (${reconnectedPlayer}) returned to match ${matchId}`,
//     );

    // Clear disconnect timeout
    const timeoutKey =
      reconnectedPlayer === "LEFT"
        ? "leftDisconnectTimeout"
        : "rightDisconnectTimeout";
    if (gameState[timeoutKey]) {
      clearTimeout(gameState[timeoutKey]);
      gameState[timeoutKey] = null;
    }

    // Remove from disconnected players
    gameState.disconnectedPlayers.delete(reconnectedPlayer);

    // Once everyone is connected, resume automatically after a short countdown.
    if (gameState.disconnectedPlayers.size === 0) {
      gameState.disconnectedPlayer = null;
      gameState.resumeAt = Date.now() + reconnectResumeDelay;
      gameState.reconnectResumeTimeout = setTimeout(() => {
        gameState.reconnectResumeTimeout = null;
        if (
          gameState.gameOver ||
          !gameState.disconnectedPlayers ||
          gameState.disconnectedPlayers.size > 0
        ) {
          return;
        }

        const pauseDuration = gameState.pausedAt
          ? Date.now() - gameState.pausedAt
          : 0;
        if (pauseDuration > 0 && gameState.timer?.startTime) {
          gameState.timer.startTime += pauseDuration;
        }
        if (pauseDuration > 0 && gameState.activeEffect?.expiresAt) {
          gameState.activeEffect.expiresAt += pauseDuration;
        }

        gameState.paused = false;
        gameState.pausedAt = null;
        gameState.resumeAt = null;
        gameState.resumeReady = null;

        const resumePayload = {
          event: "GAME_RESUMED",
          payload: { matchId },
        };
        safeSend(
          fastify.onlineUsers.get(Number(gameState.leftPlayer.id)),
          resumePayload,
          gameState.leftPlayer.id,
        );
        safeSend(
          fastify.onlineUsers.get(Number(gameState.rightPlayer.id)),
          resumePayload,
          gameState.rightPlayer.id,
        );
        broadcastState(gameState, fastify);
      }, reconnectResumeDelay);
    }

    // Always notify about the specific player who reconnected (for toasts/UI markers)
    const opponentSide = reconnectedPlayer === "LEFT" ? "RIGHT" : "LEFT";
    const currentOpponentId =
      opponentSide === "LEFT"
        ? gameState.leftPlayer?.id
        : gameState.rightPlayer?.id;
    const opponentSocket = fastify.onlineUsers.get(Number(currentOpponentId));

    if (opponentSocket) {
      safeSend(
        opponentSocket,
        {
          event: "OPPONENT_RECONNECTED",
          payload: {
            matchId,
            reconnectedPlayer,
            status:
              gameState.disconnectedPlayers.size === 0
                ? "RESUMING_AUTOMATICALLY"
                : "WAITING_FOR_OTHERS",
            resumeAt: gameState.resumeAt,
          },
        },
        currentOpponentId,
      );
    }

    // Broadcast full game state to EVERYONE (syncs high-level UI like pause overlays)
    broadcastState(gameState, fastify);
  };

  return {
    handlePlayerNavigatingAway,
    handlePlayerDisconnecting,
    handlePlayerReconnecting,
  };
}
