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
import { Eye, ArrowLeft, Loader2, Timer, Keyboard, Gamepad2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPowerUpColor, getEffectColor, getPowerUpSymbol, formatTime } from "@/utils/gameHelpers";

// Default canvas dimensions (will use gameState.constant if available)
// These are the logical/game dimensions - display size is controlled separately
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 350;

// Display scale factor for remote games (multiplied by logical dimensions)
const REMOTE_DISPLAY_SCALE = 1.4;
const DEFAULT_PADDLE_WIDTH = 12;
const DEFAULT_PADDLE_HEIGHT = 80;
const DEFAULT_BALL_SIZE = 12;

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
	const [disconnectInfo, setDisconnectInfo] = useState<{
		disconnectedPlayer: string;
		gracePeriodEndsAt: number;
		countdown: number;
	} | null>(null);
	const [pauseInfo, setPauseInfo] = useState<{
		pausedBy: string;
		pausedByName: string;
		myReadyToResume: boolean;
		opponentReadyToResume: boolean;
	} | null>(null);

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

	// Listen for opponent disconnect/reconnect events
	const [opponentConnected, setOpponentConnected] = useState(true);

	useEffect(() => {
		const handleDisconnect = (event: CustomEvent) => {
			const { disconnectedPlayer, gracePeriodEndsAt } = event.detail;
			const countdown = Math.ceil((gracePeriodEndsAt - Date.now()) / 1000);
			setDisconnectInfo({ disconnectedPlayer, gracePeriodEndsAt, countdown });
			toast.warning("Opponent disconnected! Waiting for reconnection...");
			setOpponentConnected(false);
		};

		const handleReconnect = (_event: CustomEvent) => {
			setDisconnectInfo(null);
			toast.success("Opponent reconnected!");
			setOpponentConnected(true);
		};

		const handleOpponentLeft = () => {
			setOpponentConnected(false);
			// We don't need to toast here as SocketContext already does, or we can add specific UI feedback
		};

		// Pause/Resume events
		const handleGamePaused = (event: CustomEvent) => {
			const { pausedBy, pausedByName } = event.detail;
			setPauseInfo({
				pausedBy,
				pausedByName,
				myReadyToResume: false,
				opponentReadyToResume: false
			});
		};

		const handleGameResumed = () => {
			setPauseInfo(null);
		};

		const handleOpponentReadyToResume = () => {
			setPauseInfo(prev => prev ? { ...prev, opponentReadyToResume: true } : null);
		};

		const handleWaitingForResume = () => {
			setPauseInfo(prev => prev ? { ...prev, myReadyToResume: true } : null);
		};

		window.addEventListener("opponentDisconnected", handleDisconnect as EventListener);
		window.addEventListener("opponentReconnected", handleReconnect as EventListener);
		window.addEventListener("opponentLeft", handleOpponentLeft as EventListener);
		window.addEventListener("gamePaused", handleGamePaused as EventListener);
		window.addEventListener("gameResumed", handleGameResumed as EventListener);
		window.addEventListener("opponentReadyToResume", handleOpponentReadyToResume as EventListener);
		window.addEventListener("waitingForResume", handleWaitingForResume as EventListener);

		return () => {
			window.removeEventListener("opponentDisconnected", handleDisconnect as EventListener);
			window.removeEventListener("opponentReconnected", handleReconnect as EventListener);
			window.removeEventListener("opponentLeft", handleOpponentLeft as EventListener);
			window.removeEventListener("gamePaused", handleGamePaused as EventListener);
			window.removeEventListener("gameResumed", handleGameResumed as EventListener);
			window.removeEventListener("opponentReadyToResume", handleOpponentReadyToResume as EventListener);
			window.removeEventListener("waitingForResume", handleWaitingForResume as EventListener);
		};
	}, []);

	// Sync disconnect info from game state (for reconnection scenarios or late state updates)
	useEffect(() => {
		if (!gameState) return;

		// Check if gameState has disconnect countdown info
		const disconnectCountdown = (gameState as any)?.disconnectCountdown;
		if (disconnectCountdown && disconnectCountdown.gracePeriodEndsAt) {
			const countdown = Math.ceil((disconnectCountdown.gracePeriodEndsAt - Date.now()) / 1000);
			if (countdown > 0 && !disconnectInfo) {
				setDisconnectInfo({
					disconnectedPlayer: disconnectCountdown.disconnectedPlayer || (gameState as any)?.disconnectedPlayer,
					gracePeriodEndsAt: disconnectCountdown.gracePeriodEndsAt,
					countdown
				});
				setOpponentConnected(false);
			}
		}

		// Also check if game is paused due to disconnect (from disconnectedPlayer field)
		if ((gameState as any)?.paused && (gameState as any)?.disconnectedPlayer && !disconnectInfo) {
			// Calculate remaining time based on pausedAt (30 second grace period)
			const pausedAt = (gameState as any)?.pausedAt;
			if (pausedAt) {
				const gracePeriodEndsAt = pausedAt + 30000;
				const countdown = Math.ceil((gracePeriodEndsAt - Date.now()) / 1000);
				if (countdown > 0) {
					setDisconnectInfo({
						disconnectedPlayer: (gameState as any).disconnectedPlayer,
						gracePeriodEndsAt,
						countdown
					});
					setOpponentConnected(false);
				}
			}
		}

		// Clear disconnect info if game is no longer paused or no disconnected player
		if (gameState && !(gameState as any)?.paused && disconnectInfo) {
			setDisconnectInfo(null);
			setOpponentConnected(true);
		}
	}, [gameState, disconnectInfo]);

	// Countdown timer for disconnect grace period
	useEffect(() => {
		if (!disconnectInfo) return;

		const interval = setInterval(() => {
			const remaining = Math.ceil((disconnectInfo.gracePeriodEndsAt - Date.now()) / 1000);
			if (remaining <= 0) {
				clearInterval(interval);
				setDisconnectInfo(null);
			} else {
				setDisconnectInfo(prev => prev ? { ...prev, countdown: remaining } : null);
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [disconnectInfo?.gracePeriodEndsAt]);

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
			const KEYS = ["w", "W", "s", "S", "ArrowUp", "ArrowDown", "Enter", " "];
			if (!KEYS.includes(e.key)) return;

			// Prevent default scrolling for arrow keys and space
			if (["ArrowUp", "ArrowDown", " "].includes(e.key)) {
				e.preventDefault();
			}

			let keyEvent = "START";
			// Both WASD and Arrow keys send generic UP/DOWN for the current user
			// The backend determines which paddle to move based on userId
			if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keyEvent = "UP";
			else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keyEvent = "DOWN";
			else if (e.key === " ") keyEvent = "PAUSE"; // Space = pause/resume game

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

			// Get dimensions from game state or use defaults
			const CANVAS_WIDTH = gameState.constant?.canvasWidth || DEFAULT_CANVAS_WIDTH;
			const CANVAS_HEIGHT = gameState.constant?.canvasHeight || DEFAULT_CANVAS_HEIGHT;
			const PADDLE_WIDTH = gameState.constant?.paddleWidth || DEFAULT_PADDLE_WIDTH;
			const BALL_SIZE = gameState.constant?.ballSize || DEFAULT_BALL_SIZE;

			const ball = gameState.ball;
			const left = gameState.leftPlayer;
			const right = gameState.rightPlayer;

			// Clear canvas with black background
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

			// Draw center line
			ctx.setLineDash([10, 10]);
			ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(CANVAS_WIDTH / 2, 0);
			ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
			ctx.stroke();
			ctx.setLineDash([]);

			// Draw power-ups
			if (gameState.powerUps && gameState.powerUps.length > 0) {
				gameState.powerUps.forEach((pu: any) => {
					ctx.beginPath();
					const puRadius = 10;
					ctx.arc(pu.x, pu.y, puRadius, 0, Math.PI * 2);
					ctx.fillStyle = getPowerUpColor(pu.type);
					ctx.fill();

					// White border
					ctx.strokeStyle = "#fff";
					ctx.lineWidth = 1;
					ctx.stroke();
					ctx.closePath();

					// Symbol
					ctx.fillStyle = "#000";
					ctx.font = "bold 10px Arial";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(getPowerUpSymbol(pu.type), pu.x, pu.y);
				});
			}

			// Draw ball with effect color if active
			if (ball) {
				ctx.beginPath();
				ctx.arc(ball.posX + BALL_SIZE / 2, ball.posY + BALL_SIZE / 2, BALL_SIZE / 2, 0, 2 * Math.PI);
				ctx.fillStyle = gameState.activeEffect
					? getEffectColor(gameState.activeEffect.type)
					: "#FFFFFF";
				ctx.fill();
			}

			// Draw paddles with color coding:
			// Green = your paddle (movable), Blue = opponent paddle
			// Use dynamic paddle height from game state
			const leftPaddleHeight = left?.paddleHeight || DEFAULT_PADDLE_HEIGHT;
			const rightPaddleHeight = right?.paddleHeight || DEFAULT_PADDLE_HEIGHT;

			if (left) {
				ctx.fillStyle = gameState.me === "LEFT" ? "#22c55e" : "#3b82f6";
				ctx.fillRect(left.paddleX, left.paddleY, PADDLE_WIDTH, leftPaddleHeight);
			}

			if (right) {
				ctx.fillStyle = gameState.me === "RIGHT" ? "#22c55e" : "#3b82f6";
				ctx.fillRect(right.paddleX, right.paddleY, PADDLE_WIDTH, rightPaddleHeight);
			}

			// Draw scores on canvas
			const fontSize = 48;
			ctx.font = `bold ${fontSize}px Arial`;
			ctx.fillStyle = "white";
			const centerX = CANVAS_WIDTH / 2;

			// Left player score
			ctx.textAlign = "right";
			ctx.fillText(`${left?.score || 0}`, centerX - 30, 60);

			// Right player score
			ctx.textAlign = "left";
			ctx.fillText(`${right?.score || 0}`, centerX + 30, 60);
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

	// Get canvas dimensions from game state
	const CANVAS_WIDTH = gameState?.constant?.canvasWidth || DEFAULT_CANVAS_WIDTH;
	const CANVAS_HEIGHT = gameState?.constant?.canvasHeight || DEFAULT_CANVAS_HEIGHT;

	// Remote game rendering
	if (isRemoteGame) {
		// Show loading state while waiting for game state to be restored via WebSocket
		if (!gameState && !gameOverResult) {
			return (
				<div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20">
					<div className="flex flex-col items-center gap-4">
						<Loader2 className="h-12 w-12 animate-spin text-primary" />
						<h2 className="text-2xl font-bold">Connecting to game...</h2>
						<p className="text-muted-foreground">Restoring your game session</p>
						<Button
							variant="outline"
							onClick={async () => {
								try {
									await axios.post("/api/game/leave", { matchId });
								} catch (e) {
									console.error("Failed to leave game:", e);
								}
								router.push("/game/new");
							}}
							className="mt-4"
						>
							<ArrowLeft className="mr-2 h-4 w-4" /> Back to Game Menu
						</Button>
					</div>
				</div>
			);
		}

		return (
			<div className="h-screen pt-32 pb-4 flex flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20 relative">
				{/* Decorative Background Elements */}
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-[20%] right-[10%] w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
				</div>

				{/* Spectator Badge */}
				{isSpectator && (
					<div className="absolute top-36 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
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

				{/* Header (Fixed Height) - Similar to local play */}
				<div className="shrink-0 h-24 w-full max-w-7xl mx-auto grid grid-cols-3 items-center px-8 border-b border-white/5 bg-background/40 backdrop-blur-md z-10 transition-all duration-300">
					{/* Left: Match Info */}
					<div className="flex flex-col items-start gap-1.5">
						<h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-sm">
							REMOTE MATCH
						</h1>
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-muted-foreground border-white/10 bg-black/20 px-3 py-1 rounded-full leading-normal">
								<Hash className="h-3 w-3 opacity-50" />
								{matchId}
							</Badge>
						</div>
					</div>

					{/* Center: Timer */}
					<div className="flex justify-center">
						{gameState?.timer && (
							<div className="relative group">
								<div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
								<div className="relative px-8 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg flex flex-col items-center shadow-2xl">
									<div className={cn(
										"text-4xl font-mono font-bold tabular-nums tracking-widest leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]",
										gameState.timer.timeRemaining < 30000
											? 'text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
											: 'bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70'
									)}>
										{formatTime(gameState.timer.timeRemaining)}
									</div>
									<div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-muted-foreground/80 tracking-[0.2em] mt-1">
										<Timer className="h-2.5 w-2.5" /> Time Remaining
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Right: Status Indicators */}
					<div className="flex items-center justify-end gap-3">
						<div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/5 border border-green-500/20 rounded-full">
							<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
							<span className="text-xs font-bold text-green-500 tracking-wider">LIVE</span>
						</div>
					</div>
				</div>

				{/* Main Game Area (Flexible) */}
				<div className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">
					{/* Canvas Container - scaled up for better visibility */}
					<div
						className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group"
						style={{
							width: `${CANVAS_WIDTH * REMOTE_DISPLAY_SCALE}px`,
							maxWidth: '95vw'
						}}
					>
						<div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none z-10" />
						<canvas
							ref={canvasRef}
							className="block bg-[#020817] w-full h-auto"
							width={CANVAS_WIDTH}
							height={CANVAS_HEIGHT}
							style={{ touchAction: 'none' }}
						/>
						
						{/* Ready Status / Paused UI */}
						{((gameState as any)?.paused || !gameStart) && !gameOverResult && gameState && (
							<div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm p-8">
								<div className="text-center space-y-6 max-w-lg w-full">
									{/* Paused UI - With Disconnect Countdown or Mutual Resume */}
									{(gameState as any)?.paused && (
										<div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
											{disconnectInfo ? (
												<>
													<div className="p-4 bg-red-500/10 rounded-full ring-1 ring-red-500/30 mb-2">
														<span className="text-4xl">📡</span>
													</div>
													<h3 className="text-3xl font-bold text-red-500">Opponent Disconnected</h3>
													<p className="text-white/80">
														Waiting for {disconnectInfo.disconnectedPlayer === "LEFT"
															? gameState.leftPlayer?.username
															: gameState.rightPlayer?.username} to reconnect...
													</p>
													<div className="p-6 bg-white/5 rounded-xl border border-red-500/30 w-full">
														<div className="text-center">
															<p className="text-sm text-white/60 mb-2">Auto-forfeit in</p>
															<p className={cn(
																"text-5xl font-mono font-bold tabular-nums",
																disconnectInfo.countdown <= 10 ? "text-red-500 animate-pulse" : "text-yellow-500"
															)}>
																{disconnectInfo.countdown}s
															</p>
														</div>
													</div>
													{!isSpectator && (
														<p className="text-sm text-white/50">
															Game will resume automatically when they reconnect
														</p>
													)}
												</>
											) : (
												<>
													<div className="p-4 bg-yellow-500/10 rounded-full ring-1 ring-yellow-500/30 mb-2">
														<span className="text-4xl">⏸️</span>
													</div>
													<h3 className="text-3xl font-bold text-yellow-500">Game Paused</h3>
													{pauseInfo?.pausedByName && (
														<p className="text-white/60">
															Paused by {pauseInfo.pausedByName}
														</p>
													)}
													{!isSpectator && (
														<div className="p-6 bg-white/5 rounded-xl border border-white/10 w-full space-y-4">
															<p className="text-lg font-medium text-white text-center">
																Both players must press <span className="px-2 py-1 bg-white/20 rounded font-mono font-bold">SPACE</span> to resume
															</p>
															<div className="flex justify-center gap-8">
																<div className="flex flex-col items-center">
																	<div className={cn(
																		"h-12 w-12 rounded-full flex items-center justify-center text-2xl",
																		pauseInfo?.myReadyToResume ? "bg-green-500/20 ring-2 ring-green-500" : "bg-white/10"
																	)}>
																		{pauseInfo?.myReadyToResume ? "✓" : "⏳"}
																	</div>
																	<span className="text-sm mt-2 text-white/70">You</span>
																</div>
																<div className="flex flex-col items-center">
																	<div className={cn(
																		"h-12 w-12 rounded-full flex items-center justify-center text-2xl",
																		pauseInfo?.opponentReadyToResume ? "bg-green-500/20 ring-2 ring-green-500" : "bg-white/10"
																	)}>
																		{pauseInfo?.opponentReadyToResume ? "✓" : "⏳"}
																	</div>
																	<span className="text-sm mt-2 text-white/70">Opponent</span>
																</div>
															</div>
															{pauseInfo?.myReadyToResume && !pauseInfo?.opponentReadyToResume && (
																<p className="text-sm text-yellow-500 text-center animate-pulse">
																	Waiting for opponent to press SPACE...
																</p>
															)}
															{!pauseInfo?.myReadyToResume && pauseInfo?.opponentReadyToResume && (
																<p className="text-sm text-green-500 text-center">
																	Opponent is ready! Press SPACE to resume.
																</p>
															)}
														</div>
													)}
													{isSpectator && (
														<p className="text-white/80">
															Waiting for both players to resume...
														</p>
													)}
												</>
											)}
										</div>
									)}

									{/* Ready Status UI */}
									{!(gameState as any)?.paused && (() => {
										// Determine my status and opponent's status
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
												<div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-300">
													<h3 className="text-3xl font-bold text-white">Are you ready?</h3>
													<p className="text-white/70 text-center max-w-sm">
														Both players must click Ready to start the match.
													</p>
													
													<Button 
														size="lg" 
														className="bg-green-600 hover:bg-green-700 text-white font-bold text-xl px-12 py-6 shadow-lg shadow-green-900/20 scale-100 hover:scale-105 transition-all"
														onClick={() => {
															// Send START event manually via socket
															sendSocketMessage({
																event: "GAME_EVENTS",
																payload: {
																	matchId: gameState.matchId,
																	userId: user?.id,
																	keyEvent: "START",
																},
															});
														}}
													>
														I AM READY
													</Button>

													<p className="text-xs text-white/40 pt-4">
														(Or press ENTER)
													</p>
													<p className="text-sm text-white/50">
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
												disabled={!opponentConnected}
												size="lg"
												className={cn(
													"bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg h-14 px-8 shadow-lg shadow-green-500/20",
													!opponentConnected && "opacity-50 cursor-not-allowed grayscale"
												)}
											>
												{!opponentConnected ? "Opponent Left" : "Rematch"}
											</Button>
											<Button
												onClick={() => {
													// Notify opponent that we're leaving
													// Use loose equality or explicit conversion as user.id might be string while gameState has numbers
													const opponentId = Number(gameOverResult.leftPlayer?.id) === Number(user?.id)
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
				</div>

				{/* Footer Commands (Fixed Height) - Similar to local play */}
				<div className="shrink-0 h-16 flex items-center justify-center pb-4 z-10">
					<div className="flex items-center justify-between w-full max-w-4xl px-8 py-3 bg-card/60 rounded-full border border-border/50 backdrop-blur-md shadow-lg">
						<div className="flex items-center gap-3">
							<div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 ring-1 ring-green-500/20">
								<Keyboard className="h-4 w-4" />
							</div>
							<div className="flex flex-col">
								<span className="text-xs font-bold text-foreground">Your Paddle</span>
								<span className="text-[10px] text-muted-foreground font-mono">W / S or Arrow Keys</span>
							</div>
						</div>

						<div className="h-6 w-px bg-border/50" />

						<div className="flex items-center gap-3">
							<div className="flex flex-col items-center">
								<span className="text-xs font-bold text-foreground">Ready</span>
								<span className="text-[10px] text-muted-foreground font-mono">ENTER</span>
							</div>
						</div>

						<div className="h-6 w-px bg-border/50" />

						<div className="flex items-center gap-3 text-right">
							<div className="flex flex-col items-end">
								<span className="text-xs font-bold text-foreground">Pause / Resume</span>
								<span className="text-[10px] text-muted-foreground font-mono">SPACE</span>
							</div>
							<div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 ring-1 ring-purple-500/20">
								<Gamepad2 className="h-4 w-4" />
							</div>
						</div>
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