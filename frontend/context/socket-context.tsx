"use client";
import {
  createContext,
  useRef,
  useEffect,
  RefObject,
  useContext,
} from "react";
import { useAuth } from "@/hooks/use-auth";

const SocketContext = createContext<RefObject<WebSocket | null> | null>(null);

export const SocketProvider = ({ children }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (!wsRef.current) {
      const websocket = new WebSocket("wss://localhost:8443/ws");
      wsRef.current = websocket;

      websocket.onopen = () => console.log("WebSocket is open");
      websocket.onclose = () => console.log("WebSocket is closed");
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
    <SocketContext.Provider value={wsRef}>
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
