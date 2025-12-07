"use client";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;

export default function GamePage() {
  const { sendSocketMessage, isReady } = useSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState } = useGame();
  const { user } = useAuth();
  const gameStart =
    !gameState?.leftPlayer.gamePaused && !gameState?.rightPlayer.gamePaused;

  useEffect(() => {
  if (!isReady) {
    return;
  }  

  const onKeyDown = (e) => {
    const KEYS = ["w", "W", "s", "S", "Enter"];
    if (!KEYS.includes(e.key)) return;

    let keyEvent = "START";
    if (e.key === "w" || e.key === "W") keyEvent = "UP";
    else if (e.key === "s" || e.key === "S") keyEvent = "DOWN";
    sendSocketMessage({
      event: "GAME_EVENTS",
      payload: {
        tournamentId: gameState?.tournamentId,
        matchId: gameState?.matchId,
        userId: user?.id,
        keyEvent,
      },
    });
  };

  const onKeyUp = (e) => {
    const KEYS = ["w", "W", "s", "S", "Enter"];
    if (!KEYS.includes(e.key)) return;

    sendSocketMessage({
      event: "GAME_EVENTS",
      payload: {
        tournamentId: gameState?.tournamentId,
        matchId: gameState?.matchId,
        userId: user?.id,
        keyEvent: "",
      },
    });
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}, [isReady, sendSocketMessage, gameState, user]);


  // Render game based on game state
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    function drawGame(ctx) {
      const ball = gameState?.ball;
      const left = gameState?.leftPlayer;
      const right = gameState?.rightPlayer;

      // Draw the canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      // draw the ball
      ctx.beginPath();
      ctx.arc(ball?.posX, ball?.posY, BALL_SIZE / 2, 0, 2 * Math.PI);
      ctx.fillStyle = "white";
      ctx.fill();

      // Draw the paddles
      ctx.fillRect(left?.paddleX, left?.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(right?.paddleX, right?.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
    }

    function loop() {
      if (gameState) {
        drawGame(ctx);
      }
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }, [gameState]);

  return (
    <div className="m-5">
      <div className="flex justify-between my-4">
        <p className="text-2xl font-semibold">Tournament</p>
        <div>
          <Button>Pause</Button>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="bg-accent w-full"
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
        ></canvas>
        {gameStart === false ? (
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2
                 bg-black bg-opacity-10 py-4
                 flex justify-center items-center"
          >
            <p className="text-white text-4xl">Press Enter to Start</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
