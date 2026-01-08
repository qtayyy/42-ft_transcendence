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
const WIN_SCORE = 5; // First to 5 wins

// Track running game loops per match
const gameLoops = new Map(); // matchId -> intervalHandle

function updatePaddles(gameState, player) {
  let currentPlayer = gameState.rightPlayer;
  if (player === "LEFT") currentPlayer = gameState.leftPlayer;
  if (currentPlayer.moving === "") return;

  if (currentPlayer.moving === "UP")
    currentPlayer.paddleY = Math.max(0, currentPlayer.paddleY - PADDLE_SPEED);
  else
    currentPlayer.paddleY = Math.min(
      CANVAS_HEIGHT - PADDLE_HEIGHT,
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
  gameState.ball.dx = toRight ? 4 : -4;
  gameState.ball.dy = 3 * (Math.random() > 0.5 ? 1 : -1);
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

  // Hit left paddle
  // First two conidtions give you a vertical slice
  // Last two give you a horizontal slice
  if (
    ball.posX <= leftPlayer.paddleX + PADDLE_WIDTH &&
    ball.posX + BALL_SIZE >= leftPlayer.paddleX &&
    ball.posY + BALL_SIZE >= leftPlayer.paddleY &&
    ball.posY <= leftPlayer.paddleY + PADDLE_HEIGHT
  ) {
    ball.posX = leftPlayer.paddleX + PADDLE_WIDTH; // prevent sticking
    ball.dx = Math.abs(ball.dx); // Change x direction to RHS
    // Bounce down/up more if hit edges of the paddle
    const offset =
      ball.posY + BALL_SIZE / 2 - (leftPlayer.paddleY + PADDLE_HEIGHT / 2);
    ball.dy = offset * 0.08;
  }

  if (
    ball.posX + BALL_SIZE >= rightPlayer.paddleX &&
    ball.posX <= rightPlayer.paddleX + PADDLE_WIDTH &&
    ball.posY + BALL_SIZE >= rightPlayer.paddleY &&
    ball.posY <= rightPlayer.paddleY + PADDLE_HEIGHT
  ) {
    ball.posX = rightPlayer.paddleX - BALL_SIZE;
    ball.dx = -Math.abs(ball.dx);
    const offset =
      ball.posY + BALL_SIZE / 2 - (rightPlayer.paddleY + PADDLE_HEIGHT / 2);
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
}

// Check if game should end (first to WIN_SCORE)
function checkGameOver(gameState) {
  if (gameState.leftPlayer.score >= WIN_SCORE) {
    return { winner: "LEFT", winnerId: gameState.leftPlayer.id };
  }
  if (gameState.rightPlayer.score >= WIN_SCORE) {
    return { winner: "RIGHT", winnerId: gameState.rightPlayer.id };
  }
  return null;
}

// End game, save to DB, cleanup
async function endGame(gameState, fastify) {
  const matchId = gameState.matchId;

  // Stop the game loop
  const loopHandle = gameLoops.get(matchId);
  if (loopHandle) {
    clearInterval(loopHandle);
    gameLoops.delete(matchId);
  }

  const result = checkGameOver(gameState);
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

  // Send GAME_OVER to both players
  const gameOverPayload = {
    matchId: matchId,
    leftPlayer: { id: left.id, username: left.username, score: left.score },
    rightPlayer: { id: right.id, username: right.username, score: right.score },
    winner: result?.winner || "DRAW",
    winnerId: result?.winnerId || null,
  };

  const leftSocket = fastify.onlineUsers.get(left.id);
  const rightSocket = fastify.onlineUsers.get(right.id);

  safeSend(leftSocket, { event: "GAME_OVER", payload: gameOverPayload }, left.id);
  safeSend(rightSocket, { event: "GAME_OVER", payload: gameOverPayload }, right.id);

  // Cleanup room if this was a remote room game
  if (gameState.roomId) {
    fastify.gameRooms.delete(gameState.roomId);
    fastify.currentRoom.delete(left.id);
    fastify.currentRoom.delete(right.id);
  }

  // Remove game state
  fastify.gameStates.delete(matchId);

  console.log(`Game ${matchId} ended. Winner: ${result?.winner || 'DRAW'}`);
}

function startGameLoop(gameState, fastify) {
  const matchId = gameState.matchId;

  // Don't start if already running
  if (gameLoops.has(matchId)) return;

  const loopHandle = setInterval(() => {
    updatePaddles(gameState, "LEFT");
    updatePaddles(gameState, "RIGHT");
    updateBall(gameState);
    checkCollisionsAndScore(gameState);
    broadcastState(gameState, fastify);

    // Check for game over
    const result = checkGameOver(gameState);
    if (result) {
      endGame(gameState, fastify);
    }
  }, TICK_MS);

  gameLoops.set(matchId, loopHandle);
}

export default fp((fastify) => {
  /**
   * For each match in matches, send the event "GAME_MATCH_START to each player"
   * To-do: Change this to handle > 2 players.
   */
  fastify.decorate("dispatchMatches", (matches) => {
    matches.forEach((match) => {
      const initialGameState = {
        tournamentId: match.tournamentId,
        matchId: match.id,
        ball: { posX: CANVAS_WIDTH / 2, posY: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
        leftPlayer: {
          id: match.player1Id,
          username: match.player1.username,
          gamePaused: true,
          score: match.score1,
          paddleX: 0,
          paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
          moving: "",
        },
        rightPlayer: {
          id: match.player2Id,
          username: match.player2.username,
          gamePaused: true,
          score: match.score2,
          paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
          paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
          moving: "",
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
    if (userId === gameState.leftPlayer.id) player = "LEFT";
    else if (userId === gameState.rightPlayer.id) player = "RIGHT";
    else throw new Error(`You don't have permission`);

    const currentPlayer =
      player === "LEFT" ? gameState.leftPlayer : gameState.rightPlayer;

    // ENTER = Ready toggle
    if (keyEvent === "START") {
      currentPlayer.gamePaused = !currentPlayer.gamePaused;
    } else {
      currentPlayer.moving = keyEvent;
    }

    // Start game ONLY when both unpaused (= ready)
    if (!gameState.leftPlayer.gamePaused && !gameState.rightPlayer.gamePaused) {
      console.log("Game started");
      startGameLoop(gameState, fastify);
    } else {
      // Broadcast state change (e.g. one player ready) so UI updates
      broadcastState(gameState, fastify);
    }
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
        moving: "",
      },
      rightPlayer: {
        id: player2.id,
        username: player2.username,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        moving: "",
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
        moving: "",
      },
      rightPlayer: {
        id: player2Id,
        username: player2Username,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        moving: "",
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
   * Start a tournament match between two players
   * This creates the game state and notifies both players to start playing
   */
  fastify.decorate("startTournamentMatch", (matchId, tournamentId, player1Id, player1Name, player2Id, player2Name) => {
    // Ensure numeric IDs for socket lookup
    const p1Id = Number(player1Id);
    const p2Id = Number(player2Id);

    const player1Socket = fastify.onlineUsers.get(p1Id);
    const player2Socket = fastify.onlineUsers.get(p2Id);

    if (!player1Socket || !player2Socket) {
      console.error(`Cannot start tournament match - one or both players offline: ${p1Id}, ${p2Id}`);
      return null;
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
        moving: "",
      },
      rightPlayer: {
        id: p2Id,
        username: player2Name,
        gamePaused: true,
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        moving: "",
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
