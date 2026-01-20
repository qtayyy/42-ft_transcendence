"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Timer } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ReconnectionModalProps {
  isOpen: boolean;
  activeMatch: {
    type: 'game' | 'tournament';
    matchId: string;
    tournamentId?: string;
    opponent: string;
    message?: string;
  } | null;
  onContinue: () => void;
  onLeave: () => void;
}

const COUNTDOWN_SECONDS = 30;

export function ReconnectionModal({
  isOpen,
  activeMatch,
  onContinue,
  onLeave,
}: ReconnectionModalProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // Reset countdown when modal opens
  useEffect(() => {
    if (isOpen && activeMatch) {
      setCountdown(COUNTDOWN_SECONDS);
    }
  }, [isOpen, activeMatch]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !activeMatch) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, activeMatch]);

  // Auto-forfeit when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && isOpen && activeMatch) {
      onLeave();
    }
  }, [countdown, isOpen, activeMatch, onLeave]);

  if (!activeMatch) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
             <AlertCircle className="h-6 w-6" />
             <DialogTitle>Active Match Detected</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-base">
            You have an active remote game in progress.
          </DialogDescription>
          <DialogDescription className="text-sm font-medium text-foreground py-2">
            Do you want to reconnect? Leaving will result in a forfeit.
          </DialogDescription>
        </DialogHeader>

        {/* Countdown Timer */}
        <div className="flex flex-col items-center py-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Timer className="h-4 w-4" />
            <span className="text-sm">Auto-forfeit in</span>
          </div>
          <div className={cn(
            "text-4xl font-mono font-bold tabular-nums",
            countdown <= 10 ? "text-red-500 animate-pulse" : "text-yellow-500"
          )}>
            {countdown}s
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Choose an option or auto-forfeit when timer expires
          </p>
        </div>

        <DialogFooter className="mr-auto w-full sm:justify-between gap-2 flex-col sm:flex-row">
          <Button variant="destructive" onClick={onLeave} className="w-full sm:w-auto">
            Leave Game (Forfeit)
          </Button>
          <Button onClick={onContinue} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
            Continue Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
