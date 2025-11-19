"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";


interface Match {
  id: string;
  tournamentId: string;
  date: string;
  time: string;
  players: string[];
  winner: string;
  matches: {
    matchNumber: number;
    alice: {
      scores: number;
      maxStreak: number;
      scoreHistory: number[];
    };
    bob: {
      scores: number;
      maxStreak: number;
      scoreHistory: number[];
    };
  }[];
}

export default function MatchHistoryPage() {
  const [tournaments, setTournaments] = useState<Match[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Match | null>(null);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);


  useEffect(() => {
    // Simulated API data ( replace later once qtay done)
    const mockData: Match[] = [
      {
        id: "1",
        tournamentId: "#12345",
        date: "28/10/2025",
        time: "14:30",
        players: ["Alice", "Bob"],
        winner: "Alice",
        matches: [
          {
            matchNumber: 1,
            alice: {
              scores: 10,
              maxStreak: 2,
              scoreHistory: [0, 2, 3, 5, 7, 10],
            },
            bob: {
              scores: 7,
              maxStreak: 4,
              scoreHistory: [0, 1, 2, 4, 6, 7],
            },
          },
          {
            matchNumber: 2,
            alice: {
              scores: 8,
              maxStreak: 3,
              scoreHistory: [0, 1, 3, 5, 7, 8],
            },
            bob: {
              scores: 10,
              maxStreak: 5,
              scoreHistory: [0, 2, 4, 6, 8, 10],
            },
          },
          {
            matchNumber: 3,
            alice: {
              scores: 10,
              maxStreak: 4,
              scoreHistory: [0, 2, 4, 7, 9, 10],
            },
            bob: {
              scores: 6,
              maxStreak: 2,
              scoreHistory: [0, 1, 2, 3, 5, 6],
            },
          },
        ],
      },
    ];
    setTournaments(mockData);
    if (mockData.length > 0) {
      setSelectedTournament(mockData[0]);
    }
  }, []);

  const currentMatch = selectedTournament?.matches[selectedMatchIndex];

  return (
    <div className="h-screen bg-accent m-2 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold p-5">Match History</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mx-5">
        {/* Left Column - Tournament List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-muted p-4 rounded-lg text-center font-medium">
            Tournament ID, Date, Time, Players, Winner
          </div>
          
          {tournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className={`cursor-pointer transition-all ${
                selectedTournament?.id === tournament.id
                  ? "border-primary border-2"
                  : "hover:border-primary/50"
              }`}
              onClick={() => {
                setSelectedTournament(tournament);
                setSelectedMatchIndex(0);
              }}
            >
              <CardContent className="p-4">
                <div className="space-y-1">
                  <p className="font-semibold">Tournament {tournament.tournamentId}</p>
                  <p className="text-sm text-muted-foreground">
                    {tournament.date} at {tournament.time}
                  </p>
                  <p className="text-sm">Players: {tournament.players.join(" vs ")}</p>
                  <p className="text-sm font-medium text-primary">
                    Winner: {tournament.winner}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right Column - Match Details */}
        <div className="lg:col-span-2">
          {selectedTournament ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Tournament ID {selectedTournament.tournamentId}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedTournament.date}
                    <br />
                    <span className="italic">time</span>
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Match Tabs */}
                <div className="flex gap-2 justify-center">
                  {selectedTournament.matches.map((match, index) => (
                    <Button
                      key={index}
                      variant={selectedMatchIndex === index ? "default" : "outline"}
                      onClick={() => setSelectedMatchIndex(index)}
                    >
                      Match {match.matchNumber}
                    </Button>
                  ))}
                </div>

                {currentMatch && (
                  <>
                    {/* Stats Table */}
                    <div className="grid grid-cols-3 gap-2">
                      <div></div>
                      <div className="text-center font-semibold">Alice</div>
                      <div className="text-center font-semibold">Bob</div>

                      <div className="bg-muted p-3 rounded">Scores</div>
                      <div className="border p-3 rounded text-center">
                        {currentMatch.alice.scores}
                      </div>
                      <div className="border p-3 rounded text-center">
                        {currentMatch.bob.scores}
                      </div>

                      <div className="bg-muted p-3 rounded">Max streak</div>
                      <div className="border p-3 rounded text-center">
                        {currentMatch.alice.maxStreak}
                      </div>
                      <div className="border p-3 rounded text-center">
                        {currentMatch.bob.maxStreak}
                      </div>
                    </div>

                    {/* Chart Placeholder */}
                    <div className="border rounded-lg p-12 bg-background flex items-center justify-center h-64">
                      <p className="text-muted-foreground text-lg">Chart (placeholder)</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Select a tournament to view match details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
