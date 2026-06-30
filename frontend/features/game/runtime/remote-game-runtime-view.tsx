"use client";

import { useEffect, useState } from "react";
import type { GameState } from "@/types/game";
import type { GameStateValue, UserProfile } from "@/types/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";
import PongGame from "@/components/game/PongGame";
import { LiveStatusBadge, MatchGameHeader } from "@/components/game/MatchGameHeader";
import { GameControlsTray } from "@/components/game/GameControlsTray";
import { PauseOverlay } from "@/components/game/PauseOverlay";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import type {
	DisconnectInfo,
	PauseInfo,
	RuntimeGameOverResult,
} from "@/features/game/runtime/runtime-helpers";
import { useLanguage } from "@/context/languageContext";

interface RouterLike {
	push: (path: string) => void;
}

interface RemoteGameRuntimeViewProps {
	matchId: string;
	gameState: GameStateValue | null;
	normalizedGameState: GameState | null;
	getLatestRemoteRenderGameState: () => GameState | null;
	subscribeToRemoteRenderGameState: (listener: () => void) => () => void;
	optimisticPaddlePreview: {
		paddleKey: "p1" | "p2";
		previewY: number;
		direction: "UP" | "DOWN";
	} | null;
	gameOverResult: RuntimeGameOverResult | null;
	isSpectator: boolean;
	returnToLobby: () => void;
	sendSocketMessage: (payload: Record<string, unknown>) => void;
	user: UserProfile | null;
	router: RouterLike;
	disconnectInfo: DisconnectInfo | null;
	pauseInfo: PauseInfo | null;
}

export default function RemoteGameRuntimeView({
	matchId,
	gameState,
	normalizedGameState,
	getLatestRemoteRenderGameState,
	subscribeToRemoteRenderGameState,
	optimisticPaddlePreview,
	gameOverResult,
	isSpectator,
	returnToLobby,
	sendSocketMessage,
	user,
	router,
	disconnectInfo,
	pauseInfo,
}: RemoteGameRuntimeViewProps) {
	const { t } = useLanguage();
	const [countdownNow, setCountdownNow] = useState(() => Date.now());
	const showWaitingOverlay =
		!!gameState &&
		!gameState.gameStarted &&
		!gameState.paused &&
		!gameOverResult;
	const countdownEndsAt =
		typeof gameState?.startCountdownEndsAt === "number"
			? gameState.startCountdownEndsAt
			: null;
	const hasStartCountdown = showWaitingOverlay && !!countdownEndsAt;
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
	const player1Ready =
		(pauseInfo?.myReadyToResume && gameState?.me === "LEFT") ||
		(pauseInfo?.opponentReadyToResume && gameState?.me === "RIGHT") ||
		gameState?.resumeReady?.LEFT ||
		false;
	const player2Ready =
		(pauseInfo?.myReadyToResume && gameState?.me === "RIGHT") ||
		(pauseInfo?.opponentReadyToResume && gameState?.me === "LEFT") ||
		gameState?.resumeReady?.RIGHT ||
		false;
	const pauseCurrentPlayerReady = (() => {
		if (pauseInfo?.myReadyToResume) return true;
		if (!gameState) return false;

		const currentSide =
			gameState.me ||
			(String(user?.id) === String(gameState.leftPlayer?.id) ? "LEFT" : "RIGHT");

		return gameState.resumeReady?.[currentSide as "LEFT" | "RIGHT"] || false;
	})();
	const isPaused = !gameOverResult && !!(gameState?.paused || disconnectInfo || pauseInfo);

	useEffect(() => {
		if (!hasStartCountdown) return;

		const interval = window.setInterval(() => {
			setCountdownNow(Date.now());
		}, 250);

		return () => window.clearInterval(interval);
	}, [hasStartCountdown, countdownEndsAt]);

	const sendGameEvent = (keyEvent: string) => {
		if (!gameState) return;

		sendSocketMessage({
			event: "GAME_EVENTS",
			payload: {
				matchId: gameState.matchId,
				userId: user?.id,
				keyEvent,
			},
		});
	};

	return (
		<div className="h-dvh pt-24 sm:pt-32 pb-4 flex flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20 relative">
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
				<div
					className="absolute bottom-[20%] right-[10%] w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
					style={{ animationDelay: "1s" }}
				/>
			</div>

			<MatchGameHeader
				title="REMOTE MATCH"
				displayMatchId={matchId}
				timeRemaining={gameState?.timer?.timeRemaining}
				rightSlot={
					isSpectator ? (
						<div className="flex min-w-0 items-center gap-1 sm:gap-2">
							<Badge
								aria-label="Spectating live"
								title="SPECTATING LIVE"
								className="h-7 min-w-7 bg-red-500/90 backdrop-blur-sm text-white px-1.5 py-0 text-[10px] font-bold animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)] flex shrink-0 items-center justify-center gap-1 border-0 sm:h-8 sm:min-w-8 sm:px-2 md:px-2.5 xl:px-3"
							>
								<Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
								<span className="hidden md:inline xl:hidden">LIVE</span>
								<span className="hidden xl:inline">SPECTATING LIVE</span>
							</Badge>
							<Button
								onClick={returnToLobby}
								variant="outline"
								size="sm"
								className="h-7 px-2 text-xs sm:h-8 sm:px-2.5 sm:text-sm bg-black/40 border-white/10 text-white hover:bg-white/10 hover:text-white transition-colors"
							>
								<ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:mr-2" />
								<span className="hidden lg:inline">Lobby</span>
							</Button>
						</div>
					) : (
						<LiveStatusBadge />
					)
				}
			/>

			<div className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">
				<div className="relative h-full w-full">
					<PongGame
						matchId={matchId}
						mode="remote"
						gameState={normalizedGameState}
						getLiveGameState={getLatestRemoteRenderGameState}
						subscribeToLiveGameState={subscribeToRemoteRenderGameState}
						remoteOptimisticPaddlePreview={optimisticPaddlePreview}
						layout="canvasOnly"
						showBuiltInOverlays={false}
						player1Name={gameState?.leftPlayer?.username || "Player 1"}
						player2Name={gameState?.rightPlayer?.username || "Player 2"}
						mySide={
							gameState?.me === "LEFT" || gameState?.me === "RIGHT"
								? gameState.me
								: String(user?.id) === String(gameState?.leftPlayer?.id)
									? "LEFT"
									: String(user?.id) === String(gameState?.rightPlayer?.id)
										? "RIGHT"
										: null
						}
					/>

					{showWaitingOverlay && (
						<div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm p-8">
							<div className="flex flex-col items-center justify-center space-y-4">
								{hasStartCountdown ? (
									<div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/40 bg-black/50 shadow-[0_0_30px_rgba(59,130,246,0.35)]">
										<span className="text-5xl font-black text-white tabular-nums">
											{startCountdownSeconds}
										</span>
									</div>
								) : (
									<Loader2 className="h-12 w-12 text-primary animate-spin" />
								)}
								<h3 className="text-2xl font-bold text-white">
									{t.Game["Match Starting Soon"]}
								</h3>
								<p className="text-white/80">
									{hasStartCountdown
										? t.Game["Get ready. The match starts automatically."]
										: t.Game["Waiting for players to get ready..."]}
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{!isSpectator && <GameControlsTray mode="remote" />}

			{gameState && (
				<PauseOverlay
					isOpen={isPaused}
					mode="remote"
					isSpectator={isSpectator}
					onReturnToLobby={isSpectator ? returnToLobby : undefined}
					disconnectInfo={
						disconnectInfo
							? {
									disconnectedPlayer:
										disconnectInfo.disconnectedPlayer as "LEFT" | "RIGHT",
										countdown: disconnectInfo.countdown,
										phase: disconnectInfo.phase,
							  }
							: null
					}
					player1Name={gameState.leftPlayer?.username || "Player 1"}
					player2Name={gameState.rightPlayer?.username || "Player 2"}
					player1Ready={player1Ready}
					player2Ready={player2Ready}
					currentPlayerReady={pauseCurrentPlayerReady}
					onResume={() => sendGameEvent("PAUSE")}
				/>
			)}

			{gameOverResult && (
				<GameOverOverlay
					gameOverResult={gameOverResult}
					userId={user?.id}
					sendSocketMessage={sendSocketMessage}
					router={router}
				/>
			)}
		</div>
	);
}
