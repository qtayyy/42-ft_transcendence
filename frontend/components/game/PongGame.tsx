import { useEffect } from "react";
import { GameState, GameMode } from "@/types/game";
import { usePongGame } from "@/hooks/usePongGame";
import { renderGame } from "@/utils/gameRenderer";
import { GameOverDialog } from "@/components/game/GameOverDialog";
import { formatTime } from "@/utils/gameHelpers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timer, Keyboard, Gamepad2, Hash, Zap, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** 
 * "?:" means it can be optional
 * ": " means it is mandatory
 */
interface PongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	gameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
	onExit?: () => void;
	isTournamentMatch?: boolean;
}

export default function PongGame({
	matchId,
	mode,
	wsUrl,
	gameState: externalGameState,
	onGameOver,
	onExit,
	isTournamentMatch = false,
}: PongGameProps) {
	const { 
		gameState, 
		canvasRef, 
		containerRef, 
		canvasDimensions 
	} = usePongGame({ matchId, mode, wsUrl, externalGameState, onGameOver });

	// Determine Display ID & Suffix
	let cleanId = matchId.replace(/^(local-|tournament-)/, '');
	let matchSuffix = "";

	// Check for match suffix (-m1, -m2, etc) or Swiss (-r1-m1)
	const matchMatch = cleanId.match(/-(m\d+)$/);
	const swissMatch = cleanId.match(/-(r\d+-m\d+)$/);

	if (swissMatch) {
		matchSuffix = swissMatch[1].replace('r', 'Round ').replace('-m', ' • Match '); // "Round 1 • Match 1"
		cleanId = cleanId.replace(/-(r\d+-m\d+)$/, '');
	} else if (matchMatch) {
		matchSuffix = matchMatch[1].replace('m', 'Match '); // "Match 1"
		cleanId = cleanId.replace(/-(m\d+)$/, '');
	}

	const displayMatchId = mode === "local"
		? (isTournamentMatch ? `LT-${cleanId}` : `LS-${cleanId}`)
		: cleanId;

	// Game Loop / Rendering
	useEffect(() => {
		if (!gameState || !canvasRef.current) return;
		const canvas = canvasRef.current;
		const context = canvas.getContext("2d");
		if (!context) return;

		renderGame(context, gameState, canvasDimensions);
	}, [gameState, canvasDimensions]);

	return (
		<div className="h-screen pt-32 pb-4 flex flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20 relative">
			
			{/* Decorative Background Elements */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-[20%] left-[10%] w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
				<div className="absolute bottom-[20%] right-[10%] w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
			</div>

			{/* DEBUG OVERLAY */}
			{gameState && process.env.NODE_ENV === 'development' && (
				<div className="absolute top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono backdrop-blur-md z-50 border border-white/10 shadow-xl pointer-events-none mt-24">
					<div className="flex items-center gap-2 mb-1 text-muted-foreground"><Zap className="h-3 w-3 text-yellow-500" /> Debug Info</div>
					<div>Status: <span className="text-green-400">{gameState.status}</span></div>
					<div>Ball: ({gameState.ball?.x?.toFixed(0)}, {gameState.ball?.y?.toFixed(0)})</div>
				</div>
			)}
			
			{/* Header (Fixed Height) */}
			<div className="shrink-0 h-24 w-full max-w-7xl mx-auto grid grid-cols-3 items-center px-8 border-b border-white/5 bg-background/40 backdrop-blur-md z-10 transition-all duration-300">
				
				{/* Left: Match Info */}
				<div className="flex flex-col items-start gap-1.5">
					<h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-sm">
						{mode === "local" ? "LOCAL MATCH" : "REMOTE MATCH"}
					</h1>
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="inline-flex items-center justify-center gap-1 font-mono text-[10px] tracking-widest text-muted-foreground border-white/10 bg-black/20 px-3 py-1 rounded-full leading-normal">
							<Hash className="h-3 w-3 opacity-50" />
							{displayMatchId}
						</Badge>
						{matchSuffix && (
							<Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 bg-white/10 text-white/80 border-white/10">
								{matchSuffix.toUpperCase()}
							</Badge>
						)}
					</div>
				</div>

				{/* Center: Timer */}
				<div className="flex justify-center">
					{gameState?.timer && (
						<div className="relative group">
							<div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
							<div className="relative px-8 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg flex flex-col items-center shadow-2xl">
								<div className={cn(
									"text-4xl font-mono font-bold tabular-nums tracking-widest leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]",
									gameState.timer.timeRemaining < 30000 
										? 'text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
										: 'bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70'
								)}>
									{formatTime(gameState.timer.timeRemaining)}
								</div>
								<div className="flex items-center gap-1.5 text-[9px] uppercase font-bold text-muted-foreground/80 tracking-[0.2em] mt-1">
									<Timer className="h-2.5 w-2.5" /> Time Remaining
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Right: Status Indicators */}
				<div className="flex items-center justify-end gap-3">
					<div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/5 border border-green-500/20 rounded-full">
						<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
						<span className="text-xs font-bold text-green-500 tracking-wider">LIVE</span>
					</div>
				</div>
			</div>

			{/* Main Game Area (Flexible) */}
			<div ref={containerRef} className="flex-1 w-full relative flex items-center justify-center p-4 overflow-hidden z-0">
				
				{/* Waiting Overlay */}
				{gameState?.status === "waiting" && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
						<Card className="border-yellow-500/50 bg-yellow-500/10 animate-pulse">
							<div className="px-6 py-4 text-yellow-500 font-bold text-lg flex items-center gap-2">
								<div className="h-2 w-2 bg-yellow-500 rounded-full animate-bounce" />
								Waiting for players...
							</div>
						</Card>
					</div>
				)}

				{/* Canvas */}
				<div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
					<div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5 pointer-events-none z-10" />
					<canvas
						ref={canvasRef}
						width={canvasDimensions.width}
						height={canvasDimensions.height}
						className="block bg-[#020817]"
						style={{ touchAction: 'none' }}
					/>
				</div>
			</div>

			{/* Footer Commands (Fixed Height) */}
			<div className="shrink-0 h-16 flex items-center justify-center pb-4 z-10">
				<div className="flex items-center justify-between w-full max-w-3xl px-8 py-3 bg-card/60 rounded-full border border-border/50 backdrop-blur-md shadow-lg">
					<div className="flex items-center gap-3">
						<div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 ring-1 ring-blue-500/20">
							<Keyboard className="h-4 w-4" />
						</div>
						<div className="flex flex-col">
							<span className="text-xs font-bold text-foreground">Player 1</span>
							<span className="text-[10px] text-muted-foreground font-mono">W / S</span>
						</div>
					</div>

					<div className="h-6 w-px bg-border/50" />

					<div className="flex items-center gap-3 text-right">
						<div className="flex flex-col items-end">
							<span className="text-xs font-bold text-foreground">Player 2</span>
							<span className="text-[10px] text-muted-foreground font-mono">Arrow Keys</span>
						</div>
						<div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 ring-1 ring-purple-500/20">
							<Gamepad2 className="h-4 w-4" />
						</div>
					</div>
				</div>
			</div>

			<GameOverDialog 
				gameState={gameState || null} 
				open={gameState?.status === "finished"}
				onExit={onExit} 
			/>
		</div>
	);
}

/*
	const s = gameState.status;
	- If gameState is null, this causes a "TypeError" crash!
	- It's like doing nullptr->status in C++.

	const s = gameState?.status;
	- check if gameState is not NULL/Undefined
	- if it has content, grab it
	- if no, stop immediately, return undefined, do not crash
*/