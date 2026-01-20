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
import { SocketContextValue } from "@/types/types";
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
      const connect = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const websocket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || "wss://localhost:8443/ws");
        wsRef.current = websocket;

        // Heartbeat
        const interval = setInterval(
          () => {
            if (websocket.readyState === WebSocket.OPEN) {
              websocket.send(JSON.stringify({ event: "PING" }));
            }
          },
          30000
        );

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
                isTournament: payload.isTournament || false,
                tournamentStarted: payload.tournamentStarted || false,
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
              window.dispatchEvent(
                new CustomEvent("JOIN_ROOM", { detail: payload })
              );
              break;

            case "JOIN_ROOM_ERROR":
              toast.error(payload.message || "Failed to join room");
              window.dispatchEvent(
                new CustomEvent("JOIN_ROOM_ERROR", { detail: payload })
              );
              break;


            case "MATCH_FOUND":
              // Navigate to the matched game room
              router.push(`/game/${payload.matchId}`);
              break;

            case "TOURNAMENT_FOUND":
              // Dispatch event so matchmaking page can handle it (show lobby)
              window.dispatchEvent(
                new CustomEvent("TOURNAMENT_FOUND", { detail: payload })
              );
              break;

            case "MATCHMAKING_JOINED":
              // Optionally show queue position
              console.log("Joined matchmaking queue, position:", payload.position);
              break;

            case "MATCHMAKING_HOST":
              // User has been designated as host for a new matchmade room
              // Redirect to the create page which acts as the lobby
              router.push("/game/remote/single/create");
              break;

            case "MATCHMAKING_LEFT":
              // Confirm left queue
              break;

            case "TOURNAMENT_UPDATE":
              console.log("Socket Context: Dispatching TOURNAMENT_UPDATE", payload);
              window.dispatchEvent(
                  new CustomEvent("tournamentUpdate", { detail: payload })
              );
              break;

            case "LEAVE_ROOM":
              setGameRoom(null);
              // Safely clear undefined property access if any component relies on it
              setGameState(null); 
              hasActiveGame.current = false;
              toast.info("You're removed from the game room");
              break;

            case "GAME_MATCH_START":
              setGameState(payload);
              // Navigate to game page for the match
              if (payload.matchId) {
                router.push(`/game/${payload.matchId}`);
              }
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
              }, 5000);
              break;

            case "REMATCH_FAILED":
              toast.error(payload.reason || "Rematch failed");
              setGameState(null);
              setGameRoom(null);
              hasActiveGame.current = false;
              router.push("/game/new");
              break;

            case "OPPONENT_LEFT":
              // Dispatch event for game page to handle (disable rematch)
              // We do NOT redirect here, allowing the user to stay on the results screen
              window.dispatchEvent(new CustomEvent("opponentLeft"));
              toast.info("Your opponent has left the game");
              break;

            case "OPPONENT_DISCONNECTED":
              // Dispatch event for game page to show disconnect UI with countdown
              window.dispatchEvent(
                new CustomEvent("opponentDisconnected", { detail: payload })
              );
              break;

            case "OPPONENT_RECONNECTED":
              // Dispatch event for game page to clear disconnect UI
              window.dispatchEvent(
                new CustomEvent("opponentReconnected", { detail: payload })
              );
              break;

            case "GAME_PAUSED":
              // Dispatch event for game page to show pause UI
              window.dispatchEvent(
                new CustomEvent("gamePaused", { detail: payload })
              );
              toast.info(`Game paused by ${payload.pausedByName}`);
              break;

            case "GAME_RESUMED":
              // Dispatch event for game page to resume game
              window.dispatchEvent(
                new CustomEvent("gameResumed", { detail: payload })
              );
              toast.success("Game resumed!");
              break;

            case "OPPONENT_READY_TO_RESUME":
              // Dispatch event showing opponent is ready to resume
              window.dispatchEvent(
                new CustomEvent("opponentReadyToResume", { detail: payload })
              );
              toast.info("Opponent is ready to resume. Press SPACE to continue.");
              break;

            case "WAITING_FOR_RESUME":
              // Dispatch event showing we're waiting for opponent
              window.dispatchEvent(
                new CustomEvent("waitingForResume", { detail: payload })
              );
              break;

            case "MATCH_WALKOVER":
              // Dispatch event for walkover win (opponent left)
              window.dispatchEvent(
                new CustomEvent("matchWalkover", { detail: payload })
              );
              toast.success(payload.reason || "You win by walkover!");
              break;

            case "TOURNAMENT_PLAYER_LEFT":
              // A player left the tournament
              toast.warning("A player has left the tournament");
              break;

            case "CHAT_MESSAGE":
              console.log("Received CHAT_MESSAGE via WebSocket:", payload);
              window.dispatchEvent(
                new CustomEvent("chatMessage", { detail: payload })
              );
              break;

            case "PLAYER_READY_STATE":
              // Dispatch custom event for ready state persistence
              window.dispatchEvent(new CustomEvent("PLAYER_READY_STATE", { detail: payload }));
              break;

            default:
              console.log("Unknown event:", msg.event);
              break;
          }
        } catch (err) {
          // think about how to handle errors
          console.warn("Non-JSON WebSocket message or error handling message:", event.data, err);
        }
      };

        websocket.onerror = (err) => {
          console.error("WebSocket error:", err);
        };

        websocket.onclose = (event) => {
          setIsReady(false);
          console.log("WebSocket closed", event.code, event.reason);
          clearInterval(interval);
          wsRef.current = null;

          // Attempt reconnection with exponential backoff if not closed intentionally
          if (event.code !== 1000) {
            const timeoutId = setTimeout(() => {
                console.log("Attempting to reconnect...");
                connect();
            }, 3000); // Simple 3s delay for now, or use exponential backoff
            
            // Clean up timeout if component unmounts - handled by effect cleanup? 
            // Actually, we are inside a function scope. 
          }
        };
      };

      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    user,
    setInvitesReceived,
    setOnlineFriends,
    setGameRoom,
    router,
    setGameRoomLoaded,
    setGameState,
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
