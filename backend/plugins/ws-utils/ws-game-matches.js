import fp from "fastify-plugin";
import { safeSend } from "../../utils/ws-utils.js";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_SPEED = 10;
const FPS = 60;
const TICK_MS = 1000 / FPS;
let running = false;
let loopHandle = null;
const BALL_SIZE = 12;

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

  if (ball.posX <= 0) {
    resetBall(gameState);
  } else if (ball.posX + BALL_SIZE >= CANVAS_WIDTH + 10) {
    resetBall(gameState);
  }
}

function broadcastState(gameState, fastify) {
  const leftPlayerSocket = fastify.onlineUsers.get(gameState.leftPlayer.id);
  const rightPlayerSocket = fastify.onlineUsers.get(gameState.rightPlayer.id);
  safeSend(
    leftPlayerSocket,
    {
      event: "GAME_STATE",
      payload: gameState,
    },
    gameState.leftPlayer.id
  );
  safeSend(
    rightPlayerSocket,
    {
      event: "GAME_STATE",
      payload: gameState,
    },
    gameState.rightPlayer.id
  );
}

function startGameLoop(gameState, fastify) {
  if (running) return;
  running = true;
  loopHandle = setInterval(() => {
    updatePaddles(gameState, "LEFT");
    updatePaddles(gameState, "RIGHT");
    updateBall(gameState);
    checkCollisionsAndScore(gameState);
    broadcastState(gameState, fastify);
  }, TICK_MS);
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
    }
  });
});
