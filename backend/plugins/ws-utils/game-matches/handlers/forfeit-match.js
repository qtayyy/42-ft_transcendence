/*
===============================================================================
FILE PURPOSE
This module builds the `forfeitMatch` Fastify decorator callback.
It resolves match forfeits and triggers normal game end cleanup.
===============================================================================
*/

export function createForfeitMatchHandler({ fastify, safeSend, endGame }) {
  return (matchId, userId) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) throw new Error("Match not found");

    const uid = Number(userId);
    let winner = null;
    let winnerId = null;

    if (uid === gameState.leftPlayer.id) {
      winner = "RIGHT";
      winnerId = gameState.rightPlayer.id;
    } else if (uid === gameState.rightPlayer.id) {
      winner = "LEFT";
      winnerId = gameState.leftPlayer.id;
    } else {
      throw new Error("User not in this match");
    }

    gameState.gameOver = true;
    gameState.winner = winner;
    gameState.forfeit = true;
    gameState.winnerId = winnerId; // Custom prop to pass to endGame

    // Notify the winner that the opponent has left (surrendered)
    // This ensures their UI updates to disable "Rematch" even if they haven't disconnected yet
    const winnerSocket = fastify.onlineUsers.get(winnerId);
    if (winnerSocket) {
      safeSend(
        winnerSocket,
        {
          event: "OPPONENT_LEFT",
          payload: { matchId },
        },
        winnerId,
      );
    }

    console.log(
      `[forfeitMatch] Match ${matchId} forfeited by ${userId}. Winner: ${winner}`,
    );
    endGame(gameState);
  };
}
