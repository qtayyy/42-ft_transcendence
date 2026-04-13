"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Crown, Medal } from "lucide-react";
import { useLanguage } from '@/context/languageContext';

interface Player {
  rank: number;
  userId: number;
  username: string;
  avatar: string | null;
  level: number;
  totalXP: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
}

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const LIMIT = 50;

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        const res = await axios.get(`/api/leaderboard?limit=${LIMIT}&offset=${offset}`);
        setLeaderboard(res.data.leaderboard);
      } catch (error) {
        console.error("Failed to load leaderboard", error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [offset]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  const getMedal = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
    return null;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="h-10 w-10 text-primary" />
            <h1 className="text-5xl font-black">{t["Leaderboard & Match History"]["Leaderboard"]}</h1>
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <p className="text-xl text-muted-foreground">{t["Leaderboard & Match History"]["Top players ranked by level and XP"]}</p>
        </div>

        <Card className="border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{t["Leaderboard & Match History"]["Player Rankings"]}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">{t["Leaderboard & Match History"]["Rank"]}</th>
                    <th className="text-left py-3 px-4 font-semibold">{t["Leaderboard & Match History"]["Player"]}</th>
                    <th className="text-center py-3 px-4 font-semibold">{t["Leaderboard & Match History"]["Level"]}</th>
                    <th className="text-center py-3 px-4 font-semibold">{t["Leaderboard & Match History"]["XP"]}</th>
                    <th className="text-center py-3 px-4 font-semibold">{t["Leaderboard & Match History"]["W/L/D"]}</th>
                    <th className="text-center py-3 px-4 font-semibold">{t["Leaderboard & Match History"]["Win Rate"]}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p) => (
                    <tr key={p.userId} className="border-b hover:bg-muted/20">
                      <td className="py-3 px-4 font-bold flex items-center gap-2">
                        {getMedal(p.rank)}
                        #{p.rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar || undefined} />
                            <AvatarFallback>{p.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {p.username}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="secondary">Lv. {p.level}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">{p.totalXP.toLocaleString()}</td>
                      <td className="py-3 px-4 text-center text-xs">
                        <div className="flex justify-center gap-2">
                          <Badge variant="default" className="bg-green-600">{p.totalWins}W</Badge>
                          <Badge variant="destructive">{p.totalLosses}L</Badge>
                          <Badge variant="outline">{p.totalDraws}D</Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">{p.winRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
            className="px-4 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted disabled:opacity-50"
          >
            {t["Leaderboard & Match History"]["Previous"]}
          </button>
          <div className="flex items-center text-sm text-muted-foreground">
            {t["Leaderboard & Match History"]["Page"]} {Math.floor(offset / LIMIT) + 1}
          </div>
          <button
            onClick={() => setOffset(offset + LIMIT)}
            className="px-4 py-2 rounded-lg border border-border/50 bg-card hover:bg-muted"
          >
            {t["Leaderboard & Match History"]["Next"]}
          </button>
        </div>
      </div>
    </div>
  );
}
