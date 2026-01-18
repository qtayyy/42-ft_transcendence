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
import { AlertCircle } from "lucide-react";

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

export function ReconnectionModal({
  isOpen,
  activeMatch,
  onContinue,
  onLeave,
}: ReconnectionModalProps) {
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
            {activeMatch.message || `You have an active ${activeMatch.type} match in progress against ${activeMatch.opponent}.`}
          </DialogDescription>
          <DialogDescription className="text-sm font-medium text-foreground py-2">
            Do you want to reconnect? Leaving will result in a forfeit.
          </DialogDescription>
        </DialogHeader>
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
