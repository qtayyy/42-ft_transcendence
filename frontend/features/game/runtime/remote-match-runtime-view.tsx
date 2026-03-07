"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, Timer, Keyboard, Gamepad2, Hash, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/gameHelpers";
import { ReadyOverlay } from "@/components/game/ReadyOverlay";

interface RemoteMatchRuntimeViewProps {
	canvasRef: RefObject<HTMLCanvasElement | null>;
	matchId: string;
	gameState: any;
	gameOverResult: any;
	isSpectator: boolean;
	returnToLobby: () => void;
	sendSocketMessage: (payload: any) => void;
	user: any;
	setGameOverResult: (value: any) => void;
	opponentConnected: boolean;
	router: any;
	CANVAS_WIDTH: number;
	CANVAS_HEIGHT: number;
	REMOTE_DISPLAY_SCALE: number;
	gameStart: any;
	disconnectInfo: any;
	pauseInfo: any;
}

export default function RemoteMatchRuntimeView({
	canvasRef,
	matchId,
	gameState,
	gameOverResult,
	isSpectator,
	returnToLobby,
	sendSocketMessage,
	user,
	setGameOverResult,
	opponentConnected,
	router,
	CANVAS_WIDTH,
	CANVAS_HEIGHT,
	REMOTE_DISPLAY_SCALE,
	gameStart,
	disconnectInfo,
	pauseInfo,
}: RemoteMatchRuntimeViewProps) {
	return (
		<div className="h-screen pt-32 pb-4 flex flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20 relative">
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-[20%] right-[10%] w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
			</div>

			<div className="shrink-0 h-24 w-full max-w-7xl mx-auto grid grid-cols-3 items-center px-8 border-b border-white/5 bg-background/40 backdrop-blur-md z-10 transition-all duration-300">
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

				<div className="flex justify-center">
					{gameState?.timer && (
						<div className="relative group">
							<div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
							<div className="relative px-8 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg flex flex-col items-center shadow-2xl">
								<div className={cn(
									"text-4xl font-mono font-bold tabular-nums tracking-widest leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]",
									gameState.timer.timeRemaining < 30000
										? "text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"
										: "bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70"
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

				<div className="flex items-center justify-end gap-3">
					{isSpectator ? (
						<>
							<Badge className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-1.5 text-sm font-bold animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)] flex items-center gap-2 border-0">
								<Eye className="h-4 w-4" /> SPECTATING LIVE
							</Badge>
							<Button
								onClick={returnToLobby}
								variant="outline"
								size="sm"
								className="bg-black/40 border-white/10 text-white hover:bg-white/10 hover:text-white transition-colors"
							>
								<ArrowLeft className="mr-2 h-4 w-4" /> Lobby
							</Button>
						</>
					) : (
						<div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/5 border border-green-500/20 rounded-full">
							<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
							<span className="text-xs font-bold text-green-500 tracking-wider">LIVE</span>
						</div>
					)}
				</div>
			</div>

			<div className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">
				<div
					className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group"
					style={{
						width: `${CANVAS_WIDTH * REMOTE_DISPLAY_SCALE}px`,
						maxWidth: "95vw",
					}}
				>
					<div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none z-10" />
					<canvas
						ref={canvasRef}
						className="block bg-[#020817] w-full h-auto"
						width={CANVAS_WIDTH}
						height={CANVAS_HEIGHT}
						style={{ touchAction: "none" }}
					/>

					{gameState && ((gameState as any)?.paused || (!gameState?.gameStarted && !gameStart)) && !gameOverResult && (
						<div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm p-8">
							<div className="text-center space-y-6 max-w-lg w-full">
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
													<p className="text-white/60">Paused by {pauseInfo.pausedByName}</p>
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
												{isSpectator && <p className="text-white/80">Waiting for both players to resume...</p>}
											</>
										)}
									</div>
								)}

								{!(gameState as any)?.paused && isSpectator && (
									<div className="flex flex-col items-center justify-center space-y-4">
										<Loader2 className="h-12 w-12 text-primary animate-spin" />
										<h3 className="text-2xl font-bold text-white">Match Starting Soon</h3>
										<p className="text-white/80">Waiting for players to get ready...</p>
									</div>
								)}
							</div>
						</div>
					)}

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
													const opponentId = Number(gameOverResult.leftPlayer?.id) === Number(user?.id)
														? gameOverResult.rightPlayer?.id
														: gameOverResult.leftPlayer?.id;
													sendSocketMessage({
														event: "LEAVE_GAME",
														payload: {
															opponentId,
															matchId: gameOverResult.matchId,
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

			{!isSpectator && (
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
			)}

			{/* ReadyOverlay for remote matches */}
			{gameState && !gameState.gameStarted && !gameStart && !(gameState as any)?.paused && !isSpectator && !gameOverResult && (() => {
				const mySide = gameState.me;
				const me = mySide === "LEFT" ? gameState.leftPlayer : gameState.rightPlayer;
				const currentPlayerReady = !me?.gamePaused;

				return (
					<ReadyOverlay
						isOpen={true}
						mode="remote"
						player1Ready={!gameState.leftPlayer?.gamePaused}
						player2Ready={!gameState.rightPlayer?.gamePaused}
						player1Name={gameState.leftPlayer?.username || "Player 1"}
						player2Name={gameState.rightPlayer?.username || "Player 2"}
						currentPlayerReady={currentPlayerReady}
						onReady={() => {
							sendSocketMessage({
								event: "GAME_EVENTS",
								payload: {
									matchId: gameState.matchId,
									userId: user?.id,
									keyEvent: "START",
								},
							});
						}}
						onStart={() => {
							sendSocketMessage({
								event: "GAME_EVENTS",
								payload: {
									matchId: gameState.matchId,
									userId: user?.id,
									keyEvent: "START",
								},
							});
						}}
					/>
				);
			})()}
		</div>
	);
}
