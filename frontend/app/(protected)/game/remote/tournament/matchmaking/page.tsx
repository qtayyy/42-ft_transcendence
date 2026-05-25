"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Trophy, Loader2, X, Crown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/languageContext";
import {
	buildRemoteTournamentId,
	validateRemoteMatchmakingMode,
	validateRemotePlayerCount,
	validateRemoteRoomCode,
	validateRemoteTournamentId,
} from "@/lib/remote-play-validation";

interface TournamentRoom {
	roomId: string;
	tournamentId: string;
	players: { id: number; username: string }[];
	isHost?: boolean;
}

export default function TournamentMatchmakingPage() {
	const router = useRouter();
	const { t } = useLanguage();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameRoom, setGameRoom } = useGame();
	const [searching, setSearching] = useState(true);
	const [searchTime, setSearchTime] = useState(0);
	const [tournamentRoom, setTournamentRoom] = useState<TournamentRoom | null>(null);
	const hasSentJoinRef = useRef(false);
	const recoveredTournamentRoom = useMemo(() => {
		if (!user || !gameRoom?.isTournament) return null;
		if (gameRoom.tournamentStarted) return null;

		const me = Number(user.id);
		const isMember = gameRoom.joinedPlayers?.some((p) => Number(p.id) === me);
		if (!isMember) return null;

		return {
			roomId: gameRoom.roomId,
			tournamentId: `RT-${gameRoom.roomId}`,
			players: gameRoom.joinedPlayers,
			isHost: Number(gameRoom.hostId) === me,
		};
	}, [user, gameRoom]);
	const activeTournamentRoom = tournamentRoom ?? recoveredTournamentRoom;

	const sendJoinMatchmaking = useCallback(() => {
		if (!user || !isReady) return;
		const mode = validateRemoteMatchmakingMode("tournament");
		if (!mode.ok) return;
		sendSocketMessage({
			event: "JOIN_MATCHMAKING",
			payload: {
				userId: user.id,
				username: user.username,
				mode: mode.value,
			},
		});
	}, [user, isReady, sendSocketMessage]);

	// Search timer (only while searching)
	useEffect(() => {
		if (!searching || activeTournamentRoom) return;
		const timer = setInterval(() => {
			setSearchTime(prev => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [searching, activeTournamentRoom]);

	// Join matchmaking on mount
	useEffect(() => {
		if (!searching || !user || !isReady) return;
		const me = Number(user.id);
		const isTournamentRoom = gameRoom?.isTournament === true;
		const isMember = isTournamentRoom && gameRoom?.joinedPlayers?.some((p) => Number(p.id) === me);
		if (isMember) return;
		if (hasSentJoinRef.current) return;
		hasSentJoinRef.current = true;
		sendJoinMatchmaking();
	}, [searching, user, isReady, gameRoom, sendJoinMatchmaking]);

	useEffect(() => {
		if (!isReady) {
			hasSentJoinRef.current = false;
		}
	}, [isReady]);

	// Listen for TOURNAMENT_FOUND event
	useEffect(() => {
		const handleTournamentFound = (event: CustomEvent) => {
			const payload = event.detail;
			const roomCodeResult = validateRemoteRoomCode(payload?.roomId, "Tournament code");
			const tournamentIdResult = roomCodeResult.ok
				? validateRemoteTournamentId(payload?.tournamentId, roomCodeResult.value)
				: roomCodeResult;
			const hasValidLobbyPlayers =
				Array.isArray(payload?.players) &&
				payload.players.length >= 1 &&
				payload.players.length <= 8;
			if (!roomCodeResult.ok || !tournamentIdResult.ok || !hasValidLobbyPlayers) {
				console.error("Ignoring invalid tournament matchmaking payload:", payload);
				setSearching(false);
				return;
			}
			setTournamentRoom({
				roomId: roomCodeResult.value,
				tournamentId: tournamentIdResult.value,
				players: payload.players,
				isHost: payload.isHost,
			});
			setSearching(false);
		};

		const handleRoomError = (event: CustomEvent) => {
			if (!searching || activeTournamentRoom) {
				console.warn("Ignoring generic room error after tournament lobby was already created:", event.detail);
				return;
			}
			console.error("Failed to join tournament matchmaking:", event.detail);
			setSearching(false);
			// The socket-context already shows a toast.error, so we just need to route back
			setTimeout(() => {
				router.push("/game/remote/tournament");
			}, 1000);
		};

		window.addEventListener("TOURNAMENT_FOUND", handleTournamentFound as EventListener);
		window.addEventListener("JOIN_ROOM_ERROR", handleRoomError as EventListener);
		return () => {
			window.removeEventListener("TOURNAMENT_FOUND", handleTournamentFound as EventListener);
			window.removeEventListener("JOIN_ROOM_ERROR", handleRoomError as EventListener);
		};
	}, [router, searching, activeTournamentRoom]);

	// Poll for room updates when in lobby
	useEffect(() => {
		if (!user || !isReady || !activeTournamentRoom) return;

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
	}, [sendSocketMessage, user, isReady, activeTournamentRoom]);

	useEffect(() => {
		if (!searching || !user || !isReady || activeTournamentRoom) return;

		const retry = setInterval(() => {
			const me = Number(user.id);
			const isTournamentRoom = gameRoom?.isTournament === true;
			const isMember = isTournamentRoom && gameRoom?.joinedPlayers?.some((p) => Number(p.id) === me);
			if (!isMember) {
				sendJoinMatchmaking();
			}
		}, 5000);

		return () => clearInterval(retry);
	}, [searching, user, isReady, activeTournamentRoom, gameRoom, sendJoinMatchmaking]);

	const handleCancel = () => {
		setSearching(false);
		setTournamentRoom(null);
		setGameRoom(null);
		if (user && isReady) {
			if (activeTournamentRoom) {
				const roomCodeResult = validateRemoteRoomCode(
					activeTournamentRoom.roomId,
					"Tournament code"
				);
				if (!roomCodeResult.ok) return;
				// Leave the room
				sendSocketMessage({
					event: "LEAVE_ROOM",
					payload: { roomId: roomCodeResult.value, userId: user.id },
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

	const handleStartTournament = () => {
		const roomId = activeTournamentRoom?.roomId || gameRoom?.roomId;
		const roomCodeResult = validateRemoteRoomCode(roomId, "Tournament code");
		const tournamentIdResult = roomCodeResult.ok
			? validateRemoteTournamentId(
					activeTournamentRoom?.tournamentId ||
						buildRemoteTournamentId(roomCodeResult.value),
					roomCodeResult.value
			  )
			: roomCodeResult;
		const playerCountResult = validateRemotePlayerCount(
			gameRoom?.joinedPlayers.length || activeTournamentRoom?.players.length,
			"tournament"
		);

		console.log("[Tournament] Start requested", {
			roomId,
			tournamentId: tournamentIdResult.ok ? tournamentIdResult.value : "",
			isReady,
			hasTournamentRoom: !!activeTournamentRoom,
			hasGameRoom: !!gameRoom,
			gameRoomId: gameRoom?.roomId,
			tournamentRoomId: activeTournamentRoom?.roomId,
			playerCount: gameRoom?.joinedPlayers.length || activeTournamentRoom?.players.length
		});

		if (!roomCodeResult.ok || !tournamentIdResult.ok || !playerCountResult.ok || !isReady) {
			console.warn("[Tournament] Cannot start: missing roomId or socket not ready");
			toast.error(
				!roomCodeResult.ok
					? roomCodeResult.error
					: !tournamentIdResult.ok
						? tournamentIdResult.error
						: !playerCountResult.ok
							? playerCountResult.error
							: "Cannot start tournament: socket not ready"
			);
			return;
		}

		toast.loading(t.Game["Starting tournament..."], { id: "start-tournament" });

		sendSocketMessage({
			event: "START_TOURNAMENT",
			payload: {
				roomId: roomCodeResult.value,
				tournamentId: tournamentIdResult.value,
			},
		});

		// Set a timeout to clear loading if it takes too long
		setTimeout(() => {
			toast.dismiss("start-tournament");
		}, 5000);
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const playerCount = gameRoom?.joinedPlayers.length || activeTournamentRoom?.players.length || 1;
	const isHost = gameRoom ? gameRoom.hostId === Number(user?.id) : activeTournamentRoom?.isHost;
	const canStart = validateRemotePlayerCount(playerCount, "tournament").ok;

	// Show lobby if we have a tournament room
	if (activeTournamentRoom) {
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
							{t.Game["Leave Room"]}
						</Button>
					</div>

					<div className="relative group">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
						<Card className="relative border-0 bg-card/95 backdrop-blur-sm shadow-2xl">
							<CardHeader className="text-center pb-4">
								<div className="mx-auto p-4 rounded-full bg-yellow-500/10 mb-4 ring-1 ring-yellow-500/20">
									<Trophy className="h-8 w-8 text-yellow-500" />
								</div>
								<CardTitle className="text-2xl font-bold">{t.Game["Tournament Lobby"]}</CardTitle>
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
											value={activeTournamentRoom.roomId}
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
										{t.Game["Players ({count}/8)"].replace("{count}", String(playerCount))}
									</label>
									<div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-2">
										{(gameRoom?.joinedPlayers || activeTournamentRoom.players).map((player, idx) => {
											const isPlayerHost = gameRoom ? Number(player.id) === gameRoom.hostId : idx === 0;
											const isCurrentUser = Number(player.id) === Number(user?.id);
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
															{player.username}{isCurrentUser ? ` ${t.Game["(You)"]}` : ""}
														</p>
														<p className={cn("text-xs", isPlayerHost ? "text-primary/70" : "text-green-500/70")}>
															{isPlayerHost ? t.Game["Host"] : t.Game["Ready"]}
														</p>
													</div>
												</div>
											);
										})}

										{/* Empty slots */}
										{Array.from({ length: Math.max(0, 3 - playerCount) }).map((_, idx) => (
											<div key={`empty-${idx}`} className="flex items-center gap-2 p-3 border border-dashed border-muted-foreground/30 rounded-xl">
												<Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
												<p className="text-sm text-muted-foreground">{t.Game["Waiting..."]}</p>
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
										? t.Game["Ready to start with {count} players!"].replace("{count}", String(playerCount))
										: (3 - playerCount > 1
											? t.Game["Need {count} more players to start"].replace("{count}", String(3 - playerCount))
											: t.Game["Need {count} more player to start"].replace("{count}", String(3 - playerCount)))
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
												{t.Game["Start Tournament"]}
											</>
										) : (
											t.Game["Waiting for players..."]
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
										{t.Game["Leave Tournament"]}
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
						{t.Game["Cancel"]}
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
							<CardTitle className="text-2xl font-bold">{t.Game["Finding Tournament"]}</CardTitle>
							<CardDescription>{t.Game["Looking for an available room..."]}</CardDescription>
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
								<p className="text-xs text-muted-foreground uppercase tracking-wider">{t.Game["Search Time"]}</p>
							</div>

							{/* Cancel Button */}
							<Button
								onClick={handleCancel}
								variant="outline"
								size="lg"
								className="w-full text-lg h-14 font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
							>
								<X className="mr-2 h-5 w-5" />
								{t.Game["Cancel Search"]}
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
