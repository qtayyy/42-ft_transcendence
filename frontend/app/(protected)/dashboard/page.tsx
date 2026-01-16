"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/search-bar";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useGame } from "@/hooks/use-game";
import { useLanguage } from '@/context/languageContext';
import { Users, BarChart3, PieChart, Trophy, Search, Zap, Activity } from "lucide-react";


export default function DashboardPage() {
  const router = useRouter();
  const [userFound, setUserFound] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { gameRoom, onlineFriends } = useGame();
  const { t } = useLanguage();

  const offlineFriends = [
    { id: 3, username: "Charlie" },
    { id: 4, username: "Diana" },
  ];
  const tournaments = [
    {
      id: 1,
      date: "2024-01-15",
      time: "14:30",
      players: "Alice, Bob, Charlie, Diana",
      winner: "Alice",
    },
    {
      id: 2,
      date: "2024-01-10",
      time: "10:00",
      players: "Bob, Charlie",
      winner: "Bob",
    },
  ];

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

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      {/* Default shadcn Chat Button */}
      <Button
        onClick={() => router.push('/chat')}
        aria-label="Go to Chat"
        variant="ghost"
        className="fixed bottom-8 right-8 z-50 rounded-full text-5xl p-0 h-auto w-auto bg-transparent hover:bg-transparent"
      >
        💬
      </Button>

      {/* Main Content */}
      <div className="w-full max-w-7xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4 ring-1 ring-primary/20">
            <Zap className="h-6 w-6 text-primary animate-pulse" />
          </div>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Friends Section */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-500"></div>
            <Card className="relative h-full border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="h-32 w-32 -mr-8 -mt-8" />
              </div>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-4 rounded-2xl bg-blue-500/10 mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <Users className="h-10 w-10 text-blue-500" />
                </div>
                <CardTitle className="text-3xl font-bold">{t.Dashboard.Friends}</CardTitle>
                <CardDescription className="text-base">{t.Dashboard["Connect & Play Together"]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SearchBar searchUser={handleSearchUser}></SearchBar>
                {/* Online Friends */}
                <div>
                  <h3 className="font-semibold mb-2 text-sm uppercase text-center">{t.Dashboard.Online}</h3>
                  <div className="bg-muted/30 backdrop-blur-sm border border-border/50 rounded-lg min-h-[120px] p-4 space-y-2">
                    {onlineFriends.length !== 0 ? (
                      onlineFriends.map((friend, index) => (
                        <div
                          key={`${friend.id}-${index}`}
                          className="flex items-center gap-2 p-2 hover:bg-accent/50 rounded-md cursor-pointer transition-colors"
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
                <Card className="relative cursor-pointer border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BarChart3 className="h-32 w-32 -mr-8 -mt-8" />
                  </div>
                  <CardHeader className="text-center">
                    <div className="mx-auto p-3 rounded-xl bg-purple-500/10 mb-3">
                      <Activity className="h-8 w-8 text-purple-500" />
                    </div>
                    <CardTitle className="text-2xl">{t.Dashboard.Activity}</CardTitle>
                    <CardDescription>{t.Dashboard["Your Game Activity"]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                      <p className="text-muted-foreground text-sm">{t.Dashboard["Chart (placeholder)"]}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Win-Loss Pie Chart */}
              <div className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
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
                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                      <p className="text-muted-foreground text-sm text-center px-4">
                        {t.Dashboard["Pie chart on Win-Loss (Incl. total games) - Placeholder"]}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tournament History */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500"></div>
              <Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden transition-all hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Trophy className="h-32 w-32 -mr-8 -mt-8" />
                </div>
                <CardHeader className="text-center">
                  <div className="mx-auto p-3 rounded-xl bg-yellow-500/10 mb-3">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                  </div>
                  <CardTitle className="text-2xl">{t.Dashboard["Tournament History"]}</CardTitle>
                  <CardDescription>{t.Dashboard["Your Tournament Records"]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {tournaments.length > 0 ? (
                      tournaments.map((tournament) => (
                        <div
                          key={tournament.id}
                          className="p-4 border border-border/50 rounded-lg hover:bg-accent/50 hover:border-primary/20 transition-all duration-300 hover:scale-[1.01] bg-muted/20"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                {t.Dashboard["Tournament ID:"]}{" "}
                              </span>
                              <span className="font-medium">#{tournament.id}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{t.Dashboard.Date}: </span>
                              <span className="font-medium">{tournament.date}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">{t.Dashboard.Time}: </span>
                              <span className="font-medium">{tournament.time}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                {t.Dashboard.Winner}:{" "}
                              </span>
                              <span className="font-medium text-primary">
                                {tournament.winner}
                              </span>
                            </div>
                            <div className="md:col-span-4">
                              <span className="text-muted-foreground">
                                {t.Dashboard.Player}:{" "}
                              </span>
                              <span className="font-medium">
                                {tournament.players}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        {t.Dashboard["Tournament History"]}
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