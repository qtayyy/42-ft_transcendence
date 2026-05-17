import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { GameState, GameMode } from "@/types/game";

export const defaultBindings = {
	p1Up: 'w',
	p1Down: 's',
	p2Up: 'ArrowUp',
	p2Down: 'ArrowDown',
};

export type KeyBindings = typeof defaultBindings;

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

function isBoundKey(pressed: string, binding: string): boolean {
	return pressed.toLowerCase() === binding.toLowerCase();
}

function getLocalMovementForKey(key: string, bindings: KeyBindings): LocalMovement | null {
	if (isBoundKey(key, bindings.p1Up)) {
		return { player: 1, direction: "UP", paddleKey: "p1", shouldPreventDefault: key.startsWith("Arrow") };
	}
	if (isBoundKey(key, bindings.p1Down)) {
		return { player: 1, direction: "DOWN", paddleKey: "p1", shouldPreventDefault: key.startsWith("Arrow") };
	}
	if (isBoundKey(key, bindings.p2Up)) {
		return { player: 2, direction: "UP", paddleKey: "p2", shouldPreventDefault: true };
	}
	if (isBoundKey(key, bindings.p2Down)) {
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

function isLocalControlInput(payload: object) {
	const type = (payload as { type?: unknown }).type;
	return type === "START" || type === "PAUSE";
}

export function usePongGame({ matchId, wsUrl, externalGameState, onGameOver, isAIEnabled = false }: UsePongGameProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const onGameOverRef = useRef(onGameOver);
	const latestGameStateRef = useRef<GameState | null>(null);
	const heldDirectionsRef = useRef<HeldDirectionState>({ ...EMPTY_HELD_DIRECTIONS });
	const pendingControlInputRef = useRef<object | null>(null);
	const reconnectLocalSocketRef = useRef<() => void>(() => {});

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

	const [bindings, setBindingsState] = useState<KeyBindings>(() => {
		if (typeof window === 'undefined') return defaultBindings;
		try {
			const saved = localStorage.getItem('pongBindings');
			return saved ? { ...defaultBindings, ...JSON.parse(saved) } : defaultBindings;
		} catch {
			return defaultBindings;
		}
	});

	const setBindings = (newBindings: KeyBindings) => {
		setBindingsState(newBindings);
		try { localStorage.setItem('pongBindings', JSON.stringify(newBindings)); } catch { /* ignore */ }
	};

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
		if (!wsUrl) {
			socketRef.current = null;
			return;
		}

		let isDisposed = false;
		let activeSocket: WebSocket | null = null;
		let reconnectTimer: number | null = null;

		const clearLocalInputState = () => {
			heldDirectionsRef.current = { ...EMPTY_HELD_DIRECTIONS };
			setOptimisticPaddles(EMPTY_OPTIMISTIC_PADDLES);
		};

		const shouldReconnect = () =>
			!isDisposed &&
			document.visibilityState !== "hidden" &&
			latestGameStateRef.current?.status !== "finished";

		const clearReconnectTimer = () => {
			if (reconnectTimer === null) return;
			window.clearTimeout(reconnectTimer);
			reconnectTimer = null;
		};

		const sendPendingControlInput = (ws: WebSocket) => {
			if (socketRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;
			if (!pendingControlInputRef.current) return;

			const payload = pendingControlInputRef.current;
			pendingControlInputRef.current = null;
			ws.send(JSON.stringify(payload));
		};

		const connect = () => {
			if (!shouldReconnect()) return;

			const currentSocket = socketRef.current;
			if (
				currentSocket?.readyState === WebSocket.OPEN ||
				currentSocket?.readyState === WebSocket.CONNECTING
			) {
				return;
			}

			const ws = new WebSocket(wsUrl);
			activeSocket = ws;
			socketRef.current = ws;

			ws.onopen = () => {
				sendPendingControlInput(ws);
			};

			const clearLocalSocket = () => {
				if (socketRef.current !== ws) return;

				socketRef.current = null;
				clearLocalInputState();
			};

			const scheduleReconnect = () => {
				if (!shouldReconnect() || reconnectTimer !== null) return;

				reconnectTimer = window.setTimeout(() => {
					reconnectTimer = null;
					connect();
				}, 1000);
			};

			ws.onclose = () => {
				clearLocalSocket();
				scheduleReconnect();
			};

			ws.onerror = () => {
				clearLocalSocket();
				if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
					ws.close();
					return;
				}
				scheduleReconnect();
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					startTransition(() => {
						if (isGameOverMessage(data)) {
							clearReconnectTimer();
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
		};

		const reconnectIfNeeded = () => {
			if (document.visibilityState === "hidden") return;
			clearReconnectTimer();
			connect();
		};

		reconnectLocalSocketRef.current = reconnectIfNeeded;
		connect();
		window.addEventListener("focus", reconnectIfNeeded);
		document.addEventListener("visibilitychange", reconnectIfNeeded);

		return () => {
			isDisposed = true;
			reconnectLocalSocketRef.current = () => {};
			pendingControlInputRef.current = null;
			clearReconnectTimer();
			window.removeEventListener("focus", reconnectIfNeeded);
			document.removeEventListener("visibilitychange", reconnectIfNeeded);
			if (socketRef.current === activeSocket) {
				socketRef.current = null;
			}
			clearLocalInputState();
			activeSocket?.close();
		};
	}, [wsUrl, matchId]);

	useEffect(() => {
		onGameOverRef.current = onGameOver;
	}, [onGameOver]);

	useEffect(() => {
		if (!wsUrl) return;

		const sendInput = (payload: object) => {
			const socket = socketRef.current;
			if (socket?.readyState !== WebSocket.OPEN) {
				if (isLocalControlInput(payload)) {
					pendingControlInputRef.current = payload;
					reconnectLocalSocketRef.current();
				}
				return false;
			}

			socket.send(JSON.stringify(payload));
			return true;
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			const movement = getLocalMovementForKey(event.key, bindings);
			if (movement) {
				if (event.repeat) return;
				if (movement.shouldPreventDefault) event.preventDefault();
				if (movement.player === 2 && isAIEnabled) return;
				if (heldDirectionsRef.current[movement.player] === movement.direction) return;

				const nextOptimisticY = getNextOptimisticPaddleY(
					latestGameStateRef.current,
					movement
				);

				if (!sendInput({
					type: "PADDLE_MOVE",
					direction: movement.direction,
					player: movement.player,
				})) {
					return;
				}

				heldDirectionsRef.current[movement.player] = movement.direction;
				setOptimisticPaddles((current) => ({
					...current,
					[movement.paddleKey]: {
						previewY: nextOptimisticY,
						sourceY:
							latestGameStateRef.current?.paddles[movement.paddleKey].y ?? 0,
					},
				}));
				return;
			}

			if (event.key === "Enter") {
				sendInput({ type: "START" });
				return;
			}

			if (event.key === " " || event.key === "Escape") {
				event.preventDefault();
				sendInput({ type: "PAUSE" });
			}
		};

		const handleKeyUp = (event: KeyboardEvent) => {
			const movement = getLocalMovementForKey(event.key, bindings);
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
	}, [matchId, wsUrl, isAIEnabled, bindings]);

	return {
		gameState,
		canvasRef,
		containerRef,
		canvasDimensions,
		socketRef,
		bindings,
		setBindings,
	};
}
