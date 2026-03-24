import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";

interface UsePongGameProps {
	matchId: string;
	mode: GameMode;
	wsUrl?: string;
	externalGameState?: GameState | null;
	onGameOver?: (winner: number | null, score: { p1: number; p2: number }, result: string) => void;
	isAIEnabled?: boolean;
}

function getLocalMovementForKey(key: string): { player: 1 | 2; direction: "UP" | "DOWN" } | null {
	if (key === "w" || key === "W") return { player: 1, direction: "UP" };
	if (key === "s" || key === "S") return { player: 1, direction: "DOWN" };
	if (key === "ArrowUp") return { player: 2, direction: "UP" };
	if (key === "ArrowDown") return { player: 2, direction: "DOWN" };
	return null;
}

export function usePongGame({ matchId, wsUrl, externalGameState, onGameOver, isAIEnabled = false }: UsePongGameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const onGameOverRef = useRef(onGameOver);
	const latestGameStateRef = useRef<GameState | null>(null);
	const heldDirectionsRef = useRef<{ 1: "UP" | "DOWN" | null; 2: "UP" | "DOWN" | null }>({
		1: null,
		2: null,
	});

	// Local state for direct WebSocket mode
	const [localGameState, setLocalGameState] = useState<GameState | null>(null);
	const [optimisticPaddleY, setOptimisticPaddleY] = useState<{ p1: number | null; p2: number | null }>({
		p1: null,
		p2: null,
	});

	// Determine active game state
	const gameState = useMemo(() => {
		const baseGameState = wsUrl ? localGameState : externalGameState;
		if (!wsUrl || !baseGameState) return baseGameState;

		const { p1, p2 } = optimisticPaddleY;
		if (p1 === null && p2 === null) return baseGameState;

		return {
			...baseGameState,
			paddles: {
				...baseGameState.paddles,
				p1: {
					...baseGameState.paddles.p1,
					y: p1 ?? baseGameState.paddles.p1.y,
				},
				p2: {
					...baseGameState.paddles.p2,
					y: p2 ?? baseGameState.paddles.p2.y,
				},
			},
		};
	}, [wsUrl, localGameState, externalGameState, optimisticPaddleY]);
	const baseCanvasWidth = gameState?.constant?.canvasWidth || 800;
	const baseCanvasHeight = gameState?.constant?.canvasHeight || 400;

	useEffect(() => {
		latestGameStateRef.current = gameState;
	}, [gameState]);

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
					if (onGameOverRef.current) onGameOverRef.current(data.winner, data.score, data.result || "win");
					// Store final result
					startTransition(() => {
						setLocalGameState((prev) =>
							prev ? ({ ...prev, status: "finished", winner: data.winner, score: data.score, result: data.result }) : null
						);
					});
				} else {
					startTransition(() => {
						setLocalGameState(data);
					});
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

	useEffect(() => {
		if (!wsUrl || !localGameState) return;
		setOptimisticPaddleY({ p1: null, p2: null });
	}, [wsUrl, localGameState?.paddles.p1.y, localGameState?.paddles.p2.y]);

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
			const movement = getLocalMovementForKey(e.key);
			if (movement) {
				if (e.repeat) return;
				if (movement.player === 2) e.preventDefault();
				if (movement.player === 2 && isAIEnabled) return;
				if (heldDirectionsRef.current[movement.player] === movement.direction) return;

				heldDirectionsRef.current[movement.player] = movement.direction;

				const latestGameState = latestGameStateRef.current;
				const paddleKey = movement.player === 1 ? "p1" : "p2";
				const currentY = latestGameState?.paddles[paddleKey].y ?? 0;
				const paddleHeight = latestGameState?.constant?.paddleHeight ?? 80;
				const paddleSpeed = latestGameState?.constant?.paddleSpeed ?? 10;
				const canvasHeight = latestGameState?.constant?.canvasHeight ?? 400;
				const nextY =
					movement.direction === "UP"
						? Math.max(0, currentY - paddleSpeed)
						: Math.min(canvasHeight - paddleHeight, currentY + paddleSpeed);

				setOptimisticPaddleY((prev) => ({
					...prev,
					[paddleKey]: nextY,
				}));

				sendInput({ type: "PADDLE_MOVE", direction: movement.direction, player: movement.player });
				return;
			}
			else if (e.key === "Enter") sendInput({ type: "START" });
			else if (e.key === " ") { e.preventDefault(); sendInput({ type: "PAUSE" }); }
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			const movement = getLocalMovementForKey(e.key);
			if (!movement) return;
			if (movement.player === 2 && isAIEnabled) return;

			if (heldDirectionsRef.current[movement.player] !== movement.direction) return;
			heldDirectionsRef.current[movement.player] = null;

			setOptimisticPaddleY((prev) => ({
				...prev,
				[movement.player === 1 ? "p1" : "p2"]: null,
			}));

			sendInput({ type: "PADDLE_MOVE", direction: null, player: movement.player });
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			heldDirectionsRef.current = { 1: null, 2: null };
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
