"use client";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";
import axios from "@/lib/axios";
import { useAuthContext } from "@/context/authContext";
// import { useSocket } from "../../context/socketContext";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;

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

export default function GamePage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const socketRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef(null);
  const [gameStart, setGameStart] = useState(false);
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const router = useRouter();
  const { user } = useAuthContext();
  // const { socket } = useSocket();

  // Save match result to database
  const saveMatchResult = async (finalScore: { p1: number; p2: number }) => {
    try {
      console.log("Saving match result:", {
        tournamentId: parseInt(matchId as string),
        player1Id: parseInt(user?.userId || "1"),
        player2Id: 2,
        score1: finalScore.p1,
        score2: finalScore.p2,
      });
      
      await axios.post("/api/match/save", {
        tournamentId: parseInt(matchId as string),
        player1Id: parseInt(user?.userId || "1"), // Get from authenticated user
        player2Id: 2, // TODO: Get from game participants
        score1: finalScore.p1,
        score2: finalScore.p2,
      });
      console.log("Match saved successfully");
    } catch (error) {
      console.error("Failed to save match:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
    }
  };

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
      
      // Update score display
      if (data.score) {
        setScore(data.score);
      }
      
      // Check for game over
      if (data.gameOver && !gameOver) {
        setGameOver(true);
        setWinner(data.winner);
        saveMatchResult(data.score);
      }
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
      socketRef.current?.send(JSON.stringify(payload));
    }

    const onKeyDown = (e) => {
      if (e.key === "Enter")
      {
        send({ type: "START" });
        if (gameStart === false)
          setGameStart((prev) => !prev);
      } 
      if (e.key === "w")
        send({ type: "PADDLE_MOVE", player: 1, direction: "UP" });
      if (e.key === "s")
        send({ type: "PADDLE_MOVE", player: 1, direction: "DOWN" });
      if (e.key === "ArrowUp")
        send({ type: "PADDLE_MOVE", player: 2, direction: "UP" });
      if (e.key === "ArrowDown")
        send({ type: "PADDLE_MOVE", player: 2, direction: "DOWN" });
    };

    const onKeyUp = (e) => {
      if (["w", "s"].includes(e.key))
        send({ type: "PADDLE_MOVE", player: 1, direction: null });
      if (["ArrowUp", "ArrowDown"].includes(e.key))
        send({ type: "PADDLE_MOVE", player: 2, direction: null });
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
    <div className="m-5">
      <div className="flex justify-between my-4">
        <p className="text-2xl font-semibold">Tournament</p>
        <div className="flex gap-4 items-center">
          <div className="text-4xl font-bold">
            {score.p1} - {score.p2}
          </div>
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
        {gameStart === false && !gameOver ? (
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2
                 bg-black bg-opacity-10 py-4
                 flex justify-center items-center"
          >
            <p className="text-white text-4xl">Press Enter to Play</p>
          </div>
        ) : null}
        {gameOver ? (
          <div
            className="absolute top-1/2 left-0 right-0 -translate-y-1/2
                 bg-black bg-opacity-90 py-8
                 flex flex-col gap-4 justify-center items-center"
          >
            <p className="text-white text-5xl font-bold">Game Over!</p>
            <p className="text-white text-3xl">Player {winner} Wins!</p>
            <p className="text-white text-2xl">Final Score: {score.p1} - {score.p2}</p>
            <div className="flex gap-4 mt-4">
              <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>Play Again</Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
