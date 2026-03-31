"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap } from "lucide-react";

interface Stats {
  totalXP: number;
  level: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
}

export default function UserStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiFetch("/api/profile/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading || !stats) return <div className="text-muted-foreground">Loading...</div>;

  const nextLevelXP = 100 * (stats.level + 1) * stats.level;
  const currentLevelXP = 100 * stats.level * (stats.level - 1);
  const progress = Math.round(((stats.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100);

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
      <Card className="relative border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-3 rounded-xl bg-amber-500/10 mb-3">
            <Trophy className="h-8 w-8 text-amber-500" />
          </div>
          <CardTitle className="text-3xl font-bold">{stats.level}</CardTitle>
          <CardDescription>Current Level</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Experience</span>
              <span className="font-semibold">{stats.totalXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</span>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total XP</p>
              <p className="text-lg font-bold flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-amber-500" />
                {stats.totalXP}
              </p>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-lg font-bold">{stats.winRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="border-t border-border/40 pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Wins</span>
              <Badge variant="default" className="bg-green-600">{stats.totalWins}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Losses</span>
              <Badge variant="destructive">{stats.totalLosses}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Draws</span>
              <Badge variant="secondary">{stats.totalDraws}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
