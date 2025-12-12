"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Dirent } from "fs";

// Define the shape of your Game State (Match Backend)
interface GameState {
	status: string,
	constant: {
		canvasWidth: number;
		canvasHeight: number;
		paddleWidth: number;
		paddleHeight: number;
		paddleSpeed: number;
		ballSize: number;
		FPS: number;
		TICK_MS: number;
	},
	ball: {
		x: number;
		y: number;
		dx: number;
		dy: number;
	},
	paddles: {
		p1: {
			x: number;
			y: number;
			moving: string;
		},
		p2: {
			x: number;
			y: number;
			moving: string;
		}
	}
	score: {
		p1: number;
		p2: number;
	},
	winner: string;
}

export default function GamePage() {
	const params = useParams();
	const matchId = params.matchId as string;

	// useRef : Container/ Reference
	// change this value does not trigger re-render
	// store stuff that don't affect HTML / hold connection for DOM
	const canvasRef = useRef<HTMLCanvasElement>(null); // Hold direct link to actual <canvas> HTML tag
	const socketRef = useRef<WebSocket | null>(null); // Hold the open websocket connection
	// useState: Componenents's Memory
	// Whenever you change this value, triggers re-render
	// <GameState | null> ---->Typescript -->this variable can hold GameState object OR null
	const [ gameState, setGameState ] = useState<GameState | null>(null);

	// Initialize Websocket Connection
	useEffect(() => {
		// Connect to the Websocket route with matchId
		const ws = new WebSocket(`wss://localhost:8443/ws/game/start-game?matchId=${matchId}`);
		ws.onopen = () => {
			console.log("Connected to Game Server");
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "GAME_OVER") {
					alert(`Game Over! Winner: Player ${data.winner}`);
				}
				else {
					// update local state with server state
					setGameState(data);
				}
			}
			catch (e) {
				console.error("Parse Error", e);
			}
		};

		socketRef.current = ws;

		// CLEANUP FX
		// This runs when you leave the page (Unmount)
		// It closes the connection so you don't have "ghost" connections active
		return () => {
			ws.close();
		};
	}, [matchId]); // DEPENDENCIES : Runs only if `matchId` changes

	// Handle Input (Keyboard)
	useEffect(() => {
		const handleKeyDown = (e : KeyboardEvent) => {
			if (!socketRef.current)
				return ;

			// Prepare payload based on the key
			// TypeScript has strict 'null' type by default
			// 'any' keyword allows payload structural changes (sometimes p1, sometimes p2)
			let payload: any = null;

			// Simple mapping - Server decides if it's valid for this user
			if (e.key === "w") {
				payload = {
					type: "PADDLE_MOVE",
					direction: "UP",
					player: 1
				};
			}
			if (e.key === "s") {
				payload = {
					type: "PADDLE_MOVE",
					direction: "DOWN",
					player: 1
				};
			}
			if (e.key === "ArrowUp") {
				payload = {
					type: "PADDLE_MOVE",
					direction: "UP",
					player: 2
				};
			}
			if (e.key === "ArrowDown") {
				payload = {
					type: "PADDLE_MOVE",
					direction: "DOWN",
					player: 2
				};
			}

			// Start game key
			if (e.key === "Enter") {
				payload = {
					type: "START"
				};
			}

			if (payload) {
				socketRef.current.send(JSON.stringify(payload)); // Need Optimization so that dont spam server
			}
		};

		// Handle KeyUp to stop movement (send direction: null)
		const handleKeyUp = (e : KeyboardEvent) => {
			if (!socketRef.current)
				return ;
			let payload: any = null;
			if (e.key === "w" || e.key === "s") {
				payload = {
					type: "PADDLE_MOVE",
					direction: null,
					player: 1
				};
			}
			if (e.key === "ArrowUp" || e.key === "ArrowDown") {
				payload = {
					type: "PADDLE_MOVE",
					direction: null,
					player: 2
				};
			}

			if (payload) {
				socketRef.current.send(JSON.stringify(payload)); // Need Optimization so that dont spam server
			}
		};

		// Tells browser to listen to keys
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []); // DEPENDENCY: Empty array means "Run ONLY once when component appears"

	// Render Loop (Draw the State)
	useEffect(() => {
		if (!gameState || !canvasRef.current)
			return ;
		const context = canvasRef.current.getContext("2d");
		if (!context)
			return ;

		// Clear Canvas
		context.clearRect(0, 0, gameState.constant.canvasWidth, gameState.constant.canvasHeight);
		context.fillStyle = "white";

		// Draw Ball
		context.beginPath();
		context.arc(gameState.ball.x, gameState.ball.y, 6, 0, Math.PI * 2);
		context.fill();

		// Draw Paddles
		context.fillRect(gameState.paddles.p1.x, gameState.paddles.p1.y, gameState.constant.paddleWidth, gameState.constant.paddleHeight);
		context.fillRect(gameState.paddles.p2.x, gameState.paddles.p2.y, gameState.constant.paddleWidth, gameState.constant.paddleHeight);

		// Draw Scores 
		context.font = "20px Arial";
		context.fillText(gameState.score.p1.toString() + " : ", 200, 50);
		context.fillText(gameState.score.p2.toString(), 600, 50);
	}, [gameState]);

	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
			<h1 className="mb-4 text-2xl">Match ID: {matchId}</h1>
			<canvas
				ref={canvasRef}
				width={gameState?.constant.canvasWidth}
				height={gameState?.constant.canvasHeight}
				className="border-2 boarder-white bg-gray-900"
			/>
			<p className="mt-4">
				Controls: W/S (Player 1) | Arrow (Player 2 / Local) | Enter (Start)
			</p>
		</div>
	)
}