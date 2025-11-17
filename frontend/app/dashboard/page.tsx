"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // hardcoded data - replace with API calls later
  const onlineFriends = [
    { id: 1, username: "Alice" },
    { id: 2, username: "Bob" },
  ];
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

  return (
    <div className="min-h-screen bg-background p-4">
      {/* New Game Button - Centered at top */}
      <div className="flex justify-center mb-6">
        <Button size="lg" className="px-8 py-6 text-lg" onClick={() => router.push("/game/create")}>
          New Game
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar - Friends Section */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold">FRIENDS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <Input
                type="text"
                placeholder="Search bar (add friend)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />

              {/* Online Friends */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase">ONLINE</h3>
                <Card className="bg-muted/50 min-h-[150px]">
                  <CardContent className="p-4 space-y-2">
                    {onlineFriends.length > 0 ? (
                      onlineFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>{friend.username}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No friends online</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Offline Friends */}
              <div>
                <h3 className="font-semibold mb-2 text-sm uppercase">OFFLINE</h3>
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
                      <p className="text-muted-foreground text-sm">No friends offline</p>
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
                <CardTitle>Activity</CardTitle>
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
                <CardTitle>Win-Loss</CardTitle>
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
              <CardTitle className="text-xl font-bold">TOURNAMENT HISTORY</CardTitle>
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
                          <span className="text-muted-foreground">Tournament ID: </span>
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
                          <span className="text-muted-foreground">Winner: </span>
                          <span className="font-medium text-primary">{tournament.winner}</span>
                        </div>
                        <div className="md:col-span-4">
                          <span className="text-muted-foreground">Players: </span>
                          <span className="font-medium">{tournament.players}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No tournament history available
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
