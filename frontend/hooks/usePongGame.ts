import { useEffect, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";

interface UsePongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	externalGameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
}

export function usePongGame({ matchId, wsUrl, externalGameState, onGameOver }: UsePongGameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const socketRef = useRef<WebSocket | null>(null);

	// Local state for direct WebSocket mode
	const [localGameState, setLocalGameState] = useState<GameState | null>(null);

	// Determine active game state
	const gameState = wsUrl ? localGameState : externalGameState;

	// Responsive canvas
	const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 400 });

	useEffect(() => {
		const updateCanvasSize = () => {
			if (!containerRef.current) return;
			const container = containerRef.current;
			const aspectRatio = 2; // 2:1 aspect ratio (800x400 game)

			// Calculate max dimensions that fit in container
			const maxWidth = container.clientWidth - 32; // Account for padding
			const maxHeight = container.clientHeight - 32;

			let width = maxWidth;
			let height = width / aspectRatio;

			// If height exceeds container, scale down
			if (height > maxHeight) {
				height = maxHeight;
				width = height * aspectRatio;
			}

			// Clamp to reasonable bounds
			width = Math.max(400, Math.min(width, 1400));
			height = width / aspectRatio;

			setCanvasDimensions({ width, height });
		};

		updateCanvasSize();
		const resizeObserver = new ResizeObserver(updateCanvasSize);
		if (containerRef.current) resizeObserver.observe(containerRef.current);
		return () => resizeObserver.disconnect();
	}, []);

	// WebSocket Connection
	useEffect(() => {
		if (!wsUrl) return;

		const ws = new WebSocket(wsUrl);

		ws.onopen = () => console.log(`Connected to Game Server (Match: ${matchId})`);

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "GAME_OVER") {
					if (onGameOver) onGameOver(data.winner, data.score, data.result || 'win');
					// Store final result
					setLocalGameState(prev => prev ? ({ ...prev, status: 'finished', winner: data.winner, score: data.score, result: data.result }) : null);
				} else {
					setLocalGameState(data);
				}
			} catch (e) {
				console.error("WS Parse Error", e);
			}
		};

		socketRef.current = ws;
		return () => ws.close();
	}, [wsUrl, matchId, onGameOver]);

	// Input Handling
	useEffect(() => {
		const sendInput = (payload: object) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				socketRef.current.send(JSON.stringify(payload));
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "w" || e.key === "W") sendInput({ type: "PADDLE_MOVE", direction: "UP", player: 1 });
			else if (e.key === "s" || e.key === "S") sendInput({ type: "PADDLE_MOVE", direction: "DOWN", player: 1 });
			else if (e.key === "ArrowUp") { e.preventDefault(); sendInput({ type: "PADDLE_MOVE", direction: "UP", player: 2 }); }
			else if (e.key === "ArrowDown") { e.preventDefault(); sendInput({ type: "PADDLE_MOVE", direction: "DOWN", player: 2 }); }
			else if (e.key === "Enter") sendInput({ type: "START" });
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (["w", "W", "s", "S"].includes(e.key)) sendInput({ type: "PADDLE_MOVE", direction: null, player: 1 });
			else if (["ArrowUp", "ArrowDown"].includes(e.key)) sendInput({ type: "PADDLE_MOVE", direction: null, player: 2 });
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);

	return {
		gameState,
		canvasRef,
		containerRef,
		canvasDimensions,
		socketRef
	};
}
