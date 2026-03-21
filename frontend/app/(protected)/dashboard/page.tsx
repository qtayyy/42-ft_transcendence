"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import SearchBar from "@/components/search-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGame } from "@/hooks/use-game";
import { useLanguage } from '@/context/languageContext';
import { Users, BarChart3, PieChart, Trophy, Activity, MessageCircle, Clock, Calendar, Download, FileSpreadsheet, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useFriends } from "@/hooks/use-friends";
import { Badge } from "@/components/ui/badge";

interface MatchEntry {
  id: number;
  opponent: string;
  playerScore: number;
  opponentScore: number;
  result: "win" | "loss" | "draw";
  mode: string;
  durationSeconds?: number | null;
  date: string;
}

const MODE_LABEL: Record<string, string> = {
  local: "Local 1v1",
  "local-tournament": "Local Tournament",
  remote: "Remote 1v1",
  "remote-tournament": "Remote Tournament",
  ai: "vs AI",
};


export default function DashboardPage() {
  const router = useRouter();
  const [userFound, setUserFound] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchEntry[]>([]);
  const [recentMatchesLoading, setRecentMatchesLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss" | "draw">("all");
  const [showAnalyticsControls, setShowAnalyticsControls] = useState(false);
  const { onlineFriends } = useGame();
  const { t } = useLanguage();
  const { friends: allFriends } = useFriends();

  const escapeCsvCell = (value: string | number | null | undefined) => {
    const safeValue = value == null ? "" : String(value);
    return `"${safeValue.replace(/"/g, '""')}"`;
  };

  const setQuickRange = (days: number) => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - (days - 1));
    setFromDate(start.toISOString().slice(0, 10));
    setToDate(now.toISOString().slice(0, 10));
  };

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setModeFilter("all");
    setResultFilter("all");
  };

  // Calculate offline friends by filtering out online friends
  const offlineFriends = allFriends.filter(
    friend => !onlineFriends.some(onlineFriend => String(onlineFriend.id) === String(friend.id))
  );
  useEffect(() => {
    async function fetchRecentMatches() {
      try {
        const response = await axios.get<MatchEntry[]>("/api/game/match-history");
        setMatchHistory(response.data || []);
      } catch (error) {
        console.error("Failed to load recent matches", error);
        setMatchHistory([]);
      } finally {
        setRecentMatchesLoading(false);
      }
    }

    fetchRecentMatches();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch("/api/chat/unread");
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) {
          setUnreadCount(Number(data?.unreadCount) || 0);
        }
      } catch (error) {
        console.error("Failed to load unread chat count", error);
      }
    };

    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  async function handleSearchUser(query) {
    try {
      setUserFound("");
      const res = await axios.get(`/api/friends/search?user=${query}`);
      setUserFound(res.data);
      setDialogOpen(true);
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      alert(backendError || "Something went wrong. Please try again later.");
    }
  }

  async function sendFriendRequest() {
    try {
      const res = await axios.post("/api/friends/request", {
        username: userFound,
      });
      setDialogOpen(false);
      alert(JSON.stringify(res.data.message));
    } catch (error: any) {
      const backendError = error.response?.data?.error;
      alert(backendError || "Something went wrong. Please try again later.");
    }
  }

  // async function handleNewGame() {
  //   if (gameRoom) router.push(`/game/room/${gameRoom.roomId}`);
  //   else {
  //     try {
  //       const res = await axios.get("/api/game/room/create");
  //       const roomId = res.data.roomId;
  //       router.push(`/game/room/${roomId}`);
  //     } catch (error: any) {
  //       const backendError = error.response?.data?.error;
  //       alert(backendError || "Something went wrong. Please try again later.");
  //     }
  //   }
  // }

  async function handleNewGame() {
    try {
      router.push("/game/new");
    } catch (error) {
      console.error(error);
    }
  }

  function handleFriendsNavigation() {
    router.push("/friend-request");
  }

  function handleMatchHistoryNavigation() {
    router.push("/match");
  }

  const filteredMatchHistory = matchHistory.filter((match) => {
    const matchDate = new Date(match.date);
    const fromBoundary = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const toBoundary = toDate ? new Date(`${toDate}T23:59:59.999`) : null;

    const withinFrom = !fromBoundary || matchDate >= fromBoundary;
    const withinTo = !toBoundary || matchDate <= toBoundary;
    const modeMatches = modeFilter === "all" || match.mode === modeFilter;
    const resultMatches = resultFilter === "all" || match.result === resultFilter;

    return withinFrom && withinTo && modeMatches && resultMatches;
  });

  const sortedFilteredMatches = [...filteredMatchHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const recentMatches = sortedFilteredMatches.slice(0, 3);
  const modeOptions = Array.from(new Set(matchHistory.map((match) => match.mode)));

  const handleExportCsv = () => {
    if (sortedFilteredMatches.length === 0) {
      alert("No filtered data to export.");
      return;
    }

    const headers = [
      "Match ID",
      "Date",
      "Mode",
      "Opponent",
      "Result",
      "Player Score",
      "Opponent Score",
      "Duration (seconds)",
    ];

    const rows = sortedFilteredMatches.map((match) => [
      match.id,
      new Date(match.date).toLocaleString(),
      MODE_LABEL[match.mode] || match.mode,
      match.opponent,
      match.result,
      match.playerScore,
      match.opponentScore,
      match.durationSeconds ?? "",
    ]);

    const csvText = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");

    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (sortedFilteredMatches.length === 0) {
      alert("No filtered data to export.");
      return;
    }

    const filtersSummary = [
      fromDate ? `From: ${fromDate}` : "From: Any",
      toDate ? `To: ${toDate}` : "To: Any",
      `Mode: ${modeFilter === "all" ? "All" : MODE_LABEL[modeFilter] || modeFilter}`,
      `Result: ${resultFilter === "all" ? "All" : resultFilter}`,
    ].join(" | ");

    const rowsHtml = sortedFilteredMatches
      .map(
        (match) => `
          <tr>
            <td>${match.id}</td>
            <td>${new Date(match.date).toLocaleString()}</td>
            <td>${MODE_LABEL[match.mode] || match.mode}</td>
            <td>${match.opponent}</td>
            <td style="text-transform: capitalize;">${match.result}</td>
            <td>${match.playerScore}</td>
            <td>${match.opponentScore}</td>
          </tr>
        `,
      )
      .join("");

    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      alert("Unable to open print window. Please allow popups and try again.");
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Dashboard Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 8px; }
            p { margin: 0 0 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Dashboard Match Export</h1>
          <p>Generated at: ${new Date().toLocaleString()}</p>
          <p>${filtersSummary}</p>
          <table>
            <thead>
              <tr>
                <th>Match ID</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Opponent</th>
                <th>Result</th>
                <th>Player Score</th>
                <th>Opponent Score</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  // ── Activity chart data ─────────────────────────────────────────────
  const [activityView, setActivityView] = useState<"day" | "week" | "month">("week");

  const activityBars = (() => {
    const now = new Date();

    if (activityView === "day") {
      // Last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const label = d.toLocaleDateString(undefined, { weekday: "short" });
        const count = filteredMatchHistory.filter((m) => {
          const md = new Date(m.date);
          return md.toDateString() === d.toDateString();
        }).length;
        return { label, count };
      });
    }

    if (activityView === "week") {
      // Last 8 weeks
      return Array.from({ length: 8 }, (_, i) => {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() - (7 - i) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const count = filteredMatchHistory.filter((m) => {
          const md = new Date(m.date);
          return md >= weekStart && md <= weekEnd;
        }).length;
        return { label, count };
      });
    }

    // month — last 6 months
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString(undefined, { month: "short" });
      const count = filteredMatchHistory.filter((m) => {
        const md = new Date(m.date);
        return md.getFullYear() === d.getFullYear() && md.getMonth() === d.getMonth();
      }).length;
      return { label, count };
    });
  })();

  const maxActivityCount = Math.max(...activityBars.map((b) => b.count), 1);

  const lastPlayed = sortedFilteredMatches.length > 0 ? new Date(sortedFilteredMatches[0].date) : null;
  // ── End activity chart data ─────────────────────────────────────────

  const wins = filteredMatchHistory.filter((match) => match.result === "win").length;
  const losses = filteredMatchHistory.filter((match) => match.result === "loss").length;
  const draws = filteredMatchHistory.filter((match) => match.result === "draw").length;
  const totalGames = filteredMatchHistory.length;
  const totalTrackedSeconds = filteredMatchHistory.reduce(
    (sum, match) => sum + (match.durationSeconds ?? 0),
    0,
  );
  const totalTrackedMinutes = Math.round(totalTrackedSeconds / 60);

  const winPercentage = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const lossPercentage = totalGames > 0 ? (losses / totalGames) * 100 : 0;
  const drawPercentage = totalGames > 0 ? (draws / totalGames) * 100 : 0;

  const winSegmentEnd = winPercentage;
  const lossSegmentEnd = winPercentage + lossPercentage;
  const pieBackground = `conic-gradient(#22c55e 0% ${winSegmentEnd}%, #ef4444 ${winSegmentEnd}% ${lossSegmentEnd}%, #f59e0b ${lossSegmentEnd}% 100%)`;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      {/* Floating Chat Button - Modern Design */}
      <div className="fixed bottom-8 right-8 z-50 group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-60 group-hover:opacity-100 transition duration-300 animate-pulse"></div>
        <Button
          onClick={() => router.push('/chat')}
          aria-label="Go to Chat"
          size="lg"
          className="relative rounded-2xl shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:scale-105 flex items-center gap-3 px-6 py-6 bg-card border border-border/50 text-foreground hover:bg-card/90"
        >
          <MessageCircle className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Chat</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1 animate-bounce">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-7xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-white via-primary/50 to-white bg-clip-text text-transparent pb-2">
            {t.Dashboard.Dashboard}
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
            {t.Dashboard["Track your progress. Connect with friends. Dominate the leaderboard."]}
          </p>
        </div>

        {/* New Game Button */}
        <div className="flex justify-center">
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <Button 
              size="lg" 
              variant="default"
              className="relative px-8 py-6 text-lg hover:scale-[1.02] transition-all duration-300 font-bold shadow-lg" 
              onClick={handleNewGame}
            >
              {t.Dashboard["New Game"]}
            </Button>
          </div>
        </div>

        <div className="w-full max-w-6xl mx-auto space-y-3">
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowAnalyticsControls((prev) => !prev)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {showAnalyticsControls ? "Hide Filters & Export" : "Show Filters & Export"}
              {showAnalyticsControls ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {showAnalyticsControls && (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
              <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Download className="h-6 w-6 text-sky-500" />
                    Analytics Controls
                  </CardTitle>
                  <CardDescription>
                    Custom date range and filters for dashboard stats, with CSV/PDF export.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">From</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">To</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Mode</label>
                      <select
                        value={modeFilter}
                        onChange={(e) => setModeFilter(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="all">All modes</option>
                        {modeOptions.map((mode) => (
                          <option key={mode} value={mode}>
                            {MODE_LABEL[mode] || mode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-medium">Result</label>
                      <select
                        value={resultFilter}
                        onChange={(e) => setResultFilter(e.target.value as "all" | "win" | "loss" | "draw")}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="all">All results</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="draw">Draw</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button variant="outline" className="w-full" onClick={clearFilters}>
                        Reset Filters
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setQuickRange(7)}>Last 7 days</Button>
                    <Button variant="secondary" size="sm" onClick={() => setQuickRange(30)}>Last 30 days</Button>
                    <Button variant="secondary" size="sm" onClick={() => setQuickRange(90)}>Last 90 days</Button>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>All time</Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Badge variant="secondary" className="px-3 py-1">
                      {sortedFilteredMatches.length} match{sortedFilteredMatches.length === 1 ? "" : "es"} in current view
                    </Badge>
                    <Button onClick={handleExportCsv} disabled={sortedFilteredMatches.length === 0} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportPdf} disabled={sortedFilteredMatches.length === 0} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Export PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Friends Section */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
            <Card className="relative h-full border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="h-32 w-32 -mr-8 -mt-8" />
              </div>
              <CardHeader
                className="text-center pb-2 cursor-pointer"
                onClick={handleFriendsNavigation}
              >
                <div className="mx-auto p-4 rounded-2xl bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <Users className="h-10 w-10 text-blue-500" />
                </div>
                <CardTitle className="text-3xl font-bold">{t.Dashboard.Friends}</CardTitle>
                <CardDescription className="text-base">{t.Dashboard["Connect & Play Together"]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Online Friends */}
                <div>
                  <h3 className="font-semibold mb-2 text-sm uppercase text-center">{t.Dashboard.Online}</h3>
                  <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg min-h-[120px] p-4 space-y-2">
                    {onlineFriends.length !== 0 ? (
                      onlineFriends.map((friend, index) => (
                        <div
                          key={`${friend.id}-${index}`}
                          className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-md cursor-pointer transition-colors"
                          onClick={handleFriendsNavigation}
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm">{friend.username}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        {t.Dashboard.Friends} {t.Dashboard.Offline}
                      </p>
                    )}
                  </div>
                </div>

                {/* Offline Friends */}
                <div>
                  <h3 className="font-semibold mb-2 text-sm uppercase text-center">
                    {t.Dashboard.Offline}
                  </h3>
                  <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg min-h-[120px] p-4 space-y-2">
                    {offlineFriends.length > 0 ? (
                      offlineFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-md cursor-pointer transition-colors"
                          onClick={handleFriendsNavigation}
                        >
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-sm">{friend.username}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        {t.Dashboard.Friends} {t.Dashboard.Offline}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity & Win-Loss Charts */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Activity Bar Chart */}
              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
                <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BarChart3 className="h-32 w-32 -mr-8 -mt-8" />
                  </div>
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto p-3 rounded-xl bg-purple-500/10 mb-3">
                      <Activity className="h-8 w-8 text-purple-500" />
                    </div>
                    <CardTitle className="text-2xl">{t.Dashboard.Activity}</CardTitle>
                    <CardDescription>{t.Dashboard["Your Game Activity"]}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* View toggle */}
                    <div className="flex justify-center gap-1 bg-muted/40 rounded-lg p-1">
                      {(["day", "week", "month"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setActivityView(v)}
                          className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-all capitalize ${
                            activityView === v
                              ? "bg-card shadow text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v === "day" ? "7 Days" : v === "week" ? "8 Wks" : "6 Mo"}
                        </button>
                      ))}
                    </div>

                    {/* Bar chart */}
                    {recentMatchesLoading ? (
                      <p className="text-muted-foreground text-center text-xs py-4">Loading...</p>
                    ) : (
                      <div className="flex items-end justify-between gap-1 h-28 px-1">
                        {activityBars.map((bar, i) => (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {bar.count > 0 ? bar.count : ""}
                            </span>
                            <div
                              className="w-full rounded-t-sm bg-purple-500/70 transition-all duration-500"
                              style={{ height: `${(bar.count / maxActivityCount) * 80}%`, minHeight: bar.count > 0 ? "4px" : "2px", opacity: bar.count === 0 ? 0.2 : 1 }}
                            />
                            <span className="text-[9px] text-muted-foreground truncate w-full text-center">{bar.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="border-t border-border/40 pt-2 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium text-foreground">Last played:</span>
                        {lastPlayed
                          ? lastPlayed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                          : "Never"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium text-foreground">Total minutes:</span>
                        {totalTrackedMinutes} min
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Win-Loss Pie Chart */}
              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-10 group-hover:opacity-30 transition duration-500"></div>
                <Card className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <PieChart className="h-32 w-32 -mr-8 -mt-8" />
                  </div>
                  <CardHeader className="text-center">
                    <div className="mx-auto p-3 rounded-xl bg-green-500/10 mb-3">
                      <PieChart className="h-8 w-8 text-green-500" />
                    </div>
                    <CardTitle className="text-2xl">{t.Dashboard["Win-Loss"]}</CardTitle>
                    <CardDescription>{t.Dashboard["Performance Stats"]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center rounded-lg bg-muted/20 border border-border/50 p-4">
                      {recentMatchesLoading ? (
                        <p className="text-muted-foreground text-sm">Loading stats...</p>
                      ) : totalGames === 0 ? (
                        <p className="text-muted-foreground text-sm text-center px-4">No matches yet.</p>
                      ) : (
                        <div className="w-full flex items-center justify-center gap-6">
                          <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: pieBackground }}>
                            <div className="absolute inset-4 rounded-full bg-card flex items-center justify-center border border-border/60">
                              <div className="text-center leading-tight">
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="text-base font-bold">{totalGames}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <p className="font-medium flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                              Win: {wins} ({winPercentage.toFixed(1)}%)
                            </p>
                            <p className="font-medium flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                              Loss: {losses} ({lossPercentage.toFixed(1)}%)
                            </p>
                            <p className="font-medium flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                              Draw: {draws} ({drawPercentage.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tournament History */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
              <Card
                className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.01]"
                onClick={handleMatchHistoryNavigation}
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Trophy className="h-32 w-32 -mr-8 -mt-8" />
                </div>
                <CardHeader className="text-center">
                  <div className="mx-auto p-3 rounded-xl bg-yellow-500/10 mb-3">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                  </div>
                  <CardTitle className="text-2xl">Recent Game History</CardTitle>
                  <CardDescription>Top 3 latest matches from your full history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentMatchesLoading ? (
                      <p className="text-muted-foreground text-center py-8">Loading recent matches...</p>
                    ) : recentMatches.length > 0 ? (
                      recentMatches.map((match) => (
                        <div
                          key={match.id}
                          className="p-4 border border-border/50 rounded-lg hover:bg-accent/50 hover:border-primary/20 transition-all duration-300 hover:scale-[1.01] bg-muted/20"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Match ID:{" "}
                              </span>
                              <span className="font-medium">#{match.id}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date: </span>
                              <span className="font-medium">
                                {new Date(match.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Mode: </span>
                              <span className="font-medium">{MODE_LABEL[match.mode] || match.mode}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Result: </span>
                              <span className="font-medium text-primary capitalize">{match.result}</span>
                            </div>
                            <div className="md:col-span-4">
                              <span className="text-muted-foreground">Overview: </span>
                              <span className="font-medium">
                                You {match.playerScore} - {match.opponentScore} {match.opponent}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No matches yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Friend Request Dialog */}
      {userFound ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="p-10">
            <DialogHeader>
              <DialogTitle>{t.Dashboard.Friends}</DialogTitle>
              <DialogDescription>
                Click &lsquo;{t.Setting.Save}&rsquo; to send a friend request to:
              </DialogDescription>
              <p className="text-4xl">{userFound}</p>
            </DialogHeader>
            <div className="grid place-items-center"></div>
            <div className="grid justify-end">
              <Button
                className="w-40"
                variant="default"
                onClick={sendFriendRequest}
              >
                {t.chat.Send}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
