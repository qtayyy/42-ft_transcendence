"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check, Users, Loader2, Play, Crown, User, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

export default function CreateTournamentRoomPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameRoom } = useGame();
	const [roomId, setRoomId] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [maxPlayers, setMaxPlayers] = useState(8);

	// Create room on mount
	useEffect(() => {
		const createRoom = async () => {
			if (!user || creating || roomId) return;
			setCreating(true);
			try {
				const res = await axios.get("/api/game/room/create");
				setRoomId(res.data.roomId);
				setError(null);
			} catch (err: any) {
				setError(err.response?.data?.error || "Failed to create tournament room");
			} finally {
				setCreating(false);
			}
		};
		createRoom();
	}, [user]);

	// Poll for room updates every 2 seconds
	useEffect(() => {
		if (!user || !isReady || !roomId) return;
		
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
	}, [sendSocketMessage, user, isReady, roomId]);

	const handleCopyCode = () => {
		if (roomId) {
			navigator.clipboard.writeText(roomId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleStartTournament = () => {
		if (!gameRoom || gameRoom.joinedPlayers.length < 3 || !isReady || !roomId) return;
		
		const tournamentId = `RT-${roomId}`;
		
		// Send WebSocket event to notify all players
		sendSocketMessage({
			event: "START_TOURNAMENT",
			payload: {
				roomId,
				tournamentId,
			},
		});
		
		// Host also navigates (but the event handler will do this for everyone)
	};

	const handleLeave = () => {
		if (roomId && user && isReady) {
			sendSocketMessage({
				event: "LEAVE_ROOM",
				payload: { roomId, userId: user.id },
			});
		}
		router.push("/game/remote/tournament");
	};

	const canStart = gameRoom && gameRoom.joinedPlayers.length >= 3;
	const playerCount = gameRoom?.joinedPlayers.length || 1;

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
							<CardDescription>Share the code to invite players (3-8 players)</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							{creating ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
									<span className="ml-3 text-muted-foreground">Creating tournament...</span>
								</div>
							) : error ? (
								<div className="text-center py-8">
									<p className="text-destructive mb-4">{error}</p>
									<Button onClick={() => router.push("/game/remote/tournament")}>
										Go Back
									</Button>
								</div>
							) : roomId && (
								<>
									{/* Room Code */}
									<div className="space-y-2">
										<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
											Tournament Code
										</label>
										<div className="flex gap-2">
											<Input
												value={roomId}
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
											{/* Host */}
											<div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-xl">
												<Crown className="h-4 w-4 text-primary" />
												<div className="flex-1 min-w-0">
													<p className="font-semibold truncate text-sm">{user?.username || "You"}</p>
													<p className="text-xs text-primary/70">Host</p>
												</div>
											</div>

											{/* Other Players */}
											{gameRoom?.joinedPlayers
												.filter(p => p.id !== Number(user?.id))
												.map((player, idx) => (
													<div key={idx} className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
														<User className="h-4 w-4 text-green-500" />
														<div className="flex-1 min-w-0">
															<p className="font-semibold truncate text-sm">{player.username}</p>
															<p className="text-xs text-green-500/70">Ready</p>
														</div>
													</div>
												))}

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

									{/* Start Button */}
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
								</>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
