"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Zap, Loader2, Users, X } from "lucide-react";

export default function MatchmakingPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameRoom } = useGame();
	const [searching, setSearching] = useState(true);
	const [searchTime, setSearchTime] = useState(0);
	const [playersInQueue, setPlayersInQueue] = useState(1);
	const hasSentJoinRef = useRef(false);

	const sendJoinMatchmaking = useCallback(() => {
		if (!user || !isReady) return;
		sendSocketMessage({
			event: "JOIN_MATCHMAKING",
			payload: {
				userId: user.id,
				username: user.username,
				mode: "single",
			},
		});
	}, [user, isReady, sendSocketMessage]);

	// Search timer
	useEffect(() => {
		if (!searching) return;
		const timer = setInterval(() => {
			setSearchTime(prev => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [searching]);



	// Join matchmaking queue on mount
	useEffect(() => {
		if (!searching || !user || !isReady) return;
		const isSingleRoom = gameRoom?.isTournament !== true;
		const isMember = isSingleRoom && gameRoom?.joinedPlayers?.some((p) => Number(p.id) === Number(user.id));
		if (isMember) return;
		if (hasSentJoinRef.current) return;
		hasSentJoinRef.current = true;
		sendJoinMatchmaking();
	}, [searching, user, isReady, sendJoinMatchmaking]);

	// If socket drops, allow matchmaking request to be sent again on reconnect.
	useEffect(() => {
		if (!isReady) {
			hasSentJoinRef.current = false;
		}
	}, [isReady]);

	// Handle backend matchmaking errors (e.g. room conflicts)
	useEffect(() => {
		const handleRoomError = (event: CustomEvent) => {
			console.error("Failed to join single matchmaking:", event.detail);
			setSearching(false);
			setTimeout(() => {
				router.push("/game/remote/single");
			}, 1000);
		};

		window.addEventListener("JOIN_ROOM_ERROR", handleRoomError as EventListener);
		return () => {
			window.removeEventListener("JOIN_ROOM_ERROR", handleRoomError as EventListener);
		};
	}, [router]);

	// Keep queue stats reactive when backend emits queue updates.
	useEffect(() => {
		const handleMatchmakingJoined = (event: CustomEvent) => {
			const position = Number(event.detail?.position);
			if (!Number.isNaN(position) && position > 0) {
				setPlayersInQueue(position);
			}
		};
		window.addEventListener("MATCHMAKING_JOINED", handleMatchmakingJoined as EventListener);
		return () => {
			window.removeEventListener("MATCHMAKING_JOINED", handleMatchmakingJoined as EventListener);
		};
	}, []);

	// Recovery guard: if room state is already available (e.g. recovered socket/session),
	// redirect to the correct lobby instead of staying on matchmaking spinner.
	useEffect(() => {
		if (!searching || !user || !gameRoom) return;
		if (gameRoom.isTournament) return;

		const me = Number(user.id);
		const isMember = gameRoom.joinedPlayers?.some((p) => Number(p.id) === me);
		if (!isMember) return;

		if (Number(gameRoom.hostId) === me) {
			router.push("/game/remote/single/create?matchmaking=true");
			return;
		}

		router.push(`/game/remote/single/join?roomId=${gameRoom.roomId}&matchmaking=true`);
	}, [searching, user, gameRoom, router]);

	// Watchdog: retry join request if still searching with no room assignment.
	useEffect(() => {
		if (!searching || !user || !isReady) return;
		const retry = setInterval(() => {
			const me = Number(user.id);
			const isSingleRoom = gameRoom?.isTournament !== true;
			const isMember = isSingleRoom && gameRoom?.joinedPlayers?.some((p) => Number(p.id) === me);
			if (!isMember) {
				sendJoinMatchmaking();
			}
		}, 5000);

		return () => clearInterval(retry);
	}, [searching, user, isReady, gameRoom, sendJoinMatchmaking]);

	const handleCancel = () => {
		setSearching(false);
		if (user && isReady) {
			sendSocketMessage({
				event: "LEAVE_MATCHMAKING",
				payload: { userId: user.id },
			});
		}
		router.push("/game/remote/single");
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
				
				<div className="flex items-center justify-between">
					<Button 
						variant="ghost" 
						onClick={handleCancel}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Cancel
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur opacity-30 animate-pulse"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-orange-500/10 mb-4 ring-1 ring-orange-500/20 relative">
								<Zap className="h-8 w-8 text-orange-500" />
								<div className="absolute inset-0 rounded-full border-2 border-orange-500/30 animate-ping"></div>
							</div>
							<CardTitle className="text-2xl font-bold">Finding Opponent</CardTitle>
							<CardDescription>Searching for a worthy challenger...</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							{/* Search Animation */}
							<div className="flex justify-center py-8">
								<div className="relative">
									<div className="w-24 h-24 rounded-full border-4 border-muted"></div>
									<div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-orange-500 animate-spin"></div>
									<div className="absolute inset-2 w-20 h-20 rounded-full border-4 border-transparent border-t-red-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
									<div className="absolute inset-0 flex items-center justify-center">
										<Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
									</div>
								</div>
							</div>

							{/* Stats */}
							<div className="grid grid-cols-2 gap-4">
								<div className="text-center p-4 bg-muted/30 rounded-xl">
									<p className="text-2xl font-bold font-mono">{formatTime(searchTime)}</p>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">Search Time</p>
								</div>
								<div className="text-center p-4 bg-muted/30 rounded-xl">
									<div className="flex items-center justify-center gap-1">
										<Users className="h-5 w-5 text-muted-foreground" />
										<span className="text-2xl font-bold">{playersInQueue}</span>
									</div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">In Queue</p>
								</div>
							</div>

							{/* Cancel Button */}
							<Button
								onClick={handleCancel}
								variant="outline"
								size="lg"
								className="w-full text-lg h-14 font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
							>
								<X className="mr-2 h-5 w-5" />
								Cancel Search
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
