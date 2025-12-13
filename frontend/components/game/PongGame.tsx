"use client";

import { useEffect } from "react";
import { GameState, GameMode } from "@/types/game";
import { usePongGame } from "@/hooks/usePongGame";
import { renderGame } from "@/utils/gameRenderer";
import { GameOverDialog } from "@/components/game/GameOverDialog";
import { formatTime } from "@/utils/gameHelpers";

interface PongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	gameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
	onExit?: () => void;
}

export default function PongGame({
	matchId,
	mode,
	wsUrl,
	gameState: externalGameState,
	onGameOver,
	onExit,
}: PongGameProps) {
	const { 
		gameState, 
		canvasRef, 
		containerRef, 
		canvasDimensions 
	} = usePongGame({ matchId, mode, wsUrl, externalGameState, onGameOver });

	// Game Loop / Rendering
	useEffect(() => {
		if (!gameState || !canvasRef.current) return;
		const canvas = canvasRef.current;
		const context = canvas.getContext("2d");
		if (!context) return;

		renderGame(context, gameState, canvasDimensions);
	}, [gameState, canvasDimensions]);

	return (
		<div
			ref={containerRef}
			className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] overflow-hidden bg-black text-white p-4"
		>
			{/* DEBUG OVERLAY */}
			{gameState && (
				<div className="absolute top-0 right-0 bg-red-500/80 p-2 text-xs z-50">
					<div>Status: {gameState.status}</div>
					<div>Ball: ({gameState.ball?.x?.toFixed(0)}, {gameState.ball?.y?.toFixed(0)})</div>
					<div>Score: {gameState.score?.p1} - {gameState.score?.p2}</div>
				</div>
			)}
			
			<div className="flex items-center justify-between w-full max-w-6xl mb-4">
				<h1 className="text-2xl font-bold">
					{mode === "local" && "Local Match"}
					{mode === "remote" && "Remote Match"}
				</h1>
				
				{/* Timer Display */}
				{gameState?.timer && (
					<div className="flex flex-col items-center">
						<div className={`text-4xl font-mono font-bold ${
							gameState.timer.timeRemaining < 30000 ? 'text-red-500 animate-pulse' : 'text-green-400'
						}`}>
							{formatTime(gameState.timer.timeRemaining)}
						</div>
						<div className="text-xs text-gray-400">Time Remaining</div>
					</div>
				)}
				
				<div className="text-sm text-gray-400">
					Match ID: {matchId.substring(0, 8)}
				</div>
			</div>
			
			<canvas
				ref={canvasRef}
				width={canvasDimensions.width}
				height={canvasDimensions.height}
				className="border-2 border-white bg-gray-900 rounded-lg shadow-2xl"
			/>
			
			<div className="mt-6 text-center">
				<p className="text-lg mb-2">
					<span className="font-semibold">Player 1:</span> W/S{" "}
					<span className="mx-4">|</span>{" "}
					<span className="font-semibold">Player 2:</span> Arrow Keys
				</p>
			</div>

			{gameState?.status === "waiting" && (
				<div className="mt-4 px-6 py-3 bg-yellow-600 text-black rounded-lg font-semibold animate-pulse">
					Waiting for players...
				</div>
			)}

			<GameOverDialog 
				gameState={gameState || null} 
				open={gameState?.status === "finished"} 
				onExit={onExit} 
			/>
		</div>
	);
}
