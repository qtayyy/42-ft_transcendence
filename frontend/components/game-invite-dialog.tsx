"use client";

import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GameInviteDialog() {
  const { sendSocketMessage } = useSocket();
  const { invitesReceived, setInvitesReceived } = useGame();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function load() {
      setDialogOpen(true);
    }
    if (invitesReceived.length > 0) {
      load();
    }
  }, [invitesReceived]);

  function respondGame(response: string) {
    sendSocketMessage({
      event: "RESPOND_INVITE",
      payload: {
        response,
        roomId: invitesReceived[0].roomId,
        hostId: invitesReceived[0].hostId,
        inviteeId: user?.id,
        inviteeUsername: user?.username,
      },
    });
    setInvitesReceived(prev => prev.filter((_, index) => index !== 0));
    setDialogOpen(false);
  }

  if (invitesReceived.length === 0) return null;

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          respondGame("rejected");
          setInvitesReceived((prev) => prev.filter((_, index) => index !== 0));
        }
        setDialogOpen(open);
      }}
    >
      <DialogContent className="p-10">
        <DialogHeader>
          <DialogTitle>Game Invitation</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-primary text-sm">
              {invitesReceived[0].hostUsername}
            </span>{" "}
            invited you to play pong!
          </DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center"></div>
        <div className="grid grid-cols-2 justify-around">
          <Button className="w-40" variant="secondary" onClick={() => respondGame("rejected")}>
            Decline
          </Button>
          <Button className="w-40" variant="default" onClick={() => respondGame("accepted")}>
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
