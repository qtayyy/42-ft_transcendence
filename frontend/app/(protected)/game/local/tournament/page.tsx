"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, X, Play } from "lucide-react";

export default function LocalTournamentPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [tempPlayerName, setTempPlayerName] = useState("");
    const [tempPlayers, setTempPlayers] = useState<Array<{name: string}>>([]);

    const totalPlayers = 1 + tempPlayers.length; // Account user + temp players

    const handleAddTempPlayer = () => {
        if (tempPlayerName.trim()) {
            setTempPlayers([...tempPlayers, { name: tempPlayerName.trim() }]);
            setTempPlayerName("");
        }
    };

    const handleRemoveTempPlayer = (index: number) => {
        setTempPlayers(tempPlayers.filter((_, i) => i !== index));
    };

    const canStartTournament = totalPlayers >= 4 && isPowerOf2(totalPlayers);

    function isPowerOf2(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }

    const handleStartTournament = () => {
        if (!canStartTournament) return;

        // Build full player list
        const allPlayers = [
            { id: user?.id, name: user?.username || "You", isTemp: false },
            ...tempPlayers.map((p, i) => ({ id: `temp-${i}`, name: p.name, isTemp: true }))
        ];

        const tournamentId = `local-tournament-${totalPlayers}p-${Date.now()}`;
        const playersParam = allPlayers.map(p => `${p.name}|${p.isTemp ? 'temp' : p.id}`).join(",");

        router.push(`/game/local/tournament/${tournamentId}?players=${encodeURIComponent(playersParam)}`);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <Card className="w-full max-w-3xl border-2 border-yellow-500/50 bg-gray-800/50">
                <CardHeader>
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/game/new")}
                        className="absolute top-4 left-4 text-white hover:text-gray-300"
                    >
                        ← Back
                    </Button>
                    <CardTitle className="text-center text-3xl text-white pt-2">
                        Local Tournament
                    </CardTitle>
                    <p className="text-center text-gray-400 mt-2">
                        Add temporary players to start ({totalPlayers}/4+ players)
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Account User */}
                    <div>
                        <Label className="text-white text-lg mb-2 block">Players</Label>
                        <div className="space-y-2">
                            {/* Account User (Always present) */}
                            <div className="flex items-center gap-3 p-3 bg-blue-600/20 border-2 border-blue-500 rounded-lg">
                                <User className="h-5 w-5 text-blue-400" />
                                <div className="flex-1">
                                    <p className="text-white font-semibold">{user?.username || "Account User"}</p>
                                    <p className="text-xs text-gray-400">Account Player</p>
                                </div>
                            </div>

                            {/* Temporary Players */}
                            {tempPlayers.map((player, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-gray-700 border-2 border-gray-600 rounded-lg">
                                    <User className="h-5 w-5 text-gray-400" />
                                    <div className="flex-1">
                                        <p className="text-white font-semibold">{player.name}</p>
                                        <p className="text-xs text-gray-400">Temporary Player</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveTempPlayer(index)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Player Input */}
                    <div>
                        <Label className="text-white mb-2 block">Add Temporary Player</Label>
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
                        <p className="text-sm text-gray-500 mt-2">
                            Temporary player data will not be saved
                        </p>
                    </div>

                    {/* Player Count Info */}
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <p className="text-center text-sm text-gray-300">
                            {totalPlayers < 4 ? (
                                <span className="text-yellow-400">
                                    Need at least 4 players total (add {4 - totalPlayers} more)
                                </span>
                            ) : !isPowerOf2(totalPlayers) ? (
                                <span className="text-yellow-400">
                                    Player count must be 4, 8, or 16 (currently {totalPlayers})
                                </span>
                            ) : (
                                <span className="text-green-400">
                                    ✓ Ready to start with {totalPlayers} players
                                </span>
                            )}
                        </p>
                    </div>

                    {/*Start Button */}
                    <Button
                        onClick={handleStartTournament}
                        disabled={!canStartTournament}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white text-lg py-6 disabled:opacity-50"
                    >
                        <Play className="mr-2 h-5 w-5" />
                        Start Tournament
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
