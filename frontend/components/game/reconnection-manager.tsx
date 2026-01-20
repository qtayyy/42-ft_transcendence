"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { ReconnectionModal } from "./reconnection-modal";
import { useAuth } from "@/hooks/use-auth";

interface GameStatusResponse {
  active: boolean;
  type?: 'game' | 'tournament';
  matchId?: string;
  tournamentId?: string;
  opponent?: string;
  message?: string;
}

export function ReconnectionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeMatch, setActiveMatch] = useState<GameStatusResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        console.log("ReconnectionManager: Checking status...");
        const res = await axios.get("/api/game/status", { withCredentials: true });
        console.log("ReconnectionManager: Status response:", res.data);

        if (res.data.active) {
            const match = res.data;
            let isOnCorrectPage = false;
            
            // Should match: /game/[matchId]
            // Note: pathname might be null during SSR?
            if (match.matchId && pathname) {
                isOnCorrectPage = pathname.includes(`/game/${match.matchId}`);
            }

            console.log(`ReconnectionManager: Active match found. Type: ${match.type}, MatchId: ${match.matchId}. Current Path: ${pathname}. On Correct Page: ${isOnCorrectPage}`);

            if (!isOnCorrectPage) {
                setActiveMatch(match);
                setShowModal(true);
            } else {
                setShowModal(false);
            }
        } else {
            console.log("ReconnectionManager: No active match.");
            setShowModal(false);
            setActiveMatch(null);
        }
      } catch (err: any) {
        // Don't log 401 errors - they're expected when user session expires
        if (err?.response?.status !== 401) {
          console.error("Failed to check game status", err);
        }
        // Clear any stale modal state on error
        setShowModal(false);
        setActiveMatch(null);
      }
    };

    // Check status on mount and when path changes
    checkStatus();
    
  }, [user, pathname]);

  const handleContinue = () => {
    if (!activeMatch) return;
    
    setShowModal(false);
    if (activeMatch.matchId) {
        router.push(`/game/${activeMatch.matchId}`);
    }
  };

  const handleLeave = async () => {
    if (!activeMatch) return;

    try {
        await axios.post("/api/game/leave", {
            matchId: activeMatch.matchId,
            tournamentId: activeMatch.tournamentId
        });
        setShowModal(false);
        setActiveMatch(null);
        router.push("/dashboard"); 
    } catch (err) {
        console.error("Failed to leave game", err);
    }
  };

  if (!showModal || !activeMatch) return null;

  return (
    <ReconnectionModal 
      isOpen={showModal}
      activeMatch={activeMatch as any}
      onContinue={handleContinue}
      onLeave={handleLeave}
    />
  );
}
