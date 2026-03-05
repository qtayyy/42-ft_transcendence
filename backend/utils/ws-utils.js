export function safeSend(socket, data, userId) {
  if (!socket) {
    console.warn(`WS missing for user ${userId}. Was trying to send:`);
    console.warn(data);
    return;
  }

  if (socket.readyState !== WebSocket.OPEN) {
    console.warn(`WS for user ${userId} is not open`);
    return;
  }

  try {
    console.log(`Sending to user ${userId}:`);
    console.log(data);
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
