import { useCallback, useEffect, useRef } from "react";
import { GameState, GameMode } from "@/types/game";
import { usePongGame } from "@/hooks/usePongGame";
import { interpolateGameState, renderGame } from "@/utils/gameRenderer";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import { ReadyOverlay } from "@/components/game/ReadyOverlay";
import { PauseOverlay } from "@/components/game/PauseOverlay";
import { GameControlsTray } from "@/components/game/GameControlsTray";
import { formatTime } from "@/utils/gameHelpers";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Timer, Hash, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface RemoteOptimisticPaddlePreview {
	paddleKey: "p1" | "p2";
	previewY: number;
	direction: "UP" | "DOWN";
}

/** 
 * "?:" means it can be optional
 * ": " means it is mandatory
 */
interface PongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	gameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
	onExit?: () => void;
	isTournamentMatch?: boolean;
	layout?: "full" | "canvasOnly";
	showBuiltInOverlays?: boolean;
	showControlsTray?: boolean;
	onStart?: () => void;
	onPauseToggle?: () => void;
	pauseOnGuard?: boolean;
	isAIEnabled?: boolean;
	getLiveGameState?: () => GameState | null;
	subscribeToLiveGameState?: (listener: () => void) => () => void;
	remoteOptimisticPaddlePreview?: RemoteOptimisticPaddlePreview | null;
}

export default function PongGame({
	matchId,
	mode,
	wsUrl,
	gameState: externalGameState,
	onGameOver,
	onExit,
	isTournamentMatch = false,
	layout = "full",
	showBuiltInOverlays = true,
	showControlsTray = true,
	onStart,
	onPauseToggle,
	pauseOnGuard = false,
	isAIEnabled = false,
	getLiveGameState,
	subscribeToLiveGameState,
	remoteOptimisticPaddlePreview = null,
}: PongGameProps) {
	const {
		gameState,
		canvasRef,
		containerRef,
		canvasDimensions,
		socketRef
	} = usePongGame({ matchId, mode, wsUrl, externalGameState, onGameOver, isAIEnabled });
	const guardPauseSentRef = useRef(false);
	const previousSnapshotRef = useRef<GameState | null>(null);
	const latestSnapshotRef = useRef<GameState | null>(null);
	const lastSnapshotAtRef = useRef(0);
	const snapshotIntervalRef = useRef(1000 / 60);
	const remoteOptimisticPaddlePreviewRef =
		useRef<RemoteOptimisticPaddlePreview | null>(remoteOptimisticPaddlePreview);
	const showDebugOverlay = process.env.NEXT_PUBLIC_DEBUG_GAME === "1";

	// Determine Display ID & Suffix
	let cleanId = matchId.replace(/^(local-|tournament-)/, '');
	let matchSuffix = "";

	// Check for match suffix (-m1, -m2, etc) or Swiss (-r1-m1)
	const matchMatch = cleanId.match(/-(m\d+)$/);
	const swissMatch = cleanId.match(/-(r\d+-m\d+)$/);

	if (swissMatch) {
		const matchNum = swissMatch[1].match(/-m(\d+)$/)?.[1];
		matchSuffix = matchNum ? `Match ${matchNum}` : "";
		cleanId = cleanId.replace(/-(r\d+-m\d+)$/, '');
	} else if (matchMatch) {
		matchSuffix = matchMatch[1].replace('m', 'Match '); // "Match 1"
		cleanId = cleanId.replace(/-(m\d+)$/, '');
	}

	const displayMatchId = mode === "local"
		? (isTournamentMatch ? `LT-${cleanId}` : `LS-${cleanId}`)
		: cleanId;

	const syncIncomingSnapshot = useCallback((nextGameState: GameState | null) => {
		if (!nextGameState) return;
		const now = performance.now();
		const baseTickMs = nextGameState.constant?.TICK_MS || 16.67;
		const maxInterpolationWindow = baseTickMs * 3;
		if (
			latestSnapshotRef.current &&
			latestSnapshotRef.current !== nextGameState &&
			latestSnapshotRef.current.status === "playing" &&
			nextGameState.status === "playing"
		) {
			if (lastSnapshotAtRef.current > 0) {
				const measuredInterval = now - lastSnapshotAtRef.current;
				if (measuredInterval > maxInterpolationWindow) {
					previousSnapshotRef.current = nextGameState;
					snapshotIntervalRef.current = baseTickMs;
				} else {
					previousSnapshotRef.current = latestSnapshotRef.current;
					snapshotIntervalRef.current = Math.max(8, measuredInterval);
				}
			} else {
				previousSnapshotRef.current = latestSnapshotRef.current;
			}
		} else {
			previousSnapshotRef.current = nextGameState;
			snapshotIntervalRef.current = baseTickMs;
		}

		latestSnapshotRef.current = nextGameState;
		lastSnapshotAtRef.current = now;
	}, []);

	useEffect(() => {
		syncIncomingSnapshot(gameState);
	}, [gameState, syncIncomingSnapshot]);

	useEffect(() => {
		remoteOptimisticPaddlePreviewRef.current = remoteOptimisticPaddlePreview;
	}, [remoteOptimisticPaddlePreview]);

	useEffect(() => {
		if (!getLiveGameState || !subscribeToLiveGameState) return;

		syncIncomingSnapshot(getLiveGameState());
		return subscribeToLiveGameState(() => {
			syncIncomingSnapshot(getLiveGameState());
		});
	}, [getLiveGameState, subscribeToLiveGameState, syncIncomingSnapshot]);

	// Game Loop / Rendering
	useEffect(() => {
		let frameId = 0;

		const drawFrame = (now: number) => {
			const canvas = canvasRef.current;
			const latestSnapshot = latestSnapshotRef.current;
			if (!canvas || !latestSnapshot) {
				frameId = requestAnimationFrame(drawFrame);
				return;
			}

			const context = canvas.getContext("2d");
			if (!context) {
				frameId = requestAnimationFrame(drawFrame);
				return;
			}

			const elapsedSinceSnapshot = now - lastSnapshotAtRef.current;
			const alpha = Math.min(
				1,
				elapsedSinceSnapshot / Math.max(snapshotIntervalRef.current, latestSnapshot.constant.TICK_MS || 16.67)
			);
			const frameState = interpolateGameState(
				previousSnapshotRef.current,
				latestSnapshot,
				alpha
			);
			const activePreview = remoteOptimisticPaddlePreviewRef.current;
			const renderState =
				activePreview &&
				frameState.status === "playing" &&
				(activePreview.direction === "UP"
					? frameState.paddles[activePreview.paddleKey].y > activePreview.previewY
					: frameState.paddles[activePreview.paddleKey].y < activePreview.previewY)
					? {
							...frameState,
							paddles: {
								...frameState.paddles,
								[activePreview.paddleKey]: {
									...frameState.paddles[activePreview.paddleKey],
									y: activePreview.previewY,
								},
							},
					  }
					: frameState;

			renderGame(context, renderState, canvasDimensions);
			frameId = requestAnimationFrame(drawFrame);
		};

		frameId = requestAnimationFrame(drawFrame);
		return () => cancelAnimationFrame(frameId);
	}, [canvasDimensions]);

	const localGameOverResult =
		gameState?.status === "finished"
			? {
				winner: gameState.winner === 1 ? "LEFT" : gameState.winner === 2 ? "RIGHT" : undefined,
				leftPlayer: { username: "Player 1", score: gameState.score.p1 },
				rightPlayer: { username: "Player 2", score: gameState.score.p2 },
			}
			: null;

	const handleStart = () => {
		if (onStart) {
			onStart();
			return;
		}
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "START" }));
		}
	};

	const handlePauseToggle = () => {
		if (onPauseToggle) {
			onPauseToggle();
			return;
		}
		if (socketRef.current?.readyState === WebSocket.OPEN) {
			socketRef.current.send(JSON.stringify({ type: "PAUSE" }));
		}
	};

	const requestLocalPauseBeforeUnload = useCallback(() => {
		if (mode !== "local" || wsUrl === undefined) return;
		if (gameState?.status !== "playing") return;

		const ws = socketRef.current;
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: "PAUSE" }));
		}
	}, [gameState?.status, mode, socketRef, wsUrl]);

	const requestLocalPauseForGuard = useCallback(() => {
		if (guardPauseSentRef.current) return;

		let attempts = 0;
		const maxAttempts = 30;
		const tryPause = () => {
			if (guardPauseSentRef.current) return;
			if (gameState?.status !== "playing") return;

			const ws = socketRef.current;
			if (ws?.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: "PAUSE" }));
				guardPauseSentRef.current = true;
				return;
			}

			attempts += 1;
			if (attempts < maxAttempts) {
				window.setTimeout(tryPause, 50);
			}
		};

		tryPause();
	}, [gameState?.status, socketRef]);

	// Auto-pause local game when navigation guard opens.
	// Prevent duplicate PAUSE toggles while guard remains open.
	useEffect(() => {
		if (!pauseOnGuard) {
			guardPauseSentRef.current = false;
			return;
		}
		if (guardPauseSentRef.current) return;
		if (mode !== "local" || wsUrl === undefined) return;
		if (gameState?.status !== "playing") return;
		requestLocalPauseForGuard();
	}, [pauseOnGuard, mode, wsUrl, gameState?.status, requestLocalPauseForGuard]);

	// Runtime guard trigger for local matches.
	useEffect(() => {
		if (mode !== "local" || wsUrl === undefined) return;

		const handleLocalGuardPause = (event: Event) => {
			const customEvent = event as CustomEvent<{ matchId?: string }>;
			if (customEvent.detail?.matchId && customEvent.detail.matchId !== matchId) return;
			requestLocalPauseForGuard();
		};

		window.addEventListener("localGuardPauseRequested", handleLocalGuardPause as EventListener);
		return () => {
			window.removeEventListener("localGuardPauseRequested", handleLocalGuardPause as EventListener);
		};
	}, [mode, wsUrl, matchId, requestLocalPauseForGuard]);

	// Best-effort pause for accidental refresh/tab-close on local matches.
	// This complements recovery by freezing the runtime if the browser exits suddenly.
	useEffect(() => {
		if (mode !== "local" || wsUrl === undefined) return;

		const handlePageUnload = () => {
			requestLocalPauseBeforeUnload();
		};

		window.addEventListener("beforeunload", handlePageUnload);
		window.addEventListener("pagehide", handlePageUnload);

		return () => {
			window.removeEventListener("beforeunload", handlePageUnload);
			window.removeEventListener("pagehide", handlePageUnload);
		};
	}, [mode, wsUrl, requestLocalPauseBeforeUnload]);

	if (layout === "canvasOnly") {
		return (
			<div ref={containerRef} className="relative h-full w-full overflow-hidden">
				<div
					className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group"
					style={{
						maxWidth: `${canvasDimensions.width}px`,
						maxHeight: `${canvasDimensions.height}px`,
						aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
					}}
				>
					<div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none z-10" />
					<canvas
						ref={canvasRef}
						width={canvasDimensions.width}
						height={canvasDimensions.height}
						className="block bg-[#020817] w-full h-full"
						style={{ touchAction: "none" }}
					/>
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

			{/* DEBUG OVERLAY */}
			{gameState && showDebugOverlay && (
				<div className="absolute top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono backdrop-blur-md z-50 border border-white/10 shadow-xl pointer-events-none mt-24">
					<div className="flex items-center gap-2 mb-1 text-muted-foreground"><Zap className="h-3 w-3 text-yellow-500" /> Debug Info</div>
					<div>Status: <span className="text-green-400">{gameState.status}</span></div>
					<div>Ball: ({gameState.ball?.x?.toFixed(0)}, {gameState.ball?.y?.toFixed(0)})</div>
				</div>
			)}

			{/* Header (Fixed Height) */}
			<div className="shrink-0 h-24 w-full max-w-7xl mx-auto grid grid-cols-3 items-center px-8 border-b border-white/5 bg-background/40 backdrop-blur-md z-10 transition-all duration-300">

				{/* Left: Match Info */}
				<div className="flex flex-col items-start gap-1.5">
					<h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-sm">
						{mode === "local" ? "LOCAL MATCH" : "REMOTE MATCH"}
					</h1>
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-muted-foreground border-white/10 bg-black/20 px-3 py-1 rounded-full leading-normal">
							<Hash className="h-3 w-3 opacity-50" />
							{displayMatchId}
						</Badge>
						{matchSuffix && (
							<Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 bg-white/10 text-white/80 border-white/10">
								{matchSuffix.toUpperCase()}
							</Badge>
						)}
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
			<div ref={containerRef} className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">

				{/* Waiting Overlay */}
				{showBuiltInOverlays && gameState?.status === "waiting" && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
						<Card className="border-yellow-500/50 bg-yellow-500/10 animate-pulse">
							<div className="px-6 py-4 text-yellow-500 font-bold text-lg flex items-center gap-2">
								<div className="h-2 w-2 bg-yellow-500 rounded-full animate-bounce" />
								Waiting for players...
							</div>
						</Card>
					</div>
				)}

				{/* Pause Overlay */}
				{showBuiltInOverlays && (
					<PauseOverlay
						isOpen={gameState?.status === "paused"}
						mode={mode}
						onResume={handlePauseToggle}
					/>
				)}

				{/* Canvas */}
				<div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group max-w-full">
					<div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none z-10" />
					<canvas
						ref={canvasRef}
						width={canvasDimensions.width}
						height={canvasDimensions.height}
						className="block bg-[#020817] max-w-full h-auto"
						style={{ touchAction: 'none', width: '100%', height: 'auto' }}
					/>
				</div>
			</div>

			{showControlsTray && <GameControlsTray mode={mode === "remote" ? "remote" : "local"} />}

			{showBuiltInOverlays && localGameOverResult && (
				<GameOverOverlay
					gameOverResult={localGameOverResult}
					mode="local"
					onExit={onExit}
					localActionLabel={isTournamentMatch ? "Return to Lobby" : "Continue to Menu"}
					localAutoExitSeconds={isTournamentMatch ? 5 : undefined}
				/>
			)}

			{/* Ready Overlay */}
			{showBuiltInOverlays && (
				<ReadyOverlay
					isOpen={gameState?.status === "waiting"}
					mode={mode}
					player1Ready={true} // TODO: Get from game state for remote matches
					player2Ready={true} // TODO: Get from game state for remote matches
					player1Name="Player 1" // TODO: Get from game state
					player2Name="Player 2" // TODO: Get from game state
					onStart={handleStart}
				/>
			)}
		</div>
	);
}

/*
	const s = gameState.status;
	- If gameState is null, this causes a "TypeError" crash!
	- It's like doing nullptr->status in C++.

	const s = gameState?.status;
	- check if gameState is not NULL/Undefined
	- if it has content, grab it
	- if no, stop immediately, return undefined, do not crash
*/
