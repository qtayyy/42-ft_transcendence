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

type LocalPlayer = 1 | 2;
type LocalDirection = "UP" | "DOWN";
type LocalPaddleKey = "p1" | "p2";
type HeldDirectionState = Record<LocalPlayer, LocalDirection | null>;

interface OptimisticPaddlePreview {
	previewY: number;
	sourceY: number;
}

type OptimisticPaddleState = Record<LocalPaddleKey, OptimisticPaddlePreview | null>;

interface LocalMovement {
	player: LocalPlayer;
	direction: LocalDirection;
	paddleKey: LocalPaddleKey;
	shouldPreventDefault: boolean;
}

const DEFAULT_CANVAS_DIMENSIONS = { width: 800, height: 400 };
const EMPTY_HELD_DIRECTIONS: HeldDirectionState = { 1: null, 2: null };
const EMPTY_OPTIMISTIC_PADDLES: OptimisticPaddleState = { p1: null, p2: null };

function getLocalMovementForKey(key: string): LocalMovement | null {
	if (key === "w" || key === "W") {
		return { player: 1, direction: "UP", paddleKey: "p1", shouldPreventDefault: false };
	}
	if (key === "s" || key === "S") {
		return { player: 1, direction: "DOWN", paddleKey: "p1", shouldPreventDefault: false };
	}
	if (key === "ArrowUp") {
		return { player: 2, direction: "UP", paddleKey: "p2", shouldPreventDefault: true };
	}
	if (key === "ArrowDown") {
		return { player: 2, direction: "DOWN", paddleKey: "p2", shouldPreventDefault: true };
	}

	return null;
}

function withOptimisticPaddles(
	baseGameState: GameState | null | undefined,
	optimisticPaddles: OptimisticPaddleState,
	wsUrl?: string
) {
	if (!wsUrl || !baseGameState) return baseGameState ?? null;

	const { p1, p2 } = optimisticPaddles;
	if (p1 === null && p2 === null) return baseGameState;

	return {
		...baseGameState,
		paddles: {
			...baseGameState.paddles,
			p1: {
				...baseGameState.paddles.p1,
				y:
					p1 && baseGameState.paddles.p1.y === p1.sourceY
						? p1.previewY
						: baseGameState.paddles.p1.y,
			},
			p2: {
				...baseGameState.paddles.p2,
				y:
					p2 && baseGameState.paddles.p2.y === p2.sourceY
						? p2.previewY
						: baseGameState.paddles.p2.y,
			},
		},
	};
}

function getNextOptimisticPaddleY(
	gameState: GameState | null,
	movement: LocalMovement
) {
	const currentY = gameState?.paddles[movement.paddleKey].y ?? 0;
	const paddleHeight = gameState?.constant?.paddleHeight ?? 80;
	const paddleSpeed = gameState?.constant?.paddleSpeed ?? 10;
	const canvasHeight = gameState?.constant?.canvasHeight ?? 400;

	if (movement.direction === "UP") {
		return Math.max(0, currentY - paddleSpeed);
	}

	return Math.min(canvasHeight - paddleHeight, currentY + paddleSpeed);
}

function getCanvasDimensions(
	container: HTMLDivElement,
	baseCanvasWidth: number,
	baseCanvasHeight: number
) {
	const aspectRatio = baseCanvasWidth / baseCanvasHeight;
	const computedStyle = window.getComputedStyle(container);
	const horizontalPadding =
		(parseFloat(computedStyle.paddingLeft) || 0) +
		(parseFloat(computedStyle.paddingRight) || 0);
	const verticalPadding =
		(parseFloat(computedStyle.paddingTop) || 0) +
		(parseFloat(computedStyle.paddingBottom) || 0);

	const maxWidth = Math.max(container.clientWidth - horizontalPadding, 0);
	const maxHeight = Math.max(container.clientHeight - verticalPadding, 0);
	if (!maxWidth || !maxHeight) return null;

	let width = maxWidth;
	let height = width / aspectRatio;

	if (height > maxHeight) {
		height = maxHeight;
		width = height * aspectRatio;
	}

	width = Math.min(width, 1400);
	height = width / aspectRatio;

	return {
		width: Math.round(width),
		height: Math.round(height),
	};
}

function isGameOverMessage(data: unknown): data is {
	type: "GAME_OVER";
	winner: number | null;
	score: { p1: number; p2: number };
	result?: "win" | "draw";
} {
	return typeof data === "object" && data !== null && (data as { type?: string }).type === "GAME_OVER";
}

export function usePongGame({ matchId, wsUrl, externalGameState, onGameOver, isAIEnabled = false }: UsePongGameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const onGameOverRef = useRef(onGameOver);
	const latestGameStateRef = useRef<GameState | null>(null);
	const heldDirectionsRef = useRef<HeldDirectionState>({ ...EMPTY_HELD_DIRECTIONS });

	const [localGameState, setLocalGameState] = useState<GameState | null>(null);
	const [optimisticPaddles, setOptimisticPaddles] =
		useState<OptimisticPaddleState>(EMPTY_OPTIMISTIC_PADDLES);
	const [canvasDimensions, setCanvasDimensions] = useState(DEFAULT_CANVAS_DIMENSIONS);

	const baseGameState = wsUrl ? localGameState : externalGameState;
	const gameState = useMemo(
		() => withOptimisticPaddles(baseGameState, optimisticPaddles, wsUrl),
		[baseGameState, optimisticPaddles, wsUrl]
	);

	const baseCanvasWidth = gameState?.constant?.canvasWidth || DEFAULT_CANVAS_DIMENSIONS.width;
	const baseCanvasHeight = gameState?.constant?.canvasHeight || DEFAULT_CANVAS_DIMENSIONS.height;

	useEffect(() => {
		latestGameStateRef.current = gameState;
	}, [gameState]);

	useEffect(() => {
		const updateCanvasSize = () => {
			if (!containerRef.current) return;

			const nextDimensions = getCanvasDimensions(
				containerRef.current,
				baseCanvasWidth,
				baseCanvasHeight
			);
			if (!nextDimensions) return;

			setCanvasDimensions(nextDimensions);
		};

		updateCanvasSize();
		const resizeObserver = new ResizeObserver(updateCanvasSize);
		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		return () => {
			resizeObserver.disconnect();
		};
	}, [matchId, baseCanvasWidth, baseCanvasHeight]);

	useEffect(() => {
		if (!wsUrl) return;

		const ws = new WebSocket(wsUrl);

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				startTransition(() => {
					if (isGameOverMessage(data)) {
						if (onGameOverRef.current) {
							onGameOverRef.current(data.winner, data.score, data.result || "win");
						}

						setLocalGameState((prev) =>
							prev
								? {
										...prev,
										status: "finished",
										winner: data.winner,
										score: data.score,
										result: data.result,
								  }
								: null
						);
						return;
					}

					setLocalGameState(data);
				});
			} catch (error) {
				console.error("[usePongGame] WS Parse Error", error);
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
		if (!wsUrl) return;

		const sendInput = (payload: object) => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				socketRef.current.send(JSON.stringify(payload));
				return;
			}

			console.error(
				"[usePongGame] WebSocket not ready. Cannot send message.",
				socketRef.current?.readyState
			);
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			const movement = getLocalMovementForKey(event.key);
			if (movement) {
				if (event.repeat) return;
				if (movement.shouldPreventDefault) event.preventDefault();
				if (movement.player === 2 && isAIEnabled) return;
				if (heldDirectionsRef.current[movement.player] === movement.direction) return;

				heldDirectionsRef.current[movement.player] = movement.direction;
				const nextOptimisticY = getNextOptimisticPaddleY(
					latestGameStateRef.current,
					movement
				);

				setOptimisticPaddles((current) => ({
					...current,
					[movement.paddleKey]: {
						previewY: nextOptimisticY,
						sourceY:
							latestGameStateRef.current?.paddles[movement.paddleKey].y ?? 0,
					},
				}));

				sendInput({
					type: "PADDLE_MOVE",
					direction: movement.direction,
					player: movement.player,
				});
				return;
			}

			if (event.key === "Enter") {
				sendInput({ type: "START" });
				return;
			}

			if (event.key === " ") {
				event.preventDefault();
				sendInput({ type: "PAUSE" });
			}
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			const movement = getLocalMovementForKey(event.key);
			if (!movement) return;
			if (movement.player === 2 && isAIEnabled) return;
			if (heldDirectionsRef.current[movement.player] !== movement.direction) return;

			heldDirectionsRef.current[movement.player] = null;
			setOptimisticPaddles((current) => ({
				...current,
				[movement.paddleKey]: null,
			}));

			sendInput({
				type: "PADDLE_MOVE",
				direction: null,
				player: movement.player,
			});
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			heldDirectionsRef.current = { ...EMPTY_HELD_DIRECTIONS };
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [matchId, wsUrl, isAIEnabled]);

	return {
		gameState,
		canvasRef,
		containerRef,
		canvasDimensions,
		socketRef,
	};
}
