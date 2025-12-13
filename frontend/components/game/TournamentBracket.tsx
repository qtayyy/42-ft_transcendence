import { Match, Player } from "@/lib/tournament";
import { Card } from "@/components/ui/card";
import { Trophy, User } from "lucide-react";

interface TournamentBracketProps {
    matches: Match[];
    currentMatchId: string | null;
}

export default function TournamentBracket({ matches, currentMatchId }: TournamentBracketProps) {
    // Group matches by round
    const matchesByRound = new Map<number, Match[]>();
    matches.forEach((match) => {
        const roundMatches = matchesByRound.get(match.round) || [];
        roundMatches.push(match);
        matchesByRound.set(match.round, roundMatches);
    });

    const rounds = Array.from(matchesByRound.keys()).sort((a, b) => a - b);
    const maxRound = Math.max(...rounds);

    const getRoundName = (round: number) => {
        const roundsToGo = maxRound - round;
        if (roundsToGo === 0) return "Final";
        if (roundsToGo === 1) return "Semi-Finals";
        if (roundsToGo === 2) return "Quarter-Finals";
        return `Round ${round}`;
    };

    const renderPlayer = (player: Player | null, isWinner: boolean) => {
        if (!player) {
            return (
                <div className="flex items-center gap-2 p-2 bg-gray-700 rounded text-gray-500">
                    <User className="h-4 w-4" />
                    <span className="text-sm">TBD</span>
                </div>
            );
        }

        return (
            <div
                className={`flex items-center gap-2 p-2 rounded transition-colors ${
                    isWinner
                        ? "bg-green-600 text-white font-semibold"
                        : "bg-gray-700 text-white"
                }`}
            >
                <User className="h-4 w-4" />
                <span className="text-sm">{player.name}</span>
                {isWinner && <Trophy className="h-4 w-4 ml-auto" />}
            </div>
        );
    };

    return (
        <div className="w-full overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max">
                {rounds.map((round) => {
                    const roundMatches = matchesByRound.get(round) || [];
                    
                    return (
                        <div key={round} className="flex flex-col gap-4 min-w-[250px]">
                            <h3 className="text-center text-lg font-bold text-white mb-2">
                                {getRoundName(round)}
                            </h3>
                            
                            {roundMatches.map((match) => (
                                <Card
                                    key={match.id}
                                    className={`p-3 space-y-2 transition-all ${
                                        match.id === currentMatchId
                                            ? "border-4 border-yellow-500 bg-yellow-900/20"
                                            : match.status === "completed"
                                            ? "border-2 border-green-500/50 bg-gray-800/50"
                                            : match.status === "ready"
                                            ? "border-2 border-blue-500/50 bg-gray-800/50"
                                            : "border-2 border-gray-600 bg-gray-800/30"
                                    }`}
                                >
                                    <div className="text-xs text-gray-400 text-center mb-1">
                                        Match #{match.matchNumber}
                                    </div>
                                    
                                    {renderPlayer(
                                        match.player1,
                                        match.winner?.id === match.player1?.id
                                    )}
                                    
                                    <div className="text-center text-xs text-gray-500">vs</div>
                                    
                                    {renderPlayer(
                                        match.player2,
                                        match.winner?.id === match.player2?.id
                                    )}
                                    
                                    {match.score && (
                                        <div className="text-center text-sm text-gray-400 mt-2 pt-2 border-t border-gray-600">
                                            Score: {match.score.player1} - {match.score.player2}
                                        </div>
                                    )}
                                    
                                    {match.id === currentMatchId && (
                                        <div className="text-center">
                                            <span className="inline-block px-2 py-1 bg-yellow-600 text-black text-xs font-bold rounded mt-2 animate-pulse">
                                                ACTIVE
                                            </span>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
