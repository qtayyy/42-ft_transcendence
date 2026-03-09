"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { ReconnectionModal } from "./reconnection-modal";
import { useAuth } from "@/hooks/use-auth";
import { handleSessionExpiredRedirect } from "@/lib/session-expired";

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
  const routerRef = useRef(router);
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeMatch, setActiveMatch] = useState<GameStatusResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

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
      } catch (err: unknown) {
        if (handleSessionExpiredRedirect(err, routerRef.current)) return;
        console.error("Failed to check game status", err);
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
    } catch (err: unknown) {
        if (handleSessionExpiredRedirect(err, router)) return;
        console.error("Failed to leave game", err);
    }
  };

  const modalMatch = activeMatch
    ? {
        type: activeMatch.type ?? "game",
        matchId: activeMatch.matchId ?? "",
        tournamentId: activeMatch.tournamentId,
        opponent: activeMatch.opponent ?? "Opponent",
        message: activeMatch.message,
      }
    : null;

  if (!showModal || !activeMatch) return null;

  return (
    <ReconnectionModal 
      isOpen={showModal}
      activeMatch={modalMatch}
      onContinue={handleContinue}
      onLeave={handleLeave}
    />
  );
}
