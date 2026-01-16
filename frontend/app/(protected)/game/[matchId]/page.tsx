"use client";

import PongGame from "@/components/game/PongGame";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 12;

export default function GamePage() {
	const params = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameState } = useGame();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const matchId = params.matchId as string;
	const [matchData, setMatchData] = useState<any>(null);
	const [gameOverResult, setGameOverResult] = useState<any>(null);

	// Detect spectator mode from query param or gameState
	const isSpectator = searchParams.get('spectator') === 'true' || (gameState as any)?.spectatorMode === true;

	// Determine if this is a remote game (RS-* prefix or RT-* prefix for tournaments)
	const isRemoteGame = matchId.startsWith("RS-") || matchId.startsWith("RT-");
	
	// For remote games, check if both players are ready
	const gameStart = gameState && !gameState.leftPlayer?.gamePaused && !gameState.rightPlayer?.gamePaused;

	// Auto-redirect for tournament matches
	useEffect(() => {
		if (gameOverResult?.tournamentId) {
			const timer = setTimeout(() => {
				router.push(`/game/remote/tournament/${gameOverResult.tournamentId}`);
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [gameOverResult, router]);

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
		if (!isRemoteGame || !isReady || !gameState || isSpectator) return;

		const onKeyDown = (e: KeyboardEvent) => {
			const KEYS = ["w", "W", "s", "S", "ArrowUp", "ArrowDown", "Enter"];
			if (!KEYS.includes(e.key)) return;

			// Prevent default scrolling for arrow keys
			if (["ArrowUp", "ArrowDown"].includes(e.key)) {
				e.preventDefault();
			}

			let keyEvent = "START";
			// Both WASD and Arrow keys send generic UP/DOWN for the current user
			// The backend determines which paddle to move based on userId
			if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keyEvent = "UP";
			else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keyEvent = "DOWN";
			
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
			const KEYS = ["w", "W", "s", "S", "ArrowUp", "ArrowDown", "Enter"];
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
	}, [isRemoteGame, isReady, sendSocketMessage, gameState, user, isSpectator]);

	// Return to lobby handler for spectators
	const returnToLobby = () => {
		// Send UNVIEW_MATCH event
		if (matchId) {
			sendSocketMessage({
				event: "UNVIEW_MATCH",
				payload: { matchId }
			});
		}
		
		// Navigate back to tournament lobby or dashboard
		let tournamentId: string | number | undefined = gameState?.tournamentId;
		
		// Fallback: Try to extract tournamentId from matchId (format: RT-{roomId}-m{id})
		if (!tournamentId && matchId.startsWith("RT-")) {
            // Extract everything before the last -m part
            // Example: RT-123-m1 -> RT-123
            const parts = matchId.split("-m");
            if (parts.length > 1) {
                tournamentId = parts[0];
            }
		}

		if (tournamentId) {
			router.push(`/game/remote/tournament/${tournamentId}`);
		} else {
			router.push("/dashboard");
		}
	};

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
			<div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20 relative">
				{/* Spectator Overlay */}
				{isSpectator && (
					<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
						<Badge className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 text-sm font-medium animate-pulse">
							<Eye className="mr-2 h-4 w-4" /> Spectating Live
						</Badge>
						<Button
							onClick={returnToLobby}
							variant="secondary"
							size="sm"
							className="bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background/90"
						>
							<ArrowLeft className="mr-2 h-4 w-4" /> Return to Lobby
						</Button>
					</div>
				)}

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
						
						{/* Ready Status UI */}
						{!gameStart && !gameOverResult && gameState && (
							<div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm p-8">
								<div className="text-center space-y-6 max-w-lg w-full">
									{/* Determine my status and opponent's status */}
									{(() => {
										// If spectator, show waiting status only
										if (isSpectator) {
											return (
												<div className="flex flex-col items-center justify-center space-y-4">
													<Loader2 className="h-12 w-12 text-primary animate-spin" />
													<h3 className="text-2xl font-bold text-white">Match Starting Soon</h3>
													<p className="text-white/80">Waiting for players to get ready...</p>
												</div>
											)
										}

										const mySide = gameState.me;
										const opponentSide = mySide === "LEFT" ? "RIGHT" : "LEFT";
										
										const me = mySide === "LEFT" ? gameState.leftPlayer : gameState.rightPlayer;
										const opponent = mySide === "LEFT" ? gameState.rightPlayer : gameState.leftPlayer;
										
										const amIReady = !me?.gamePaused;
										const isOpponentReady = !opponent?.gamePaused;
										
										if (amIReady && !isOpponentReady) {
											return (
												<div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
													<div className="relative">
														<div className="h-16 w-16 rounded-full border-4 border-yellow-500/30 border-t-yellow-500 animate-spin" />
														<div className="absolute inset-0 flex items-center justify-center">
															<span className="text-xl">⏳</span>
														</div>
													</div>
													<div className="space-y-1">
														<h3 className="text-2xl font-bold text-yellow-500">Waiting for Opponent</h3>
														<p className="text-white/80">
															Waiting for <span className="font-semibold text-white">{opponent?.username || "Opponent"}</span> to be ready...
														</p>
													</div>
												</div>
											);
										} else if (!amIReady && isOpponentReady) {
											return (
												<div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
													<div className="p-4 bg-green-500/10 rounded-full ring-1 ring-green-500/30 mb-2">
														<span className="text-4xl">✨</span>
													</div>
													<div className="space-y-2">
														<h3 className="text-3xl font-bold text-green-400">Opponent is Ready!</h3>
														<p className="text-white/90 text-lg">
															<span className="font-semibold text-white">{opponent?.username}</span> is waiting for you.
														</p>
													</div>
													<div className="p-6 bg-white/5 rounded-xl border border-white/10 w-full">
														<p className="text-lg font-medium text-white mb-2">Press <span className="px-2 py-1 bg-white/20 rounded font-mono font-bold">ENTER</span> to start!</p>
														<p className="text-xs text-white/50">Only you can start the match now</p>
													</div>
												</div>
											);
										} else {
											return (
												<div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
													<h3 className="text-3xl font-bold text-white">Are you ready?</h3>
													<p className="text-white/70">Press <span className="px-2 py-1 bg-white/20 rounded font-mono font-bold text-white">ENTER</span> to mark yourself as ready</p>
													<p className="text-sm text-white/50 pt-4">
														{gameState.me === "LEFT" ? "You are Player 1 (Left)" : "You are Player 2 (Right)"}
													</p>
												</div>
											);
										}
									})()}
								</div>
							</div>
						)}

						{/* Game Over overlay */}
						{gameOverResult && (
							<div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-md">
								<div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
									<h2 className="text-5xl font-black text-white tracking-tight">GAME OVER</h2>
									
									<div className="flex items-center justify-center gap-8 py-8">
										<div className={`text-center p-6 rounded-2xl transition-all duration-500 ${gameOverResult.winner === "LEFT" ? "bg-green-500/20 ring-4 ring-green-500 scale-110 shadow-2xl shadow-green-500/20" : "bg-white/5 grayscale opacity-70"}`}>
											<p className="text-lg font-semibold text-white mb-1">{gameOverResult.leftPlayer?.username}</p>
											<p className="text-6xl font-black text-white">{gameOverResult.leftPlayer?.score}</p>
											{gameOverResult.winner === "LEFT" && (
												<Badge className="mt-4 bg-green-500 hover:bg-green-600 text-white border-0 text-sm px-3 py-1">WINNER</Badge>
											)}
										</div>
										<span className="text-4xl text-white/30 font-thin">vs</span>
										<div className={`text-center p-6 rounded-2xl transition-all duration-500 ${gameOverResult.winner === "RIGHT" ? "bg-green-500/20 ring-4 ring-green-500 scale-110 shadow-2xl shadow-green-500/20" : "bg-white/5 grayscale opacity-70"}`}>
											<p className="text-lg font-semibold text-white mb-1">{gameOverResult.rightPlayer?.username}</p>
											<p className="text-6xl font-black text-white">{gameOverResult.rightPlayer?.score}</p>
											{gameOverResult.winner === "RIGHT" && (
												<Badge className="mt-4 bg-green-500 hover:bg-green-600 text-white border-0 text-sm px-3 py-1">WINNER</Badge>
											)}
										</div>
									</div>
								
								<div className="flex gap-4 justify-center">
									{gameOverResult.tournamentId ? (
										<div className="space-y-4">
											<p className="text-white/80 animate-pulse">
												Returning to tournament lobby in 5 seconds...
											</p>
											<Button
												onClick={() => {
													router.push(`/game/remote/tournament/${gameOverResult.tournamentId}`);
												}}
												size="lg"
												className="bg-white/10 hover:bg-white/20 text-white border-0"
											>
												Return Now <ArrowLeft className="ml-2 h-4 w-4" />
											</Button>
										</div>
									) : (
										<>
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
												className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg h-14 px-8 shadow-lg shadow-green-500/20"
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
										</>
									)}
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
			{/* Spectator Overlay */}
			{isSpectator && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
					<Badge className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 text-sm font-medium">
						<Eye className="mr-2 h-4 w-4" /> Spectating
					</Badge>
					<Button
						onClick={returnToLobby}
						variant="outline"
						size="sm"
						className="bg-background/80 backdrop-blur-sm"
					>
						<ArrowLeft className="mr-2 h-4 w-4" /> Return to Lobby
					</Button>
				</div>
			)}

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