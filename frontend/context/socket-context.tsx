"use client";

import {
  createContext,
  useRef,
  useEffect,
  useContext,
  useState,
  RefObject,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface SocketContextType {
  wsRef: RefObject<WebSocket | null>;
  onlineFriends: Array<{ id: number; username: string }>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider = ({ children }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [onlineFriends, setOnlineFriends] = useState<Array<{ id: number; username: string }>>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchOnlineFriends = async () => {
      try {
        const res = await fetch("/api/friends/online");
        if (!res.ok) throw new Error("Failed to fetch online friends");
        const data = await res.json();
        setOnlineFriends(data);
      } catch (err) {
        console.error("Error fetching online friends:", err);
      }
    };
    fetchOnlineFriends();

    if (!wsRef.current) {
      const websocket = new WebSocket("wss://localhost:8443/ws");
      wsRef.current = websocket;

      websocket.onopen = () => console.log("WebSocket connected");

      websocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.event) {
            case "FRIEND_REQUEST":
              toast.info(`${msg.payload.requesterUsername} sent you a friend request!`);
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

            default:
              console.log("Unknown event:", msg.event);
          }
        } catch (err) {
          console.warn("Non-JSON WebSocket message:", event.data);
          throw err;
        }
      };

      websocket.onclose = () => console.log("WebSocket closed");
      websocket.onerror = (err) => console.error("WebSocket error:", err);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ wsRef, onlineFriends }}>
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
