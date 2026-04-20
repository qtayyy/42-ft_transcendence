"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Play, Keyboard, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyBindings } from "@/hooks/usePongGame";
import { BackgroundId } from "@/utils/gameRenderer";
import { GameSettingsPanel } from "@/components/game/GameSettingsPanel";

interface ReadyOverlayProps {
	isOpen: boolean;
	onStart: () => void;
	onReady?: () => void;
	mode: "local" | "remote";
	player1Ready?: boolean;
	player2Ready?: boolean;
	player1Name?: string;
	player2Name?: string;
	currentPlayerReady?: boolean;
	currentPlayerSide?: "LEFT" | "RIGHT";
	// Customization (local only)
	bindings?: KeyBindings;
	onBindingsChange?: (b: KeyBindings) => void;
	background?: BackgroundId;
	onBackgroundChange?: (id: BackgroundId) => void;
	unlockedAchievements?: string[];
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
	currentPlayerReady = false,
	bindings,
	onBindingsChange,
	background = 'default',
	onBackgroundChange,
	unlockedAchievements = [],
}: ReadyOverlayProps) {
	const [optimisticReady, setOptimisticReady] = useState<boolean | null>(null);

	useEffect(() => {
		if (optimisticReady !== null && optimisticReady === currentPlayerReady) {
			setOptimisticReady(null);
		}
	}, [currentPlayerReady, optimisticReady]);

	if (!isOpen) return null;

	const displayReady = optimisticReady !== null ? optimisticReady : currentPlayerReady;
	const allPlayersReady = mode === "local" || (player1Ready && player2Ready);

	const handleReadyClick = () => {
		setOptimisticReady(!displayReady);
		onReady?.();
	};

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<Card className="border-blue-500/50 bg-linear-to-br from-blue-500/20 to-purple-500/20 shadow-2xl w-full max-w-md mx-4">
				<CardContent className="px-8 py-8">
					<div className="flex flex-col items-center gap-5 text-center">
						{/* Icon and Title */}
						<div className="relative">
							<div className="absolute -inset-4 bg-linear-to-r from-blue-600 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse" />
							<div className="relative h-14 w-14 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center ring-4 ring-blue-500/20">
								<Users className="h-7 w-7 text-white" />
							</div>
						</div>

						<div className="space-y-1">
							<h2 className="text-2xl font-black bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-400">
								{allPlayersReady ? "Ready to Play!" : "Game Setup"}
							</h2>
							<p className="text-muted-foreground text-sm">
								{allPlayersReady
									? "All players are ready to start"
									: "Configure your game before starting"}
							</p>
						</div>

						{/* Remote: player ready status */}
						{mode === "remote" && (
							<div className="w-full space-y-3 pt-2">
								<div className={cn(
									"flex items-center justify-between px-4 py-2 rounded-lg border transition-all duration-300",
									player1Ready ? "bg-green-500/20 border-green-500/50" : "bg-black/30 border-white/10"
								)}>
									<span className={cn("text-sm font-semibold", player1Ready ? "text-green-400" : "text-blue-400")}>
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
									player2Ready ? "bg-green-500/20 border-green-500/50" : "bg-black/30 border-white/10"
								)}>
									<span className={cn("text-sm font-semibold", player2Ready ? "text-green-400" : "text-purple-400")}>
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

						{/* Settings panel — local and remote */}
						{bindings && onBindingsChange && onBackgroundChange && (
							<div className="w-full text-left">
								<GameSettingsPanel
									bindings={bindings}
									onBindingsChange={onBindingsChange}
									background={background}
									onBackgroundChange={onBackgroundChange}
									unlockedAchievements={unlockedAchievements}
									defaultTab="controls"
									mode={mode}
								/>
							</div>
						)}

						{/* Action Button */}
						{mode === "local" ? (
							<>
								<Button
									size="lg"
									onClick={onStart}
									className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
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
								{!displayReady ? (
									<>
										<Button
											size="lg"
											onClick={handleReadyClick}
											className="w-full bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
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
											className="w-full bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200 group"
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
