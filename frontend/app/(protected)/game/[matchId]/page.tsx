"use client";

import PongGame from "@/components/game/PongGame";
import { useParams, useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;

export default function GamePage() {
	const params = useParams();
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameState } = useGame();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const matchId = params.matchId as string;
	const [matchData, setMatchData] = useState<any>(null);
	const [gameOverResult, setGameOverResult] = useState<any>(null);

	// Determine if this is a remote game (RS-* prefix)
	const isRemoteGame = matchId.startsWith("RS-");
	
	// For remote games, check if both players are ready
	const gameStart = gameState && !gameState.leftPlayer?.gamePaused && !gameState.rightPlayer?.gamePaused;

	// Listen for game over event
	useEffect(() => {
		const handleGameOver = (event: CustomEvent) => {
			setGameOverResult(event.detail);
		};

		window.addEventListener("gameOver", handleGameOver as EventListener);
		return () => {
			window.removeEventListener("gameOver", handleGameOver as EventListener);
		};
	}, []);

	// Load match data for local games
	useEffect(() => {
		if (!isRemoteGame) {
			const storedMatchData = localStorage.getItem("current-match");
			if (storedMatchData) {
				setMatchData(JSON.parse(storedMatchData));
			}
		}
	}, [isRemoteGame]);

	// Handle keyboard input for remote games
	useEffect(() => {
		if (!isRemoteGame || !isReady || !gameState) return;

		const onKeyDown = (e: KeyboardEvent) => {
			const KEYS = ["w", "W", "s", "S", "Enter"];
			if (!KEYS.includes(e.key)) return;

			let keyEvent = "START";
			if (e.key === "w" || e.key === "W") keyEvent = "UP";
			else if (e.key === "s" || e.key === "S") keyEvent = "DOWN";
			
			sendSocketMessage({
				event: "GAME_EVENTS",
				payload: {
					matchId: gameState.matchId,
					userId: user?.id,
					keyEvent,
				},
			});
		};

		const onKeyUp = (e: KeyboardEvent) => {
			const KEYS = ["w", "W", "s", "S", "Enter"];
			if (!KEYS.includes(e.key)) return;

			sendSocketMessage({
				event: "GAME_EVENTS",
				payload: {
					matchId: gameState.matchId,
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
	}, [isRemoteGame, isReady, sendSocketMessage, gameState, user]);

	// Render remote game based on game state
	useEffect(() => {
		if (!isRemoteGame || !gameState) return;
		
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!ctx) return;

		function drawGame() {
			if (!ctx || !gameState) return;
			
			const ball = gameState.ball;
			const left = gameState.leftPlayer;
			const right = gameState.rightPlayer;

			// Clear canvas
			ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
			
			// Draw center line
			ctx.setLineDash([5, 10]);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
			ctx.beginPath();
			ctx.moveTo(CANVAS_WIDTH / 2, 0);
			ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
			ctx.stroke();
			ctx.setLineDash([]);

			// Draw ball
			if (ball) {
				ctx.beginPath();
				ctx.arc(ball.posX, ball.posY, BALL_SIZE / 2, 0, 2 * Math.PI);
				ctx.fillStyle = "#FFD700";
				ctx.fill();
			}

			// Draw paddles
			ctx.fillStyle = gameState.me === "LEFT" ? "#22c55e" : "#3b82f6";
			if (left) {
				ctx.fillRect(left.paddleX, left.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
			}
			
			ctx.fillStyle = gameState.me === "RIGHT" ? "#22c55e" : "#3b82f6";
			if (right) {
				ctx.fillRect(right.paddleX, right.paddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
			}
		}

		function loop() {
			drawGame();
			requestAnimationFrame(loop);
		}

		const animId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(animId);
	}, [isRemoteGame, gameState]);

	const handleGameOver = async (winner: number | null, score: { p1: number; p2: number }, result: string) => {
		console.log(`Game Over! Result: ${result}`, { winner, score });
		
		if (matchData && user) {
			try {
				const player1Id = matchData.player1?.isTemp ? null : matchData.player1?.id;
				const player2Id = matchData.player2?.isTemp ? null : matchData.player2?.id;

				if (player1Id || player2Id) {
					await axios.post("/api/game/save-match", {
						matchId: matchData.matchId,
						player1Id: player1Id,
						player2Id: player2Id,
						player1Name: matchData.player1?.name,
						player2Name: matchData.player2?.name,
						score1: score.p1,
						score2: score.p2,
						winner: winner,
						mode: "LOCAL",
					});
				}
			} catch (error: any) {
				console.error("Failed to save match:", error);
				toast.error("Failed to save match result.");
			}
		}
	};

	const handleExit = () => {
		localStorage.removeItem("current-match");
		router.push("/game/new");
	};

	// Remote game rendering
	if (isRemoteGame) {
		return (
			<div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
				<div className="w-full max-w-4xl space-y-6">
					{/* Header */}
					<div className="flex justify-between items-center">
						<div>
							<h1 className="text-2xl font-bold text-primary">REMOTE MATCH</h1>
							<p className="text-sm text-muted-foreground font-mono">{matchId}</p>
						</div>
						<div className="flex items-center gap-4">
							<div className="text-right">
								<p className="font-semibold">{gameState?.leftPlayer?.username}</p>
								<p className="text-xs text-muted-foreground">Player 1</p>
							</div>
							<div className="text-3xl font-bold px-4">
								{gameState?.leftPlayer?.score || 0} - {gameState?.rightPlayer?.score || 0}
							</div>
							<div className="text-left">
								<p className="font-semibold">{gameState?.rightPlayer?.username}</p>
								<p className="text-xs text-muted-foreground">Player 2</p>
							</div>
						</div>
					</div>

					{/* Game Canvas */}
					<div className="relative rounded-xl overflow-hidden border border-primary/20 shadow-xl shadow-primary/10">
						<canvas
							ref={canvasRef}
							className="bg-slate-900 w-full"
							width={CANVAS_WIDTH}
							height={CANVAS_HEIGHT}
						/>
						
						{/* Press Enter overlay */}
						{!gameStart && !gameOverResult && (
							<div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
								<div className="text-center">
									<p className="text-white text-3xl font-bold mb-2">Press ENTER to Ready</p>
									<p className="text-white/70 text-lg">
										{gameState?.me === "LEFT" ? "You are Player 1 (Left)" : "You are Player 2 (Right)"}
									</p>
									<p className="text-white/50 text-sm mt-2">Use W/S to move your paddle</p>
								</div>
							</div>
						)}

						{/* Game Over overlay */}
						{gameOverResult && (
							<div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-md">
								<div className="text-center space-y-6">
									<h2 className="text-5xl font-bold text-white">GAME OVER</h2>
									
									<div className="flex items-center justify-center gap-8">
										<div className={`text-center p-4 rounded-xl ${gameOverResult.winner === "LEFT" ? "bg-green-500/20 ring-2 ring-green-500" : "bg-muted/20"}`}>
											<p className="text-lg font-semibold text-white">{gameOverResult.leftPlayer?.username}</p>
											<p className="text-4xl font-bold text-white">{gameOverResult.leftPlayer?.score}</p>
											{gameOverResult.winner === "LEFT" && <p className="text-green-400 font-bold mt-2">WINNER!</p>}
										</div>
										<span className="text-3xl text-white/50">vs</span>
										<div className={`text-center p-4 rounded-xl ${gameOverResult.winner === "RIGHT" ? "bg-green-500/20 ring-2 ring-green-500" : "bg-muted/20"}`}>
											<p className="text-lg font-semibold text-white">{gameOverResult.rightPlayer?.username}</p>
											<p className="text-4xl font-bold text-white">{gameOverResult.rightPlayer?.score}</p>
											{gameOverResult.winner === "RIGHT" && <p className="text-green-400 font-bold mt-2">WINNER!</p>}
										</div>
										</div>
								
								<div className="flex gap-4">
									<Button
										onClick={() => {
											// Send rematch request with both players' info
											sendSocketMessage({
												event: "REMATCH",
												payload: {
													player1Id: gameOverResult.leftPlayer?.id,
													player1Username: gameOverResult.leftPlayer?.username,
													player2Id: gameOverResult.rightPlayer?.id,
													player2Username: gameOverResult.rightPlayer?.username,
												},
											});
											setGameOverResult(null);
										}}
										size="lg"
										className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg h-14 px-8"
									>
										Rematch
									</Button>
									<Button
										onClick={() => {
											// Notify opponent that we're leaving
											const opponentId = gameOverResult.leftPlayer?.id === user?.id 
												? gameOverResult.rightPlayer?.id 
												: gameOverResult.leftPlayer?.id;
											sendSocketMessage({
												event: "LEAVE_GAME",
												payload: { 
													opponentId,
													matchId: gameOverResult.matchId 
												},
											});
											router.push("/game/new");
										}}
										variant="outline"
										size="lg"
										className="text-lg h-14 px-8 border-white/20 text-white hover:bg-white/10"
									>
										Leave
									</Button>
								</div>
							</div>
							</div>
						)}
					</div>

					{/* Controls hint */}
					<div className="flex justify-center gap-8 text-sm text-muted-foreground">
						<span>W/S - Move paddle</span>
						<span>ENTER - Ready</span>
					</div>
				</div>
			</div>
		);
	}

	// Local game rendering (original behavior)
	return (
		<div className="relative">
			<PongGame
				matchId={matchId}
				mode="local"
				wsUrl={`wss://localhost:8443/ws/game?matchId=${matchId}`}
				onGameOver={handleGameOver}
				onExit={handleExit}
				isTournamentMatch={matchData?.isTournamentMatch}
			/>
		</div>
	);
}