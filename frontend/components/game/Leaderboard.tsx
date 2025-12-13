import { PlayerStanding } from "@/lib/tournament";
import { Trophy, TrendingUp, Target } from "lucide-react";

interface LeaderboardProps {
    standings: PlayerStanding[];
    currentUserId?: string;
}

export default function Leaderboard({ standings, currentUserId }: LeaderboardProps) {
    return (
        <div className="w-full bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 p-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Trophy className="h-6 w-6" />
                    Leaderboard
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rank</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Player</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                    <Trophy className="h-4 w-4" />
                                    Points
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">W-D-L</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                    <TrendingUp className="h-4 w-4" />
                                    Score Diff
                                </div>
                            </th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                    <Target className="h-4 w-4" />
                                    Total Pts
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {standings.map((standing, index) => {
                            const isCurrentUser = standing.playerId === currentUserId;
                            const isTop3 = index < 3;
                            
                            return (
                                <tr
                                    key={standing.playerId}
                                    className={`border-t border-gray-700 ${
                                        isCurrentUser ? 'bg-blue-900/30' : 'hover:bg-gray-750'
                                    }`}
                                >
                                    {/* Rank */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {index === 0 && <Trophy className="h-5 w-5 text-yellow-400" />}
                                            {index === 1 && <Trophy className="h-5 w-5 text-gray-400" />}
                                            {index === 2 && <Trophy className="h-5 w-5 text-amber-600" />}
                                            <span className={`font-bold ${isTop3 ? 'text-yellow-400' : 'text-white'}`}>
                                                #{standing.rank}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Player Name */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium">{standing.playerName}</span>
                                            {standing.isTemp && (
                                                <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                                                    Temp
                                                </span>
                                            )}
                                            {isCurrentUser && (
                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Match Points */}
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-xl font-bold text-green-400">
                                            {standing.matchPoints}
                                        </span>
                                    </td>

                                    {/* W-D-L */}
                                    <td className="px-4 py-3 text-center text-gray-300">
                                        <span className="text-green-400">{standing.wins}</span>-
                                        <span className="text-yellow-400">{standing.draws}</span>-
                                        <span className="text-red-400">{standing.losses}</span>
                                    </td>

                                    {/* Score Differential */}
                                    <td className="px-4 py-3 text-center">
                                        <span className={`font-semibold ${
                                            standing.scoreDifferential > 0 ? 'text-green-400' :
                                            standing.scoreDifferential < 0 ? 'text-red-400' :
                                            'text-gray-400'
                                        }`}>
                                            {standing.scoreDifferential > 0 && '+'}
                                            {standing.scoreDifferential}
                                        </span>
                                    </td>

                                    {/* Total Points Scored */}
                                    <td className="px-4 py-3 text-center text-gray-300 font-medium">
                                        {standing.totalPointsScored}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="bg-gray-750 p-4 text-sm text-gray-400">
                <p className="mb-2"><strong>Scoring:</strong> Win = 3 pts | Draw = 1 pt | Loss = 0 pts | Bye = 3 pts</p>
                <p><strong>Tie-breakers:</strong> 1) Match Points → 2) Score Differential → 3) Total Points Scored</p>
            </div>
        </div>
    );
}
