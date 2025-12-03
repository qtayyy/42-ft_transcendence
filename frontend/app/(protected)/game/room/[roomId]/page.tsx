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
import { Input } from "@/components/ui/input";
import FriendsDropdown from "@/components/ui/friends-dropdown";
import { useEffect } from "react";
import { Friend } from "@/type/types";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

export default function GameRoom() {
  const { sendSocketMessage, isReady } = useSocket();
  const { user } = useAuth();
  const { gameRoom, onlineFriends } = useGame();
  const { roomId } = useParams();
  const router = useRouter();
  const isHost = user?.id === gameRoom?.hostId;

  useEffect(() => {
    if (!user || !isReady) return;
    sendSocketMessage({
      event: "GET_GAME_ROOM",
      payload: {
        userId: user?.id,
      },
    });
  }, [sendSocketMessage, user, isReady]);

  function handleInvite(newFriend: Friend) {
    if (!user || !isReady) return;
    sendSocketMessage({
      event: "SEND_GAME_INVITE",
      payload: {
        roomId: roomId,
        hostId: gameRoom?.hostId,
        hostUsername: user?.username,
        friendId: newFriend.id,
        friendUsername: newFriend.username,
      },
    });
  }

  const handleStart = async () => {
    // Hardcoded data (handle two players for now)
    const data = [{ userId: 1 }, { userId: 2 }];

    const response = await axios.post("/api/game/create", data);
    const tournamentId = response.data.tournamentId;
    router.push(`/game/${tournamentId}`);
  };

  const handleKick = (userId: number) => {
    if (!user || !isReady) return;
    sendSocketMessage({
      event: "LEAVE_ROOM",
      payload: {
        roomId: roomId,
        userId: userId,
      },
    });
  };

  if (isHost) {
    return (
      <div className="h-screen bg-accent">
        <p className="flex text-2xl font-semibold justify-center p-5">
          NEW GAME
        </p>
        <div className="flex justify-center">
          <Card className="flex w-1/3">
            <CardContent>
              {onlineFriends ? (
                <FriendsDropdown
                  friends={onlineFriends}
                  onInvite={handleInvite}
                  gameRoom={gameRoom}
                />
              ) : null}
              {gameRoom?.joinedPlayers.map((joined, index) => {
                return (
                  <div
                    key={`${joined.id}-${index}`}
                    className="flex mt-6 gap-3 items-center"
                  >
                    <Input
                      disabled
                      value={
                        joined.id === gameRoom.hostId
                          ? `${joined.username} (Host)`
                          : joined.username
                      }
                      className="text-green-500"
                    />
                    <Button
                      variant="destructive"
                      onClick={() => handleKick(joined.id)}
                    >
                      {joined.id === gameRoom.hostId ? "Leave" : "Kick"}
                    </Button>
                  </div>
                );
              })}
              {gameRoom?.invitedPlayers.map((invited, index) => {
                return (
                  <div
                    key={`${invited.id}-${index}`}
                    className="flex mt-6 gap-3 items-center"
                  >
                    <Input
                      disabled
                      value={invited.username}
                      className="text-yellow-500"
                    />
                    <Button
                      variant="destructive"
                      onClick={() => handleKick(invited.id)}
                    >
                      Kick
                    </Button>
                  </div>
                );
              })}
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
  } else {
    return (
      <div className="h-screen bg-accent">
        <p className="flex text-2xl font-semibold justify-center p-5">
          Waiting for players to join...
        </p>
        <div className="flex justify-center">
          <Card className="flex w-1/3">
            <CardContent>
              {gameRoom?.joinedPlayers.map((joined, index) => {
                return (
                  <div
                    key={`${joined.id}-${index}`}
                    className="flex mt-6 gap-3 items-center"
                  >
                    <Input
                      disabled
                      value={
                        joined.id === gameRoom.hostId
                          ? `${joined.username} (Host)`
                          : joined.username
                      }
                      className="text-green-500"
                    />
                    {joined.id === Number(user?.id) ? (
                      <Button
                        variant="destructive"
                        onClick={() => handleKick(joined.id)}
                      >
                        Leave
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              {gameRoom?.invitedPlayers.map((invited, index) => {
                return (
                  <div
                    key={`${invited.id}-${index}`}
                    className="flex mt-6 gap-3 items-center"
                  >
                    <Input
                      disabled
                      value={invited.username}
                      className="text-yellow-500"
                    />
                  </div>
                );
              })}
            </CardContent>
            <CardFooter className="grid justify-end"></CardFooter>
          </Card>
        </div>
      </div>
    );
  }
}
