"use client";

import { useGame } from "@/hooks/use-game";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/hooks/use-auth";
import { usePathname, useRouter } from "next/navigation";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useCallback } from "react";

export function NavigationGuard() {
	const router = useRouter();
	const pathname = usePathname();
	const { user } = useAuth();
	const {
		gameState,
		gameRoom,
		showNavGuard,
		setShowNavGuard,
		pendingPath,
		setPendingPath
	} = useGame();
	const { sendSocketMessage } = useSocket();

	const isSpectator = gameState?.spectatorMode === true;
	const matchId = gameState?.matchId;
	const routeTournamentMatch = pathname.match(/^\/game\/remote\/tournament\/(RT-[^/?#]+)/);
	const routeTournamentId = routeTournamentMatch?.[1] || null;
	const resolvedTournamentId = (() => {
		const tournamentId = gameState?.tournamentId;
		if (tournamentId) return String(tournamentId);
		if (typeof matchId === "string" && matchId.startsWith("RT-")) {
			const parts = matchId.split("-m");
			if (parts.length > 1) {
				return parts[0];
			}
		}
		return null;
	})();
	const tournamentId = resolvedTournamentId || routeTournamentId;
	const tournamentRoomId = gameRoom?.roomId || (tournamentId ? tournamentId.replace(/^RT-/, "") : null);
	const isTournamentLobby = /^\/game\/remote\/tournament\/RT-/.test(pathname);

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
			// Explicitly leave tournament room when user chooses "Leave Game"
			// so backend can broadcast TOURNAMENT_PLAYER_LEFT / update standings.
			if (tournamentRoomId && user?.id && (isTournamentLobby || !!tournamentId)) {
				sendSocketMessage({
					event: "LEAVE_ROOM",
					payload: {
						roomId: tournamentRoomId,
						userId: user.id,
					},
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
						{isTournamentLobby ? "Active Tournament in Progress" : "Active Match in Progress"}
					</DialogTitle>
					<DialogDescription className="pt-2">
						{isTournamentLobby ? (
							<span className="block space-y-2">
								<span className="block">You are currently in an active tournament lobby.</span>
								<span className="block text-sm">Leaving now will withdraw you from the tournament and affect remaining matches.</span>
							</span>
						) : isSpectator ? (
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
