"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import FriendsDropdown from "../../../../components/ui/friends-dropdown";
import axios from "axios";

type Friend = {
  id: number;
  username: string;
};

// This page is expected to change a lot.
// Host and non-host players should see a different UI.
export default function CreateGamePage() {
  const router = useRouter();
  const [onlineFriends, setOnlineFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);

  // This code is repeated in Dashboard now.
  // Prob can move this to AuthProvider.
  const fetchFriends = async () => {
    try {
      const res = await axios.get("/api/friends");
      setOnlineFriends(res.data);
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    async function loadFriends() {
      await fetchFriends();
    }
    loadFriends();
  }, []);

  // Use this to send friend request
  function handleInvite(friend: Friend) {
    setSelectedFriends((prev) =>
      prev.find((f) => f.id === friend.id) ? prev : [...prev, friend]
    );
  }

  const handleStart = async () => {
    // Hardcoded data (handle two players for now)
    const data = [{ userId: 1 }, { userId: 2 }];

    const response = await axios.post("/api/game/create", data);
    const tournamentId = response.data.tournamentId;
    router.push(`/game/${tournamentId}`);
  };

  return (
    <div className="h-screen bg-accent">
      <p className="flex text-2xl font-semibold justify-center p-5">NEW GAME</p>
      <div className="flex justify-center">
        <Card className="flex w-1/3">
          <CardContent>
            {onlineFriends ? (
              <FriendsDropdown
                friends={onlineFriends}
                onInvite={handleInvite}
              />
            ) : null}
            {selectedFriends.map((selected) => (
              <div key={selected.id} className="flex mt-6 gap-3">
                <Input disabled value={selected.username} />
                <Button variant="destructive">Kick</Button>
              </div>
            ))}
          </CardContent>
          <CardFooter className="grid justify-end">
            <Button className="w-40 mt-10" onClick={handleStart}>
              Start!
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
