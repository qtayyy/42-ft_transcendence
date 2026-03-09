"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Play, Keyboard, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReadyOverlayProps {
	isOpen: boolean;
	onStart: () => void;
	onReady?: () => void; // For remote: toggle current player's ready state
	mode: "local" | "remote";
	player1Ready?: boolean;
	player2Ready?: boolean;
	player1Name?: string;
	player2Name?: string;
	currentPlayerReady?: boolean; // For remote: is current player ready?
	currentPlayerSide?: "LEFT" | "RIGHT"; // Which player is the current user?
}

export function ReadyOverlay({
	isOpen,
	onStart,
	onReady,
	mode,
	player1Ready = false,
	player2Ready = false,
	player1Name = "Player 1",
	player2Name = "Player 2",
	currentPlayerReady = false
}: ReadyOverlayProps) {
	// Optimistic UI state - shows immediate feedback before server confirms
	const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);

	// Sync optimistic state with server state when it arrives
	useEffect(() => {
		if (optimisticReady !== null && optimisticReady === currentPlayerReady) {
			// Server confirmed our optimistic update, clear it
			setOptimisticReady(null);
		}
	}, [currentPlayerReady, optimisticReady]);

	if (!isOpen) return null;

	// Use optimistic state if available, otherwise use server state
	const displayReady = optimisticReady !== null ? optimisticReady : currentPlayerReady;
	const allPlayersReady = mode === "local" || (player1Ready && player2Ready);

	const handleReadyClick = () => {
		// Immediately update UI (optimistic)
		setOptimisticReady(!displayReady);
		// Send to server
		onReady?.();
	};

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-2xl max-w-lg">
				<CardContent className="px-8 py-10">
					<div className="flex flex-col items-center gap-6 text-center">
						{/* Icon and Title */}
						<div className="relative">
							<div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse" />
							<div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center ring-4 ring-blue-500/20">
								<Users className="h-8 w-8 text-white" />
							</div>
						</div>

						<div className="space-y-2">
							<h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
								{allPlayersReady ? "Ready to Play!" : "Waiting for Players..."}
							</h2>
							<p className="text-muted-foreground text-sm">
								{mode === "local"
									? "Both players are connected and ready"
									: allPlayersReady
									? "All players are ready to start"
									: "Waiting for all players to ready up"}
							</p>
						</div>

						{/* Player Ready Status (for remote mode) */}
						{mode === "remote" && (
							<div className="w-full space-y-3 pt-2">
								<div className={cn(
									"flex items-center justify-between px-4 py-2 rounded-lg border transition-all duration-300",
									player1Ready
										? "bg-green-500/20 border-green-500/50"
										: "bg-black/30 border-white/10"
								)}>
									<span className={cn(
										"text-sm font-semibold",
										player1Ready ? "text-green-400" : "text-blue-400"
									)}>
										{player1Name}
									</span>
									{player1Ready ? (
										<div className="flex items-center gap-1 text-green-400">
											<Check className="h-4 w-4" />
											<span className="text-xs font-bold">READY</span>
										</div>
									) : (
										<div className="flex items-center gap-1 text-muted-foreground">
											<Clock className="h-4 w-4 animate-pulse" />
											<span className="text-xs">Waiting...</span>
										</div>
									)}
								</div>
								<div className={cn(
									"flex items-center justify-between px-4 py-2 rounded-lg border transition-all duration-300",
									player2Ready
										? "bg-green-500/20 border-green-500/50"
										: "bg-black/30 border-white/10"
								)}>
									<span className={cn(
										"text-sm font-semibold",
										player2Ready ? "text-green-400" : "text-purple-400"
									)}>
										{player2Name}
									</span>
									{player2Ready ? (
										<div className="flex items-center gap-1 text-green-400">
											<Check className="h-4 w-4" />
											<span className="text-xs font-bold">READY</span>
										</div>
									) : (
										<div className="flex items-center gap-1 text-muted-foreground">
											<Clock className="h-4 w-4 animate-pulse" />
											<span className="text-xs">Waiting...</span>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Instructions (only for local mode) */}
						{mode === "local" && (
							<div className="w-full space-y-3 pt-2">
								<div className="flex items-center justify-between px-4 py-2 bg-black/30 rounded-lg border border-white/10">
									<span className="text-sm font-semibold text-blue-400">Player 1</span>
									<span className="text-xs font-mono text-muted-foreground">W / S keys</span>
								</div>
								<div className="flex items-center justify-between px-4 py-2 bg-black/30 rounded-lg border border-white/10">
									<span className="text-sm font-semibold text-purple-400">Player 2</span>
									<span className="text-xs font-mono text-muted-foreground">Arrow Keys</span>
								</div>
							</div>
						)}

						{/* Action Button */}
						{mode === "local" ? (
							// Local Mode: Start Game Button
							<>
								<Button
									size="lg"
									onClick={onStart}
									className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
								>
									<Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
									Start Game
								</Button>
								<p className="text-xs text-muted-foreground flex items-center gap-2">
									<Keyboard className="h-3 w-3" />
									Or press <kbd className="px-2 py-1 bg-black/40 rounded border border-white/20 font-mono text-[10px]">Enter</kbd> to start
								</p>
							</>
						) : (
							// Remote Mode: Ready/Start Button
							<>
								{!displayReady ? (
									<>
										<Button
											size="lg"
											onClick={handleReadyClick}
											className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
										>
											<Check className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
											I AM READY
										</Button>
										<p className="text-xs text-muted-foreground flex items-center gap-2">
											<Keyboard className="h-3 w-3" />
											Or press <kbd className="px-2 py-1 bg-black/40 rounded border border-white/20 font-mono text-[10px]">Enter</kbd> to ready up
										</p>
									</>
								) : allPlayersReady ? (
									<>
										<Button
											size="lg"
											onClick={onStart}
											className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
										>
											<Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
											Start Game
										</Button>
										<p className="text-xs text-muted-foreground flex items-center gap-2">
											<Keyboard className="h-3 w-3" />
											Or press <kbd className="px-2 py-1 bg-black/40 rounded border border-white/20 font-mono text-[10px]">Enter</kbd> to start
										</p>
									</>
								) : (
									<>
										<Button
											size="lg"
											onClick={handleReadyClick}
											variant="outline"
											className="w-full border-white/20 text-white/70 hover:bg-white/10 font-bold py-6 text-lg"
										>
											Not Ready? Click to cancel
										</Button>
										<p className="text-xs text-yellow-500 flex items-center gap-2 animate-pulse">
											<Clock className="h-3 w-3" />
											Waiting for opponent...
										</p>
									</>
								)}
							</>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
