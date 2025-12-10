"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Friend, GameContextValue, GameRoomValue, Invites, GameStateValue } from "@/type/types";
import axios from "axios";

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineFriends, setOnlineFriends] = useState<Friend[]>([]);
  const [invitesReceived, setInvitesReceived] = useState<Invites[]>([]);
  const [gameRoom, setGameRoom] = useState<GameRoomValue | null>(null);
  const [gameRoomLoaded, setGameRoomLoaded] = useState(false);
  const [gameState, setGameState] = useState<GameStateValue | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const res = await axios.get("/api/friends/online");
        setOnlineFriends(res.data);
      } catch (err) {
        throw err;
      }
    }
    load();
  }, [user]);

  return (
    <GameContext.Provider
      value={{
        onlineFriends,
        setOnlineFriends,
        invitesReceived,
        setInvitesReceived,
        gameRoomLoaded,
        setGameRoomLoaded,
        gameRoom,
        setGameRoom,
        gameState,
        setGameState
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context)
    throw new Error("useGameContext must be used within GameProvider");
  return context;
};
