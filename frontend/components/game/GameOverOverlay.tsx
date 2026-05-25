"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/languageContext";

interface GameOverPlayer {
	id?: number | string;
	username?: string;
	score?: number;
}

interface GameOverResult {
	winner?: string | null;
	leftPlayer?: GameOverPlayer;
	rightPlayer?: GameOverPlayer;
	tournamentId?: number | string | null;
	matchId?: number | string;
}

interface RouterLike {
	push: (path: string) => void;
}

interface GameOverOverlayProps {
	gameOverResult: GameOverResult;
	mode?: "remote" | "local";
	userId?: number | string;
	sendSocketMessage?: (payload: Record<string, unknown>) => void;
	router?: RouterLike;
	onExit?: () => void;
	localActionLabel?: string;
	localAutoExitSeconds?: number;
}

export function GameOverOverlay({
	gameOverResult,
	mode = "remote",
	userId,
	sendSocketMessage,
	router,
	onExit,
	localActionLabel = "Continue to Menu",
	localAutoExitSeconds,
}: GameOverOverlayProps) {
	const isRemote = mode === "remote";
	const isTournament = !!gameOverResult.tournamentId;
	const isLocalAutoExitEnabled =
		!isRemote &&
		typeof localAutoExitSeconds === "number" &&
		localAutoExitSeconds > 0 &&
		typeof onExit === "function";
	const [localCountdown, setLocalCountdown] = useState(
		isLocalAutoExitEnabled ? localAutoExitSeconds : 0,
	);
	const { t } = useLanguage();
	const hasAutoExitedRef = useRef(false);
	const triggerLocalExit = useCallback(() => {
		if (!onExit || hasAutoExitedRef.current) return;
		hasAutoExitedRef.current = true;
		onExit();
	}, [onExit]);

	useEffect(() => {
		if (!isLocalAutoExitEnabled) return;
		hasAutoExitedRef.current = false;

		const deadline = Date.now() + localAutoExitSeconds * 1000;
		const intervalId = window.setInterval(() => {
			const remainingSeconds = Math.max(
				0,
				Math.ceil((deadline - Date.now()) / 1000),
			);
			setLocalCountdown(remainingSeconds);
		}, 250);

		const timeoutId = window.setTimeout(() => {
			triggerLocalExit();
		}, localAutoExitSeconds * 1000);

		return () => {
			window.clearInterval(intervalId);
			window.clearTimeout(timeoutId);
		};
	}, [isLocalAutoExitEnabled, localAutoExitSeconds, triggerLocalExit]);

	return (
		<div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-md z-30">
			<div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
				<h2 className="text-5xl font-black text-white tracking-tight">{t.Game["GAME OVER"]}</h2>

				<div className="flex items-center justify-center gap-8 py-8">
					<div className={`text-center p-6 rounded-2xl transition-all duration-500 ${gameOverResult.winner === "LEFT" ? "bg-green-500/20 ring-4 ring-green-500 scale-110 shadow-2xl shadow-green-500/20" : "bg-white/5 grayscale opacity-70"}`}>
						<p className="text-lg font-semibold text-white mb-1">{gameOverResult.leftPlayer?.username}</p>
						<p className="text-6xl font-black text-white">{gameOverResult.leftPlayer?.score}</p>
						{gameOverResult.winner === "LEFT" && (
							<Badge className="mt-4 bg-green-500 hover:bg-green-600 text-white border-0 text-sm px-3 py-1">{t.Game["WINNER"]}</Badge>
						)}
					</div>
					<span className="text-4xl text-white/30 font-thin">vs</span>
					<div className={`text-center p-6 rounded-2xl transition-all duration-500 ${gameOverResult.winner === "RIGHT" ? "bg-green-500/20 ring-4 ring-green-500 scale-110 shadow-2xl shadow-green-500/20" : "bg-white/5 grayscale opacity-70"}`}>
						<p className="text-lg font-semibold text-white mb-1">{gameOverResult.rightPlayer?.username}</p>
						<p className="text-6xl font-black text-white">{gameOverResult.rightPlayer?.score}</p>
						{gameOverResult.winner === "RIGHT" && (
							<Badge className="mt-4 bg-green-500 hover:bg-green-600 text-white border-0 text-sm px-3 py-1">{t.Game["WINNER"]}</Badge>
						)}
					</div>
				</div>

				<div className="flex gap-4 justify-center">
					{isTournament && isRemote ? (
						<div className="space-y-4">
							<p className="text-white/80 animate-pulse">
								{t.Game["Returning to tournament lobby in 5 seconds..."]}
							</p>
							<Button
								onClick={() => {
									router?.push(`/game/remote/tournament/${gameOverResult.tournamentId}`);
								}}
								size="lg"
								className="bg-white/10 hover:bg-white/20 text-white border-0"
							>
								{t.Game["Return Now"]} <ArrowLeft className="ml-2 h-4 w-4" />
							</Button>
						</div>
					) : isRemote ? (
						<>
							<Button
								onClick={() => {
									if (!sendSocketMessage) return;
									const opponentId = Number(gameOverResult.leftPlayer?.id) === Number(userId)
										? gameOverResult.rightPlayer?.id
										: gameOverResult.leftPlayer?.id;
									sendSocketMessage({
										event: "LEAVE_GAME",
										payload: {
											opponentId,
											matchId: gameOverResult.matchId,
										},
									});
									router?.push("/game/new");
								}}
								variant="outline"
								size="lg"
								className="text-lg h-14 px-8 border-white/20 text-white hover:bg-white/10"
							>
								{t.Game["Leave"]}
							</Button>
						</>
						) : (
							<div className="space-y-4">
								{isLocalAutoExitEnabled && (
									<p className="text-white/80 animate-pulse">
										{(localCountdown === 1 ? t.Game["Auto returning to lobby in {count} second..."] : t.Game["Auto returning to lobby in {count} seconds..."]).replace("{count}", String(localCountdown))}
									</p>
								)}
								<Button
									onClick={triggerLocalExit}
									size="lg"
									className="bg-white/10 hover:bg-white/20 text-white border-0 text-lg h-14 px-8"
								>
									{localActionLabel}
								</Button>
							</div>
						)}
					</div>
				</div>
		</div>
	);
}
