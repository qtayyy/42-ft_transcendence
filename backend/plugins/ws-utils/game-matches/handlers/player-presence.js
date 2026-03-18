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

import { DISCONNECT_GRACE_PERIOD } from "../constants.js";

export function createPlayerPresenceHandlers({
  fastify,
  safeSend,
  broadcastState,
  endGame,
}) {
  const markPlayerDisconnected = (gameState, disconnectedPlayer, matchId, userId) => {
    // A disconnect starts its own grace window even if the match was already
    // paused for manual resume. This keeps reconnect UI timers accurate.
    gameState.paused = true;
    gameState.pausedAt = Date.now();
    gameState.resumeReady = { LEFT: false, RIGHT: false };

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
      console.log(
        `[Disconnect] Grace period expired for ${disconnectedPlayer} in match ${matchId}`,
      );

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
      console.log(`[Navigate Away] No game state found for match ${matchId}`);
      return;
    }

    const uid = Number(userId);
    let disconnectedPlayer = null;

    if (uid === gameState.leftPlayer?.id) {
      disconnectedPlayer = "LEFT";
    } else if (uid === gameState.rightPlayer?.id) {
      disconnectedPlayer = "RIGHT";
    } else {
      console.log(`[Navigate Away] User ${userId} not in match ${matchId}`);
      return;
    }

    // Don't pause if game is already over or hasn't started yet
    if (gameState.gameOver || !gameState.gameStarted) {
      console.log(
        `[Navigate Away] Game ${matchId} not in progress (gameOver=${gameState.gameOver}, gameStarted=${gameState.gameStarted}), ignoring`,
      );
      return;
    }

    console.log(
      `[Navigate Away] User ${userId} (${disconnectedPlayer}) left match ${matchId}`,
    );

    markPlayerDisconnected(gameState, disconnectedPlayer, matchId, userId);

    // Notify ALL participants (including this player's other tabs and spectators)
    broadcastState(gameState, fastify);

    // If it's a tournament match, update tournament state immediately for forfeit
    if (gameState.isTournamentMatch && gameState.tournamentId) {
      console.log(`[Navigate Away] Processing tournament forfeit for ${matchId}`);
      if (fastify.handleTournamentMatchEnd) {
        // The remaining player is the winner
        const winnerId =
          disconnectedPlayer === "LEFT"
            ? gameState.rightPlayer.id
            : gameState.leftPlayer.id;
        fastify.handleTournamentMatchEnd(gameState.tournamentId, matchId, winnerId);
      }
    }

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
          console.log(
            `[Navigate Away] Evicting disconnected user ${disconnectedId} from room ${gameState.roomId}`,
          );
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

    console.log(
      `[Disconnect] Hard disconnect for user ${userId} (${disconnectedPlayer}) from match ${matchId}`,
    );

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
      console.log(
        `[Reconnect] User ${userId} (${reconnectedPlayer}) not in disconnected set, ignoring`,
      );
      return;
    }

    console.log(
      `[Reconnect] User ${userId} (${reconnectedPlayer}) returned to match ${matchId}`,
    );

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

    // If no more disconnected players, handle the transition to manual resume state
    if (gameState.disconnectedPlayers.size === 0) {
      gameState.disconnectedPlayer = null;
      console.log(
        `[Reconnect] All players back in ${matchId}, remaining PAUSED until manual resume`,
      );
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
                ? "PAUSED_WAITING_FOR_SPACE"
                : "WAITING_FOR_OTHERS",
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
