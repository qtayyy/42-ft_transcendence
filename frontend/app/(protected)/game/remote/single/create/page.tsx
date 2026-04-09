"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Check, Users, Loader2, Play, Crown, User, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { handleSessionExpiredRedirect } from "@/lib/session-expired";

export default function CreateRoomPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const { sendSocketMessage, isReady, reconnectSocket } = useSocket();
	const { gameRoom, onlineFriends } = useGame();
	const [roomId, setRoomId] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [copiedLan, setCopiedLan] = useState(false);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lanInfo, setLanInfo] = useState<{ ip: string; port: number } | null>(null);
	const hasSentMatchmakingJoinRef = useRef(false);
	const isMatchmakingMode = searchParams.get("matchmaking") === "true";

	useEffect(() => {
		if (!user || isReady) return;

		reconnectSocket();
		const interval = window.setInterval(() => {
			reconnectSocket();
		}, 1500);

		return () => window.clearInterval(interval);
	}, [user, isReady, reconnectSocket]);

	const sendJoinMatchmaking = useCallback(() => {
		if (!user) return;
		if (!isReady) {
			reconnectSocket();
			return;
		}
		sendSocketMessage({
			event: "JOIN_MATCHMAKING",
			payload: {
				userId: user.id,
				username: user.username,
				mode: "single",
			},
		});
	}, [user, isReady, sendSocketMessage, reconnectSocket]);

	// Public matchmaking mode: join queue directly from create page.
	useEffect(() => {
		if (!isMatchmakingMode || !user || !isReady) return;
		const me = Number(user.id);
		const isSingleRoom = gameRoom?.isTournament !== true;
		const isMember = isSingleRoom && gameRoom?.joinedPlayers?.some((p) => Number(p.id) === me);
		if (isMember) return;
		if (hasSentMatchmakingJoinRef.current) return;
		hasSentMatchmakingJoinRef.current = true;
		sendJoinMatchmaking();
	}, [isMatchmakingMode, user, isReady, gameRoom, sendJoinMatchmaking]);

	// If the shared socket reconnects while we're still queueing, allow requeue.
	useEffect(() => {
		if (!isReady) {
			hasSentMatchmakingJoinRef.current = false;
		}
	}, [isReady]);

	// Keep room info in sync and redirect non-hosts to join lobby.
	useEffect(() => {
		if (!isMatchmakingMode || !gameRoom || !user) return;
		const me = Number(user.id);
		const isMember = gameRoom.joinedPlayers?.some((p) => Number(p.id) === me);
		if (!isMember) return;

		setRoomId(gameRoom.roomId);
		if (Number(gameRoom.hostId) !== me) {
			router.push(`/game/remote/single/join?roomId=${gameRoom.roomId}&matchmaking=true`);
		}
	}, [isMatchmakingMode, gameRoom, user, router]);

	// Keep nudging the queue join while we have no room assignment yet.
	useEffect(() => {
		if (!isMatchmakingMode || !user || !isReady || roomId) return;

		const retry = setInterval(() => {
			const me = Number(user.id);
			const isSingleRoom = gameRoom?.isTournament !== true;
			const isMember = isSingleRoom && gameRoom?.joinedPlayers?.some((p) => Number(p.id) === me);
			if (!isMember) {
				sendJoinMatchmaking();
			}
		}, 5000);

		return () => clearInterval(retry);
	}, [isMatchmakingMode, user, isReady, roomId, gameRoom, sendJoinMatchmaking]);

	// Fetch LAN IP once
	useEffect(() => {
		axios.get("/api/lan/info")
			.then(r => setLanInfo(r.data))
			.catch(() => {/* not critical */});
	}, []);

	// Create room on mount
	useEffect(() => {
		const createRoom = async () => {
			if (isMatchmakingMode) return;

			// If we already have a gameRoom (e.g. from matchmaking host redirect), uses that
			if (gameRoom && gameRoom.hostId === Number(user?.id)) {
				setRoomId(gameRoom.roomId);
				return;
			}

			if (!user || creating || roomId) return;
			setCreating(true);
			try {
				const res = await axios.get("/api/game/room/create?maxPlayers=2");
				setRoomId(res.data.roomId);
				setError(null);
			} catch (err: unknown) {
				if (handleSessionExpiredRedirect(err, router, "/game/remote/single")) return;
				const errorMessage =
					axios.isAxiosError(err) && err.response?.data?.error
						? String(err.response.data.error)
						: "Failed to create room";
				setError(errorMessage);
			} finally {
				setCreating(false);
			}
		};
		createRoom();
	}, [user, gameRoom, isMatchmakingMode]);

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
	}, [user, isReady, roomId, sendSocketMessage]);

	const handleCopyCode = () => {
		if (roomId) {
			navigator.clipboard.writeText(roomId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleCopyLanUrl = () => {
		if (lanInfo && roomId) {
			const url = `https://${lanInfo.ip}:${lanInfo.port}/game/remote/single/join?roomId=${roomId}`;
			navigator.clipboard.writeText(url);
			setCopiedLan(true);
			setTimeout(() => setCopiedLan(false), 2000);
		}
	};

	const handleStartGame = () => {
		console.log('🎮 [Start Match] Button clicked!');
		console.log('🎮 [Start Match] Checking conditions:', {
			hasGameRoom: !!gameRoom,
			playerCount: gameRoom?.joinedPlayers.length,
			roomId: roomId,
			isReady: isReady
		});

		if (!gameRoom || gameRoom.joinedPlayers.length < 2 || !roomId || !isReady) {
			console.error('❌ [Start Match] Cannot start game - conditions not met:', {
				gameRoom: !!gameRoom,
				players: gameRoom?.joinedPlayers.length || 0,
				roomId: roomId,
				socketReady: isReady
			});
			return;
		}

		console.log('✅ [Start Match] All conditions met! Sending START_ROOM_GAME event');
		// Send start game event - both players will receive GAME_MATCH_START
		sendSocketMessage({
			event: "START_ROOM_GAME",
			payload: { roomId },
		});
		console.log('📤 [Start Match] Event sent successfully');
	};

	const handleLeave = () => {
		if (isMatchmakingMode && user && isReady) {
			sendSocketMessage({
				event: "LEAVE_MATCHMAKING",
				payload: { userId: user.id },
			});
		}
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
		<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-linear-to-b from-background to-muted/20">
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
					<div className="absolute -inset-0.5 bg-linear-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
					<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
						<CardHeader className="text-center pb-4">
							<div className="mx-auto p-4 rounded-full bg-blue-500/10 mb-4 ring-1 ring-blue-500/20">
								<Users className="h-8 w-8 text-blue-500" />
							</div>
							<CardTitle className="text-2xl font-bold">{isMatchmakingMode ? "Finding Opponent" : "Game Room"}</CardTitle>
							<CardDescription>{isMatchmakingMode ? "Searching public queue and preparing your lobby..." : "Share the code with a friend to join"}</CardDescription>
						</CardHeader>

						<CardContent className="space-y-6">
							{/* Room Code */}
							{(isMatchmakingMode && !roomId && !error) ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-8 w-8 animate-spin text-blue-500" />
									<span className="ml-3 text-muted-foreground">Searching matchmaking...</span>
								</div>
							) : creating ? (
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

									{/* LAN Section */}
									{lanInfo && (
										<div className="space-y-2">
											<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
												<Wifi className="h-3 w-3" /> LAN Join Link
											</label>
											<div className="flex gap-2">
												<Input
													value={`https://${lanInfo.ip}:${lanInfo.port}/game/remote/single/join?roomId=${roomId}`}
													readOnly
													className="font-mono text-xs bg-muted/50"
												/>
												<Button
													variant="outline"
													size="icon"
													onClick={handleCopyLanUrl}
													className={cn(
														"shrink-0 transition-colors",
														copiedLan && "bg-green-500/10 border-green-500/30 text-green-500"
													)}
												>
													{copiedLan ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
												</Button>
											</div>
											<p className="text-[10px] text-muted-foreground">
												Player 2 on the same WiFi can open this link directly
											</p>
										</div>
									)}

									{/* Players */}
									<div className="space-y-3">
										<label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
											Players ({gameRoom?.joinedPlayers.length || 1}/{gameRoom?.maxPlayers || 2})
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
												.filter(p => p.id !== Number(user?.id))
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
												? "bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/20"
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
