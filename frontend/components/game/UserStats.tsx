"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap } from "lucide-react";
import { useLanguage } from '@/context/languageContext';

interface Stats {
  totalXP: number;
  level: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
}

export default function UserStats() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await axios.get("/api/profile/stats");
        setStats(res.data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  if (loading || !stats) return <div className="text-muted-foreground">{t.Dashboard["Loading..."]}</div>;

  const nextLevelXP = 100 * (stats.level + 1) * stats.level;
  const currentLevelXP = 100 * stats.level * (stats.level - 1);
  const progress = Math.round(((stats.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100);

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
      <Card className="relative h-full border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Trophy className="h-32 w-32 -mr-8 -mt-8" />
        </div>
        <CardHeader className="text-center pb-2">
          <div className="mx-auto p-4 rounded-2xl bg-amber-500/10 mb-4 group-hover:bg-amber-500/20 transition-colors">
            <Trophy className="h-10 w-10 text-amber-500" />
          </div>
          <CardTitle className="text-3xl font-bold">{stats.level}</CardTitle>
          <CardDescription className="text-base">{t.Dashboard["Current Level"]}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.Dashboard["Experience"]}</span>
              <span className="font-semibold">{stats.totalXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</span>
            </div>
            <div className="w-full bg-muted/30 backdrop-blur-sm rounded-full h-3 overflow-hidden border border-border/50">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase">{t.Dashboard["Total XP"]}</p>
              <p className="text-lg font-bold flex items-center justify-center gap-1">
                <Zap className="h-4 w-4 text-amber-500" />
                {stats.totalXP}
              </p>
            </div>
            <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground font-medium uppercase">{t.Dashboard["Win Rate"]}</p>
              <p className="text-lg font-bold">{stats.winRate.toFixed(1)}%</p>
            </div>
          </div>

          <div className="border-t border-border/40 pt-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t.Dashboard["Wins"]}</span>
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">{stats.totalWins}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t.Dashboard["Losses"]}</span>
              <Badge variant="destructive" className="hover:bg-red-600">{stats.totalLosses}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t.Dashboard["Draws"]}</span>
              <Badge variant="secondary" className="hover:bg-secondary/80">{stats.totalDraws}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
