"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Users, Monitor, Gamepad2, Trophy, ArrowLeft } from "lucide-react";

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
        <div className="container mx-auto max-w-4xl p-6">
            <div className="space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight">New Game</h1>
                    <p className="text-muted-foreground">Select a game mode to start playing</p>
                </div>

                {!selectedMode ? (
                    // Step 1: Choose Local or Remote
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card 
                            className="cursor-pointer transition-all hover:scale-105 hover:bg-accent/50 border-2"
                            onClick={() => handleModeSelect("local")}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-center mb-4">
                                    <div className="p-4 rounded-full bg-blue-500/10">
                                        <Monitor className="h-12 w-12 text-blue-500" />
                                    </div>
                                </div>
                                <CardTitle className="text-center text-2xl">
                                    Local Play
                                </CardTitle>
                                <CardDescription className="text-center">
                                    Play on the same device
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-sm text-muted-foreground">
                                    Add temporary players • Single Match or Tournament
                                </p>
                            </CardContent>
                        </Card>

                        <Card 
                            className="cursor-pointer transition-all hover:scale-105 hover:bg-accent/50 border-2"
                            onClick={() => handleModeSelect("remote")}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-center mb-4">
                                    <div className="p-4 rounded-full bg-green-500/10">
                                        <Users className="h-12 w-12 text-green-500" />
                                    </div>
                                </div>
                                <CardTitle className="text-center text-2xl">
                                    Remote Play
                                </CardTitle>
                                <CardDescription className="text-center">
                                    Play online with friends
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-sm text-muted-foreground">
                                    Invite friends or matchmaking • Online multiplayer
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                ) : selectedMode === "local" ? (
                    // Step 2: Local Play Options
                    <div className="space-y-6">
                        <div className="flex items-center">
                            <Button 
                                variant="ghost" 
                                onClick={handleBack}
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Modes
                            </Button>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <Card 
                                className="cursor-pointer transition-all hover:scale-105 hover:bg-accent/50 border-2"
                                onClick={() => router.push("/game/local/single")}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-center mb-4">
                                        <div className="p-4 rounded-full bg-purple-500/10">
                                            <Gamepad2 className="h-10 w-10 text-purple-500" />
                                        </div>
                                    </div>
                                    <CardTitle className="text-center text-xl">
                                        Single Match
                                    </CardTitle>
                                    <CardDescription className="text-center">
                                        1v1 Dual
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-center text-sm text-muted-foreground">
                                        Quick match • First to 5 points wins
                                    </p>
                                </CardContent>
                            </Card>

                            <Card 
                                className="cursor-pointer transition-all hover:scale-105 hover:bg-accent/50 border-2"
                                onClick={() => router.push("/game/local/tournament")}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-center mb-4">
                                        <div className="p-4 rounded-full bg-yellow-500/10">
                                            <Trophy className="h-10 w-10 text-yellow-500" />
                                        </div>
                                    </div>
                                    <CardTitle className="text-center text-xl">
                                        Tournament
                                    </CardTitle>
                                    <CardDescription className="text-center">
                                        Bracket Elimination
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-center text-sm text-muted-foreground">
                                        4+ Players • Local Tournament Mode
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    // Remote Play Placeholder
                    <div className="space-y-6">
                        <div className="flex items-center">
                            <Button 
                                variant="ghost" 
                                onClick={handleBack}
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Modes
                            </Button>
                        </div>
                        
                        <Card className="border-dashed border-2">
                            <CardContent className="p-12 text-center space-y-4">
                                <div className="flex justify-center">
                                    <div className="p-4 rounded-full bg-muted">
                                        <Users className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-semibold">Remote Play Coming Soon</h3>
                                    <p className="text-muted-foreground">
                                        Online matchmaking and tournaments will be available in the next update.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
