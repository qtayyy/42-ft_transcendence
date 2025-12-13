import { useEffect, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";

interface UsePongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	externalGameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
}

export function usePongGame({ matchId, mode, wsUrl, externalGameState, onGameOver }: UsePongGameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const socketRef = useRef<WebSocket | null>(null);

	// Local state for direct WebSocket mode
	const [localGameState, setLocalGameState] = useState<GameState | null>(null);

	// Determine active game state
	const gameState = wsUrl ? localGameState : externalGameState;

	// Responsive canvas
	const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 600 });

	useEffect(() => {
		const updateCanvasSize = () => {
			if (!containerRef.current) return;
			const container = containerRef.current;
			const aspectRatio = 2;
			let width = Math.max(container.clientWidth - 40, 800);
			let height = width / aspectRatio;

			if (height > container.clientHeight - 200) {
				height = Math.max(container.clientHeight - 200, 400);
				width = height * aspectRatio;
			}
			width = Math.min(width, 1200);
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
		const sendInput = (payload: any) => {
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
