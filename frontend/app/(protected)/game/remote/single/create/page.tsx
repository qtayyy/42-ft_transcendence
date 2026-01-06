"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check, Users, Loader2, Play, Crown, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

export default function CreateRoomPage() {
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameRoom, onlineFriends } = useGame();
	const [roomId, setRoomId] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
				setError(err.response?.data?.error || "Failed to create room");
			} finally {
				setCreating(false);
			}
		};
		createRoom();
	}, [user]);

	// Poll for room updates
	useEffect(() => {
		if (!user || !isReady || !roomId) return;
		sendSocketMessage({
			event: "GET_GAME_ROOM",
			payload: { userId: user.id },
		});
	}, [sendSocketMessage, user, isReady, roomId]);

	const handleCopyCode = () => {
		if (roomId) {
			navigator.clipboard.writeText(roomId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleStartGame = () => {
		if (!gameRoom || gameRoom.joinedPlayers.length < 2) return;
		// Navigate to game with room ID
		router.push(`/game/RS-${roomId}`);
	};

	const handleLeave = () => {
		if (roomId && user && isReady) {
			sendSocketMessage({
				event: "LEAVE_ROOM",
				payload: { roomId, userId: user.id },
			});
		}
		router.push("/game/remote/single");
	};

	const canStart = gameRoom && gameRoom.joinedPlayers.length >= 2;

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
					<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-blue-500/10 mb-4 ring-1 ring-blue-500/20">
								<Users className="h-8 w-8 text-blue-500" />
							</div>
							<CardTitle className="text-2xl font-bold">Game Room</CardTitle>
							<CardDescription>Share the code with a friend to join</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							{/* Room Code */}
							{creating ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-blue-500" />
									<span className="ml-3 text-muted-foreground">Creating room...</span>
								</div>
							) : error ? (
								<div className="text-center py-8">
									<p className="text-destructive mb-4">{error}</p>
									<Button onClick={() => router.push("/game/remote/single")}>
										Go Back
									</Button>
								</div>
							) : roomId && (
								<>
									<div className="space-y-2">
										<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
											Room Code
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
											Players ({gameRoom?.joinedPlayers.length || 1}/2)
										</label>
										<div className="space-y-2">
											{/* Host (Current User) */}
											<div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
												<div className="p-2 bg-primary/20 rounded-full">
													<Crown className="h-4 w-4 text-primary" />
												</div>
												<div className="flex-1">
													<p className="font-semibold">{user?.username || "You"}</p>
													<p className="text-xs text-primary/70">Host</p>
												</div>
											</div>

											{/* Other Players */}
											{gameRoom?.joinedPlayers
												.filter(p => p.id !== user?.id)
												.map((player, idx) => (
													<div key={idx} className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
														<div className="p-2 bg-green-500/20 rounded-full">
															<User className="h-4 w-4 text-green-500" />
														</div>
														<div className="flex-1">
															<p className="font-semibold">{player.username}</p>
															<p className="text-xs text-green-500/70">Ready</p>
														</div>
													</div>
												))}

											{/* Waiting for player */}
											{(!gameRoom || gameRoom.joinedPlayers.length < 2) && (
												<div className="flex items-center gap-3 p-3 border border-dashed border-muted-foreground/30 rounded-xl">
													<div className="p-2 bg-muted rounded-full">
														<Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
													</div>
													<div className="flex-1">
														<p className="text-muted-foreground">Waiting for opponent...</p>
													</div>
												</div>
											)}
										</div>
									</div>

									{/* Start Button */}
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
										{canStart ? (
											<>
												<Play className="mr-2 h-5 w-5 fill-current" />
												Start Game
											</>
										) : (
											"Waiting for opponent..."
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
