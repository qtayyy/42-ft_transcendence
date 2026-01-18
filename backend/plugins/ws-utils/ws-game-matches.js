import fp from "fastify-plugin";
import crypto from "crypto";
import { safeSend } from "../../utils/ws-utils.js";
import { PrismaClient } from "/app/generated/prisma/index.js";

const prisma = new PrismaClient();

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_SPEED = 10;
const FPS = 60;
const TICK_MS = 1000 / FPS;
const BALL_SIZE = 12;
const MATCH_DURATION = 120000; // 2 minutes in milliseconds
const POWERUP_SPAWN_INTERVAL = 10000; // Spawn power-up every 10 seconds
const POWERUP_EFFECT_DURATION = 5000; // Effects last 5 seconds
const POWERUP_SIZE = 20; // Power-up hitbox size

// Power-up types
const POWERUP_TYPES = ['SPEED_UP', 'SPEED_DOWN', 'SIZE_UP', 'SIZE_DOWN'];

// Track running game loops per match
const gameLoops = new Map(); // matchId -> intervalHandle

// Track spectators per match
const matchSpectators = new Map(); // matchId -> Set of spectatorIds

function updatePaddles(gameState, player) {
  let currentPlayer = gameState.rightPlayer;
  if (player === "LEFT") currentPlayer = gameState.leftPlayer;
  if (currentPlayer.moving === "") return;

  // Use dynamic paddle height (may be modified by power-ups)
  const paddleHeight = currentPlayer.paddleHeight || PADDLE_HEIGHT;

  if (currentPlayer.moving === "UP")
    currentPlayer.paddleY = Math.max(0, currentPlayer.paddleY - PADDLE_SPEED);
  else
    currentPlayer.paddleY = Math.min(
      CANVAS_HEIGHT - paddleHeight,
      currentPlayer.paddleY + PADDLE_SPEED
    );
}

function updateBall(gameState) {
  let ball = gameState.ball;
  ball.posX += ball.dx;
  ball.posY += ball.dy;
}

function resetBall(gameState, toRight = true) {
  gameState.ball.posX = (CANVAS_WIDTH - BALL_SIZE) / 2;
  gameState.ball.posY = (CANVAS_HEIGHT - BALL_SIZE) / 2;
  // Apply speed modifier if active effect is SPEED_UP or SPEED_DOWN
  let baseSpeed = 4;
  if (gameState.activeEffect) {
    if (gameState.activeEffect.type === 'SPEED_UP') baseSpeed = 6;
    else if (gameState.activeEffect.type === 'SPEED_DOWN') baseSpeed = 2;
  }
  gameState.ball.dx = toRight ? baseSpeed : -baseSpeed;
  gameState.ball.dy = 3 * (Math.random() > 0.5 ? 1 : -1);
}

// Spawn a random power-up on the field
function spawnPowerUp(gameState) {
  // Don't spawn if there's already a power-up or if game hasn't started
  if (gameState.powerUps.length > 0) return;

  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const id = crypto.randomUUID();

  // Spawn in middle third of the field (avoid paddles)
  const minX = CANVAS_WIDTH * 0.25;
  const maxX = CANVAS_WIDTH * 0.75;
  const x = minX + Math.random() * (maxX - minX);
  const y = POWERUP_SIZE + Math.random() * (CANVAS_HEIGHT - POWERUP_SIZE * 2);

  gameState.powerUps.push({ id, x, y, type });
}

// Check if ball collides with a power-up
function checkPowerUpCollision(gameState) {
  const ball = gameState.ball;
  const ballCenterX = ball.posX + BALL_SIZE / 2;
  const ballCenterY = ball.posY + BALL_SIZE / 2;

  for (let i = gameState.powerUps.length - 1; i >= 0; i--) {
    const pu = gameState.powerUps[i];
    const distanceSq = Math.pow(ballCenterX - pu.x, 2) + Math.pow(ballCenterY - pu.y, 2);
    const radiusSum = (BALL_SIZE / 2) + (POWERUP_SIZE / 2);

    if (distanceSq < radiusSum * radiusSum) {
      // Collision! Apply effect
      gameState.powerUps.splice(i, 1);
      applyPowerUpEffect(gameState, pu.type);
      return;
    }
  }
}

// Apply power-up effect
function applyPowerUpEffect(gameState, type) {
  const now = Date.now();
  gameState.activeEffect = {
    type: type,
    expiresAt: now + POWERUP_EFFECT_DURATION
  };

  // Apply immediate effects
  if (type === 'SPEED_UP') {
    // Increase ball speed
    const speedMultiplier = 1.5;
    gameState.ball.dx = gameState.ball.dx > 0
      ? Math.abs(gameState.ball.dx) * speedMultiplier
      : -Math.abs(gameState.ball.dx) * speedMultiplier;
  } else if (type === 'SPEED_DOWN') {
    // Decrease ball speed
    const speedMultiplier = 0.5;
    gameState.ball.dx = gameState.ball.dx > 0
      ? Math.abs(gameState.ball.dx) * speedMultiplier
      : -Math.abs(gameState.ball.dx) * speedMultiplier;
  } else if (type === 'SIZE_UP') {
    // Increase paddle size for both players
    gameState.leftPlayer.paddleHeight = PADDLE_HEIGHT * 1.5;
    gameState.rightPlayer.paddleHeight = PADDLE_HEIGHT * 1.5;
  } else if (type === 'SIZE_DOWN') {
    // Decrease paddle size for both players
    gameState.leftPlayer.paddleHeight = PADDLE_HEIGHT * 0.6;
    gameState.rightPlayer.paddleHeight = PADDLE_HEIGHT * 0.6;
  }
}

// Check and expire active effects
function updateActiveEffect(gameState) {
  if (!gameState.activeEffect) return;

  const now = Date.now();
  if (now >= gameState.activeEffect.expiresAt) {
    // Reset effects based on type
    const type = gameState.activeEffect.type;

    if (type === 'SPEED_UP' || type === 'SPEED_DOWN') {
      // Reset ball speed to normal (preserve direction)
      const direction = gameState.ball.dx > 0 ? 1 : -1;
      gameState.ball.dx = 4 * direction;
    } else if (type === 'SIZE_UP' || type === 'SIZE_DOWN') {
      // Reset paddle sizes
      gameState.leftPlayer.paddleHeight = PADDLE_HEIGHT;
      gameState.rightPlayer.paddleHeight = PADDLE_HEIGHT;
    }

    gameState.activeEffect = null;
  }
}

// Update timer
function updateTimer(gameState) {
  if (!gameState.timer) return;

  const now = Date.now();
  const elapsed = now - gameState.timer.startTime;
  gameState.timer.timeElapsed = elapsed;
  gameState.timer.timeRemaining = Math.max(0, MATCH_DURATION - elapsed);
}

function checkCollisionsAndScore(gameState) {
  const ball = gameState.ball;

  // Collide with top
  if (ball.posY <= 0) {
    ball.posY = 0;
    ball.dy *= -1; // Flip the direction
  }
  // Collide with btm
  if (ball.posY + BALL_SIZE >= CANVAS_HEIGHT) {
    ball.posY = CANVAS_HEIGHT - BALL_SIZE;
    ball.dy *= -1; // Flip the direction
  }

  const leftPlayer = gameState.leftPlayer;
  const rightPlayer = gameState.rightPlayer;

  // Use dynamic paddle height (may be modified by power-ups)
  const leftPaddleHeight = leftPlayer.paddleHeight || PADDLE_HEIGHT;
  const rightPaddleHeight = rightPlayer.paddleHeight || PADDLE_HEIGHT;

  // Hit left paddle
  // First two conidtions give you a vertical slice
  // Last two give you a horizontal slice
  if (
    ball.posX <= leftPlayer.paddleX + PADDLE_WIDTH &&
    ball.posX + BALL_SIZE >= leftPlayer.paddleX &&
    ball.posY + BALL_SIZE >= leftPlayer.paddleY &&
    ball.posY <= leftPlayer.paddleY + leftPaddleHeight
  ) {
    ball.posX = leftPlayer.paddleX + PADDLE_WIDTH; // prevent sticking
    ball.dx = Math.abs(ball.dx); // Change x direction to RHS
    // Bounce down/up more if hit edges of the paddle
    const offset =
      ball.posY + BALL_SIZE / 2 - (leftPlayer.paddleY + leftPaddleHeight / 2);
    ball.dy = offset * 0.08;
  }

  if (
    ball.posX + BALL_SIZE >= rightPlayer.paddleX &&
    ball.posX <= rightPlayer.paddleX + PADDLE_WIDTH &&
    ball.posY + BALL_SIZE >= rightPlayer.paddleY &&
    ball.posY <= rightPlayer.paddleY + rightPaddleHeight
  ) {
    ball.posX = rightPlayer.paddleX - BALL_SIZE;
    ball.dx = -Math.abs(ball.dx);
    const offset =
      ball.posY + BALL_SIZE / 2 - (rightPlayer.paddleY + rightPaddleHeight / 2);
    ball.dy = offset * 0.08;
  }

  // Ball goes past left paddle - right player scores
  if (ball.posX <= 0) {
    gameState.rightPlayer.score += 1;
    resetBall(gameState, true); // Ball goes to right
  }
  // Ball goes past right paddle - left player scores
  else if (ball.posX + BALL_SIZE >= CANVAS_WIDTH) {
    gameState.leftPlayer.score += 1;
    resetBall(gameState, false); // Ball goes to left
  }
}

function broadcastState(gameState, fastify) {
  const leftPlayerSocket = fastify.onlineUsers.get(gameState.leftPlayer.id);
  const rightPlayerSocket = fastify.onlineUsers.get(gameState.rightPlayer.id);

  // Send to players
  safeSend(
    leftPlayerSocket,
    {
      event: "GAME_STATE",
      payload: { ...gameState, me: "LEFT" },
    },
    gameState.leftPlayer.id
  );
  safeSend(
    rightPlayerSocket,
    {
      event: "GAME_STATE",
      payload: { ...gameState, me: "RIGHT" },
    },
    gameState.rightPlayer.id
  );

  // Send to spectators
  const spectators = matchSpectators.get(gameState.matchId);
  if (spectators && spectators.size > 0) {
    const spectatorPayload = { ...gameState, spectatorMode: true };
    spectators.forEach(spectatorId => {
      const spectatorSocket = fastify.onlineUsers.get(spectatorId);
      safeSend(spectatorSocket, { event: "GAME_STATE", payload: spectatorPayload }, spectatorId);
    });
  }
}

// Check if game should end (timer expired - highest score wins)
function checkGameOver(gameState) {
  // Check if timer has expired
  if (gameState.timer && gameState.timer.timeRemaining <= 0) {
    const leftScore = gameState.leftPlayer.score;
    const rightScore = gameState.rightPlayer.score;

    if (leftScore > rightScore) {
      return { winner: "LEFT", winnerId: gameState.leftPlayer.id, result: "win" };
    } else if (rightScore > leftScore) {
      return { winner: "RIGHT", winnerId: gameState.rightPlayer.id, result: "win" };
    } else {
      // Draw - scores are equal
      return { winner: null, winnerId: null, result: "draw" };
    }
  }
  return null;
}

import { activeTournaments } from "../../game/TournamentManager.js";

// End game, save to DB, cleanup
async function endGame(gameState, fastify) {
  const matchId = gameState.matchId;

  // Stop the game loop
  const loopHandle = gameLoops.get(matchId);
  if (loopHandle) {
    clearInterval(loopHandle);
    gameLoops.delete(matchId);
  }

  let result;
  if (gameState.forfeit && gameState.winner) {
    result = { winner: gameState.winner, winnerId: gameState.winnerId, result: 'win' };
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
        winnerId: result?.winnerId || null,
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
      let outcome = 'draw';
      if (result) {
        if (gameState.forfeit) outcome = 'forfeit';
        else outcome = 'win';
      }

      console.log(`Updating result for tournament match ${matchId} (Winner: ${result?.winner}, Outcome: ${outcome})`);
      const updateResult = tournament.updateMatchResult(
        matchId,
        { p1: left.score, p2: right.score },
        outcome,
        result?.winnerId // Explicitly pass winnerId
      );

      // Broadcast TOURNAMENT_UPDATE to all players in the tournament
      // This ensures everyone (including those with Byes) sees the new state
      if (updateResult.success) {
        const tournamentData = tournament.getSummary();
        tournament.players.forEach(player => {
          const socket = fastify.onlineUsers.get(Number(player.id));
          if (socket) {
            safeSend(socket, {
              event: "TOURNAMENT_UPDATE",
              payload: tournamentData
            }, player.id);
          }
        });
        console.log(`Broadcasted TOURNAMENT_UPDATE for tournament ${gameState.tournamentId}`);
      }
    }
  }

  // Send GAME_OVER to both players
  const gameOverPayload = {
    matchId: matchId,
    tournamentId: gameState.tournamentId,
    leftPlayer: { id: left.id, username: left.username, score: left.score },
    rightPlayer: { id: right.id, username: right.username, score: right.score },
    winner: result?.winner || "DRAW",
    winnerId: result?.winnerId || null,
  };

  const leftSocket = fastify.onlineUsers.get(left.id);
  const rightSocket = fastify.onlineUsers.get(right.id);

  safeSend(leftSocket, { event: "GAME_OVER", payload: gameOverPayload }, left.id);
  safeSend(rightSocket, { event: "GAME_OVER", payload: gameOverPayload }, right.id);

  // Send GAME_OVER to active spectators
  const spectators = matchSpectators.get(matchId);
  if (spectators) {
    spectators.forEach(spectatorId => {
      const socket = fastify.onlineUsers.get(spectatorId);
      safeSend(socket, { event: "GAME_OVER", payload: gameOverPayload }, spectatorId);
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

  console.log(`Game ${matchId} ended. Winner: ${result?.winner || 'DRAW'}`);
}

function startGameLoop(gameState, fastify) {
  const matchId = gameState.matchId;

  // Don't start if already running
  if (gameLoops.has(matchId)) return;

  // Initialize timer when game starts
  const now = Date.now();
  gameState.timer = {
    startTime: now,
    timeElapsed: 0,
    timeRemaining: MATCH_DURATION
  };

  // Track last power-up spawn time
  let lastPowerUpSpawn = now;

  const loopHandle = setInterval(() => {
    // Check if game is paused (e.g. player disconnected)
    if (gameState.paused) return;

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

    // Broadcast state throttled (every 3 ticks = 20 FPS)
    // Initialize active tick counter if not present
    if (typeof gameState.tickCount === 'undefined') gameState.tickCount = 0;
    gameState.tickCount++;

    if (gameState.tickCount % 3 === 0) {
      broadcastState(gameState, fastify);
    }

    // Check for game over (timer expired)
    const result = checkGameOver(gameState);
    if (result) {
      endGame(gameState, fastify);
    }
  }, TICK_MS);

  gameLoops.set(matchId, loopHandle);
}

// Fastify plugin
export default fp(async (fastify, opts) => {
  // Expose matchSpectators to fastify instance
  fastify.decorate("matchSpectators", matchSpectators);

  /**
   * For each match in matches, send the event "GAME_MATCH_START to each player"
   * To-do: Change this to handle > 2 players.
   */
  fastify.decorate("dispatchMatches", (matches) => {
    matches.forEach((match) => {
      const initialGameState = {
        tournamentId: match.tournamentId,
        matchId: match.id,
        isRemote: true,
        isTournamentMatch: true,
        ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
        leftPlayer: {
          id: match.player1Id,
          username: match.player1.username,
          gamePaused: true,
          score: match.score1,
          paddleX: 0,
          paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
          paddleHeight: PADDLE_HEIGHT,
          moving: "",
        },
        rightPlayer: {
          id: match.player2Id,
          username: match.player2.username,
          gamePaused: true,
          score: match.score2,
          paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
          paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
          paddleHeight: PADDLE_HEIGHT,
          moving: "",
        },
        // Timer will be initialized when game loop starts
        timer: null,
        // Power-ups and effects
        powerUps: [],
        activeEffect: null,
        // Game constants for frontend rendering
        constant: {
          canvasWidth: CANVAS_WIDTH,
          canvasHeight: CANVAS_HEIGHT,
          paddleWidth: PADDLE_WIDTH,
          paddleHeight: PADDLE_HEIGHT,
          ballSize: BALL_SIZE,
          matchDuration: MATCH_DURATION,
        },
      };
      fastify.gameStates.set(match.id, initialGameState);

      const player1Socket = fastify.onlineUsers.get(match.player1Id);
      safeSend(
        player1Socket,
        {
          event: "GAME_MATCH_START",
          payload: { ...initialGameState, me: "LEFT" },
        },
        match.player1Id
      );
      const player2Socket = fastify.onlineUsers.get(match.player2Id);
      safeSend(
        player2Socket,
        {
          event: "GAME_MATCH_START",
          payload: { ...initialGameState, me: "RIGHT" },
        },
        match.player2Id
      );
    });
  });

  fastify.decorate("updateGameState", (matchId, userId, keyEvent) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState)
      throw new Error(`Game state doesn't exist for match ${matchId}`);

    let player;
    const uid = Number(userId);
    if (uid === gameState.leftPlayer.id) player = "LEFT";
    else if (uid === gameState.rightPlayer.id) player = "RIGHT";
    else {
      // Allow spectators or ignore?
      // throw new Error(`You don't have permission`);
      return; // Just ignore invalid input
    }

    const currentPlayer =
      player === "LEFT" ? gameState.leftPlayer : gameState.rightPlayer;

    // SPACE = Pause/Resume game (global pause)
    if (keyEvent === "PAUSE") {
      // Only allow pause when game is actually running (both players ready)
      const gameRunning = !gameState.leftPlayer.gamePaused && !gameState.rightPlayer.gamePaused;

      if (gameState.paused) {
        // Resume from pause - adjust timer and power-up effect expiry
        if (gameState.pausedAt) {
          const pauseDuration = Date.now() - gameState.pausedAt;

          // Adjust timer start time to effectively "freeze" the timer during pause
          if (gameState.timer && gameState.timer.startTime) {
            gameState.timer.startTime += pauseDuration;
            console.log(`[Game] Timer adjusted by ${pauseDuration}ms for pause duration`);
          }

          // Adjust active effect expiry time
          if (gameState.activeEffect && gameState.activeEffect.expiresAt) {
            gameState.activeEffect.expiresAt += pauseDuration;
            console.log(`[Game] Active effect expiry adjusted by ${pauseDuration}ms`);
          }

          gameState.pausedAt = null;
        }

        gameState.paused = false;
        gameState.disconnectedPlayer = null;
        console.log(`[Game] Resumed by user ${userId} via SPACE`);
      } else if (gameRunning) {
        // Pause the game
        gameState.paused = true;
        gameState.pausedAt = Date.now();
        console.log(`[Game] Paused by user ${userId} via SPACE`);
      }
    }
    // ENTER = Ready toggle (pre-game only)
    else if (keyEvent === "START") {
      // Only allow ready toggle if game hasn't started yet
      // Once gameStarted is true, ENTER should not toggle ready state
      if (!gameState.gameStarted) {
        currentPlayer.gamePaused = !currentPlayer.gamePaused;
      }
      // Note: ENTER no longer resumes from pause - use SPACE instead
    } else if (keyEvent !== "PAUSE") {
      currentPlayer.moving = keyEvent;
    }

    // Start game ONLY when both unpaused (= ready)
    if (!gameState.leftPlayer.gamePaused && !gameState.rightPlayer.gamePaused && !gameState.paused) {
      // Mark game as started - prevents ENTER from toggling ready state again
      if (!gameState.gameStarted) {
        gameState.gameStarted = true;
        console.log("Game started for the first time");
      } else {
        console.log("Game resumed");
      }
      startGameLoop(gameState, fastify);
    } else {
      // Broadcast state change (e.g. one player ready) so UI updates
      broadcastState(gameState, fastify);
    }
  });

  fastify.decorate("forfeitMatch", (matchId, userId) => {
    const gameState = fastify.gameStates.get(matchId);
    if (!gameState) throw new Error("Match not found");

    const uid = Number(userId);
    let loser = null;
    let winner = null;
    let winnerId = null;

    if (uid === gameState.leftPlayer.id) {
      loser = "LEFT";
      winner = "RIGHT";
      winnerId = gameState.rightPlayer.id;
    } else if (uid === gameState.rightPlayer.id) {
      loser = "RIGHT";
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
      safeSend(winnerSocket, {
        event: "OPPONENT_LEFT",
        payload: { matchId }
      }, winnerId);
    }

    console.log(`[forfeitMatch] Match ${matchId} forfeited by ${userId}. Winner: ${winner}`);
    endGame(gameState, fastify);
  });

  /**
   * Start a game from a remote room
   * Called when host clicks "Start Game" in the room lobby
   */
  fastify.decorate("startRoomGame", (roomId) => {
    const room = fastify.gameRooms.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.joinedPlayers.length < 2) throw new Error("Need at least 2 players");

    const player1 = room.joinedPlayers[0];
    const player2 = room.joinedPlayers[1];
    const matchId = `RS-${roomId}`;

    const initialGameState = {
      matchId: matchId,
      roomId: roomId,
      isRemote: true,
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: player1.id,
        username: player1.username,
        gamePaused: true,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: player2.id,
        username: player2.username,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      // Timer will be initialized when game loop starts
      timer: null,
      // Power-ups and effects
      powerUps: [],
      activeEffect: null,
      // Game constants for frontend rendering
      constant: {
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        ballSize: BALL_SIZE,
        matchDuration: MATCH_DURATION,
      },
    };

    fastify.gameStates.set(matchId, initialGameState);

    // Notify player 1 (left)
    const player1Socket = fastify.onlineUsers.get(player1.id);
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...initialGameState, me: "LEFT" },
      },
      player1.id
    );

    // Notify player 2 (right)
    const player2Socket = fastify.onlineUsers.get(player2.id);
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...initialGameState, me: "RIGHT" },
      },
      player2.id
    );

    console.log(`Remote game started: ${matchId} with ${player1.username} vs ${player2.username}`);
    return matchId;
  });

  /**
   * Start a rematch with the same players (no room needed)
   */
  fastify.decorate("startRematch", (player1Id, player1Username, player2Id, player2Username) => {
    // Check if both players are still online
    const player1Socket = fastify.onlineUsers.get(player1Id);
    const player2Socket = fastify.onlineUsers.get(player2Id);

    if (!player1Socket || !player2Socket) {
      // One or both players left - notify the remaining player
      if (player1Socket) {
        safeSend(player1Socket, {
          event: "REMATCH_FAILED",
          payload: { reason: "Opponent has left the game" }
        }, player1Id);
      }
      if (player2Socket) {
        safeSend(player2Socket, {
          event: "REMATCH_FAILED",
          payload: { reason: "Opponent has left the game" }
        }, player2Id);
      }
      return null;
    }

    const roomId = crypto.randomUUID();
    const matchId = `RS-${roomId}`;

    const initialGameState = {
      matchId: matchId,
      roomId: null, // No room for rematch
      isRemote: true,
      isRematch: true,
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: player1Id,
        username: player1Username,
        gamePaused: true,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: player2Id,
        username: player2Username,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      // Timer will be initialized when game loop starts
      timer: null,
      // Power-ups and effects
      powerUps: [],
      activeEffect: null,
      // Game constants for frontend rendering
      constant: {
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        ballSize: BALL_SIZE,
        matchDuration: MATCH_DURATION,
      },
    };

    fastify.gameStates.set(matchId, initialGameState);

    // Notify player 1 (left) - reuse socket from online check
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...initialGameState, me: "LEFT" },
      },
      player1Id
    );

    // Notify player 2 (right) - reuse socket from online check
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...initialGameState, me: "RIGHT" },
      },
      player2Id
    );

    console.log(`Rematch started: ${matchId} with ${player1Username} vs ${player2Username}`);
    return matchId;
  });

  /**
   * Handle player clicking "Ready" in the lobby
   */
  fastify.decorate("handleLobbyReady", (tournamentId, matchId, userId) => {
    if (!fastify.activeTournaments) return;
    const tournament = fastify.activeTournaments.get(tournamentId);
    if (!tournament) {
      console.error(`[handleLobbyReady] Tournament ${tournamentId} not found`);
      const socket = fastify.onlineUsers.get(Number(userId));
      if (socket) safeSend(socket, { event: "TOURNAMENT_ERROR", payload: { message: "Tournament not found" } }, userId);
      return;
    }

    const result = tournament.setLobbyReady(matchId, userId);
    if (!result.success) {
      console.error(`[handleLobbyReady] Match ${matchId} not found`);
      const socket = fastify.onlineUsers.get(Number(userId));
      if (socket) safeSend(socket, { event: "TOURNAMENT_ERROR", payload: { message: "Match not found" } }, userId);
      return;
    }

    console.log(`[LobbyReady] Player ${userId} ready for match ${matchId}. AllReady: ${result.allReady}`);

    if (result.allReady) {
      // Both players ready - Start the match
      const match = result.match;
      // Handle Bye case (player2 might be null) - though Bye is auto-ready usually
      if (!match.player2) {
        // Auto-process bye? Usually byes are processed by TournamentManager immediately or end-round.
        // But if a bye player clicks ready... actually bye matches should be auto-processed or just wait.
        // My TournamentManager logic sets p1Ready=true for Bye.
        console.log("Bye match ready? Should verify logic.");
        return;
      }

      fastify.startTournamentMatch(
        match.matchId,
        match.tournamentId,
        match.player1.id,
        match.player1.name,
        match.player2.id,
        match.player2.name
      );
    } else {
      // Broadcast update so other player sees the checkmark
      const tournamentData = tournament.getSummary();
      tournament.players.forEach(player => {
        const socket = fastify.onlineUsers.get(Number(player.id));
        if (socket) {
          safeSend(socket, {
            event: "TOURNAMENT_UPDATE",
            payload: tournamentData
          }, Number(player.id));
        }
      });
    }
  });

  /**
   * Start a tournament match between two players
   * This creates the game state and notifies both players to start playing
   */
  fastify.decorate("startTournamentMatch", (matchId, tournamentId, player1Id, player1Name, player2Id, player2Name) => {
    // Ensure numeric IDs for socket lookup
    const p1Id = Number(player1Id);
    const p2Id = Number(player2Id);

    console.log(`[startTournamentMatch] Attempting to start match ${matchId} (${player1Name} vs ${player2Name})`);

    const player1Socket = fastify.onlineUsers.get(p1Id);
    const player2Socket = fastify.onlineUsers.get(p2Id);

    if (!player1Socket || !player2Socket) {
      console.error(`Cannot start tournament match - one or both players offline: P1:${p1Id}(${!!player1Socket}) P2:${p2Id}(${!!player2Socket})`);

      // Notify the player who tried to start it (we don't know who triggered it here easily without passing userId, 
      // but usually the active player triggers it. We'll try to notify both if online).
      const errorPayload = { message: "Cannot start match: Opponent is offline or disconnected." };
      if (player1Socket) safeSend(player1Socket, { event: "TOURNAMENT_ERROR", payload: errorPayload }, p1Id);
      if (player2Socket) safeSend(player2Socket, { event: "TOURNAMENT_ERROR", payload: errorPayload }, p2Id);

      return null;
    }

    // Update match status in tournament to 'inprogress' safely
    if (fastify.activeTournaments && tournamentId) {
      const tournament = fastify.activeTournaments.get(tournamentId);
      if (tournament) {
        const marked = tournament.markMatchInProgress(matchId);
        console.log(`[startTournamentMatch] Marked match ${matchId} in progress: ${marked}`);
      } else {
        console.error(`[startTournamentMatch] Tournament ${tournamentId} not found!`);
      }
    }

    const initialGameState = {
      matchId: matchId,
      tournamentId: tournamentId,
      isRemote: true,
      isTournamentMatch: true,
      ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
      leftPlayer: {
        id: p1Id,
        username: player1Name,
        gamePaused: true,
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      rightPlayer: {
        id: p2Id,
        username: player2Name,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },
      // Timer will be initialized when game loop starts
      timer: null,
      // Power-ups and effects
      powerUps: [],
      activeEffect: null,
      // Game constants for frontend rendering
      constant: {
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        ballSize: BALL_SIZE,
        matchDuration: MATCH_DURATION,
      },
    };

    fastify.gameStates.set(matchId, initialGameState);

    // Notify player 1 (left)
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...initialGameState, me: "LEFT" },
      },
      p1Id
    );

    // Notify player 2 (right)
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: { ...initialGameState, me: "RIGHT" },
      },
      p2Id
    );

    console.log(`Tournament match started: ${matchId} (${tournamentId}) - ${player1Name} vs ${player2Name}`);
    return matchId;
  });
});
