"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Leaderboard from "@/components/game/Leaderboard";
import { Tournament, TournamentMatch, PlayerStanding } from "@/lib/tournament";
import { Play, Trophy, ArrowLeft, Crown, History, Medal, Star, Loader2, Users, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RemoteTournamentState {
	tournamentId: string;
	format: 'round-robin' | 'swiss';
	playerCount: number;
	currentRound: number;
	totalRounds: number;
	matches: TournamentMatch[];
	leaderboard: PlayerStanding[];
	isComplete: boolean;
}

export default function RemoteTournamentPage() {
	const params = useParams();
	const router = useRouter();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameState, gameRoom } = useGame();
	const tournamentId = params.tournamentId as string;

	const [tournament, setTournament] = useState<RemoteTournamentState | null>(null);
	const [loading, setLoading] = useState(true);
	const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
	const [isCreatingTournament, setIsCreatingTournament] = useState(false);
	// Calculate readiness derived from current match state
	const isMeReady = useMemo(() => {
		if (!currentMatch || !user) return false;
		const isP1 = String(currentMatch.player1.id) === String(user.id) || currentMatch.player1.name === user.username;
		const isP2 = currentMatch.player2 && (String(currentMatch.player2.id) === String(user.id) || currentMatch.player2.name === user.username);
		return (isP1 && (currentMatch as any).p1Ready) || (isP2 && (currentMatch as any).p2Ready);
	}, [currentMatch, user]);

	// Extract roomId from tournamentId (RT-{roomId})
	const roomId = tournamentId.startsWith('RT-') ? tournamentId.slice(3) : tournamentId;

	// Helper to find valid next match (prioritizing user's match in current round)
	const getNextMatch = useCallback((matches: TournamentMatch[], currentRound: number) => {
		if (!user) return matches.find(m => m.status === 'pending' && m.round === currentRound) || null;
		
		// Filter for matches in the current round
		const currentRoundMatches = matches.filter(m => m.round === currentRound);

		const isMyMatch = (m: TournamentMatch) => {
			const p1Match = String(m.player1.id) === String(user.id) || m.player1.name === user.username;
			const p2Match = m.player2 && (String(m.player2.id) === String(user.id) || m.player2.name === user.username);
			return p1Match || p2Match;
		};

		// 1. Look for active (inprogress) match for the user
		const myActiveMatch = currentRoundMatches.find(m => 
			isMyMatch(m) && m.status === 'inprogress'
		);
		if (myActiveMatch) return myActiveMatch;

		// 2. Look for pending match for the user
		const myPendingMatch = currentRoundMatches.find(m => 
			isMyMatch(m) && m.status === 'pending'
		);
		if (myPendingMatch) return myPendingMatch;

		// 3. Fallback: Return any available match in current round (for spectators)
		return currentRoundMatches.find(m => m.status === 'inprogress' || m.status === 'pending') || null;
	}, [user]);

	// Initialize tournament when page loads
	useEffect(() => {
		const initTournament = async () => {
			if (!user) return;

			// Try to get existing tournament first
			try {
				const response = await axios.get(`/api/tournament/${tournamentId}`);
				setTournament({
					tournamentId: response.data.tournamentId || tournamentId,
					format: response.data.format,
					playerCount: response.data.leaderboard?.length || 0,
					currentRound: response.data.currentRound || 1,
					totalRounds: response.data.totalRounds,
					matches: response.data.matches,
					leaderboard: response.data.leaderboard,
					isComplete: response.data.isComplete || false,
				});
				
				// Find next pending match
				const nextMatch = getNextMatch(response.data.matches, response.data.currentRound || 1);
				setCurrentMatch(nextMatch);
				setLoading(false);
			} catch (error: any) {
				if (error.response?.status === 404 && gameRoom) {
					// Tournament doesn't exist and we have gameRoom info, create it
					await createTournament();
				} else if (error.response?.status === 404) {
					// Tournament doesn't exist and no gameRoom - wait and retry
					console.log("Tournament not found yet, waiting for creation...");
					setTimeout(initTournament, 2000);
				} else {
					console.error("Failed to load tournament:", error);
					setLoading(false);
				}
			}
		};

		initTournament();
	}, [tournamentId, gameRoom, user]);

	// Create tournament from room players
	const createTournament = async () => {
		if (!gameRoom || isCreatingTournament) return;
		
		setIsCreatingTournament(true);
		try {
			// Convert room players to tournament format
			const players = gameRoom.joinedPlayers.map((p) => ({
				id: String(p.id),
				name: p.username,
				isTemp: false,
			}));

			// Pass tournamentId to ensure all clients use the same ID
			const response = await axios.post('/api/tournament/create', {
				players,
				tournamentId: tournamentId,  // Use the RT-{roomId} format
			});

			setTournament({
				tournamentId: tournamentId,
				format: response.data.format,
				playerCount: players.length,
				currentRound: response.data.currentRound || 1,
				totalRounds: response.data.totalRounds,
				matches: response.data.matches,
				leaderboard: response.data.leaderboard,
				isComplete: false,
			});

			// Find next pending match
			const nextMatch = getNextMatch(response.data.matches, response.data.currentRound || 1);
			setCurrentMatch(nextMatch);
			setLoading(false);
		} catch (error) {
			console.error("Failed to create tournament:", error);
			setLoading(false);
		} finally {
			setIsCreatingTournament(false);
		}
	};

    // Listen for real-time tournament updates
    useEffect(() => {
        const handleTournamentUpdate = (event: CustomEvent) => {
            console.log("Received TOURNAMENT_UPDATE:", event.detail);
            const data = event.detail;
            setTournament({
                tournamentId: data.tournamentId,
                format: data.format,
                playerCount: data.playerCount,
                currentRound: data.currentRound,
                totalRounds: data.totalRounds,
                matches: data.matches,
                leaderboard: data.leaderboard,
                isComplete: data.isComplete,
            });
            
            // Update current match based on new state
            if (user) {
                const nextMatch = getNextMatch(data.matches, data.currentRound);
                setCurrentMatch(nextMatch);
            }
        };

        window.addEventListener("tournamentUpdate", handleTournamentUpdate as EventListener);
        return () => {
            window.removeEventListener("tournamentUpdate", handleTournamentUpdate as EventListener);
        };
    }, [user, getNextMatch]);

	// Refresh tournament data
	const fetchTournament = useCallback(async () => {
		try {
			const response = await axios.get(`/api/tournament/${tournamentId}`, { withCredentials: true });
			setTournament(response.data);
			
			// Find next pending match
			const nextMatch = getNextMatch(response.data.matches, response.data.currentRound || 1);
			setCurrentMatch(nextMatch);
		} catch (error) {
			console.error("Failed to refresh tournament:", error);
		}
	}, [tournamentId]);

	// Poll for tournament updates
	useEffect(() => {
		if (!tournament || tournament.isComplete) return;
		
		const interval = setInterval(fetchTournament, 3000);
		return () => clearInterval(interval);
	}, [tournament, fetchTournament]);

	// Handle starting a match - send WS event to both players
	const handleStartMatch = () => {
		if (!currentMatch || !user || !isReady) return;

		// Send WebSocket event to signal I am ready in the lobby
		sendSocketMessage({
			event: "PLAYER_LOBBY_READY",
			payload: {
				matchId: currentMatch.matchId,
				tournamentId: tournamentId,
				userId: user.id
			},
		});
		
		// Navigation will happen when we receive GAME_MATCH_START event
	};

	// Handle bye processing
	const handleProcessBye = async () => {
		if (!currentMatch) return;

		try {
			await axios.post(`/api/tournament/${tournamentId}/match-result`, {
				matchId: currentMatch.matchId,
				player1Id: currentMatch.player1.id,
				player2Id: null,
				score: { p1: 0, p2: 0 },
				outcome: 'bye'
			});
			await fetchTournament();
		} catch (error) {
			console.error("Failed to process bye:", error);
		}
	};

	const leaveRoom = () => {
		// Send LEAVE_ROOM event to backend for proper cleanup
		if (user && roomId) {
			sendSocketMessage({
				event: "LEAVE_ROOM",
				payload: {
					roomId,
					userId: user.id
				}
			});
		}
	};

	const handleLeaveTournament = () => {
		leaveRoom();
		// Default redirect to tournament list
		router.push("/game/remote/tournament");
	};

	const watchMatch = (matchId: string) => {
		sendSocketMessage({
			event: "VIEW_MATCH",
			payload: { matchId }
		});
		router.push(`/game/${matchId}?spectator=true`);
	};

	const handleExit = () => {
		// Same cleanup as leaving
		handleLeaveTournament();
	};

	if (loading) {
		return (
			<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4 animate-pulse">
					<Loader2 className="h-12 w-12 text-primary animate-spin" />
					<div className="text-xl font-medium text-muted-foreground">Loading tournament...</div>
				</div>
			</div>
		);
	}

	if (!tournament) {
		return (
			<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
				<Card className="max-w-md w-full border-destructive/20 bg-destructive/5">
					<CardContent className="flex flex-col items-center p-8 text-center space-y-4">
						<History className="h-12 w-12 text-destructive/50" />
						<h2 className="text-2xl font-bold">Tournament Not Found</h2>
						<p className="text-muted-foreground">This tournament doesn't exist or has ended.</p>
						<Button onClick={handleExit}>Return to Game Menu</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Tournament complete - show final results
	if (tournament.isComplete) {
		const winner = tournament.leaderboard[0];
		
		return (
			<div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
				<div className="w-full max-w-4xl animate-in fade-in zoom-in-95 duration-700">
					<Card className="border-0 bg-card/95 backdrop-blur-sm shadow-2xl overflow-hidden relative">
						{/* Celebration Effect Background */}
						<div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-orange-500/10" />
						
						<CardHeader className="text-center relative z-10 pt-12 pb-2">
							<div className="mx-auto p-4 rounded-full bg-yellow-500/20 mb-6 ring-4 ring-yellow-500/10 animate-bounce">
								<Trophy className="h-16 w-16 text-yellow-500 drop-shadow-lg" />
							</div>
							<CardTitle className="text-5xl font-black bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent pb-2">
								Tournament Complete!
							</CardTitle>
							<CardDescription className="text-xl font-medium text-muted-foreground">
								{tournament.format === 'round-robin' ? 'Round Robin' : 'Swiss'} • {tournament.playerCount} Contenders
							</CardDescription>
						</CardHeader>

						<CardContent className="relative z-10 space-y-12 p-8">
							{/* Winner Spotlight */}
							<div className="relative max-w-lg mx-auto transform transition-all hover:scale-105 duration-500">
								<div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-600 rounded-2xl blur opacity-75"></div>
								<div className="relative bg-black/80 p-8 rounded-2xl border border-yellow-500/50 flex flex-col items-center text-center space-y-4">
									<Crown className="h-12 w-12 text-yellow-500" />
									<div className="space-y-1">
										<p className="text-yellow-500 font-bold tracking-widest uppercase text-sm">Grand Champion</p>
										<p className="text-4xl font-bold text-white">{winner.playerName}</p>
										<Badge variant="outline" className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10 mt-2">
											{winner.matchPoints} Match Points
										</Badge>
									</div>
									<div className="flex gap-1">
										{[1, 2, 3].map((_, i) => (
											<Star key={i} className="h-5 w-5 text-yellow-500 fill-yellow-500 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
										))}
									</div>
								</div>
							</div>

							{/* Full Leaderboard */}
							<div className="max-w-2xl mx-auto">
								<h3 className="text-center text-lg font-semibold mb-4 text-muted-foreground flex items-center justify-center gap-2">
									<Medal className="h-5 w-5" /> Final Standings
								</h3>
								<Leaderboard standings={tournament.leaderboard} currentUserId={user?.id} />
							</div>

							{/* Actions */}
							<div className="grid grid-cols-2 gap-4 max-w-lg mx-auto pt-4">
								<Button
									onClick={() => {
										console.log("Navigating to new game list");
										leaveRoom();
										router.push("/game/remote/tournament"); // Redirect to remote tournament list
									}}
									size="lg"
									className="h-14 text-lg bg-primary hover:bg-primary/90"
								>
									New Game
								</Button>
								<Button
									onClick={() => {
										leaveRoom();
										router.push("/dashboard"); // Redirect to dashboard
									}}
									variant="outline"
									size="lg"
									className="h-14 text-lg"
								>
									Dashboard
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Tournament in progress
	return (
		<div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b from-background to-muted/20">
			<div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
				{/* Navigation & Header */}
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					<Button
						variant="ghost"
						onClick={handleExit}
						className="text-muted-foreground hover:text-foreground pl-0 gap-2 self-start md:self-center"
					>
						<ArrowLeft className="h-4 w-4" />
						Exit Tournament
					</Button>
					
					<div className="text-center md:text-right">
						<h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
							<Badge variant="secondary" className="text-sm px-2 py-0.5">
								<Users className="h-3 w-3 mr-1" />
								Remote
							</Badge>
							{tournament.format === 'round-robin' ? 'Round Robin' : 'Swiss'} Tournament
							<Badge variant="secondary" className="text-lg px-3 py-1">
								Round {tournament.currentRound} / {tournament.totalRounds}
							</Badge>
						</h1>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Main Content: Current Match & History */}
					<div className="lg:col-span-2 space-y-8">
						
						{/* Current Match Action Card */}
						{currentMatch && (
							<div className="relative group">
								<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
								<Card className="relative border-0 bg-card/95 backdrop-blur-sm overflow-hidden">
									<div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
										<Play className="h-48 w-48 -mr-12 -mt-12" />
									</div>
									<CardHeader>
										<CardTitle className="flex items-center gap-2 text-xl text-blue-500">
											<Play className="h-5 w-5 fill-current" /> Next Match
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-6">
										<div className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 rounded-xl bg-background/50 border shadow-inner">
											{/* Player 1 */}
											<div className="flex items-center gap-4 flex-1">
												<div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
													<span className="font-bold text-blue-500 text-lg">{currentMatch.player1.name.charAt(0)}</span>
												</div>
												<div className="flex flex-col">
													<span className="font-bold text-lg">{currentMatch.player1.name}</span>
													<span className="text-xs text-muted-foreground uppercase">Challenger 1</span>
												</div>
											</div>

											{/* VS */}
											<div className="flex flex-col items-center px-4">
												<span className="text-xl font-black text-muted-foreground italic">VS</span>
											</div>

											{/* Player 2 */}
											<div className="flex items-center gap-4 flex-1 justify-end text-right">
												<div className="flex flex-col">
													<span className="font-bold text-lg">{currentMatch.player2?.name || 'BYE'}</span>
													<span className="text-xs text-muted-foreground uppercase">Challenger 2</span>
												</div>
												<div className={`h-12 w-12 rounded-full flex items-center justify-center ${currentMatch.player2 ? "bg-red-500/10" : "bg-yellow-500/10"}`}>
													{currentMatch.player2 ? (
														<span className="font-bold text-red-500 text-lg">{currentMatch.player2.name.charAt(0)}</span>
													) : (
														<Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
													)}
												</div>
											</div>
										</div>

										{!currentMatch.player2 ? (
											<div className="flex flex-col items-center gap-6 w-full">
												<div className="text-center space-y-2">
													<Badge variant="outline" className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10 px-4 py-1 text-base">
														<Crown className="w-4 h-4 mr-2 inline-block" />
														Automatic Bye
													</Badge>
													<p className="text-muted-foreground max-w-md mx-auto">
														You have a bye for this round! You automatically advance with 3 points.
														While you wait for the next round, you can spectate other ongoing matches.
													</p>
												</div>

												{/* Spectator Options for Bye Player */}
												<div className="w-full space-y-4">
													<h4 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
														<Eye className="w-4 h-4" /> Available Matches to Watch
													</h4>
													
													{tournament.matches.filter(m => m.status === 'inprogress').length > 0 ? (
														<div className="grid gap-3">
															{tournament.matches
																.filter(m => m.status === 'inprogress')
																.map(match => (
																	<div 
																		key={match.matchId} 
																		className="flex items-center justify-between p-4 bg-background/40 border border-white/10 rounded-xl hover:bg-background/60 transition-all group/match"
																	>
																		<div className="flex items-center gap-4">
																			<div className="flex flex-col">
																				<span className="font-bold text-lg">{match.player1.name}</span>
																				<span className="text-xs text-muted-foreground">Player 1</span>
																			</div>
																			<span className="text-muted-foreground font-black italic">VS</span>
																			<div className="flex flex-col text-right">
																				<span className="font-bold text-lg">{match.player2?.name}</span>
																				<span className="text-xs text-muted-foreground">Player 2</span>
																			</div>
																		</div>
																		<Button
																			onClick={() => watchMatch(match.matchId)}
																			className="bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 opacity-0 group-hover/match:opacity-100 transition-opacity"
																		>
																			<Eye className="mr-2 h-4 w-4" /> Watch
																		</Button>
																	</div>
																))}
														</div>
													) : (
														<div className="p-6 text-center border border-dashed rounded-xl bg-muted/10 text-muted-foreground">
															No matches currently in progress.
														</div>
													)}
												</div>

												<div className="flex gap-4 w-full md:w-auto pt-4 border-t border-white/5">
													<div className="w-full text-center text-muted-foreground italic">
														Waiting for other matches in this round to complete...
													</div>
												</div>
											</div>
										) : (
											<div className="flex flex-col gap-4 w-full">
												{isMeReady ? (
													<div className="flex flex-col items-center justify-center py-8 space-y-4 bg-muted/20 rounded-xl animate-in fade-in duration-300">
														<Loader2 className="h-10 w-10 text-primary animate-spin" />
														<p className="font-medium text-lg">You are ready for the next match</p>
														<p className="text-sm text-muted-foreground">Waiting for game to start...</p>
													</div>
												) : (
													<div className="flex gap-4">
														{(
															(String(currentMatch.player1.id) === String(user?.id) || currentMatch.player1.name === user?.username) || 
															(currentMatch.player2 && (String(currentMatch.player2.id) === String(user?.id) || currentMatch.player2.name === user?.username))
														) ? (
															<Button
																onClick={handleStartMatch}
																className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg h-14 shadow-lg shadow-blue-500/20 font-bold"
															>
																<Play className="mr-2 h-5 w-5 fill-current" /> Ready
															</Button>
														) : (
															<Button
																disabled
																className="flex-1 bg-muted text-muted-foreground text-lg h-14 font-medium"
															>
																Waiting for players...
															</Button>
														)}
														<Button
															onClick={handleLeaveTournament}
															variant="outline"
															className="flex-1 text-lg h-14 border-white/10 hover:bg-white/5"
														>
															Leave
														</Button>
													</div>
												)}
											</div>
										)}
									</CardContent>
								</Card>
							</div>
						)}

						{/* Live Matches Section */}
						{tournament.matches.filter(m => m.status === 'inprogress').length > 0 && (
							<Card className="bg-card/50 backdrop-blur-sm border-red-500/20">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
										Live Matches
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{tournament.matches
										.filter(m => m.status === 'inprogress')
										.map(match => (
											<div 
												key={match.matchId} 
												className="flex items-center justify-between p-4 bg-background/60 border rounded-xl hover:bg-background/80 transition-colors"
											>
												<div>
													<div className="font-semibold">
														{match.player1.name} <span className="text-muted-foreground">vs</span> {match.player2?.name}
													</div>
													<div className="text-xs text-muted-foreground">Round {match.round}</div>
												</div>
												<Button
													onClick={() => watchMatch(match.matchId)}
													size="sm"
													className="bg-red-500 hover:bg-red-600"
												>
													<Eye className="mr-2 h-4 w-4" /> Watch Live
												</Button>
											</div>
										))}
								</CardContent>
							</Card>
						)}

						{/* Match History */}
						<Card className="bg-card/50 backdrop-blur-sm">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<History className="h-5 w-5" /> Match History
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{tournament.matches.filter(m => m.status === 'completed' || m.status === 'bye').length === 0 ? (
										<p className="text-center text-muted-foreground py-8 italic">No matches completed yet.</p>
									) : (
										tournament.matches
											.filter(m => m.status === 'completed' || m.status === 'bye')
											.map((match) => (
												<div
													key={match.matchId}
													className="flex items-center justify-between p-4 bg-background/60 border rounded-xl hover:bg-background/80 transition-colors"
												>
													<div className="flex items-center gap-4">
														<Badge variant="outline" className="w-16 justify-center">R{match.round}</Badge>
														<div className="flex flex-col gap-0.5">
															<div className="font-semibold text-sm">
																{match.player1.name} <span className="text-muted-foreground font-normal">vs</span> {match.player2?.name || 'BYE'}
															</div>
															<div className="text-xs text-muted-foreground">
																{match.result?.outcome === 'bye' ? (
																	<span className="text-yellow-500 font-medium">Automatic Bye</span>
																) : (
																	<span>Score: {match.result?.score.p1} - {match.result?.score.p2}</span>
																)}
															</div>
														</div>
													</div>
													
													{match.result?.outcome === 'draw' && (
														<Badge variant="secondary">Draw</Badge>
													)}
												</div>
											))
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Sidebar: Leaderboard */}
					<div className="lg:col-span-1">
						<div className="sticky top-6">
							<Card className="bg-card/50 backdrop-blur-sm h-full">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Trophy className="h-5 w-5 text-yellow-500" /> Standings
									</CardTitle>
								</CardHeader>
								<CardContent className="px-2">
									<Leaderboard standings={tournament.leaderboard} currentUserId={user?.id} />
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
