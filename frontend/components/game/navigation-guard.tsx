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
import { useMemo } from "react";

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
	const isRuntimeMatchRoute = /^\/game\/[^/]+$/.test(pathname);
	const routeMatchId = isRuntimeMatchRoute ? pathname.split("/")[2] : null;
	const isRemoteRuntimeMatch =
		typeof routeMatchId === "string" &&
		(routeMatchId.startsWith("RS-") || routeMatchId.startsWith("RT-"));
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
	const isLocalTournamentLobby = /^\/game\/local\/tournament\/[^/]+$/.test(pathname);
	const isLocalTournamentMatch = useMemo(() => {
		if (isSpectator || !isRuntimeMatchRoute || isRemoteRuntimeMatch) return false;
		if (typeof window === "undefined") return false;

		try {
			const raw = localStorage.getItem("current-match");
			if (!raw) return false;
			const parsed = JSON.parse(raw) as {
				matchId?: string;
				runtimeMatchId?: string;
				tournamentId?: string;
				isTournamentMatch?: boolean;
			};

			const currentRouteMatchId = routeMatchId ?? "";
			const knownIds = [parsed.runtimeMatchId, parsed.matchId].filter(
				(value): value is string => typeof value === "string" && value.length > 0
			);
			if (knownIds.length > 0 && !knownIds.includes(currentRouteMatchId)) {
				return false;
			}

			return (
				parsed.isTournamentMatch === true ||
				(typeof parsed.tournamentId === "string" && parsed.tournamentId.startsWith("local-tournament-"))
			);
		} catch {
			return false;
		}
	}, [isSpectator, isRuntimeMatchRoute, isRemoteRuntimeMatch, routeMatchId]);
	const isLocalMatch = isRuntimeMatchRoute && !isRemoteRuntimeMatch && !isLocalTournamentMatch && !isSpectator;
	const isAnyTournamentContext = isTournamentLobby || isLocalTournamentLobby || isLocalTournamentMatch;
	const guardTitle = isAnyTournamentContext
		? "Active Tournament in Progress"
		: "Active Match in Progress";
	const stayLabel = isSpectator
		? "Stay Here"
		: isAnyTournamentContext
			? "Stay in Tournament"
			: "Stay in Match";
	const leaveLabel = isAnyTournamentContext ? "Leave Tournament" : "Leave Game";

	const handleStay = () => {
		setShowNavGuard(false);
		setPendingPath(null);
	};

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
							{guardTitle}
						</DialogTitle>
						<DialogDescription className="pt-2">
							{isTournamentLobby || isLocalTournamentLobby ? (
								<span className="block space-y-2">
									<span className="block">You are currently in an active tournament lobby.</span>
									<span className="block text-sm">
										Leaving now will withdraw you from the tournament and affect remaining matches.
									</span>
									</span>
							) : isLocalTournamentMatch ? (
								<span className="block space-y-2">
									<span className="block font-semibold text-foreground">You are currently in an active local tournament match.</span>
									<span className="block text-sm">Navigating to another page will forfeit the entire tournament. Are you sure you want to leave the tournament?</span>
								</span>
							) : isLocalMatch ? (
								<span className="block space-y-2">
									<span className="block font-semibold text-foreground">You are currently in an active local match.</span>
									<span className="block text-sm">Navigating to another page will forfeit this match. Are you sure you want to leave the game?</span>
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
							{stayLabel}
						</Button>


					<Button
						variant="destructive"
							onClick={handleLeaveGame}
							className="w-full sm:w-auto"
						>
							{leaveLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
		</Dialog>
	);
}
