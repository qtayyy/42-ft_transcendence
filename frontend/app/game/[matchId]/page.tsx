"use client";
import { useRef, useEffect } from "react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12; // must be half the size of paddle width

function drawGame(ctx, { ball, paddles }) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // draw da ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, 2 * Math.PI);
  ctx.fillStyle = "white";
  ctx.fill();

  // console.log(paddles);
  // draw left & right paddle
  ctx.fillRect(paddles.p1.x, paddles.p1.y, PADDLE_WIDTH, PADDLE_HEIGHT);
  ctx.fillRect(paddles.p2.x, paddles.p2.y, PADDLE_WIDTH, PADDLE_HEIGHT);
}

export default function GamePage({ matchId }) {
  const socketRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef(null);

  // Set up socket connection
  useEffect(() => {
    const socket = new WebSocket("wss://localhost:8443/ws/game");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Client connected to WS server");
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      gameStateRef.current = data;
    };

    socket.onclose = () => {
      console.log("Socket closed");
    };

    return () => {
      socket.close();
    };
  }, [matchId]);

  // Send keydown/up events thru socket
  useEffect(() => {
    function send(payload) {
      socketRef.current?.send(
        JSON.stringify(payload)
      );
    }

    const onKeyDown = (e) => {
      if (e.key === "Enter") send({ type: "START" });
      if (e.key === "w") send({ type: "PADDLE_MOVE", player: 1, direction: "UP" });
      if (e.key === "s") send({ type: "PADDLE_MOVE", player: 1, direction: "DOWN" });
      if (e.key === "ArrowUp") send({ type: "PADDLE_MOVE", player: 2, direction: "UP" });
      if (e.key === "ArrowDown") send({ type: "PADDLE_MOVE", player: 2, direction: "DOWN" });
    };

    const onKeyUp = (e) => {
      if (["w", "s"].includes(e.key)) send({ type: "PADDLE_MOVE", player: 1, direction: null });
      if (["ArrowUp", "ArrowDown"].includes(e.key)) send({ type: "PADDLE_MOVE", player: 2, direction: null });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Render game based on game state
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    function loop() {
      if (gameStateRef.current) {
        drawGame(ctx, gameStateRef.current);
      }
      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="bg-red-500 w-full"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
    ></canvas>
  );
}
