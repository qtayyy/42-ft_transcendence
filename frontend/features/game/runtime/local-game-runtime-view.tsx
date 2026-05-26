"use client";

import PongGame from "@/components/game/PongGame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft } from "lucide-react";
import { getGameWebSocketUrl } from "@/lib/runtime-url";

interface LocalGameRuntimeViewProps {
	isSpectator: boolean;
	returnToLobby: () => void;
	matchId: string;
	isAI: boolean;
	aiDifficulty: "easy" | "medium" | "hard";
	handleGameOver: (winner: number | null, score: { p1: number; p2: number }, result: string) => Promise<void>;
	handleExit: () => void;
	isTournamentMatch: boolean;
	pauseOnGuard: boolean;
	player1Name?: string;
	player2Name?: string;
}

export default function LocalGameRuntimeView({
	isSpectator,
	returnToLobby,
	matchId,
	isAI,
	aiDifficulty,
	handleGameOver,
	handleExit,
	isTournamentMatch,
	pauseOnGuard,
	player1Name,
	player2Name,
}: LocalGameRuntimeViewProps) {
	return (
		<div className="relative">
			{isSpectator && (
				<div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-2.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full shadow-2xl">
					<Badge
						title="SPECTATING LIVE"
						className="h-7 min-w-7 bg-red-500/90 text-white px-1.5 py-0 text-[10px] font-bold animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)] flex shrink-0 items-center justify-center gap-1 border-0 sm:h-8 sm:min-w-8 sm:px-2 md:px-2.5 xl:px-3"
					>
						<Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
						<span className="hidden md:inline xl:hidden">LIVE</span>
						<span className="hidden xl:inline">SPECTATING LIVE</span>
					</Badge>
					<div className="h-5 sm:h-6 w-px bg-white/20" />
					<Button
						onClick={returnToLobby}
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs sm:h-8 sm:px-2.5 sm:text-sm text-white hover:bg-white/10"
					>
						<ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:mr-2" />
						<span className="hidden lg:inline">Lobby</span>
					</Button>
				</div>
			)}

			<PongGame
				matchId={matchId}
				mode="local"
				wsUrl={getGameWebSocketUrl(matchId, {
					isAI,
					aiDifficulty,
				})}
				isAIEnabled={isAI}
				onGameOver={handleGameOver}
				onExit={handleExit}
				isTournamentMatch={isTournamentMatch}
				showControlsTray={!isSpectator}
				pauseOnGuard={pauseOnGuard}
				player1Name={player1Name}
				player2Name={player2Name}
			/>
		</div>
	);
}
