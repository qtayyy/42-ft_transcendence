import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

interface Ball {
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  speed: number;
}

interface Keys {
  [key: string]: boolean;
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  
  const keysRef = useRef<Keys>({});
  const animationFrameRef = useRef<number>();
  
  const CANVAS_WIDTH = 1000;
  const CANVAS_HEIGHT = 600;
  const PADDLE_WIDTH = 15;
  const PADDLE_HEIGHT = 100;
  const BALL_RADIUS = 10;
  const WINNING_SCORE = 7;

  const paddle1Ref = useRef<Paddle>({
    x: 30,
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    speed: 8
  });

  const paddle2Ref = useRef<Paddle>({
    x: CANVAS_WIDTH - 30 - PADDLE_WIDTH,
    y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    speed: 8
  });

  const ballRef = useRef<Ball>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    radius: BALL_RADIUS,
    velocityX: 5,
    velocityY: 5,
    speed: 5
  });

  const resetBall = useCallback(() => {
    const ball = ballRef.current;
    ball.x = CANVAS_WIDTH / 2;
    ball.y = CANVAS_HEIGHT / 2;
    ball.speed = 5;
    ball.velocityX = (Math.random() > 0.5 ? 1 : -1) * 5;
    ball.velocityY = (Math.random() * 4 - 2);
  }, []);

  const checkWinner = useCallback((newScore: { player1: number; player2: number }) => {
    if (newScore.player1 >= WINNING_SCORE) {
      setWinner('Player 1');
      setGameStarted(false);
      return true;
    } else if (newScore.player2 >= WINNING_SCORE) {
      setWinner('Player 2');
      setGameStarted(false);
      return true;
    }
    return false;
  }, []);

  const update = useCallback(() => {
    if (!gameStarted || isPaused) return;

    const paddle1 = paddle1Ref.current;
    const paddle2 = paddle2Ref.current;
    const ball = ballRef.current;
    const keys = keysRef.current;

    // Player 1 controls (WASD)
    if (keys['w'] || keys['W']) {
      paddle1.y = Math.max(0, paddle1.y - paddle1.speed);
    }
    if (keys['s'] || keys['S']) {
      paddle1.y = Math.min(CANVAS_HEIGHT - paddle1.height, paddle1.y + paddle1.speed);
    }

    // Player 2 controls (Arrow keys)
    if (keys['ArrowUp']) {
      paddle2.y = Math.max(0, paddle2.y - paddle2.speed);
    }
    if (keys['ArrowDown']) {
      paddle2.y = Math.min(CANVAS_HEIGHT - paddle2.height, paddle2.y + paddle2.speed);
    }

    // Ball movement
    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    // Top and bottom wall collision
    if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= CANVAS_HEIGHT) {
      ball.velocityY = -ball.velocityY;
      ball.y = ball.y - ball.radius <= 0 ? ball.radius : CANVAS_HEIGHT - ball.radius;
    }

    // Paddle collision detection
    const hitPaddle1 = 
      ball.x - ball.radius <= paddle1.x + paddle1.width &&
      ball.x + ball.radius >= paddle1.x &&
      ball.y >= paddle1.y &&
      ball.y <= paddle1.y + paddle1.height;

    const hitPaddle2 = 
      ball.x + ball.radius >= paddle2.x &&
      ball.x - ball.radius <= paddle2.x + paddle2.width &&
      ball.y >= paddle2.y &&
      ball.y <= paddle2.y + paddle2.height;

    if (hitPaddle1) {
      const collidePoint = ball.y - (paddle1.y + paddle1.height / 2);
      const normalizedCollidePoint = collidePoint / (paddle1.height / 2);
      const bounceAngle = normalizedCollidePoint * (Math.PI / 4);
      
      ball.velocityX = ball.speed * Math.cos(bounceAngle);
      ball.velocityY = ball.speed * Math.sin(bounceAngle);
      ball.x = paddle1.x + paddle1.width + ball.radius;
      ball.speed += 0.2;
    }

    if (hitPaddle2) {
      const collidePoint = ball.y - (paddle2.y + paddle2.height / 2);
      const normalizedCollidePoint = collidePoint / (paddle2.height / 2);
      const bounceAngle = normalizedCollidePoint * (Math.PI / 4);
      
      ball.velocityX = -ball.speed * Math.cos(bounceAngle);
      ball.velocityY = ball.speed * Math.sin(bounceAngle);
      ball.x = paddle2.x - ball.radius;
      ball.speed += 0.2;
    }

    // Score detection
    if (ball.x - ball.radius <= 0) {
      const newScore = { ...score, player2: score.player2 + 1 };
      setScore(newScore);
      if (!checkWinner(newScore)) {
        resetBall();
      }
    } else if (ball.x + ball.radius >= CANVAS_WIDTH) {
      const newScore = { ...score, player1: score.player1 + 1 };
      setScore(newScore);
      if (!checkWinner(newScore)) {
        resetBall();
      }
    }
  }, [gameStarted, isPaused, score, resetBall, checkWinner]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const paddle1 = paddle1Ref.current;
    const paddle2 = paddle2Ref.current;
    const ball = ballRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw center line
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles with glow effect
    const drawPaddle = (paddle: Paddle, color: string) => {
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.shadowBlur = 0;
    };

    drawPaddle(paddle1, '#00f5ff');
    drawPaddle(paddle2, '#ff00ff');

    // Draw ball with glow effect
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

  const gameLoop = useCallback(() => {
    update();
    draw();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  useEffect(() => {
    if (gameStarted && !isPaused && !winner) {
      gameLoop();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameStarted, isPaused, winner, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    setGameStarted(true);
    setWinner(null);
    setScore({ player1: 0, player2: 0 });
    resetBall();
  };

  const restartGame = () => {
    setScore({ player1: 0, player2: 0 });
    setWinner(null);
    setGameStarted(true);
    setIsPaused(false);
    resetBall();
  };

  return (
    <div className="app">
      <div className="game-container">
        <div className="header">
          <h1 className="title">Glassmorphism Ping Pong</h1>
          <div className="scoreboard">
            <div className="score-item player1">
              <span className="player-label">Player 1</span>
              <span className="score-value">{score.player1}</span>
            </div>
            <div className="score-divider">:</div>
            <div className="score-item player2">
              <span className="player-label">Player 2</span>
              <span className="score-value">{score.player2}</span>
            </div>
          </div>
        </div>

        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="game-canvas"
          />
          
          {!gameStarted && !winner && (
            <div className="overlay">
              <div className="overlay-content">
                <h2>Welcome to Ping Pong!</h2>
                <div className="controls-info">
                  <div className="control-group">
                    <h3>Player 1</h3>
                    <p><kbd>W</kbd> Move Up</p>
                    <p><kbd>S</kbd> Move Down</p>
                  </div>
                  <div className="control-group">
                    <h3>Player 2</h3>
                    <p><kbd>↑</kbd> Move Up</p>
                    <p><kbd>↓</kbd> Move Down</p>
                  </div>
                </div>
                <p className="pause-hint">Press <kbd>SPACE</kbd> to pause during game</p>
                <button className="start-button" onClick={startGame}>
                  Start Game
                </button>
              </div>
            </div>
          )}

          {isPaused && gameStarted && (
            <div className="overlay">
              <div className="overlay-content">
                <h2>Game Paused</h2>
                <p>Press <kbd>SPACE</kbd> to resume</p>
              </div>
            </div>
          )}

          {winner && (
            <div className="overlay">
              <div className="overlay-content winner-screen">
                <h2>🏆 {winner} Wins! 🏆</h2>
                <p className="final-score">
                  Final Score: {score.player1} - {score.player2}
                </p>
                <button className="start-button" onClick={restartGame}>
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="footer">
          <div className="info-card">
            <p>First to {WINNING_SCORE} points wins!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
