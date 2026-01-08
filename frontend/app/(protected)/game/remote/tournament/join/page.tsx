"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogIn, Loader2, AlertCircle, Trophy, Crown, User, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function JoinTournamentPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameRoom } = useGame();
	const [roomCode, setRoomCode] = useState("");
	const [joining, setJoining] = useState(false);
	const [joined, setJoined] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Poll for room updates after joining
	useEffect(() => {
		if (!joined || !user || !isReady) return;
		
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
	}, [joined, user, isReady, sendSocketMessage]);

	// Stop joining spinner when room data received
	useEffect(() => {
		if (gameRoom && joined) {
			setJoining(false);
		}
	}, [gameRoom, joined]);

	const handleJoin = () => {
		if (!roomCode.trim() || !user || !isReady) return;
		
		setJoining(true);
		setError(null);

		try {
			sendSocketMessage({
				event: "JOIN_ROOM_BY_CODE",
				payload: {
					roomId: roomCode.trim(),
					userId: user.id,
					username: user.username,
				},
			});
			setJoined(true);
		} catch (err: any) {
			setError(err.message || "Failed to join tournament");
			setJoining(false);
		}
	};

	const handleStartTournament = () => {
		if (!gameRoom || gameRoom.joinedPlayers.length < 3 || !isReady) return;
		
		const tournamentId = `RT-${roomCode.trim()}`;
		
		// Send WebSocket event to notify all players
		sendSocketMessage({
			event: "START_TOURNAMENT",
			payload: {
				roomId: roomCode.trim(),
				tournamentId,
			},
		});
		
		// Host also navigates (but the event handler will do this for everyone)
	};

	const handleLeave = () => {
		if (joined && user && isReady && roomCode) {
			sendSocketMessage({
				event: "LEAVE_ROOM",
				payload: { roomId: roomCode.trim(), userId: user.id },
			});
		}
		setJoined(false);
		setRoomCode("");
		router.push("/game/remote/tournament");
	};

	const isHost = gameRoom?.hostId === Number(user?.id);
	const canStart = gameRoom && gameRoom.joinedPlayers.length >= 3;
	const playerCount = gameRoom?.joinedPlayers.length || 0;

	// Show lobby view after joining
	if (joined && gameRoom) {
		return (
			<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
				<div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
					
					<div className="flex items-center justify-between">
						<Button 
							variant="ghost" 
							onClick={handleLeave}
							className="gap-2 text-muted-foreground hover:text-foreground pl-0"
						>
							<ArrowLeft className="h-4 w-4" />
							Leave Tournament
						</Button>
					</div>

					<div className="relative group">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
						<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
							<CardHeader className="text-center pb-4">
								<div className="mx-auto p-4 rounded-full bg-emerald-500/10 mb-4 ring-1 ring-emerald-500/20">
									<Trophy className="h-8 w-8 text-emerald-500" />
								</div>
								<CardTitle className="text-2xl font-bold">Tournament Lobby</CardTitle>
								<CardDescription>Waiting for host to start</CardDescription>
							</CardHeader>

							<CardContent className="space-y-6">
								{/* Players */}
								<div className="space-y-3">
									<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
										Players ({playerCount}/8)
									</label>
									<div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-2">
										{gameRoom.joinedPlayers.map((player, idx) => (
											<div 
												key={idx} 
												className={cn(
													"flex items-center gap-2 p-3 rounded-xl",
													player.id === gameRoom.hostId 
														? "bg-primary/10 border border-primary/20"
														: "bg-green-500/10 border border-green-500/20"
												)}
											>
												{player.id === gameRoom.hostId 
													? <Crown className="h-4 w-4 text-primary" />
													: <User className="h-4 w-4 text-green-500" />
												}
												<div className="flex-1 min-w-0">
													<p className="font-semibold truncate text-sm">{player.username}</p>
													<p className={cn(
														"text-xs",
														player.id === gameRoom.hostId ? "text-primary/70" : "text-green-500/70"
													)}>
														{player.id === gameRoom.hostId ? "Host" : "Ready"}
													</p>
												</div>
											</div>
										))}
										
										{playerCount < 3 && Array.from({ length: 3 - playerCount }).map((_, idx) => (
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
									{isHost 
										? (canStart ? `Ready with ${playerCount} players!` : `Need ${3 - playerCount} more player(s)`)
										: (canStart ? "Waiting for host to start..." : `Waiting for ${3 - playerCount} more player(s)...`)
									}
								</div>

								{/* Start button (only for host) */}
								{isHost && (
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
										<Trophy className="mr-2 h-5 w-5" />
										Start Tournament
									</Button>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	// Show join form
	return (
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
				
				<div className="flex items-center justify-between">
					<Button 
						variant="ghost" 
						onClick={() => router.push("/game/remote/tournament")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-emerald-500/10 mb-4 ring-1 ring-emerald-500/20">
								<Trophy className="h-8 w-8 text-emerald-500" />
							</div>
							<CardTitle className="text-2xl font-bold">Join Tournament</CardTitle>
							<CardDescription>Enter the tournament code to join</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							<div className="space-y-2">
								<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
									Tournament Code
								</label>
								<Input
									value={roomCode}
									onChange={(e) => setRoomCode(e.target.value)}
									placeholder="Enter tournament code..."
									className="font-mono text-lg text-center tracking-widest h-14"
									onKeyPress={(e) => e.key === "Enter" && handleJoin()}
									disabled={joining}
								/>
							</div>

							{error && (
								<div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
									<AlertCircle className="h-4 w-4 shrink-0" />
									{error}
								</div>
							)}

							<Button
								onClick={handleJoin}
								disabled={!roomCode.trim() || joining}
								size="lg"
								className="w-full text-lg h-14 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20"
							>
								{joining ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Joining...
									</>
								) : (
									<>
										<LogIn className="mr-2 h-5 w-5" />
										Join Tournament
									</>
								)}
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
