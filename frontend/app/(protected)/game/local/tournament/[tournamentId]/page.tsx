"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Leaderboard from "@/components/game/Leaderboard";
import { Tournament, TournamentMatch } from "@/lib/tournament";
import { Play, Trophy, ArrowLeft } from "lucide-react";

export default function TournamentPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const tournamentId = params.tournamentId as string;

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);

    // Load tournament from backend
    useEffect(() => {
        fetchTournament();
    }, [tournamentId]);

    const fetchTournament = async () => {
        try {
            const response = await axios.get(`/api/tournament/${tournamentId}`);
            setTournament(response.data);
            
            // Find next pending match
            const nextMatch = response.data.matches.find(
                (m: TournamentMatch) => m.status === 'pending'
            );
            setCurrentMatch(nextMatch || null);
            setLoading(false);
        } catch (error) {
            console.error("Failed to load tournament:", error);
            setLoading(false);
        }
    };

    const handleStartMatch = () => {
        if (!currentMatch) return;

        // Store match data for game page
        const matchData = {
            matchId: currentMatch.matchId,
            tournamentId: tournamentId,
            player1: currentMatch.player1,
            player2: currentMatch.player2,
            isTournamentMatch: true
        };

        localStorage.setItem("current-match", JSON.stringify(matchData));
        router.push(`/game/${currentMatch.matchId}`);
    };

    // Listen for match results from game page
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data.type === "TOURNAMENT_MATCH_RESULT") {
                const { matchId, player1Id, player2Id, score, outcome } = event.data;

                try {
                    // Send result to backend
                    await axios.post(`/api/tournament/${tournamentId}/match-result`, {
                        matchId,
                        player1Id,
                        player2Id,
                        score,
                        outcome
                    });

                    // Refresh tournament data
                    await fetchTournament();
                } catch (error) {
                    console.error("Failed to update match result:", error);
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [tournamentId]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                <div className="text-white text-xl">Loading tournament...</div>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
                <div className="text-white text-xl">Tournament not found</div>
            </div>
        );
    }

    // Tournament complete - show final results
    if (tournament.isComplete) {
        const winner = tournament.leaderboard[0];
        
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
                <Card className="w-full max-w-4xl border-4 border-yellow-500 bg-gray-800/50">
                    <CardContent className="pt-8">
                        <div className="flex flex-col items-center mb-8">
                            <Trophy className="h-24 w-24 text-yellow-400 mb-4" />
                            <h1 className="text-4xl font-bold text-white mb-2">Tournament Complete!</h1>
                            <p className="text-xl text-gray-300">
                                {tournament.format === 'round-robin' ? 'Round Robin' : 'Swiss'} • {tournament.playerCount} Players
                            </p>
                        </div>

                        <div className="mb-6">
                            <div className="text-center mb-4">
                                <p className="text-gray-400 text-lg">Champion</p>
                                <p className="text-yellow-400 text-5xl font-bold">{winner.playerName}</p>
                                <p className="text-gray-300 mt-2">{winner.matchPoints} Match Points</p>
                            </div>
                        </div>

                        <Leaderboard standings={tournament.leaderboard} currentUserId={user?.id} />

                        <div className="mt-6 flex gap-4">
                            <Button
                                onClick={() => router.push("/game/new")}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-6"
                            >
                                New Game
                            </Button>
                            <Button
                                onClick={() => router.push("/dashboard")}
                                variant="outline"
                                className="flex-1 py-6"
                            >
                                Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Tournament in progress
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/game/new")}
                        className="text-white hover:text-gray-300"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Menu
                    </Button>
                    
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-white">
                            {tournament.format === 'round-robin' ? 'Round Robin' : 'Swiss'} Tournament
                        </h1>
                        <p className="text-gray-400">
                            Round {tournament.currentRound} of {tournament.totalRounds}
                        </p>
                    </div>
                    
                    <div className="w-32" /> {/* Spacer */}
                </div>

                {/* Current Match Card */}
                {currentMatch && (
                    <Card className="mb-6 border-2 border-blue-500/50 bg-gray-800/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="text-white">
                                    <p className="text-sm text-gray-400 mb-1">Next Match:</p>
                                    <p className="text-2xl font-bold">
                                        {currentMatch.player1.name} vs {currentMatch.player2?.name || 'BYE'}
                                    </p>
                                    {!currentMatch.player2 && (
                                        <p className="text-sm text-yellow-400 mt-1">
                                            {currentMatch.player1.name} receives an automatic bye (3 points)
                                        </p>
                                    )}
                                </div>
                                {currentMatch.player2 && (
                                    <Button
                                        onClick={handleStartMatch}
                                        className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6"
                                    >
                                        <Play className="mr-2 h-5 w-5" />
                                        Start Match
                                    </Button>
                                )}
                                {!currentMatch.player2 && (
                                    <Button
                                        onClick={async () => {
                                            // Auto-process bye
                                            await axios.post(`/api/tournament/${tournamentId}/match-result`, {
                                                matchId: currentMatch.matchId,
                                                player1Id: currentMatch.player1.id,
                                                player2Id: null,
                                                score: { p1: 0, p2: 0 },
                                                outcome: 'bye'
                                            });
                                            await fetchTournament();
                                        }}
                                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-6"
                                    >
                                        Process Bye
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Leaderboard */}
                <Leaderboard standings={tournament.leaderboard} currentUserId={user?.id} />

                {/* Matches History */}
                <Card className="mt-6 bg-gray-800/50">
                    <CardContent className="pt-6">
                        <h3 className="text-xl font-bold text-white mb-4">Match History</h3>
                        <div className="space-y-2">
                            {tournament.matches
                                .filter(m => m.status === 'completed' || m.status === 'bye')
                                .map((match) => (
                                    <div
                                        key={match.matchId}
                                        className="flex items-center justify-between p-3 bg-gray-700 rounded"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-sm">R{match.round}</span>
                                            <span className="text-white">
                                                {match.player1.name} vs {match.player2?.name || 'BYE'}
                                            </span>
                                        </div>
                                        <div className="text-gray-300">
                                            {match.result?.outcome === 'bye' ? (
                                                <span className="text-yellow-400">Bye</span>
                                            ) : match.result?.outcome === 'draw' ? (
                                                <span className="text-yellow-400">
                                                    Draw ({match.result.score.p1}-{match.result.score.p2})
                                                </span>
                                            ) : (
                                                <span>
                                                    {match.result?.score.p1} - {match.result?.score.p2}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
