"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, X, Play } from "lucide-react";

export default function LocalSingleMatchPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [tempPlayerName, setTempPlayerName] = useState("");
    const [player2, setPlayer2] = useState<{name: string; isTemp: boolean} | null>(null);

    const handleAddTempPlayer = () => {
        if (tempPlayerName.trim()) {
            setPlayer2({
                name: tempPlayerName.trim(),
                isTemp: true
            });
            setTempPlayerName("");
        }
    };

    const handleRemovePlayer2 = () => {
        setPlayer2(null);
    };

    const handleStartMatch = () => {
        if (!player2) return;

        // Create match data
        const matchData = {
            matchId: `local-${Date.now()}`,
            mode: "local",
            player1: {
                id: user?.id,
                name: user?.username || "You", 
                isTemp: false
            },
            player2: player2
        };

        // Store match data
        localStorage.setItem("current-match", JSON.stringify(matchData));

        // Navigate to game
        router.push(`/game/${matchData.matchId}`);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <Card className="w-full max-w-2xl border-2 border-purple-500/50 bg-gray-800/50">
                <CardHeader>
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/game/new")}
                        className="absolute top-4 left-4 text-white hover:text-gray-300"
                    >
                        ← Back
                    </Button>
                    <CardTitle className="text-center text-3xl text-white pt-2">
                        Local Single Match
                    </CardTitle>
                    <p className="text-center text-gray-400 mt-2">
                        Add a temporary player to start
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Account User (Player 1) */}
                    <div>
                        <Label className="text-white text-lg mb-2 block">Player 1 (You)</Label>
                        <div className="flex items-center gap-3 p-4 bg-blue-600/20 border-2 border-blue-500 rounded-lg">
                            <User className="h-6 w-6 text-blue-400" />
                            <div className="flex-1">
                                <p className="text-white font-semibold">{user?.username || "Account User"}</p>
                                <p className="text-sm text-gray-400">Account Player</p>
                            </div>
                        </div>
                    </div>

                    {/* Player 2 */}
                    <div>
                        <Label className="text-white text-lg mb-2 block">Player 2</Label>
                        {!player2 ? (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter player name..."
                                        value={tempPlayerName}
                                        onChange={(e) => setTempPlayerName(e.target.value)}
                                        onKeyPress={(e) => e.key === "Enter" && handleAddTempPlayer()}
                                        className="bg-gray-700 text-white border-gray-600"
                                    />
                                    <Button
                                        onClick={handleAddTempPlayer}
                                        disabled={!tempPlayerName.trim()}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <UserPlus className="h-4 w-4 mr-2" />
                                        Add
                                    </Button>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Temporary player data will not be saved
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-4 bg-gray-700 border-2 border-gray-600 rounded-lg">
                                <User className="h-6 w-6 text-gray-400" />
                                <div className="flex-1">
                                    <p className="text-white font-semibold">{player2.name}</p>
                                    <p className="text-sm text-gray-400">Temporary Player</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemovePlayer2}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Start Button */}
                    <Button
                        onClick={handleStartMatch}
                        disabled={!player2}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6 disabled:opacity-50"
                    >
                        <Play className="mr-2 h-5 w-5" />
                        Start Match
                    </Button>

                    {/* Controls Info */}
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <p className="text-center text-sm text-gray-300">
                            <span className="font-semibold">Player 1:</span> W/S keys  
                            <span className="mx-3">|</span>
                            <span className="font-semibold">Player 2:</span> Arrow keys
                        </p>
                        <p className="text-center text-xs text-gray-500 mt-2">
                            First to 5 points wins
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
