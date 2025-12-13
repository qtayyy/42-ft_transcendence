"use client";

import PongGame from "@/components/game/PongGame";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";

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
            } catch (error) {
                console.error("Failed to save match:", error);
            }
        }
        
        // If this is a tournament match, send result back
        if (matchData?.isTournamentMatch) {
            window.postMessage(
                {
                    type: "TOURNAMENT_MATCH_RESULT",
                    matchId: matchData.matchId,
                    player1Id: matchData.player1?.id,
                    player2Id: matchData.player2?.id || null,
                    score: score,
                    outcome: result // 'win' or 'draw'
                },
                window.location.origin
            );

            setTimeout(() => {
                router.push(`/game/local/tournament/${matchData.tournamentId}`);
            }, 2000);
        } else {
            // Single match - go back to menu after a delay
            setTimeout(() => {
                localStorage.removeItem("current-match");
                router.push("/game/new");
            }, 3000);
        }
    };

    return (
        <div className="relative">
            {matchData && (
                <div className="absolute top-4 left-4 bg-gray-800/90 text-white p-3 rounded-lg shadow-lg z-10">
                    <p className="text-sm font-semibold">
                        {matchData.isTournamentMatch ? "Tournament Match" : "Local Match"}
                    </p>
                    <p className="text-xs text-gray-300">
                        {matchData.player1?.name} vs {matchData.player2?.name}
                    </p>
                    {(matchData.player1?.isTemp || matchData.player2?.isTemp) && (
                        <p className="text-xs text-yellow-400 mt-1">
                            Temporary player data won't be saved
                        </p>
                    )}
                </div>
            )}
            <PongGame
                matchId={matchId}
                mode="local"
                wsUrl={`wss://localhost:8443/ws/game?matchId=${matchId}`}
                onGameOver={handleGameOver}
            />
        </div>
    );
}