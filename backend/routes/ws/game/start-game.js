const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_SPEED = 10;
const WINNING_SCORE = 7;
let running = false;
let loopHandle = null;
const FPS = 60;
const TICK_MS = 1000 / FPS;
let socket;
const BALL_SIZE = 12;

function createInitialState() {
  return {
    ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: 4, dy: 3 },
    paddles: {
      p1: { x: 0, y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2, moving: null },
      p2: {
        x: CANVAS_WIDTH - PADDLE_WIDTH,
        y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        moving: null,
      },
    },
  };
}

const gameState = createInitialState();

function updatePaddles() {
  ["p1", "p2"].forEach((k) => {
    let paddle = gameState.paddles[k];
    if (!paddle.moving) return;
    if (paddle.moving === "UP") paddle.y = Math.max(0, paddle.y - PADDLE_SPEED);
    if (paddle.moving === "DOWN")
      paddle.y = Math.min(
        CANVAS_HEIGHT - PADDLE_HEIGHT,
        paddle.y + PADDLE_SPEED
      );
  });
}

function updateBall() {
  let ball = gameState.ball;
  ball.x += ball.dx;
  ball.y += ball.dy;
}

function resetBall(toRight = true) {
  gameState.ball.x = (CANVAS_WIDTH - BALL_SIZE) / 2;
  gameState.ball.y = (CANVAS_HEIGHT - BALL_SIZE) / 2;
  gameState.ball.dx = toRight ? 4 : -4;
  gameState.ball.dy = 3 * (Math.random() > 0.5 ? 1 : -1);
}

function checkCollisionsAndScore() {
  const ball = gameState.ball;

  // Collide with top
  if (ball.y <= 0) {
    ball.y = 0;
    ball.dy *= -1; // Flip the direction
  }
  // Collide with btm
  if (ball.y + BALL_SIZE >= CANVAS_HEIGHT ) {
    ball.y = CANVAS_HEIGHT - BALL_SIZE;
    ball.dy *= -1; // Flip the direction
  }

  const p1 = gameState.paddles.p1;
  const p2 = gameState.paddles.p2;

  // Hit left paddle
  // First two conidtions give you a vertical slice
  // Last two give you a horizontal slice
  if (
    ball.x <= p1.x + PADDLE_WIDTH &&
    ball.x + BALL_SIZE >= p1.x &&
    ball.y + BALL_SIZE >= p1.y &&
    ball.y <= p1.y + PADDLE_HEIGHT
  ) {
    ball.x = p1.x + PADDLE_WIDTH; // prevent sticking
    ball.dx = Math.abs(ball.dx); // Change x direction to RHS
    // Bounce down/up more if hit edges of the paddle
    const offset = ball.y + BALL_SIZE / 2 - (p1.y + PADDLE_HEIGHT / 2);
    ball.dy = offset * 0.08;
  }

  if (
    ball.x + BALL_SIZE >= p2.x &&
    ball.x <= p2.x + PADDLE_WIDTH &&
    ball.y + BALL_SIZE >= p2.y &&
    ball.y <= p2.y + PADDLE_HEIGHT
  ) {
    ball.x = p2.x - BALL_SIZE;
    ball.dx = -Math.abs(ball.dx);
    const offset = ball.y + BALL_SIZE / 2 - (p2.y + PADDLE_HEIGHT / 2);
    ball.dy = offset * 0.08;
  }

  
  if (ball.x <= 0) {
    resetBall();
  }
  else if (ball.x + BALL_SIZE >= CANVAS_WIDTH + 10) {
    resetBall();
  }
}

function broadcastState()
{
  const payload = JSON.stringify(gameState);
  socket.send(payload);
}
function startGameLoop() {
  if (running) return;
  running = true;
  loopHandle = setInterval(() => {
    updatePaddles();
    updateBall();
    checkCollisionsAndScore();
    broadcastState();
  }, TICK_MS);
}

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      websocket: true,
    },
    (connection, request) => {
      socket = connection;
      connection.send(JSON.stringify(gameState));

      connection.on("message", (raw) => {
        let message = JSON.parse(raw);
        if (message.type === "PADDLE_MOVE" )
        {
          const player = message.player === 1 ? "p1" : "p2";
          console.log(player);
          gameState.paddles[player].moving = message.direction;
        }
        if (message.type === "START")
        {
          console.log("starting game loop");
          startGameLoop();
        }
      });
    }
  );
}
