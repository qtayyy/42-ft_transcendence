import { useEffect, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";

interface UsePongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	externalGameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
	isAIEnabled?: boolean;
}

export function usePongGame({ matchId, wsUrl, externalGameState, onGameOver, isAIEnabled = false }: UsePongGameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const onGameOverRef = useRef(onGameOver);

	// Local state for direct WebSocket mode
	const [localGameState, setLocalGameState] = useState<GameState | null>(null);

	// Determine active game state
	const gameState = wsUrl ? localGameState : externalGameState;
	const baseCanvasWidth = gameState?.constant?.canvasWidth || 800;
	const baseCanvasHeight = gameState?.constant?.canvasHeight || 400;

	// Responsive canvas
	const [canvasDimensions, setCanvasDimensions] = useState({ width: 800, height: 400 });

	useEffect(() => {
		const updateCanvasSize = () => {
			if (!containerRef.current) return;
			const container = containerRef.current;
			const aspectRatio = baseCanvasWidth / baseCanvasHeight;
			const computed = window.getComputedStyle(container);
			const paddingX = (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
			const paddingY = (parseFloat(computed.paddingTop) || 0) + (parseFloat(computed.paddingBottom) || 0);

			// Use actual container padding to avoid mode-specific shrink differences.
			const maxWidth = Math.max(container.clientWidth - paddingX, 0);
			const maxHeight = Math.max(container.clientHeight - paddingY, 0);
			if (!maxWidth || !maxHeight) return;

			let width = maxWidth;
			let height = width / aspectRatio;

			// If height exceeds container, scale down
			if (height > maxHeight) {
				height = maxHeight;
				width = height * aspectRatio;
			}

			// Cap extremely large desktops, but allow small windows/mobile widths.
			width = Math.min(width, 1400);
			height = width / aspectRatio;

			setCanvasDimensions({
				width: Math.round(width),
				height: Math.round(height),
			});
		};

		updateCanvasSize();
		const resizeObserver = new ResizeObserver(updateCanvasSize);
		if (containerRef.current) resizeObserver.observe(containerRef.current);

		return () => {
			resizeObserver.disconnect();
		};
	}, [matchId, baseCanvasWidth, baseCanvasHeight]);

	// WebSocket Connection
	useEffect(() => {
		if (!wsUrl) return;

		const ws = new WebSocket(wsUrl);

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "GAME_OVER") {
					if (onGameOverRef.current) onGameOverRef.current(data.winner, data.score, data.result || 'win');
					// Store final result
					setLocalGameState(prev => prev ? ({ ...prev, status: 'finished', winner: data.winner, score: data.score, result: data.result }) : null);
				} else {
					setLocalGameState(data);
				}
			} catch (e) {
				console.error("[usePongGame] WS Parse Error", e);
			}
		};

		socketRef.current = ws;
		return () => {
			ws.close();
		};
	}, [wsUrl, matchId]);

	useEffect(() => {
		onGameOverRef.current = onGameOver;
	}, [onGameOver]);

	// Input Handling
	useEffect(() => {
		if (!wsUrl) return;

		const sendInput = (payload: object) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				socketRef.current.send(JSON.stringify(payload));
			} else {
				console.error('[usePongGame] ❌ WebSocket NOT READY! Cannot send message. State:', socketRef.current?.readyState);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "w" || e.key === "W") sendInput({ type: "PADDLE_MOVE", direction: "UP", player: 1 });
			else if (e.key === "s" || e.key === "S") sendInput({ type: "PADDLE_MOVE", direction: "DOWN", player: 1 });
			else if (e.key === "ArrowUp") {
				e.preventDefault();
				if (!isAIEnabled) sendInput({ type: "PADDLE_MOVE", direction: "UP", player: 2 });
			}
			else if (e.key === "ArrowDown") {
				e.preventDefault();
				if (!isAIEnabled) sendInput({ type: "PADDLE_MOVE", direction: "DOWN", player: 2 });
			}
			else if (e.key === "Enter") sendInput({ type: "START" });
			else if (e.key === " ") { e.preventDefault(); sendInput({ type: "PAUSE" }); }
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (["w", "W", "s", "S"].includes(e.key)) sendInput({ type: "PADDLE_MOVE", direction: null, player: 1 });
			else if (["ArrowUp", "ArrowDown"].includes(e.key) && !isAIEnabled) sendInput({ type: "PADDLE_MOVE", direction: null, player: 2 });
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [matchId, wsUrl, isAIEnabled]);

	return {
		gameState,
		canvasRef,
		containerRef,
		canvasDimensions,
		socketRef
	};
}
