"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Pause, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeyBindings } from "@/hooks/usePongGame";
import { BackgroundId } from "@/utils/gameRenderer";
import { GameSettingsPanel } from "@/components/game/GameSettingsPanel";

interface PauseOverlayProps {
	isOpen: boolean;
	mode: "local" | "remote";
	onResume?: () => void;
	onExit?: () => void;
	// Customization props (local only)
	bindings?: KeyBindings;
	onBindingsChange?: (b: KeyBindings) => void;
	background?: BackgroundId;
	onBackgroundChange?: (id: BackgroundId) => void;
	unlockedAchievements?: string[];
	// Remote-specific props
	player1Ready?: boolean;
	player2Ready?: boolean;
	player1Name?: string;
	player2Name?: string;
	currentPlayerReady?: boolean;
	disconnectInfo?: {
		disconnectedPlayer: "LEFT" | "RIGHT";
		countdown: number;
	} | null;
	isSpectator?: boolean;
	onReturnToLobby?: () => void;
}

export function PauseOverlay({
	isOpen,
	mode,
	onResume,
	onExit,
	bindings,
	onBindingsChange,
	background = 'default',
	onBackgroundChange,
	unlockedAchievements = [],
	player1Ready = false,
	player2Ready = false,
	player1Name = "Player 1",
	player2Name = "Player 2",
	currentPlayerReady = false,
	disconnectInfo = null,
	isSpectator = false,
	onReturnToLobby,
}: PauseOverlayProps) {
	const [showSettings, setShowSettings] = useState(false);

	if (!isOpen) return null;

	const handleResume = () => {
		console.log("[PauseOverlay] Resume button clicked", {
			mode,
			currentPlayerReady,
			player1Ready,
			player2Ready,
			hasOnResume: !!onResume
		});
		if (onResume) {
			onResume();
		} else {
			console.error("[PauseOverlay] onResume callback is undefined!");
		}
	};

	// Show disconnection overlay if player disconnected (remote only)
	if (mode === "remote" && disconnectInfo) {
		return (
			<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
				<Card className="border-red-500/50 bg-red-500/10">
					<div className="px-8 py-6 flex flex-col items-center gap-4">
						<div className="text-4xl">📡</div>
						<div className="text-red-400 font-bold text-2xl tracking-widest uppercase">
							Opponent Disconnected
						</div>
						<div className="text-white/80 text-sm text-center">
							Waiting for {disconnectInfo.disconnectedPlayer === "LEFT" ? player1Name : player2Name} to reconnect...
						</div>
						<div className="p-4 bg-white/5 rounded-lg border border-red-500/30 min-w-[200px]">
							<div className="text-center">
								<p className="text-xs text-white/60 mb-1">Auto-forfeit in</p>
								<p
									className={cn(
										"text-4xl font-mono font-bold tabular-nums",
										disconnectInfo.countdown <= 10
											? "text-red-500 animate-pulse"
											: "text-yellow-500"
									)}
								>
									{disconnectInfo.countdown}s
								</p>
							</div>
						</div>
						{isSpectator && onReturnToLobby && (
							<Button
								onClick={onReturnToLobby}
								variant="outline"
								className="border-white/20 text-white hover:bg-white/10"
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								Return to Lobby
							</Button>
						)}
						{!isSpectator && (
							<div className="text-xs text-white/50 text-center">
								Game will resume automatically when they reconnect
							</div>
						)}
					</div>
				</Card>
			</div>
		);
	}

	// Remote mode with two-player agreement
	if (mode === "remote") {
		return (
			<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
				<Card className="border-yellow-500/50 bg-yellow-500/10 w-full max-w-sm mx-4">
					<div className="px-8 py-6 flex flex-col items-center gap-4">
						<Pause className="h-10 w-10 text-yellow-400" />
						<div className="text-yellow-400 font-bold text-2xl tracking-widest uppercase">
							Paused
						</div>

						{!isSpectator ? (
							<>
								<div className="text-muted-foreground text-sm text-center">
									Both players must agree to resume
								</div>

								<div className="flex justify-center gap-6">
									<div className="flex flex-col items-center">
										<div
											className={cn(
												"h-10 w-10 rounded-full flex items-center justify-center text-xl",
												player1Ready
													? "bg-green-500/20 ring-2 ring-green-500"
													: "bg-white/10"
											)}
										>
											{player1Ready ? "✓" : "⏳"}
										</div>
										<span className="text-xs mt-1 text-white/70">{player1Name}</span>
									</div>
									<div className="flex flex-col items-center">
										<div
											className={cn(
												"h-10 w-10 rounded-full flex items-center justify-center text-xl",
												player2Ready
													? "bg-green-500/20 ring-2 ring-green-500"
													: "bg-white/10"
											)}
										>
											{player2Ready ? "✓" : "⏳"}
										</div>
										<span className="text-xs mt-1 text-white/70">{player2Name}</span>
									</div>
								</div>

								{currentPlayerReady ? (
									<div className="text-xs text-yellow-500 text-center animate-pulse">
										Waiting for opponent...
									</div>
								) : (player1Ready || player2Ready) ? (
									<div className="text-xs text-green-500 text-center">
										Opponent is ready!
									</div>
								) : null}

								<Button
									onClick={handleResume}
									variant="default"
									className="w-full bg-green-500 hover:bg-green-600 text-white"
								>
									{currentPlayerReady ? "Waiting for Opponent..." : "Resume Game"}
								</Button>

								{/* Settings toggle */}
								{bindings && onBindingsChange && onBackgroundChange && (
									<Button
										onClick={() => setShowSettings(s => !s)}
										variant="outline"
										className="w-full border-white/20 text-white/70 hover:bg-white/10 gap-2"
									>
										<Settings className="h-4 w-4" />
										{showSettings ? "Hide Settings" : "Settings"}
									</Button>
								)}

								{/* Settings panel */}
								{showSettings && bindings && onBindingsChange && onBackgroundChange && (
									<div className="w-full text-left">
										<GameSettingsPanel
											bindings={bindings}
											onBindingsChange={onBindingsChange}
											background={background}
											onBackgroundChange={onBackgroundChange}
											unlockedAchievements={unlockedAchievements}
										/>
									</div>
								)}

								{onExit && (
									<Button
										onClick={onExit}
										variant="outline"
										className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
									>
										<LogOut className="h-4 w-4" />
										Exit Game
									</Button>
								)}

								<div className="text-xs text-white/50 text-center">
									Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-mono text-xs">Space</kbd> or <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-mono text-xs">Esc</kbd> to toggle ready
								</div>
							</>
						) : (
							<div className="flex flex-col items-center gap-4">
								<div className="text-muted-foreground text-sm text-center">
									Waiting for both players to resume...
								</div>
								{onReturnToLobby && (
									<Button
										onClick={onReturnToLobby}
										variant="outline"
										className="border-white/20 text-white hover:bg-white/10"
									>
										<ArrowLeft className="mr-2 h-4 w-4" />
										Return to Lobby
									</Button>
								)}
							</div>
						)}
					</div>
				</Card>
			</div>
		);
	}

	// Local mode — pause with settings panel + exit
	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<Card className="border-blue-500/50 bg-blue-500/10 w-full max-w-sm mx-4">
				<div className="px-6 py-5 flex flex-col items-center gap-4">
					<div className="flex items-center gap-2">
						<Pause className="h-5 w-5 text-blue-400" />
						<span className="text-blue-400 font-bold text-xl tracking-widest uppercase">Paused</span>
					</div>

					{bindings && onBindingsChange && onBackgroundChange && (
						<GameSettingsPanel
							bindings={bindings}
							onBindingsChange={onBindingsChange}
							background={background}
							onBackgroundChange={onBackgroundChange}
							unlockedAchievements={unlockedAchievements}
						/>
					)}

					<div className="flex items-center gap-2 w-full mt-1">
						<Button
							onClick={handleResume}
							variant="default"
							className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
						>
							Resume
						</Button>
						{onExit && (
							<Button
								onClick={onExit}
								variant="outline"
								className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
							>
								<LogOut className="h-4 w-4" />
							</Button>
						)}
					</div>
					<div className="text-muted-foreground text-xs text-center">
						Press <kbd className="px-2 py-0.5 bg-white/10 rounded text-white font-mono">Space</kbd> or <kbd className="px-2 py-0.5 bg-white/10 rounded text-white font-mono">Esc</kbd> to resume
					</div>
				</div>
			</Card>
		</div>
	);
}
