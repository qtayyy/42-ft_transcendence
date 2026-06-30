import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";
import { usePongGame } from "@/hooks/usePongGame";
import { BackgroundId, interpolateGameState, renderGame } from "@/utils/gameRenderer";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import { ReadyOverlay } from "@/components/game/ReadyOverlay";
import { PauseOverlay } from "@/components/game/PauseOverlay";
import { GameControlsTray } from "@/components/game/GameControlsTray";
import { MatchPlayerBanner } from "@/components/game/MatchPlayerBanner";
import { LiveStatusBadge, MatchGameHeader } from "@/components/game/MatchGameHeader";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/languageContext";
import { useMusic } from "@/context/music-context";

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
	/** Left paddle (player 1) display name */
	player1Name?: string;
	/** Right paddle (player 2) display name */
	player2Name?: string;
	/** Which side is the logged-in user (remote); omit for local */
	mySide?: "LEFT" | "RIGHT" | null;
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
	player1Name: player1NameProp,
	player2Name: player2NameProp,
	mySide = null,
}: PongGameProps) {
	const {
		gameState,
		canvasRef,
		containerRef,
		canvasDimensions,
		socketRef,
		bindings,
		setBindings,
	} = usePongGame({ matchId, mode, wsUrl, externalGameState, onGameOver, isAIEnabled });
	const { t } = useLanguage();
	const { setGameplayMusicActive } = useMusic();
	const [countdownNow, setCountdownNow] = useState(() => Date.now());
	const guardPauseSentRef = useRef(false);
	const previousSnapshotRef = useRef<GameState | null>(null);
	const latestSnapshotRef = useRef<GameState | null>(null);
	const lastSnapshotAtRef = useRef(0);
	const snapshotIntervalRef = useRef(1000 / 60);
	const remoteOptimisticPaddlePreviewRef =
		useRef<RemoteOptimisticPaddlePreview | null>(remoteOptimisticPaddlePreview);
	const showDebugOverlay = process.env.NEXT_PUBLIC_DEBUG_GAME === "1";

	// Background
	const [background, setBackground] = useState<BackgroundId>(() => {
		if (typeof window === 'undefined') return 'default';
		return (localStorage.getItem('pongBackground') as BackgroundId) ?? 'default';
	});
	const handleBackgroundChange = (id: BackgroundId) => {
		setBackground(id);
		localStorage.setItem('pongBackground', id);
	};

	// Unlocked achievements for background gate
	const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
	useEffect(() => {
		fetch('/api/achievements')
			.then(r => r.json())
			.then((data: { key: string }[]) =>
				setUnlockedAchievements(data.map(a => a.key))
			)
			.catch(() => {/* ignore */});
	}, []);

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

	const localPlayerNames = useMemo<{
		left: string;
		right: string;
	} | null>(() => {
		if (
			mode !== "local" ||
			player1NameProp ||
			player2NameProp ||
			typeof window === "undefined"
		) {
			return null;
		}

		try {
			const raw = localStorage.getItem("current-match");
			if (!raw) return null;
			const data = JSON.parse(raw) as {
				player1?: { name?: string };
				player2?: { name?: string };
			};
			return {
				left: data.player1?.name || "Player 1",
				right: data.player2?.name || "Player 2",
			};
		} catch {
			return null;
		}
	}, [mode, player1NameProp, player2NameProp]);

	const player1Name = player1NameProp ?? localPlayerNames?.left ?? "Player 1";
	const player2Name = player2NameProp ?? localPlayerNames?.right ?? "Player 2";
	const showPlayerBanner = Boolean(player1Name || player2Name);

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
		setGameplayMusicActive(gameState?.status === "playing");

		return () => {
			setGameplayMusicActive(false);
		};
	}, [gameState?.status, setGameplayMusicActive]);

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

			renderGame(context, renderState, canvasDimensions, background);
			frameId = requestAnimationFrame(drawFrame);
		};

		frameId = requestAnimationFrame(drawFrame);
		return () => cancelAnimationFrame(frameId);
	}, [canvasDimensions, background, canvasRef]);

	const localGameOverResult =
		gameState?.status === "finished"
			? {
				winner: gameState.winner === 1 ? "LEFT" : gameState.winner === 2 ? "RIGHT" : undefined,
				leftPlayer: { username: player1Name, score: gameState.score.p1 },
				rightPlayer: { username: player2Name, score: gameState.score.p2 },
			}
			: null;
	const countdownEndsAt =
		typeof gameState?.startCountdownEndsAt === "number"
			? gameState.startCountdownEndsAt
			: null;
	const hasStartCountdown = gameState?.status === "waiting" && !!countdownEndsAt;
	const startCountdownMaxSeconds =
		typeof gameState?.startCountdownDurationMs === "number"
			? Math.ceil(gameState.startCountdownDurationMs / 1000)
			: Infinity;
	const startCountdownSeconds = hasStartCountdown
		? Math.min(
				startCountdownMaxSeconds,
				Math.max(0, Math.ceil((countdownEndsAt - countdownNow) / 1000))
			)
		: 0;

	useEffect(() => {
		if (!hasStartCountdown) return;

		const interval = window.setInterval(() => {
			setCountdownNow(Date.now());
		}, 250);

		return () => window.clearInterval(interval);
	}, [hasStartCountdown, countdownEndsAt]);

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

	const canvasBlock = (
		<div
			className={cn(
				"w-full overflow-hidden shadow-2xl ring-1 ring-white/10 group",
				showPlayerBanner ? "rounded-b-xl" : "rounded-xl",
			)}
			style={
				layout === "canvasOnly"
					? {
							maxWidth: `${canvasDimensions.width}px`,
							maxHeight: showPlayerBanner
								? `${canvasDimensions.height + 56}px`
								: `${canvasDimensions.height}px`,
							aspectRatio: showPlayerBanner
								? undefined
								: `${canvasDimensions.width} / ${canvasDimensions.height}`,
						}
					: undefined
			}
		>
			{showPlayerBanner && (
				<MatchPlayerBanner
					leftName={player1Name}
					rightName={player2Name}
					leftScore={gameState?.score?.p1 ?? 0}
					rightScore={gameState?.score?.p2 ?? 0}
					mySide={mySide}
				/>
			)}
			<div
				className={cn(
					"relative bg-[#020817]",
					layout === "canvasOnly" && "w-full",
					layout === "full" && "rounded-b-xl overflow-hidden",
				)}
				style={
					layout === "canvasOnly"
						? { aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}` }
						: undefined
				}
			>
				<div className="absolute inset-0 bg-linear-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none z-10" />
				<canvas
					ref={canvasRef}
					width={canvasDimensions.width}
					height={canvasDimensions.height}
					className={cn(
						"block bg-[#020817]",
						layout === "canvasOnly" ? "w-full h-full" : "max-w-full h-auto",
					)}
					style={{ touchAction: "none", width: layout === "full" ? "100%" : undefined, height: layout === "full" ? "auto" : undefined }}
				/>
			</div>
		</div>
	);

	if (layout === "canvasOnly") {
		return (
			<div ref={containerRef} className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-2">
				{canvasBlock}
			</div>
		);
	}

	return (
		<div className="h-dvh pt-24 sm:pt-32 pb-4 flex flex-col overflow-hidden bg-linear-to-b from-background to-muted/20 relative">

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

			<MatchGameHeader
				title={mode === "local" ? "LOCAL MATCH" : "REMOTE MATCH"}
				displayMatchId={displayMatchId}
				matchSuffix={matchSuffix || undefined}
				timeRemaining={gameState?.timer?.timeRemaining}
				rightSlot={<LiveStatusBadge />}
			/>

			{/* Main Game Area (Flexible) */}
			<div ref={containerRef} className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">

				{/* Waiting / start countdown overlay */}
				{showBuiltInOverlays && hasStartCountdown && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
						<div className="flex flex-col items-center justify-center space-y-4 text-center">
							<div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/40 bg-black/50 shadow-[0_0_30px_rgba(59,130,246,0.35)]">
								<span className="text-5xl font-black text-white tabular-nums">
									{startCountdownSeconds}
								</span>
							</div>
							<h3 className="text-2xl font-bold text-white">
								{t.Game["Match Starting Soon"]}
							</h3>
							<p className="text-white/80">
								{t.Game["Get ready. The match starts automatically."]}
							</p>
						</div>
					</div>
				)}

				{showBuiltInOverlays && gameState?.status === "waiting" && !hasStartCountdown && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
						<Card className="border-yellow-500/50 bg-yellow-500/10 animate-pulse">
							<div className="px-6 py-4 text-yellow-500 font-bold text-lg flex items-center gap-2">
								<div className="h-2 w-2 bg-yellow-500 rounded-full animate-bounce" />
								{t.Game["Waiting for players..."]}
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
						onExit={onExit}
						bindings={bindings}
						onBindingsChange={setBindings}
						background={background}
						onBackgroundChange={handleBackgroundChange}
						unlockedAchievements={unlockedAchievements}
						player1Name={player1Name}
						player2Name={player2Name}
					/>
				)}

				{/* Canvas + player names */}
				<div className="max-w-full">{canvasBlock}</div>
			</div>

			{showControlsTray && <GameControlsTray mode={mode === "remote" ? "remote" : "local"} bindings={bindings} />}

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
					isOpen={gameState?.status === "waiting" && !hasStartCountdown}
					mode={mode}
					player1Ready={true} // TODO: Get from game state for remote matches
					player2Ready={true} // TODO: Get from game state for remote matches
					player1Name={player1Name}
					player2Name={player2Name}
					onStart={handleStart}
					bindings={bindings}
					onBindingsChange={setBindings}
					background={background}
					onBackgroundChange={handleBackgroundChange}
					unlockedAchievements={unlockedAchievements}
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
