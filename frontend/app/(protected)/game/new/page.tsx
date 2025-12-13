"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Users, Monitor, Gamepad2, Trophy } from "lucide-react";

export default function NewGamePage() {
    const router = useRouter();
    const [selectedMode, setSelectedMode] = useState<"local" | "remote" | null>(null);

    const handleModeSelect = (mode: "local" | "remote") => {
        setSelectedMode(mode);
    };

    const handleBack = () => {
        setSelectedMode(null);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <div className="w-full max-w-4xl">
                <h1 className="mb-8 text-center text-4xl font-bold text-white">
                    New Game
                </h1>

                {!selectedMode ? (
                    // Step 1: Choose Local or Remote
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card 
                            className="cursor-pointer transition-all hover:scale-105 hover:shadow-xl border-2 border-blue-500/50 bg-gray-800/50"
                            onClick={() => handleModeSelect("local")}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-center mb-4">
                                    <Monitor className="h-16 w-16 text-blue-400" />
                                </div>
                                <CardTitle className="text-center text-2xl text-white">
                                    Local Play
                                </CardTitle>
                                <CardDescription className="text-center text-gray-300">
                                    Play on the same device
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-sm text-gray-400">
                                    Add temporary players • Single Match or Tournament
                                </p>
                            </CardContent>
                        </Card>

                        <Card 
                            className="cursor-pointer transition-all hover:scale-105 hover:shadow-xl border-2 border-green-500/50 bg-gray-800/50"
                            onClick={() => handleModeSelect("remote")}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-center mb-4">
                                    <Users className="h-16 w-16 text-green-400" />
                                </div>
                                <CardTitle className="text-center text-2xl text-white">
                                    Remote Play
                                </CardTitle>
                                <CardDescription className="text-center text-gray-300">
                                    Play online with friends
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-sm text-gray-400">
                                    Invite friends or matchmaking • Online multiplayer
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                ) : selectedMode === "local" ? (
                    // Step 2: Local Play Options (Simplified - no Invite/Matchmaking)
                    <div>
                        <Button 
                            variant="ghost" 
                            onClick={handleBack}
                            className="mb-4 text-white hover:text-gray-300"
                        >
                            ← Back
                        </Button>
                        <h2 className="mb-6 text-center text-2xl font-semibold text-white">
                            Local Play
                        </h2>
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card 
                                className="cursor-pointer transition-all hover:scale-105 hover:shadow-xl border-2 border-purple-500/50 bg-gray-800/50"
                                onClick={() => router.push("/game/local/single")}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-center mb-2">
                                        <Gamepad2 className="h-12 w-12 text-purple-400" />
                                    </div>
                                    <CardTitle className="text-center text-xl text-white">
                                        Single Match
                                    </CardTitle>
                                    <CardDescription className="text-center text-gray-300">
                                        2 Players
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-center text-sm text-gray-400">
                                        Quick 1v1 match • First to 5 points wins
                                    </p>
                                </CardContent>
                            </Card>

                            <Card 
                                className="cursor-pointer transition-all hover:scale-105 hover:shadow-xl border-2 border-yellow-500/50 bg-gray-800/50"
                                onClick={() => router.push("/game/local/tournament")}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-center mb-2">
                                        <Trophy className="h-12 w-12 text-yellow-400" />
                                    </div>
                                    <CardTitle className="text-center text-xl text-white">
                                        Tournament
                                    </CardTitle>
                                    <CardDescription className="text-center text-gray-300">
                                        4+ Players
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-center text-sm text-gray-400">
                                        Bracket-style elimination tournament
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    // Remote Play - Keep the detailed options
                    <div>
                        <Button 
                            variant="ghost" 
                            onClick={handleBack}
                            className="mb-4 text-white hover:text-gray-300"
                        >
                            ← Back
                        </Button>
                        <h2 className="mb-6 text-center text-2xl font-semibold text-white">
                            Remote Play - Coming Soon
                        </h2>
                        <Card className="border-2 border-gray-600 bg-gray-800/50">
                            <CardContent className="p-8 text-center text-gray-400">
                                <p>Remote play features will be available in Phase 3</p>
                                <p className="mt-2 text-sm">
                                    (Invite Players, Matchmaking, Online Tournaments)
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
