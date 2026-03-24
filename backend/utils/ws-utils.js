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
