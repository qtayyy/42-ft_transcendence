"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useLanguage } from "@/context/languageContext";


export default function DashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [userFound, setUserFound] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { gameRoom, onlineFriends } = useGame();

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
    <div className="bg-background p-4">
      {/* New Game Button - Centered at top */}
      <div className="flex justify-center mb-6">
        <Button size="lg" className="px-8 py-6 text-lg" onClick={handleNewGame}>
          {t.game.startGame}
        </Button>
      </div>
      {/* Main Content Area */}
      {userFound ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="p-10">
            <DialogHeader>
              <DialogTitle>{t.friends.addFriend}</DialogTitle>
              <DialogDescription>
                {t.friends.sendRequest}:
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
                {t.common.submit}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar - Friends Section */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">{t.nav.friends.toUpperCase()}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SearchBar searchUser={handleSearchUser}></SearchBar>
              {/* Online Friends */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase">{t.friends.online.toUpperCase()}</h3>
                <Card className="bg-muted/50 min-h-[150px]">
                  <CardContent className="p-4 space-y-2">
                    {onlineFriends.length !== 0 ? (
                      onlineFriends.map((friend, index) => (
                        <div
                          key={`${friend.id}-${index}`}
                          className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>{friend.username}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t.friends.online} - 0
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Offline Friends */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase">
                  {t.friends.offline.toUpperCase()}
                </h3>
                <Card className="bg-muted/50 min-h-[150px]">
                  <CardContent className="p-4 space-y-2">
                    {offlineFriends.length > 0 ? (
                      offlineFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                        >
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span>{friend.username}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t.friends.offline} - 0
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Content Panel - Activity & Tournament History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Activity Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t.profile.stats}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <p className="text-muted-foreground">Chart (placeholder)</p>
                </div>
              </CardContent>
            </Card>

            {/* Win-Loss Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t.profile.wins}-{t.profile.losses}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <p className="text-muted-foreground">
                    Pie chart on Win-Loss (Incl. total games) - Placeholder
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tournament History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">
                {t.game.tournament.toUpperCase()} {t.profile.matchHistory.toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tournaments.length > 0 ? (
                  tournaments.map((tournament) => (
                    <div
                      key={tournament.id}
                      className="p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            {t.game.tournament} ID:{" "}
                          </span>
                          <span className="font-medium">#{tournament.id}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date: </span>
                          <span className="font-medium">{tournament.date}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time: </span>
                          <span className="font-medium">{tournament.time}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {t.game.winner}:{" "}
                          </span>
                          <span className="font-medium text-primary">
                            {tournament.winner}
                          </span>
                        </div>
                        <div className="md:col-span-4">
                          <span className="text-muted-foreground">
                            Players:{" "}
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
                    {t.game.tournament} - 0
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
