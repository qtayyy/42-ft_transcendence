"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogIn, Loader2, AlertCircle, Users, Crown, User, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function JoinRoomPage() {
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

		// Issue #26: Basic UUID validation for room code
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!uuidRegex.test(roomCode.trim())) {
			setError("Invalid room code format (must be a valid UUID)");
			return;
		}
		
		setJoining(true);
		setError(null);

		
		// Send join request via WebSocket calls
		sendSocketMessage({
			event: "JOIN_ROOM_BY_CODE",
			payload: {
				roomId: roomCode.trim(),
				userId: user.id,
				username: user.username,
			},
		});
		// Do not setJoined(true) here immediately. Wait for JOIN_ROOM event.
	};

	useEffect(() => {
		const handleJoinSuccess = () => {
			setJoined(true);
			setJoining(false);
		};

		const handleJoinError = (e: CustomEvent) => {
			// e.detail is the payload
			setError(e.detail?.message || "Failed to join room");
			setJoining(false);
		};

		window.addEventListener("JOIN_ROOM", handleJoinSuccess);
		window.addEventListener("JOIN_ROOM_ERROR", handleJoinError as EventListener);

		return () => {
			window.removeEventListener("JOIN_ROOM", handleJoinSuccess);
			window.removeEventListener("JOIN_ROOM_ERROR", handleJoinError as EventListener);
		};
	}, []);

	const handleStartGame = () => {
		if (!gameRoom || gameRoom.joinedPlayers.length < 2) return;
		router.push(`/game/RS-${roomCode.trim()}`);
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
		router.push("/game/remote/single");
	};

	const isHost = gameRoom?.hostId === Number(user?.id);
	const canStart = gameRoom && gameRoom.joinedPlayers.length >= 2;

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
							Leave Room
						</Button>
					</div>

					<div className="relative group">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
						<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
							<CardHeader className="text-center pb-4">
								<div className="mx-auto p-4 rounded-full bg-purple-500/10 mb-4 ring-1 ring-purple-500/20">
									<Users className="h-8 w-8 text-purple-500" />
								</div>
								<CardTitle className="text-2xl font-bold">Game Lobby</CardTitle>
								<CardDescription>Waiting for host to start the game</CardDescription>
							</CardHeader>

							<CardContent className="space-y-6">
								{/* Players */}
								<div className="space-y-3">
									<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
										Players ({gameRoom.joinedPlayers.length}/2)
									</label>
									<div className="space-y-2">
										{gameRoom.joinedPlayers.map((player, idx) => (
											<div 
												key={idx} 
												className={cn(
													"flex items-center gap-3 p-3 rounded-xl",
													player.id === gameRoom.hostId 
														? "bg-primary/10 border border-primary/20"
														: "bg-green-500/10 border border-green-500/20"
												)}
											>
												<div className={cn(
													"p-2 rounded-full",
													player.id === gameRoom.hostId ? "bg-primary/20" : "bg-green-500/20"
												)}>
													{player.id === gameRoom.hostId 
														? <Crown className="h-4 w-4 text-primary" />
														: <User className="h-4 w-4 text-green-500" />
													}
												</div>
												<div className="flex-1">
													<p className="font-semibold">{player.username}</p>
													<p className={cn(
														"text-xs",
														player.id === gameRoom.hostId ? "text-primary/70" : "text-green-500/70"
													)}>
														{player.id === gameRoom.hostId ? "Host" : "Ready"}
													</p>
												</div>
											</div>
										))}
										
										{gameRoom.joinedPlayers.length < 2 && (
											<div className="flex items-center gap-3 p-3 border border-dashed border-muted-foreground/30 rounded-xl">
												<div className="p-2 bg-muted rounded-full">
													<Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
												</div>
												<p className="text-muted-foreground">Waiting for opponent...</p>
											</div>
										)}
									</div>
								</div>

								{/* Status message */}
								<div className={cn(
									"p-3 rounded-xl text-center text-sm",
									canStart 
										? "bg-green-500/10 text-green-500 border border-green-500/20"
										: "bg-muted/50 text-muted-foreground"
								)}>
									{isHost 
										? (canStart ? "Ready to start!" : "Waiting for opponent to join...")
										: (canStart ? "Waiting for host to start..." : "Waiting for more players...")
									}
								</div>

								{/* Start button (only for host) */}
								{isHost && (
									<Button
										onClick={handleStartGame}
										disabled={!canStart}
										size="lg"
										className={cn(
											"w-full text-lg h-14 font-bold transition-all",
											canStart 
												? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/20"
												: "bg-muted text-muted-foreground"
										)}
									>
										<Play className="mr-2 h-5 w-5 fill-current" />
										Start Game
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
						onClick={() => router.push("/game/remote/single")}
						className="gap-2 text-muted-foreground hover:text-foreground pl-0"
					>
						<ArrowLeft className="h-4 w-4" />
						Back
					</Button>
				</div>

				<div className="relative group">
					<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-purple-500/10 mb-4 ring-1 ring-purple-500/20">
								<LogIn className="h-8 w-8 text-purple-500" />
							</div>
							<CardTitle className="text-2xl font-bold">Join Room</CardTitle>
							<CardDescription>Enter the room code to join a game</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							<div className="space-y-2">
								<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
									Room Code
								</label>
								<Input
									value={roomCode}
									onChange={(e) => setRoomCode(e.target.value)}
									placeholder="Enter room code..."
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
								className="w-full text-lg h-14 font-bold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg shadow-purple-500/20"
							>
								{joining ? (
									<>
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Joining...
									</>
								) : (
									<>
										<LogIn className="mr-2 h-5 w-5" />
										Join Game
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
