"use client";

import PongGame from "@/components/game/PongGame";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";
import { toast } from "sonner";

export default function LocalGamePage() {
	const params = useParams();
	const router = useRouter();
	const { user } = useAuth();
	const matchId = params.matchId as string;
	const [matchData, setMatchData] = useState<any>(null);

	// Load match data
	useEffect(() => {
		const storedMatchData = localStorage.getItem("current-match");
		if (storedMatchData) {
			setMatchData(JSON.parse(storedMatchData));
		}
	}, []);

	const handleGameOver = async (winner: number | null, score: { p1: number; p2: number }, result: string) => {
		console.log(`Game Over! Result: ${result}`, { winner, score });
		
		// Save match to backend (only for account user)
		if (matchData && user) {
			try {
				const player1Id = matchData.player1?.isTemp ? null : matchData.player1?.id;
				const player2Id = matchData.player2?.isTemp ? null : matchData.player2?.id;

				// Only save if at least one player is the account user
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
					console.log("Match saved to backend");
				}
			} catch (error: any) {
				console.error("Failed to save match:", error);
				if (error.response?.status === 401) {
					toast.error("Session expired. Match could not be saved.");
					// Optional: redirect to login or just let them know
				} else {
					toast.error("Failed to save match result.");
				}
			}
		}
		
		// If this is a tournament match, update tournament state
		if (matchData?.isTournamentMatch && matchData.tournamentId) {
			try {
				await axios.post(`/api/tournament/${matchData.tournamentId}/match-result`, {
					matchId: matchData.matchId,
					player1Id: matchData.player1?.id,
					player2Id: matchData.player2?.id || null,
					score: score,
					outcome: result // 'win' or 'draw'
				});
				console.log("Tournament match result updated");
			} catch (error) {
				console.error("Failed to update tournament result:", error);
				toast.error("Failed to update tournament progress.");
			}
		}
	};

	const handleExit = () => {
		if (matchData?.isTournamentMatch) {
			router.push(`/game/local/tournament/${matchData.tournamentId}`);
		} else {
			localStorage.removeItem("current-match");
			router.push("/game/new");
		}
	};

	return (
		<div className="relative">

			<PongGame
				matchId={matchId}
				mode="local"
				wsUrl={`wss://localhost:8443/ws/game?matchId=${matchId}`}
				onGameOver={handleGameOver}
				onExit={handleExit}
			/>
		</div>
	);
}