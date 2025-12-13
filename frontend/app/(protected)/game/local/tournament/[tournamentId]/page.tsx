"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TournamentBracket from "@/components/game/TournamentBracket";
import {
    Player,
    Match,
    generateBracket,
    shufflePlayers,
    updateBracketWithResult,
    getCurrentMatch,
    isTournamentComplete,
    getTournamentWinner,
} from "@/lib/tournament";
import { Trophy, Play, ArrowLeft } from "lucide-react";

export default function LocalTournamentPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tournamentId = params.tournamentId as string;

    const [matches, setMatches] = useState<Match[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
    const [winner, setWinner] = useState<Player | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    // Initialize tournament from URL params or localStorage
    useEffect(() => {
        // Try to load from localStorage first
        const savedTournament = localStorage.getItem(`tournament-${tournamentId}`);
        
        if (savedTournament) {
            const data = JSON.parse(savedTournament);
            setPlayers(data.players);
            setMatches(data.matches);
        } else {
            // Initialize new tournament from URL params
            const playerNames = searchParams.get("players")?.split(",") || [];
            
            if (playerNames.length === 0) {
                // Generate default players
                const count = parseInt(tournamentId.split("-")[3]?.replace("p", "") || "4");
                for (let i = 1; i <= count; i++) {
                    playerNames.push(`Player ${i}`);
                }
            }

            const playerList: Player[] = playerNames.map((name, index) => ({
                id: `player-${index + 1}`,
                name: name,
            }));

            // Shuffle players randomly
            const shuffledPlayers = shufflePlayers(playerList);
            setPlayers(shuffledPlayers);

            // Generate bracket
            const bracket = generateBracket(shuffledPlayers);
            setMatches(bracket);

            // Save to localStorage
            localStorage.setItem(
                `tournament-${tournamentId}`,
                JSON.stringify({
                    players: shuffledPlayers,
                    matches: bracket,
                })
            );
        }
    }, [tournamentId, searchParams]);

    // Update current match and check completion
    useEffect(() => {
        if (matches.length > 0) {
            const current = getCurrentMatch(matches);
            setCurrentMatch(current);

            const complete = isTournamentComplete(matches);
            setIsComplete(complete);

            if (complete) {
                const tournamentWinner = getTournamentWinner(matches);
                setWinner(tournamentWinner);
            }

            // Save state to localStorage
            localStorage.setItem(
                `tournament-${tournamentId}`,
                JSON.stringify({ players, matches })
            );
        }
    }, [matches, tournamentId, players]);

    // Handle match result from game
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === "MATCH_RESULT") {
                const { matchId, winner, score } = event.data;
                const winnerPlayer = players.find((p) => p.id === winner);
                
                if (winnerPlayer) {
                    const updatedMatches = updateBracketWithResult(
                        matches,
                        matchId,
                        winnerPlayer,
                        score
                    );
                    setMatches(updatedMatches);
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [matches, players]);

    const handleStartMatch = () => {
        if (!currentMatch) return;

        // Navigate to game with match info
        const matchData = {
            matchId: currentMatch.id,
            tournamentId: tournamentId,
            player1: currentMatch.player1,
            player2: currentMatch.player2,
        };

        // Store match data in localStorage for game to retrieve
        localStorage.setItem("current-match", JSON.stringify(matchData));

        // Navigate to game
        router.push(`/game/${currentMatch.id}`);
    };

    const handleReset = () => {
        localStorage.removeItem(`tournament-${tournamentId}`);
        router.push("/game/new");
    };

    if (isComplete && winner) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
                <Card className="w-full max-w-2xl border-4 border-yellow-500 bg-gray-800/50">
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <Trophy className="h-24 w-24 text-yellow-500" />
                        </div>
                        <CardTitle className="text-center text-4xl text-white">
                            Tournament Complete!
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center">
                            <p className="text-gray-300 text-xl mb-2">Winner:</p>
                            <p className="text-yellow-400 text-5xl font-bold">
                                {winner.name}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Button
                                onClick={handleReset}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-6"
                            >
                                New Tournament
                            </Button>
                            <Button
                                onClick={() => router.push("/game/new")}
                                variant="outline"
                                className="w-full text-lg py-6"
                            >
                                Main Menu
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

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
                    
                    <h1 className="text-3xl font-bold text-white">
                        Local Tournament
                    </h1>
                    
                    <div className="w-32" /> {/* Spacer for centering */}
                </div>

                {currentMatch && (
                    <Card className="mb-6 border-2 border-blue-500/50 bg-gray-800/50">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="text-white">
                                    <p className="text-sm text-gray-400 mb-1">Next Match:</p>
                                    <p className="text-2xl font-bold">
                                        {currentMatch.player1?.name} vs {currentMatch.player2?.name}
                                    </p>
                                </div>
                                <Button
                                    onClick={handleStartMatch}
                                    className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6"
                                >
                                    <Play className="mr-2 h-5 w-5" />
                                    Start Match
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <TournamentBracket
                    matches={matches}
                    currentMatchId={currentMatch?.id || null}
                />
            </div>
        </div>
    );
}
