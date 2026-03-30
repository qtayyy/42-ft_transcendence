export function safeSend(socket, data, userId) {
  if (!socket) {
    return;
  }

  // Handle multiple sockets per user as a Set
  if (socket instanceof Set) {
    socket.forEach((s) => safeSend(s, data, userId));
    return;
  }

  if (socket.readyState !== (global.WebSocket?.OPEN || 1)) {
    return;
  }

  try {
    socket.send(JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to send to user ${userId}`, err);
  }
}

/**
 * Helper to serialize game state for JSON (converts Set to array,
 * strips non-serializable Timeout handles that cause circular JSON errors).
 */
export function serializeGameState(gameState) {
  if (!gameState) return null;

  // Destructure out any Timeout/interval handles stored directly on gameState
  // so they don't get serialised (they contain circular references).
  const {
    leftDisconnectTimeout, // Timeout handle - not serialisable
    rightDisconnectTimeout, // Timeout handle - not serialisable
    ...rest
  } = gameState;

  return {
    ...rest,
    disconnectedPlayers:
      gameState.disconnectedPlayers instanceof Set
        ? [...gameState.disconnectedPlayers]
        : gameState.disconnectedPlayers || [],
  };
}

/**
 * Serialize the high-frequency gameplay fields used during active remote play.
 * This keeps routine websocket packets smaller than full state snapshots.
 */
export function serializeRoutineGameTick(gameState) {
  if (!gameState) return null;

  return {
    matchId: gameState.matchId,
    gameStarted: Boolean(gameState.gameStarted),
    paused: Boolean(gameState.paused),
    ball: {
      posX: gameState.ball?.posX ?? 0,
      posY: gameState.ball?.posY ?? 0,
      dx: gameState.ball?.dx ?? 0,
      dy: gameState.ball?.dy ?? 0,
    },
    leftPlayer: {
      paddleY: gameState.leftPlayer?.paddleY ?? 0,
    },
    rightPlayer: {
      paddleY: gameState.rightPlayer?.paddleY ?? 0,
    },
    timer: gameState.timer
      ? {
          timeElapsed: gameState.timer.timeElapsed ?? 0,
          timeRemaining: gameState.timer.timeRemaining ?? 0,
        }
      : null,
  };
}
