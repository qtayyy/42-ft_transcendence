"use client";

import {
  createContext,
  useRef,
  useEffect,
  useContext,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { SocketContextValue } from "@/type/types";
import { useGame } from "@/hooks/use-game";
import { usePathname, useRouter } from "next/navigation";

const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider = ({ children }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  const {
    setOnlineFriends,
    setInvitesReceived,
    setGameRoom,
    setGameRoomLoaded,
    gameState,
    setGameState,
  } = useGame();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  // Set this to NULL when a match ends
  const hasActiveGame = useRef(false);

useEffect(() => {
  if (!gameState) return;

  if (!hasActiveGame.current) {
    hasActiveGame.current = true;
    // Navigate based on game type
    const matchId = String(gameState.matchId);
    if (matchId.startsWith("RS-")) {
      // Remote single match
      router.push(`/game/${matchId}`);
    } else if (matchId.startsWith("RT-")) {
      // Remote tournament
      router.push(`/game/${matchId}`);
    } else {
      // Local tournament (existing behavior)
      router.push(`/game/tournament/${matchId}`);
    }
  }
}, [gameState, router]);


  useEffect(() => {
    if (!user) return;

    if (!wsRef.current) {
      const websocket = new WebSocket("wss://localhost:8443/ws");
      // Heartbeat
      const interval = setInterval(
        () => websocket.send(JSON.stringify({ event: "PING" })),
        30000
      );
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log("WebSocket connected");
        setIsReady(true);
      };

      websocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            toast.error(msg.error);
            return;
          }
          const payload = msg.payload;

          switch (msg.event) {
            case "PONG":
              break;

            case "FRIEND_REQUEST":
              toast.info(
                `${payload.requesterUsername} sent you a friend request!`
              );
              break;

            case "FRIEND_STATUS":
              const { id, username, status } = msg.payload;

              setOnlineFriends((prev) => {
                const exists = prev.find((f) => f.id === id);

                if (status === "online" && !exists) {
                  return [...prev, { id, username }];
                }

                if (status === "offline" && exists) {
                  return prev.filter((f) => f.id !== id);
                }

                return prev;
              });

              toast.info(`${username} is now ${status}!`);
              break;

            case "GAME_ROOM":
              setGameRoom({
                roomId: payload.roomId,
                hostId: payload.hostId,
                invitedPlayers: payload.invitedPlayers,
                joinedPlayers: payload.joinedPlayers,
                maxPlayers: payload.maxPlayers,
              });
              setGameRoomLoaded(true);
              break;

            case "ROOM_NOT_FOUND":
              setGameRoom(null);
              setGameRoomLoaded(true);
              break;

            case "GAME_INVITE":
              setInvitesReceived((prev) => [
                ...prev,
                {
                  roomId: payload.roomId,
                  hostId: payload.hostId,
                  hostUsername: payload.hostUsername,
                },
              ]);
              break;

            case "JOIN_ROOM":
              // Room joined successfully - pages handle their own state
              // No redirect needed as new pages stay in place
              toast.success("Joined room successfully!");
              break;

            case "LEAVE_ROOM":
              setGameRoom(null);
              toast.info("You're removed from the game room");
              router.push("/dashboard");
              break;

            case "GAME_MATCH_START":
              setGameState(payload);
              break;

            case "TOURNAMENT_START":
              // Navigate all players to the remote tournament game page
              router.push(`/game/remote/tournament/${payload.tournamentId}`);
              break;

            case "GAME_STATE":
              setGameState({...payload});  
              break;

            case "GAME_OVER":
              // Dispatch custom event for game page to show results
              window.dispatchEvent(
                new CustomEvent("gameOver", { detail: payload })
              );
              // Reset state after a delay to allow results screen
              setTimeout(() => {
                setGameState(null);
                setGameRoom(null);
                hasActiveGame.current = false;
              }, 100);
              break;

            case "REMATCH_FAILED":
              toast.error(payload.reason || "Rematch failed");
              setGameState(null);
              setGameRoom(null);
              hasActiveGame.current = false;
              router.push("/game/new");
              break;

            case "OPPONENT_LEFT":
              toast.info("Your opponent has left the game");
              setGameState(null);
              setGameRoom(null);
              hasActiveGame.current = false;
              router.push("/game/new");
              break;

            case "CHAT_MESSAGE":
              console.log("Received CHAT_MESSAGE via WebSocket:", payload);
              window.dispatchEvent(
                new CustomEvent("chatMessage", { detail: payload })
              );
              break;

            default:
              console.log("Unknown event:", msg.event);
              break;
          }
        } catch (err) {
          // think about how to handle errors
          console.warn("Non-JSON WebSocket message:", event.data);
          throw err;
        }
      };

      websocket.onclose = (event) => {
        setIsReady(false);
        console.log("WebSocket closed", event.code, event.reason);
        clearInterval(interval);
      };

      websocket.onerror = (err) => {
        setIsReady(false);
        console.error("WebSocket error:", err);
      };
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    user,
    // setInvitesReceived,
    // setOnlineFriends,
    // setGameRoom,
    // router,
    // setGameRoomLoaded,
    // gameState,
    // setGameState,
  ]);

  const sendSocketMessage = useCallback((payload) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("Client socket isn't ready");
      return;
    }
    socket.send(JSON.stringify(payload));
  }, []);

  return (
    <SocketContext.Provider
      value={{
        sendSocketMessage,
        isReady,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocketContext must be used within SocketProvider");
  }
  return context;
};
