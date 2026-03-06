/*
===============================================================================
FILE PURPOSE
This module encapsulates remote match lifecycle behavior:
- Detecting game-over conditions
- Ending games and persisting results
- Running/stopping the real-time game loop
===============================================================================
*/

import {
  MATCH_DURATION,
  POWERUP_SPAWN_INTERVAL,
  TICK_MS,
} from "./constants.js";
import {
  checkCollisionsAndScore,
  checkPowerUpCollision,
  spawnPowerUp,
  updateActiveEffect,
  updateBall,
  updatePaddles,
  updateTimer,
} from "./engine.js";

export function createGameLifecycle({
  fastify,
  prisma,
  gameLoops,
  matchSpectators,
  safeSend,
  activeTournaments,
  broadcastState,
}) {
  // Check if game should end (timer expired - highest score wins)
  function checkGameOver(gameState) {
    // Check if timer has expired
    if (gameState.timer && gameState.timer.timeRemaining <= 0) {
      const leftScore = gameState.leftPlayer.score;
      const rightScore = gameState.rightPlayer.score;

      if (leftScore > rightScore) {
        return {
          winner: "LEFT",
          winnerId: gameState.leftPlayer.id,
          result: "win",
        };
      } else if (rightScore > leftScore) {
        return {
          winner: "RIGHT",
          winnerId: gameState.rightPlayer.id,
          result: "win",
        };
      } else {
        // Draw - scores are equal
        return { winner: null, winnerId: null, result: "draw" };
      }
    }
    return null;
  }

  // End game, save to DB, cleanup
  async function endGame(gameState) {
    const matchId = gameState.matchId;

    // Stop the game loop with enhanced cleanup verification
    const loopHandle = gameLoops.get(matchId);
    if (loopHandle) {
      clearInterval(loopHandle);
      gameLoops.delete(matchId);
      console.log(
        `[endGame] Successfully cleared game loop for match ${matchId}. Remaining loops: ${gameLoops.size}`,
      );
    } else {
      console.warn(
        `[endGame] No game loop found for match ${matchId} - may have already been cleared`,
      );
    }

    // Verify cleanup was successful
    if (gameLoops.has(matchId)) {
      console.error(
        `[endGame] CRITICAL: Failed to delete game loop for match ${matchId}! Forcing removal...`,
      );
      // Force removal if still present
      gameLoops.delete(matchId);
    }

    let result;
    if (gameState.doubleForfeit) {
      // Both players forfeited - no winner
      result = { winner: null, winnerId: null, result: "double_forfeit" };
    } else if (gameState.forfeit && gameState.winner) {
      result = {
        winner: gameState.winner,
        winnerId: gameState.winnerId,
        result: "win",
      };
    } else {
      result = checkGameOver(gameState);
    }
    const left = gameState.leftPlayer;
    const right = gameState.rightPlayer;

    // Save match to database
    try {
      await prisma.match.create({
        data: {
          player1Id: left.id,
          player2Id: right.id,
          score1: left.score,
          score2: right.score,
          mode: "REMOTE",
        },
      });
      console.log(`Match ${matchId} saved to database`);
    } catch (error) {
      console.error("Failed to save match:", error);
    }

    // Handle Tournament Updates
    if (gameState.tournamentId) {
      const tournament = activeTournaments.get(gameState.tournamentId);
      if (tournament) {
        let outcome = "draw";
        if (result) {
          if (gameState.doubleForfeit) outcome = "double_forfeit";
          else if (gameState.forfeit) outcome = "forfeit";
          else if (result.result === "win") outcome = "win";
        }

        console.log(
          `Updating result for tournament match ${matchId} (Winner: ${result?.winner}, Outcome: ${outcome})`,
        );
        const updateResult = tournament.updateMatchResult(
          matchId,
          { p1: left.score, p2: right.score },
          outcome,
          result?.winnerId, // Explicitly pass winnerId
        );

        // Broadcast TOURNAMENT_UPDATE to all players in the tournament
        // This ensures everyone (including those with Byes) sees the new state
        if (updateResult.success) {
          const tournamentData = tournament.getSummary();
          tournament.players.forEach((player) => {
            const socket = fastify.onlineUsers.get(Number(player.id));
            if (socket) {
              safeSend(
                socket,
                {
                  event: "TOURNAMENT_UPDATE",
                  payload: tournamentData,
                },
                player.id,
              );
            }
          });
          console.log(
            `Broadcasted TOURNAMENT_UPDATE for tournament ${gameState.tournamentId}`,
          );

          // Check if tournament is complete and clean up the associated room
          if (tournament.isComplete()) {
            console.log(
              `Tournament ${gameState.tournamentId} is complete. Cleaning up room and tournament.`,
            );

            // Extract room ID from tournament ID (format: "RT-<roomId>")
            const roomId = gameState.tournamentId.replace(/^RT-/, "");
            const room = fastify.gameRooms.get(roomId);

            if (room) {
              console.log(
                `Deleting room ${roomId} for completed tournament ${gameState.tournamentId}`,
              );

              // Remove all players from currentRoom mapping
              tournament.players.forEach((player) => {
                fastify.currentRoom.delete(Number(player.id));
              });

              // Delete the room
              fastify.gameRooms.delete(roomId);

              console.log(`Successfully cleaned up room ${roomId}`);
            } else {
              console.log(
                `Room ${roomId} not found for tournament ${gameState.tournamentId} (may have been cleaned up already)`,
              );
            }

            // Clean up the tournament from activeTournaments after an hour
            // (give clients time to receive final TOURNAMENT_UPDATE and view the leaderboard)
            setTimeout(() => {
              activeTournaments.delete(gameState.tournamentId);
              console.log(
                `Removed completed tournament ${gameState.tournamentId} from activeTournaments`,
              );
            }, 3600000); // 1 hour delay
          }
        }
      }
    }

    // Send GAME_OVER to both players
    const gameOverPayload = {
      matchId: matchId,
      tournamentId: gameState.tournamentId,
      leftPlayer: { id: left.id, username: left.username, score: left.score },
      rightPlayer: {
        id: right.id,
        username: right.username,
        score: right.score,
      },
      winner: result?.winner || "DRAW",
      winnerId: result?.winnerId || null,
    };

    const leftSocket = fastify.onlineUsers.get(left.id);
    const rightSocket = fastify.onlineUsers.get(right.id);

    safeSend(leftSocket, { event: "GAME_OVER", payload: gameOverPayload }, left.id);
    safeSend(
      rightSocket,
      { event: "GAME_OVER", payload: gameOverPayload },
      right.id,
    );

    // Send GAME_OVER to active spectators
    const spectators = matchSpectators.get(matchId);
    if (spectators) {
      spectators.forEach((spectatorId) => {
        const socket = fastify.onlineUsers.get(spectatorId);
        safeSend(
          socket,
          { event: "GAME_OVER", payload: gameOverPayload },
          spectatorId,
        );
      });
    }

    // Cleanup room if this was a remote room game
    if (gameState.roomId) {
      fastify.gameRooms.delete(gameState.roomId);
      fastify.currentRoom.delete(left.id);
      fastify.currentRoom.delete(right.id);
    }

    // Remove spectators
    matchSpectators.delete(matchId);

    // Remove game state
    fastify.gameStates.delete(matchId);

    console.log(`Game ${matchId} ended. Winner: ${result?.winner || "DRAW"}`);
  }

  function startGameLoop(gameState) {
    const matchId = gameState.matchId;

    // Don't start if already running
    if (gameLoops.has(matchId)) {
      console.warn(
        `[Game Loop] Loop already exists for match ${matchId}. Skipping duplicate.`,
      );
      return;
    }

    console.log(
      `[Game Loop] Starting game loop for match ${matchId}. Total active loops: ${gameLoops.size + 1}`,
    );

    // Initialize timer when game starts
    const now = Date.now();
    gameState.timer = {
      startTime: now,
      timeElapsed: 0,
      timeRemaining: MATCH_DURATION,
    };

    // Track last power-up spawn time
    let lastPowerUpSpawn = now;

    const loopHandle = setInterval(() => {
      // Initialize active tick counter if not present
      if (typeof gameState.tickCount === "undefined") gameState.tickCount = 0;
      gameState.tickCount++;

      // Check if game is still active in the main Map
      // This prevents "ghost" loops if endGame failed to clear the interval correctly
      if (!fastify.gameStates.has(matchId)) {
        console.warn(
          `[Game Loop] Match ${matchId} not found in gameStates. Stopping ghost loop at tick ${gameState.tickCount}.`,
        );
        clearInterval(loopHandle);
        gameLoops.delete(matchId);
        return;
      }

      // Additional safety check: verify this loop is still the registered one
      if (gameLoops.get(matchId) !== loopHandle) {
        console.error(
          `[Game Loop] Loop handle mismatch for match ${matchId}. This is a ghost loop. Stopping.`,
        );
        clearInterval(loopHandle);
        return;
      }

      // Check if game is paused (e.g. player disconnected or manual pause)
      if (gameState.paused) {
        // Still broadcast paused state periodically so clients stay in sync
        // but at a lower rate (every 30 ticks = ~2 FPS for paused state)
        if (gameState.tickCount % 30 === 0) {
          broadcastState(gameState, fastify);
        }
        return;
      }

      // Update timer
      updateTimer(gameState);

      // Spawn power-ups periodically
      const currentTime = Date.now();
      if (currentTime - lastPowerUpSpawn >= POWERUP_SPAWN_INTERVAL) {
        spawnPowerUp(gameState);
        lastPowerUpSpawn = currentTime;
      }

      // Update active effects (expire them if needed)
      updateActiveEffect(gameState);

      updatePaddles(gameState, "LEFT");
      updatePaddles(gameState, "RIGHT");
      updateBall(gameState);
      checkCollisionsAndScore(gameState);

      // Check power-up collisions
      checkPowerUpCollision(gameState);

      // Broadcast state every tick (60 FPS) to eliminate client-side stutter
      broadcastState(gameState, fastify);

      // Check for game over (timer expired)
      const result = checkGameOver(gameState);
      if (result) {
        endGame(gameState);
      }
    }, TICK_MS);

    gameLoops.set(matchId, loopHandle);
  }

  return {
    checkGameOver,
    endGame,
    startGameLoop,
  };
}
