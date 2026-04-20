"use client";

import PongGame from "@/components/game/PongGame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeft } from "lucide-react";
import { useGameSettings } from "@/hooks/use-game-settings";

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
}: LocalGameRuntimeViewProps) {
	const { background, setBackground, setBindings } = useGameSettings();
	const query = new URLSearchParams({ matchId });
	if (isAI) {
		query.set("isAI", "1");
		query.set("aiDifficulty", aiDifficulty);
	}

	return (
		<div className="relative">
			{isSpectator && (
				<div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full shadow-2xl">
					<Badge className="bg-red-500/90 text-white px-4 py-1.5 text-sm font-bold animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.6)] flex items-center gap-2 border-0">
						<Eye className="h-4 w-4" /> SPECTATING LIVE
					</Badge>
					<div className="h-6 w-px bg-white/20" />
					<Button
						onClick={returnToLobby}
						variant="ghost"
						size="sm"
						className="text-white hover:bg-white/10"
					>
						<ArrowLeft className="mr-2 h-4 w-4" /> Lobby
					</Button>
				</div>
			)}

			<PongGame
				matchId={matchId}
				mode="local"
				wsUrl={`wss://${typeof window !== 'undefined' ? window.location.host : 'localhost:8443'}/ws/game?${query.toString()}`}
				isAIEnabled={isAI}
				onGameOver={handleGameOver}
				onExit={handleExit}
				isTournamentMatch={isTournamentMatch}
				showControlsTray={!isSpectator}
				pauseOnGuard={pauseOnGuard}
				background={background}
				onBackgroundChange={setBackground}
				onBindingsChange={setBindings}
			/>
		</div>
	);
}
