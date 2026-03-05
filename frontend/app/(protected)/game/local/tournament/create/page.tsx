"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LocalTournamentCreatePage() {
    const router = useRouter();
    const [playerCount, setPlayerCount] = useState<number>(4);
    const [playerNames, setPlayerNames] = useState<string[]>(
        Array(4).fill("").map((_, i) => `Player ${i + 1}`)
    );

    const handlePlayerCountChange = (value: string) => {
        const count = parseInt(value);
        setPlayerCount(count);
        setPlayerNames(Array(count).fill("").map((_, i) => `Player ${i + 1}`));
    };

    const handlePlayerNameChange = (index: number, name: string) => {
        const newNames = [...playerNames];
        newNames[index] = name || `Player ${index + 1}`;
        setPlayerNames(newNames);
    };

    const handleStartTournament = () => {
        // Generate tournament ID
        const tournamentId = `local-tournament-${playerCount}p-${Date.now()}`;
        
        // Pass player names as URL params
        const playersParam = playerNames.join(",");
        
        // Navigate to tournament page
        router.push(`/game/local/tournament/${tournamentId}?players=${encodeURIComponent(playersParam)}`);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <Card className="w-full max-w-2xl border-2 border-pink-500/50 bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-center text-3xl text-white">
                        Local Tournament Setup
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label className="text-white text-lg mb-3 block">
                            Number of Players
                        </Label>
                        <div className="flex gap-3">
                            {[4, 8, 12].map((count) => (
                                <Button
                                    key={count}
                                    type="button"
                                    onClick={() => handlePlayerCountChange(count.toString())}
                                    variant={playerCount === count ? "default" : "outline"}
                                    className={playerCount === count ? "bg-pink-600" : ""}
                                >
                                    {count} Players
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label className="text-white text-lg mb-3 block">Player Names</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                            {playerNames.map((name, index) => (
                                <div key={index}>
                                    <Input
                                        placeholder={`Player ${index + 1}`}
                                        value={name}
                                        onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                                        className="bg-gray-700 text-white border-gray-600"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        onClick={handleStartTournament}
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white text-lg py-6"
                    >
                        Start Tournament
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
