"use client";

import type { Dispatch, SetStateAction } from "react";
import type { GameState } from "@/types/game";
import type { GameStateValue, UserProfile } from "@/types/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft, Timer, Hash, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/utils/gameHelpers";
import PongGame from "@/components/game/PongGame";
import { GameControlsTray } from "@/components/game/GameControlsTray";
import { ReadyOverlay } from "@/components/game/ReadyOverlay";
import { PauseOverlay } from "@/components/game/PauseOverlay";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import type {
	DisconnectInfo,
	PauseInfo,
	RuntimeGameOverResult,
} from "@/features/game/runtime/runtime-helpers";

interface RouterLike {
	push: (path: string) => void;
}

interface RemoteGameRuntimeViewProps {
	matchId: string;
	gameState: GameStateValue | null;
	normalizedGameState: GameState | null;
	gameOverResult: RuntimeGameOverResult | null;
	isSpectator: boolean;
	returnToLobby: () => void;
	sendSocketMessage: (payload: Record<string, unknown>) => void;
	user: UserProfile | null;
	setGameOverResult: Dispatch<SetStateAction<RuntimeGameOverResult | null>>;
	opponentConnected: boolean;
	router: RouterLike;
	gameStart: boolean;
	disconnectInfo: DisconnectInfo | null;
	pauseInfo: PauseInfo | null;
}

export default function RemoteGameRuntimeView({
	matchId,
	gameState,
	normalizedGameState,
	gameOverResult,
	isSpectator,
	returnToLobby,
	sendSocketMessage,
	user,
	setGameOverResult,
	opponentConnected,
	router,
	gameStart,
	disconnectInfo,
	pauseInfo,
}: RemoteGameRuntimeViewProps) {
	const showWaitingOverlay =
		!!gameState &&
		!gameState.gameStarted &&
		!gameStart &&
		!gameState.paused &&
		!gameOverResult;
	const shouldShowSpectatorWaitingOverlay = showWaitingOverlay && isSpectator;
	const shouldShowReadyOverlay = showWaitingOverlay && !isSpectator;
	const mySide = gameState?.me;
	const currentPlayer =
		mySide === "LEFT" ? gameState?.leftPlayer : gameState?.rightPlayer;
	const currentPlayerReady = currentPlayer ? !currentPlayer.gamePaused : false;
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
		<div className="h-screen pt-32 pb-4 flex flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20 relative">
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
				<div
					className="absolute bottom-[20%] right-[10%] w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
					style={{ animationDelay: "1s" }}
				/>
			</div>

			<div className="shrink-0 h-24 w-full max-w-7xl mx-auto grid grid-cols-3 items-center px-8 border-b border-white/5 bg-background/40 backdrop-blur-md z-10 transition-all duration-300">
				<div className="flex flex-col items-start gap-1.5">
					<h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-sm">
						REMOTE MATCH
					</h1>
					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className="inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-muted-foreground border-white/10 bg-black/20 px-3 py-1 rounded-full leading-normal"
						>
							<Hash className="h-3 w-3 opacity-50" />
							{matchId}
						</Badge>
					</div>
				</div>

				<div className="flex justify-center">
					{gameState?.timer && (
						<div className="relative group">
							<div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500" />
							<div className="relative px-8 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg flex flex-col items-center shadow-2xl">
								<div
									className={cn(
										"text-4xl font-mono font-bold tabular-nums tracking-widest leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]",
										gameState.timer.timeRemaining < 30000
											? "text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"
											: "bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70"
									)}
								>
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
							<span className="text-xs font-bold text-green-500 tracking-wider">
								LIVE
							</span>
						</div>
					)}
				</div>
			</div>

			<div className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">
				<div className="relative h-full w-full">
					<PongGame
						matchId={matchId}
						mode="remote"
						gameState={normalizedGameState}
						layout="canvasOnly"
						showBuiltInOverlays={false}
					/>

					{shouldShowSpectatorWaitingOverlay && (
						<div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm p-8">
							<div className="flex flex-col items-center justify-center space-y-4">
								<Loader2 className="h-12 w-12 text-primary animate-spin" />
								<h3 className="text-2xl font-bold text-white">
									Match Starting Soon
								</h3>
								<p className="text-white/80">
									Waiting for players to get ready...
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{!isSpectator && <GameControlsTray mode="remote" />}

			{gameState && shouldShowReadyOverlay && (
				<ReadyOverlay
					isOpen
					mode="remote"
					player1Ready={!gameState.leftPlayer?.gamePaused}
					player2Ready={!gameState.rightPlayer?.gamePaused}
					player1Name={gameState.leftPlayer?.username || "Player 1"}
					player2Name={gameState.rightPlayer?.username || "Player 2"}
					currentPlayerReady={currentPlayerReady}
					onReady={() => sendGameEvent("START")}
					onStart={() => sendGameEvent("START")}
				/>
			)}

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
					opponentConnected={opponentConnected}
					userId={user?.id}
					sendSocketMessage={sendSocketMessage}
					setGameOverResult={setGameOverResult}
					router={router}
				/>
			)}
		</div>
	);
}
