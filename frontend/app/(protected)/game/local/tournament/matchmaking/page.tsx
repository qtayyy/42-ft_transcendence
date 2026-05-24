"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    LOCAL_TOURNAMENT_MAX_PLAYERS,
    LOCAL_TOURNAMENT_MIN_PLAYERS,
} from "@/lib/local-play-validation";

export default function LocalTournamentMatchmakingPage() {
    const router = useRouter();

    const handleQuickStart = (players: number) => {
        if (players < LOCAL_TOURNAMENT_MIN_PLAYERS || players > LOCAL_TOURNAMENT_MAX_PLAYERS) {
            return;
        }
        const tournamentId = `local-tournament-quick-${players}p-${Date.now()}`;
        router.push(`/game/local/tournament/${tournamentId}`);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
            <Card className="w-full max-w-md border-2 border-orange-500/50 bg-gray-800/50">
                <CardHeader>
                    <CardTitle className="text-center text-2xl text-white">
                        Quick Tournament
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-center text-gray-300 mb-4">
                        Select number of players for quick start with default names
                    </p>
                    
                    <Button
                        onClick={() => handleQuickStart(4)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white text-lg py-6"
                    >
                        4 Players
                    </Button>
                    
                    <Button
                        onClick={() => handleQuickStart(8)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white text-lg py-6"
                    >
                        8 Players
                    </Button>
                    
                    <p className="text-center text-xs uppercase tracking-widest text-gray-400">
                        Supports {LOCAL_TOURNAMENT_MIN_PLAYERS}-{LOCAL_TOURNAMENT_MAX_PLAYERS} players
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
