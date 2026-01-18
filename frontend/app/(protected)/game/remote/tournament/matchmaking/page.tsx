"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, Loader2, Users, X, Crown, User, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentRoom {
	roomId: string;
	tournamentId: string;
	players: { id: number; username: string }[];
	isHost?: boolean;
}

export default function TournamentMatchmakingPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameRoom } = useGame();
	const [searching, setSearching] = useState(true);
	const [searchTime, setSearchTime] = useState(0);
	const [tournamentRoom, setTournamentRoom] = useState<TournamentRoom | null>(null);
	const [copied, setCopied] = useState(false);

	// Search timer (only while searching)
	useEffect(() => {
		if (!searching || tournamentRoom) return;
		const timer = setInterval(() => {
			setSearchTime(prev => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [searching, tournamentRoom]);

	// Join matchmaking on mount
	useEffect(() => {
		if (!user || !isReady) return;
		sendSocketMessage({
			event: "JOIN_MATCHMAKING",
			payload: {
				userId: user.id,
				username: user.username,
				mode: "tournament",
			},
		});
	}, [user, isReady, sendSocketMessage]);

	// Listen for TOURNAMENT_FOUND event
	useEffect(() => {
		const handleTournamentFound = (event: CustomEvent) => {
			const payload = event.detail;
			setTournamentRoom({
				roomId: payload.roomId,
				tournamentId: payload.tournamentId,
				players: payload.players,
				isHost: payload.isHost,
			});
			setSearching(false);
		};

		window.addEventListener("TOURNAMENT_FOUND" as any, handleTournamentFound);
		return () => window.removeEventListener("TOURNAMENT_FOUND" as any, handleTournamentFound);
	}, []);

	// Poll for room updates when in lobby
	useEffect(() => {
		if (!user || !isReady || !tournamentRoom) return;

		// Initial fetch
		sendSocketMessage({
			event: "GET_GAME_ROOM",
			payload: { userId: user.id },
		});

		// Poll every 2 seconds
		const interval = setInterval(() => {
			sendSocketMessage({
				event: "GET_GAME_ROOM",
				payload: { userId: user.id },
			});
		}, 2000);

		return () => clearInterval(interval);
	}, [sendSocketMessage, user, isReady, tournamentRoom]);

	const handleCancel = () => {
		setSearching(false);
		if (user && isReady) {
			if (tournamentRoom) {
				// Leave the room
				sendSocketMessage({
					event: "LEAVE_ROOM",
					payload: { roomId: tournamentRoom.roomId, userId: user.id },
				});
			} else {
				// Leave matchmaking queue
				sendSocketMessage({
					event: "LEAVE_MATCHMAKING",
					payload: { userId: user.id },
				});
			}
		}
		router.push("/game/remote/tournament");
	};

	const handleCopyCode = () => {
		if (tournamentRoom?.roomId) {
			navigator.clipboard.writeText(tournamentRoom.roomId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleStartTournament = () => {
		if (!tournamentRoom || !gameRoom || gameRoom.joinedPlayers.length < 3 || !isReady) return;

		sendSocketMessage({
			event: "START_TOURNAMENT",
			payload: {
				roomId: tournamentRoom.roomId,
				tournamentId: tournamentRoom.tournamentId,
			},
		});
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const playerCount = gameRoom?.joinedPlayers.length || tournamentRoom?.players.length || 1;
	const isHost = gameRoom ? gameRoom.hostId === user?.id : tournamentRoom?.isHost;
	const canStart = playerCount >= 3;

	// Show lobby if we have a tournament room
	if (tournamentRoom) {
		return (
			<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
				<div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
					<div className="flex items-center justify-between">
						<Button
							variant="ghost"
							onClick={handleCancel}
							className="gap-2 text-muted-foreground hover:text-foreground pl-0"
						>
							<ArrowLeft className="h-4 w-4" />
							Leave Room
						</Button>
					</div>

					<div className="relative group">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
						<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
							<CardHeader className="text-center pb-4">
								<div className="mx-auto p-4 rounded-full bg-yellow-500/10 mb-4 ring-1 ring-yellow-500/20">
									<Trophy className="h-8 w-8 text-yellow-500" />
								</div>
								<CardTitle className="text-2xl font-bold">Tournament Lobby</CardTitle>
								<CardDescription>
									{isHost ? "You are the host - share the code or wait for players" : "Waiting for host to start"}
								</CardDescription>
							</CardHeader>

							<CardContent className="space-y-6">
								{/* Room Code */}
								<div className="space-y-2">
									<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
										Tournament Code
									</label>
									<div className="flex gap-2">
										<Input
											value={tournamentRoom.roomId}
											readOnly
											className="font-mono text-lg text-center bg-muted/50 tracking-widest"
										/>
										<Button
											variant="outline"
											size="icon"
											onClick={handleCopyCode}
											className={cn(
												"shrink-0 transition-colors",
												copied && "bg-green-500/10 border-green-500/30 text-green-500"
											)}
										>
											{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
										</Button>
									</div>
								</div>

								{/* Players */}
								<div className="space-y-3">
									<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
										Players ({playerCount}/8)
									</label>
									<div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-2">
										{(gameRoom?.joinedPlayers || tournamentRoom.players).map((player, idx) => {
											const isPlayerHost = gameRoom ? Number(player.id) === gameRoom.hostId : idx === 0;
											const isCurrentUser = Number(player.id) === user?.id;
											return (
												<div
													key={player.id}
													className={cn(
														"flex items-center gap-2 p-3 rounded-xl",
														isPlayerHost
															? "bg-primary/10 border border-primary/20"
															: "bg-green-500/10 border border-green-500/20"
													)}
												>
													{isPlayerHost ? (
														<Crown className="h-4 w-4 text-primary" />
													) : (
														<User className="h-4 w-4 text-green-500" />
													)}
													<div className="flex-1 min-w-0">
														<p className="font-semibold truncate text-sm">
															{player.username}{isCurrentUser ? " (You)" : ""}
														</p>
														<p className={cn("text-xs", isPlayerHost ? "text-primary/70" : "text-green-500/70")}>
															{isPlayerHost ? "Host" : "Ready"}
														</p>
													</div>
												</div>
											);
										})}

										{/* Empty slots */}
										{Array.from({ length: Math.max(0, 3 - playerCount) }).map((_, idx) => (
											<div key={`empty-${idx}`} className="flex items-center gap-2 p-3 border border-dashed border-muted-foreground/30 rounded-xl">
												<Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
												<p className="text-sm text-muted-foreground">Waiting...</p>
											</div>
										))}
									</div>
								</div>

								{/* Status */}
								<div className={cn(
									"p-3 rounded-xl text-center text-sm",
									canStart
										? "bg-green-500/10 text-green-500 border border-green-500/20"
										: "bg-muted/50 text-muted-foreground"
								)}>
									{canStart
										? `Ready to start with ${playerCount} players!`
										: `Need ${3 - playerCount} more player${3 - playerCount > 1 ? 's' : ''} to start`
									}
								</div>

								{/* Start/Leave Buttons */}
								{isHost ? (
									<Button
										onClick={handleStartTournament}
										disabled={!canStart}
										size="lg"
										className={cn(
											"w-full text-lg h-14 font-bold transition-all",
											canStart
												? "bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-black shadow-lg shadow-orange-500/20"
												: "bg-muted text-muted-foreground"
										)}
									>
										{canStart ? (
											<>
												<Trophy className="mr-2 h-5 w-5" />
												Start Tournament
											</>
										) : (
											"Waiting for players..."
										)}
									</Button>
								) : (
									<Button
										onClick={handleCancel}
										variant="outline"
										size="lg"
										className="w-full text-lg h-14 font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
									>
										<X className="mr-2 h-5 w-5" />
										Leave Tournament
									</Button>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	// Show searching state
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
					<div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl blur opacity-30 animate-pulse"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-rose-500/10 mb-4 ring-1 ring-rose-500/20 relative">
								<Trophy className="h-8 w-8 text-rose-500" />
								<div className="absolute inset-0 rounded-full border-2 border-rose-500/30 animate-ping"></div>
							</div>
							<CardTitle className="text-2xl font-bold">Finding Tournament</CardTitle>
							<CardDescription>Looking for an available room...</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							{/* Search Animation */}
							<div className="flex justify-center py-8">
								<div className="relative">
									<div className="w-24 h-24 rounded-full border-4 border-muted"></div>
									<div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-rose-500 animate-spin"></div>
									<div className="absolute inset-2 w-20 h-20 rounded-full border-4 border-transparent border-t-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
									<div className="absolute inset-0 flex items-center justify-center">
										<Trophy className="h-8 w-8 text-rose-500 animate-pulse" />
									</div>
								</div>
							</div>

							{/* Stats */}
							<div className="text-center p-4 bg-muted/30 rounded-xl">
								<p className="text-2xl font-bold font-mono">{formatTime(searchTime)}</p>
								<p className="text-xs text-muted-foreground uppercase tracking-wider">Search Time</p>
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
