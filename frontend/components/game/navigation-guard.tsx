"use client";

import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useCallback } from "react";

export function NavigationGuard() {
  const router = useRouter();
  const { 
    gameState, 
    showNavGuard, 
    setShowNavGuard, 
    pendingPath, 
    setPendingPath 
  } = useGame();
  const { sendSocketMessage } = useSocket();

  const isSpectator = gameState?.spectatorMode === true;
  const matchId = gameState?.matchId;

  const handleStay = () => {
    setShowNavGuard(false);
    setPendingPath(null);
  };

  const handleReturnToLobby = useCallback(() => {
    if (!gameState) return;

    // Send cleanup event if spectating
    if (isSpectator && matchId) {
      sendSocketMessage({
        event: "UNVIEW_MATCH",
        payload: { matchId }
      });
    }

    setShowNavGuard(false);
    setPendingPath(null);

    // Determine target lobby
    let tournamentId = gameState.tournamentId;
    if (!tournamentId && typeof matchId === 'string' && matchId.startsWith("RT-")) {
      const parts = matchId.split("-m");
      if (parts.length > 1) {
        tournamentId = parts[0];
      }
    }

    if (tournamentId) {
      router.push(`/game/remote/tournament/${tournamentId}`);
    } else {
      router.push("/dashboard");
    }
  }, [gameState, isSpectator, matchId, sendSocketMessage, setShowNavGuard, setPendingPath, router]);

  const handleLeaveGame = () => {
    if (pendingPath) {
      // Send cleanup if spectating
      if (isSpectator && matchId) {
        sendSocketMessage({
          event: "UNVIEW_MATCH",
          payload: { matchId }
        });
      }
      
      setShowNavGuard(false);
      const path = pendingPath;
      setPendingPath(null);
      router.push(path);
    } else {
      setShowNavGuard(false);
    }
  };

  if (!showNavGuard) return null;

  return (
    <Dialog open={showNavGuard} onOpenChange={setShowNavGuard}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Active Match in Progress
          </DialogTitle>
          <DialogDescription className="pt-2">
            {isSpectator ? (
              <span className="block space-y-2">
                <span className="block">You are currently spectating an active tournament match.</span>
                <span className="block font-medium">What would you like to do?</span>
              </span>
            ) : (
              <span className="block space-y-2">
                <span className="block font-semibold text-foreground">You are a player in this active match!</span>
                <span className="block text-sm">Leaving now may result in disqualification or a loss. What would you like to do?</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleStay}
            className="w-full sm:w-auto"
          >
            {isSpectator ? "Stay Here" : "Stay in Match"}
          </Button>
          
          <Button
            variant="secondary"
            onClick={handleReturnToLobby}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lobby
          </Button>

          <Button
            variant="destructive"
            onClick={handleLeaveGame}
            className="w-full sm:w-auto"
          >
            Leave Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
