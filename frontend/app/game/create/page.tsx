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
import FriendsDropdown from "../../../components/ui/friends-dropdown";
import axios from "axios";
import { match } from "assert";

// Hard-coded friends
const onlineFriends = [
  { value: "winnie", label: "Winnie" },
  { value: "nelson", label: "Nelson" },
  { value: "xuan", label: "Xuan" },
  { value: "jaxz", label: "Jaxz" },
  { value: "natalie", label: "Natalie" },
  { value: "adya", label: "Adya" },
  { value: "low", label: "Low" },
  { value: "zhen", label: "Zhen" },
  { value: "kegoh", label: "Kegoh" },
  { value: "maxwell", label: "Maxwell" },
  { value: "amber", label: "Amber" },
];

// This page is expected to change a lot.
// Host and non-host players should see a different UI.
export default function CreateGamePage() {
  // Use this to track selectedFrieds:
  // const [selectedFriends, setSelectedFriends] = useState([]);
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const router = useRouter();

  const handleNext = () => {
    // Need to check if there's at least one friend
    setStep(2);
  };

  // Use this to send friend request
  function handleInvite(friendValue: string) {
  console.log("Invited", friendValue);
}

  const handleStart = async () => {
    // Hardcoded data
    const data = [
      {username: "p1", displayName: "p1"},
      {username: "p2", displayName: "p2"},
    ];
  
    const response = await axios.post("/api/game/create", data);
    const matchId = response.data.matchId;
    router.push(`/game/${matchId}`);
  }

  return (
    <div className="h-screen bg-accent">
      <p className="flex text-2xl font-semibold justify-center p-5">NEW GAME</p>
      <div className="flex justify-center">
        {step === 1 && (
          <Card className="flex w-1/3">
            <CardContent>
              <FriendsDropdown friends={onlineFriends} onInvite={handleInvite} />
              {/* Hardcoded friends */}
                <div className="flex mt-6 gap-3">
                  <Input disabled value="Friend 1" />
                  <Button variant="destructive">Kick</Button>
                </div>
                <div className="flex mt-6 gap-3">
                  <Input disabled value="Friend 2" />
                  <Button variant="destructive">Kick</Button>
                </div>
                <div className="flex mt-6 gap-3">
                  <Input disabled value="Friend 3" />
                  <Button variant="destructive">Kick</Button>
                </div>
            </CardContent>
            <CardFooter className="grid justify-end">
              <Button className="w-40 mt-10" onClick={handleNext}>
                Next
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="flex w-1/3">
            <CardTitle className="p-5 m-auto">
              Enter Your Display Name
            </CardTitle>
            <CardContent>
              <Input
                className="p-2 border rounded w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </CardContent>
            <CardFooter className="grid justify-end">
              <Button
                className="w-40 mt-10"
                onClick={handleStart}
              >
                Start Game
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
