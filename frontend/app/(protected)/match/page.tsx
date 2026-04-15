"use client";

import { useEffect, useState } from "react";
import { History, Trophy, Swords, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/context/languageContext";
import axios from "axios";
import Achievements from "@/components/game/Achievements";

type MatchResult = "win" | "loss" | "draw";

interface MatchEntry {
  id: number;
  opponent: string;
  opponentAvatar: string | null;
  playerScore: number;
  opponentScore: number;
  result: MatchResult;
  mode: string;
  date: string;
}

const RESULT_CONFIG: Record<
  MatchResult,
  { label: string; badgeClass: string; glowClass: string; Icon: React.ElementType }
> = {
  win: {
    label: "Win",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    glowClass: "from-emerald-500 to-green-500",
    Icon: TrendingUp,
  },
  loss: {
    label: "Loss",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
    glowClass: "from-red-500 to-orange-500",
    Icon: TrendingDown,
  },
  draw: {
    label: "Draw",
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    glowClass: "from-yellow-500 to-amber-500",
    Icon: Minus,
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MatchHistoryPage() {
  const { t } = useLanguage();
  const MODE_LABEL: Record<string, string> = {
    "local": t?.Dashboard?.["Local 1v1"] || "Local 1v1",
    "local-tournament": t?.Dashboard?.["Local Tournament"] || "Local Tournament",
    "remote": t?.Dashboard?.["Remote 1v1"] || "Remote 1v1",
    "remote-tournament": t?.Dashboard?.["Remote Tournament"] || "Remote Tournament",
    "ai": t?.Dashboard?.["vs AI"] || "vs AI",
  };
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await axios.get<MatchEntry[]>("/api/game/match-history");
        setMatches(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load match history.");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const wins = matches.filter((m) => m.result === "win").length;
  const losses = matches.filter((m) => m.result === "loss").length;
  const total = matches.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Page Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
            {t?.DropDown?.MatchHistory || "Match History"}
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
            {t?.["Leaderboard & Match History"]?.["Review your past matches and track your performance"] || "Review your past matches and track your performance"}
          </p>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="max-w-3xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t?.ResetPassword?.["Error"] || "Error"}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total Matches */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-violet-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500" />
            <Card className="relative border-0 bg-card/95 backdrop-blur-sm transition-all hover:scale-[1.02] text-center">
              <CardContent className="pt-6 pb-4">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                ) : (
                  <p className="text-4xl font-black text-foreground">{total}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1 font-medium">{t?.["Leaderboard & Match History"]?.["Total Matches"] || "Total Matches"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Wins */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500" />
            <Card className="relative border-0 bg-card/95 backdrop-blur-sm transition-all hover:scale-[1.02] text-center">
              <CardContent className="pt-6 pb-4">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                ) : (
                  <p className="text-4xl font-black text-emerald-400">{wins}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1 font-medium">{t?.Dashboard?.Wins || "Wins"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Losses */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500" />
            <Card className="relative border-0 bg-card/95 backdrop-blur-sm transition-all hover:scale-[1.02] text-center">
              <CardContent className="pt-6 pb-4">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                ) : (
                  <p className="text-4xl font-black text-red-400">{losses}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1 font-medium">{t?.Dashboard?.Losses || "Losses"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Win Rate */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500" />
            <Card className="relative border-0 bg-card/95 backdrop-blur-sm transition-all hover:scale-[1.02] text-center">
              <CardContent className="pt-6 pb-4">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                ) : (
                  <p className="text-4xl font-black text-yellow-400">{winRate}%</p>
                )}
                <p className="text-sm text-muted-foreground mt-1 font-medium">{t?.Dashboard?.["Win Rate"] || "Win Rate"}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Match List */}
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-violet-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500" />
          <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.005]">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Swords className="h-32 w-32 -mr-8 -mt-8" />
            </div>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2">{t?.["Leaderboard & Match History"]?.["Recent Matches"] || "Recent Matches"}</CardTitle>
                  <CardDescription className="text-base">
                    {loading
                      ? (t?.["Leaderboard & Match History"]?.["Loading your matches..."] || "Loading your matches...")
                      : `${total} ${total !== 1
                        ? (t?.["Leaderboard & Match History"]?.["matches played"] || "matches played")
                        : (t?.["Leaderboard & Match History"]?.["match played"] || "match played")}`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[460px] pr-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">{t?.["Leaderboard & Match History"]?.["Loading match history..."] || "Loading match history…"}</p>
                  </div>
                ) : matches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                    <Swords className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">{t?.["Leaderboard & Match History"]?.["No matches played yet"] || "No matches played yet"}</p>
                    <p className="text-xs">{t?.["Leaderboard & Match History"]?.["Play your first game to see your history here"] || "Play your first game to see your history here"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matches.map((match) => {
                      const cfg = RESULT_CONFIG[match.result] ?? RESULT_CONFIG.draw;
                      const ResultIcon = cfg.Icon;
                      return (
                        <div
                          key={match.id}
                          className="group/row relative flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all"
                        >
                          {/* Result stripe */}
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b ${cfg.glowClass}`}
                          />

                          {/* Opponent avatar */}
                          <Avatar className="h-10 w-10 shrink-0">
                            {match.opponentAvatar ? (
                              <AvatarImage src={match.opponentAvatar} />
                            ) : null}
                            <AvatarFallback className="text-sm font-bold">
                              {match.opponent[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Opponent name + mode */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {match.opponent}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {MODE_LABEL[match.mode] ?? match.mode} &middot; {formatDate(match.date)}
                            </p>
                          </div>

                          {/* Score */}
                          <div className="text-center shrink-0">
                            <p className="text-xl font-black tabular-nums tracking-tight">
                              <span
                                className={
                                  match.result === "win"
                                    ? "text-emerald-400"
                                    : match.result === "loss"
                                      ? "text-red-400"
                                      : "text-yellow-400"
                                }
                              >
                                {match.playerScore}
                              </span>
                              <span className="text-muted-foreground mx-1">:</span>
                              <span className="text-muted-foreground">{match.opponentScore}</span>
                            </p>
                          </div>

                          {/* Result badge */}
                          <div className="shrink-0">
                            <Badge
                              variant="outline"
                              className={`${cfg.badgeClass} flex items-center gap-1 px-3 py-1 font-semibold`}
                            >
                              <ResultIcon className="h-3 w-3" />
                              {t?.Dashboard?.[cfg.label] || cfg.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Achievements Section */}
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500" />
          <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{t?.["Leaderboard & Match History"]?.["Achievements"] || "Achievements"}</CardTitle>
              <CardDescription>{t?.["Leaderboard & Match History"]?.["Track your unlocked achievements as you progress"] || "Track your unlocked achievements as you progress"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Achievements />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
