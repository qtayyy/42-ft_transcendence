"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, UserPlus, X, Play, ArrowLeft, Trophy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

    const canStartTournament = totalPlayers >= 3 && totalPlayers <= 8;

    const handleStartTournament = async () => {
        if (!canStartTournament) return;

        try {
            // Build full player list
            const allPlayers = [
                { id: user?.id || 'user', name: user?.username || "You", isTemp: false },
                ...tempPlayers.map((p, i) => ({ id: `temp-${Date.now()}-${i}`, name: p.name, isTemp: true }))
            ];

            // Create tournament via backend
            const response = await axios.post("/api/tournament/create", {
                players: allPlayers
            });

            const { tournamentId } = response.data;

            // Navigate to tournament page
            router.push(`/game/local/tournament/${tournamentId}`);
        } catch (error) {
            console.error("Failed to create tournament:", error);
            alert("Failed to create tournament. Please try again.");
        }
    };

    return (
        <div className="container mx-auto max-w-3xl px-6 flex flex-col justify-center min-h-[calc(100vh-12rem)]">
            <div className="mb-6">
                <Button 
                    variant="ghost" 
                    onClick={() => router.push("/game/new")}
                    className="gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Modes
                </Button>
            </div>

            <Card className="border-2 shadow-lg">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl flex items-center justify-center gap-2">
                        <Trophy className="h-8 w-8 text-yellow-500" />
                        Local Tournament
                    </CardTitle>
                    <CardDescription>
                        Set up a local tournament for 3-8 players
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Player List */}
                    <div className="space-y-4">
                        <Label className="text-lg font-semibold">
                            Players ({totalPlayers})
                        </Label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Account User (Always present) */}
                            <div className="flex items-center gap-3 p-3 bg-primary/5 border rounded-lg">
                                <div className="p-2 bg-primary/10 rounded-full">
                                    <User className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{user?.username || "Account User"}</p>
                                    <p className="text-xs text-muted-foreground">Account Player</p>
                                </div>
                            </div>

                            {/* Temporary Players */}
                            {tempPlayers.map((player, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-secondary/50 border rounded-lg group">
                                    <div className="p-2 bg-secondary rounded-full">
                                        <User className="h-4 w-4 text-secondary-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{player.name}</p>
                                        <p className="text-xs text-muted-foreground">Guest</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveTempPlayer(index)}
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-70 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Player Input */}
                    <div className="space-y-3">
                        <Label>Add Guest Player</Label>
                        <div className="flex gap-3">
                            <Input
                                placeholder="Enter player name..."
                                value={tempPlayerName}
                                onChange={(e) => setTempPlayerName(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && handleAddTempPlayer()}
                                className="h-11"
                            />
                            <Button
                                onClick={handleAddTempPlayer}
                                disabled={!tempPlayerName.trim() || totalPlayers >= 8}
                                className="h-11 px-6"
                            >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Guest players are temporary for this session only.
                        </p>
                    </div>

                    {/* Tournament Status Info */}
                    <Alert variant={canStartTournament ? "default" : "destructive"} className={canStartTournament ? "border-green-500/50 bg-green-500/10" : ""}>
                         <div className="flex items-center gap-2">
                             {canStartTournament ? (
                                 <Trophy className="h-4 w-4 text-green-500" />
                             ) : (
                                 <AlertDescription className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                 </AlertDescription>
                             )}
                            <AlertTitle className={canStartTournament ? "text-green-600 dark:text-green-400 mb-0" : "mb-0"}>
                                {totalPlayers < 3 ? (
                                    `Need ${3 - totalPlayers} more player${3 - totalPlayers === 1 ? '' : 's'} to start`
                                ) : totalPlayers > 8 ? (
                                    `Maximum 8 players allowed (remove ${totalPlayers - 8})`
                                ) : (
                                    `Ready! Format: ${totalPlayers <= 4 ? 'Round Robin' : 'Swiss System'}`
                                )}
                            </AlertTitle>
                        </div>
                    </Alert>

                    {/* Start Button */}
                    <Button
                        onClick={handleStartTournament}
                        disabled={!canStartTournament}
                        size="lg"
                        className="w-full text-lg h-14"
                    >
                        <Play className="mr-2 h-5 w-5" />
                        Start Tournament
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
