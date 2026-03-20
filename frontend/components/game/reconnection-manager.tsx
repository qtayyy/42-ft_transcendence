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
  gracePeriodEndsAt?: number | null;
}

type LocalRecoveryCandidate = {
  localMatchId?: string;
  localTournamentId?: string;
};

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

  const getLocalRecoveryCandidate = (): LocalRecoveryCandidate | null => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem("current-match");
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        matchId?: string;
        runtimeMatchId?: string;
        tournamentId?: string;
      };

      const localTournamentId =
        typeof parsed.tournamentId === "string" &&
        parsed.tournamentId.startsWith("local-tournament-")
          ? parsed.tournamentId
          : undefined;
      const runtimeId =
        typeof parsed.runtimeMatchId === "string"
          ? parsed.runtimeMatchId
          : typeof parsed.matchId === "string" && parsed.matchId.startsWith("local-")
            ? parsed.matchId
            : undefined;

      if (!runtimeId && !localTournamentId) return null;

      return {
        localMatchId: runtimeId,
        localTournamentId: runtimeId ? undefined : localTournamentId,
      };
    } catch {
      return null;
    }
  };

  const getContinuePath = (match: GameStatusResponse): string | null => {
    if (match.matchId) {
      return `/game/${match.matchId}`;
    }

    if (!match.tournamentId) return null;

    if (match.tournamentId.startsWith("local-tournament-")) {
      return `/game/local/tournament/${match.tournamentId}`;
    }

    if (match.tournamentId.startsWith("RT-")) {
      return `/game/remote/tournament/${match.tournamentId}`;
    }

    return null;
  };

  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      try {
        console.log("ReconnectionManager: Checking status...");
        const localCandidate = getLocalRecoveryCandidate();
        const res = await axios.get("/api/game/status", {
          withCredentials: true,
          params: localCandidate ?? undefined,
        });
        console.log("ReconnectionManager: Status response:", res.data);

        if (res.data.active) {
            const match = res.data;
            const continuePath = getContinuePath(match);
            const isOnCorrectPage = Boolean(
              continuePath && pathname && pathname.includes(continuePath),
            );

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
    const continuePath = getContinuePath(activeMatch);
    if (continuePath) {
        router.push(continuePath);
    }
  };

  const handleLeave = async () => {
    if (!activeMatch) return;

    const isLocalRecovery =
      (activeMatch.matchId?.startsWith("local-") ?? false) ||
      (activeMatch.tournamentId?.startsWith("local-tournament-") ?? false);

    if (isLocalRecovery) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("current-match");
        }
        setShowModal(false);
        setActiveMatch(null);
        router.push("/dashboard");
        return;
    }

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
        gracePeriodEndsAt: activeMatch.gracePeriodEndsAt,
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
