"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { useGame } from "@/hooks/use-game";
import axios from "axios";
import { toast } from "sonner";
import type { GameState } from "@/types/game";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import RemoteGameRuntimeView from "@/features/game/runtime/remote-game-runtime-view";
import LocalGameRuntimeView from "@/features/game/runtime/local-game-runtime-view";
import {
	LOCAL_TOURNAMENT_PENDING_RESULT_PREFIX,
	getDisconnectInfoFromRemoteState,
	getMovementDirectionForKey,
	getNextHeldDirection,
	getPauseInfoFromRemoteState,
	hasSameDisconnectInfo,
	normalizeRemoteGameState,
	shouldAllowTournamentNavigation,
	type DisconnectInfo,
	type LocalMatchData,
	type MovementDirection,
	type PauseInfo,
	type RuntimeGameOverResult,
} from "@/features/game/runtime/runtime-helpers";
import { NavigationGuard } from "@/components/game/navigation-guard";
import { handleSessionExpiredRedirect } from "@/lib/session-expired";

const DEFAULT_PADDLE_HEIGHT = 80;
const DEFAULT_CANVAS_HEIGHT = 350;
const DEFAULT_PADDLE_SPEED = 10;
const REMOTE_INPUT_PULSE_MS = Math.round(1000 / 60);

interface OptimisticRemotePaddlePreview {
	previewY: number;
	direction: MovementDirection;
}

function getNextRemotePaddleY(
	currentY: number,
	direction: MovementDirection,
	paddleHeight: number,
	canvasHeight: number,
	paddleSpeed: number
) {
	if (direction === "UP") {
		return Math.max(0, currentY - paddleSpeed);
	}

	return Math.min(canvasHeight - paddleHeight, currentY + paddleSpeed);
}

function isRemotePreviewAhead(
	authoritativeY: number,
	preview: OptimisticRemotePaddlePreview
) {
	return preview.direction === "UP"
		? authoritativeY > preview.previewY
		: authoritativeY < preview.previewY;
}

export default function GameRuntimePage() {
	const params = useParams();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameState, setGameState, showNavGuard, setShowNavGuard, pendingPath, setPendingPath } = useGame();
	const matchId = params.matchId as string;
	const [matchData] = useState<LocalMatchData | null>(() => {
		if (typeof window === "undefined") return null;

		const storedMatchData = localStorage.getItem("current-match");
		return storedMatchData ? JSON.parse(storedMatchData) : null;
	});
	const [gameOverResult, setGameOverResult] = useState<RuntimeGameOverResult | null>(null);
	const [disconnectInfo, setDisconnectInfo] = useState<DisconnectInfo | null>(null);
	const [pauseInfo, setPauseInfo] = useState<PauseInfo | null>(null);
	const [optimisticPaddlePreview, setOptimisticPaddlePreview] =
		useState<OptimisticRemotePaddlePreview | null>(null);
	const spectatorParam = searchParams.get("spectator") === "true";
	// Detect spectator mode from query param or gameState
	const isSpectator = spectatorParam || gameState?.spectatorMode === true;
	const inferredTournamentId = useMemo(() => {
		if (!matchId?.startsWith("RT-")) return null;
		const parts = matchId.split("-m");
		return parts.length > 1 ? parts[0] : null;
	}, [matchId]);

	// Check if this is a tournament match
	// Use both gameState and matchId fallback so guards still work during reconnect/loading
	const isTournamentMatch =
		gameState?.tournamentId !== undefined && gameState?.tournamentId !== null
			? true
			: !!inferredTournamentId;

	// Determine if this is a remote game (RS-* prefix or RT-* prefix for tournaments)
	const isRemoteGame = matchId.startsWith("RS-") || matchId.startsWith("RT-");

	// For remote games, check if both players are ready
	const gameStart =
		!!gameState &&
		!gameState.leftPlayer?.gamePaused &&
		!gameState.rightPlayer?.gamePaused;

	// Track if we've already sent reconnection notification for this session
	const hasNotifiedReconnection = useRef(false);
	// Track if component is mounted to prevent false navigation events during re-renders
	const isMountedRef = useRef(true);
	// Prevent duplicate pause dispatches while the navigation guard stays open
	const navGuardPauseSentRef = useRef(false);
	const heldMovementKeysRef = useRef(new Set<string>());
	const heldMovementRef = useRef<"UP" | "DOWN" | null>(null);
	const remoteInputPulseRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
	const remoteGameStateRef = useRef(gameState);
	const remoteUserIdRef = useRef(user?.id);
	const remoteCurrentPlayerSideRef = useRef<"LEFT" | "RIGHT" | null>(null);

	const currentPlayerSide = useMemo(() => {
		if (!gameState || !user?.id) return null;
		if (gameState.me === "LEFT" || gameState.me === "RIGHT") return gameState.me;
		if (String(gameState.leftPlayer?.id) === String(user.id)) return "LEFT";
		if (String(gameState.rightPlayer?.id) === String(user.id)) return "RIGHT";
		return null;
	}, [gameState, user?.id]);

	useEffect(() => {
		remoteGameStateRef.current = gameState;
		remoteUserIdRef.current = user?.id;
		remoteCurrentPlayerSideRef.current = currentPlayerSide;
	}, [gameState, user?.id, currentPlayerSide]);

	const clearRemoteInputPulse = useCallback(() => {
		if (remoteInputPulseRef.current !== null) {
			window.clearInterval(remoteInputPulseRef.current);
			remoteInputPulseRef.current = null;
		}
	}, []);

	const advanceRemoteOptimisticPaddlePreview = useCallback(
		(direction: MovementDirection) => {
			const currentGameState = remoteGameStateRef.current;
			const activePlayerSide = remoteCurrentPlayerSideRef.current;
			if (!currentGameState || !activePlayerSide) return;

			const currentPlayer =
				activePlayerSide === "LEFT"
					? currentGameState.leftPlayer
					: currentGameState.rightPlayer;
			const authoritativeY = currentPlayer?.paddleY ?? 0;
			const paddleHeight =
				currentPlayer?.paddleHeight ??
				currentGameState.constant?.paddleHeight ??
				DEFAULT_PADDLE_HEIGHT;
			const canvasHeight =
				currentGameState.constant?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT;
			const paddleSpeed =
				currentGameState.constant?.paddleSpeed ?? DEFAULT_PADDLE_SPEED;

			setOptimisticPaddlePreview((currentPreview) => {
				const baseY =
					currentPreview?.direction === direction
						? direction === "UP"
							? Math.min(currentPreview.previewY, authoritativeY)
							: Math.max(currentPreview.previewY, authoritativeY)
						: authoritativeY;

				return {
					previewY: getNextRemotePaddleY(
						baseY,
						direction,
						paddleHeight,
						canvasHeight,
						paddleSpeed
					),
					direction,
				};
			});
		},
		[]
	);

	const sendRemoteMovementEvent = useCallback(
		(keyEvent: string) => {
			const currentGameState = remoteGameStateRef.current;
			if (!currentGameState?.matchId) return;

			sendSocketMessage({
				event: "GAME_EVENTS",
				payload: {
					matchId: currentGameState.matchId,
					userId: remoteUserIdRef.current,
					keyEvent,
				},
			});
		},
		[sendSocketMessage]
	);

	const pulseRemoteMovement = useCallback(
		(direction: MovementDirection) => {
			advanceRemoteOptimisticPaddlePreview(direction);
			sendRemoteMovementEvent(direction);
		},
		[advanceRemoteOptimisticPaddlePreview, sendRemoteMovementEvent]
	);

	const startRemoteInputPulse = useCallback(() => {
		clearRemoteInputPulse();
		remoteInputPulseRef.current = window.setInterval(() => {
			if (!heldMovementRef.current) return;
			pulseRemoteMovement(heldMovementRef.current);
		}, REMOTE_INPUT_PULSE_MS);
	}, [clearRemoteInputPulse, pulseRemoteMovement]);

	// Notify server when player returns to game page (reconnection)
	// Only send this if the game state shows we were disconnected, not on initial load
	useEffect(() => {
		if (!isRemoteGame || !isReady || !matchId || isSpectator) return;
		// Only send reconnection if game is paused due to disconnect
		// This prevents false positives on initial game load
		if (!gameState) return;

		const disconnectedPlayer = (
			gameState as typeof gameState & { disconnectedPlayer?: string }
		)?.disconnectedPlayer;
		const isPausedDueToDisconnect =
			gameState.paused && (disconnectedPlayer || gameState.disconnectCountdown);

		// Only notify once per session and only if actually reconnecting from disconnect
		if (isPausedDueToDisconnect && !hasNotifiedReconnection.current) {
			hasNotifiedReconnection.current = true;
			sendSocketMessage({
				event: "PLAYER_RECONNECTING",
				payload: {
					matchId,
					userId: user?.id
				}
			});
		}
	}, [isRemoteGame, isReady, matchId, user, isSpectator, sendSocketMessage, gameState]);

	// Spectators re-subscribe on mount and after socket reconnect
	useEffect(() => {
		if (!isRemoteGame || !isReady || !matchId) return;
		if (isSpectator || spectatorParam) {
			sendSocketMessage({
				event: "VIEW_MATCH",
				payload: { matchId }
			});
		}
	}, [isRemoteGame, isReady, matchId, sendSocketMessage, isSpectator, spectatorParam]);

	// Request initial game state if missing (e.g. on page reload) for players
	useEffect(() => {
		if (!isRemoteGame || !isReady || !matchId) return;
		if (isSpectator || spectatorParam) return;

		// Check if gameState matches current matchId (prevent using stale state)
		const isGameStateValid = gameState && gameState.matchId === matchId;
		if (!isGameStateValid) {
			sendSocketMessage({
				event: "GET_GAME_STATE",
				payload: { matchId }
			});
		}
	}, [isRemoteGame, isReady, matchId, gameState, sendSocketMessage, isSpectator, spectatorParam]);

	// Auto-redirect for tournament matches
	useEffect(() => {
		if (gameOverResult?.tournamentId) {
			const timer = setTimeout(() => {
				router.push(`/game/remote/tournament/${gameOverResult.tournamentId}`);
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [gameOverResult, router]);

	// Memoized event handlers to prevent listener accumulation
	const handleGameOverEvent = useCallback((event: CustomEvent<RuntimeGameOverResult>) => {
		// Validate that this game over event belongs to the current match
		if (event.detail?.matchId && event.detail.matchId !== matchId) {
			return;
		}
		// Ensure game-over overlay takes precedence over any pause/disconnect overlays.
		setPauseInfo(null);
		setDisconnectInfo(null);
		setGameOverResult(event.detail);
	}, [matchId]);

	// Listen for game over event
	useEffect(() => {
		window.addEventListener("gameOver", handleGameOverEvent as EventListener);
		return () => {
			window.removeEventListener("gameOver", handleGameOverEvent as EventListener);
		};
	}, [matchId, handleGameOverEvent]);

	// Cleanup spectator state on unmount to prevent blocking LEAVE_ROOM later
	useEffect(() => {
		return () => {
			// In dev Strict Mode, mount->unmount->mount can happen immediately.
			// Only clear if this page is actually being left.
			if (isSpectator && setGameState && window.location.pathname !== `/game/${matchId}`) {
				setGameState(null);
			}
		};
	}, [isSpectator, setGameState, matchId]);

	// Listen for opponent disconnect/reconnect events
	const [opponentConnected, setOpponentConnected] = useState(true);

	// Memoized event handlers for game state events
	const handleDisconnect = useCallback((event: CustomEvent) => {
		const { disconnectedPlayer, gracePeriodEndsAt } = event.detail;
		const countdown = Math.ceil((gracePeriodEndsAt - Date.now()) / 1000);
		setPauseInfo(null);
		setDisconnectInfo({ disconnectedPlayer, gracePeriodEndsAt, countdown });
		toast.warning("Opponent disconnected! Waiting for reconnection...");
		setOpponentConnected(false);
	}, []);

	const handleReconnect = useCallback(() => {
		setDisconnectInfo(null);
		toast.success("Opponent reconnected!");
		setOpponentConnected(true);
	}, []);

	const handleOpponentLeft = useCallback(() => {
		setOpponentConnected(false);
		// We don't need to toast here as SocketContext already does, or we can add specific UI feedback
	}, []);

	// Pause/Resume events
	const handleGamePaused = useCallback((event: CustomEvent) => {
		const { pausedBy, pausedByName } = event.detail;
		setPauseInfo({
			pausedBy,
			pausedByName,
			myReadyToResume: false,
			opponentReadyToResume: false
		});
	}, []);

	const handleGameResumed = useCallback(() => {
		setPauseInfo(null);
	}, []);

	const handleOpponentReadyToResume = useCallback(() => {
		setPauseInfo(prev => prev ? { ...prev, opponentReadyToResume: true } : null);
	}, []);

	const handleWaitingForResume = useCallback(() => {
		setPauseInfo(prev => prev ? { ...prev, myReadyToResume: true } : null);
	}, []);

	useEffect(() => {
		window.addEventListener("opponentDisconnected", handleDisconnect as EventListener);
		window.addEventListener("opponentReconnected", handleReconnect as EventListener);
		window.addEventListener("opponentLeft", handleOpponentLeft as EventListener);
		window.addEventListener("gamePaused", handleGamePaused as EventListener);
		window.addEventListener("gameResumed", handleGameResumed as EventListener);
		window.addEventListener("opponentReadyToResume", handleOpponentReadyToResume as EventListener);
		window.addEventListener("waitingForResume", handleWaitingForResume as EventListener);

		return () => {
			window.removeEventListener("opponentDisconnected", handleDisconnect as EventListener);
			window.removeEventListener("opponentReconnected", handleReconnect as EventListener);
			window.removeEventListener("opponentLeft", handleOpponentLeft as EventListener);
			window.removeEventListener("gamePaused", handleGamePaused as EventListener);
			window.removeEventListener("gameResumed", handleGameResumed as EventListener);
			window.removeEventListener("opponentReadyToResume", handleOpponentReadyToResume as EventListener);
			window.removeEventListener("waitingForResume", handleWaitingForResume as EventListener);
		};
	}, [matchId, handleDisconnect, handleReconnect, handleOpponentLeft, handleGamePaused, handleGameResumed, handleOpponentReadyToResume, handleWaitingForResume]);

	// Sync disconnect info from game state (for reconnection scenarios or late state updates).
	// We keep the overlay state local so event-driven updates remain immediate, while this
	// effect restores the same UI after refresh or socket recovery.
	/* eslint-disable react-hooks/set-state-in-effect */
	useEffect(() => {
		if (!gameState) return;

		const nextDisconnectInfo = getDisconnectInfoFromRemoteState(gameState);
		if (nextDisconnectInfo && !hasSameDisconnectInfo(disconnectInfo, nextDisconnectInfo)) {
			setPauseInfo(null);
			setDisconnectInfo(nextDisconnectInfo);
			setOpponentConnected(false);
			return;
		}

		if (!nextDisconnectInfo && disconnectInfo) {
			setDisconnectInfo(null);
			setOpponentConnected(true);
		}
	}, [gameState, disconnectInfo]);

	// Sync pauseInfo from gameState to ensure UI is always accurate
	// (especially for spectators or after a page refresh/reconnect).
	useEffect(() => {
		if (gameState?.paused) {
			const nextPauseInfo = getPauseInfoFromRemoteState(gameState, user?.id);
			if (!nextPauseInfo) return;

			setPauseInfo((previousPauseInfo) => {
				if (
					previousPauseInfo?.pausedBy === nextPauseInfo.pausedBy &&
					previousPauseInfo?.pausedByName === nextPauseInfo.pausedByName &&
					previousPauseInfo?.myReadyToResume === nextPauseInfo.myReadyToResume &&
					previousPauseInfo?.opponentReadyToResume ===
						nextPauseInfo.opponentReadyToResume
				) {
					return previousPauseInfo;
				}

				return nextPauseInfo;
			});
			return;
		}

		if (gameState && !gameState.paused && !pendingPath && !showNavGuard && pauseInfo) {
			setPauseInfo(null);
		}
	}, [gameState, user?.id, pendingPath, showNavGuard, pauseInfo]);
	/* eslint-enable react-hooks/set-state-in-effect */

	// Countdown timer for disconnect grace period
	useEffect(() => {
		if (!disconnectInfo) return;

		let isActive = true;

		const interval = setInterval(() => {
			if (!isActive) {
				clearInterval(interval);
				return;
			}

			const remaining = Math.ceil((disconnectInfo.gracePeriodEndsAt - Date.now()) / 1000);
			if (remaining <= 0) {
				clearInterval(interval);
				setDisconnectInfo(null);
			} else {
				setDisconnectInfo(prev => prev ? { ...prev, countdown: remaining } : null);
			}
		}, 1000);

		return () => {
			isActive = false;
			clearInterval(interval);
		};
	}, [disconnectInfo]);

	// Handle keyboard input for remote games
	useEffect(() => {
		if (!isRemoteGame || !isReady || isSpectator) return;

		const onKeyDown = (e: KeyboardEvent) => {
			const KEYS = ["w", "W", "s", "S", "ArrowUp", "ArrowDown", "Enter", " "];
			if (!KEYS.includes(e.key)) return;

			// Prevent default scrolling for arrow keys and space
			if (["ArrowUp", "ArrowDown", " "].includes(e.key)) {
				e.preventDefault();
			}

			let keyEvent = "START";
			// Both WASD and Arrow keys send generic UP/DOWN for the current user
			// The backend determines which paddle to move based on userId
			const movementDirection = getMovementDirectionForKey(e.key);
			if (movementDirection) keyEvent = movementDirection;
			else if (e.key === " ") keyEvent = "PAUSE"; // Space = pause/resume game

			if (movementDirection && e.repeat) {
				return;
			}

			if (movementDirection) {
				heldMovementKeysRef.current.add(e.key);
			}

			if ((keyEvent === "UP" || keyEvent === "DOWN") && heldMovementRef.current === keyEvent) {
				return;
			}
			if ((keyEvent === "START" || keyEvent === "PAUSE") && e.repeat) {
				return;
			}

			if (keyEvent === "UP" || keyEvent === "DOWN") {
				heldMovementRef.current = keyEvent;
				pulseRemoteMovement(keyEvent);
				startRemoteInputPulse();
				return;
			}

			sendRemoteMovementEvent(keyEvent);
		};

		const onKeyUp = (e: KeyboardEvent) => {
			const KEYS = ["w", "W", "s", "S", "ArrowUp", "ArrowDown"];
			if (!KEYS.includes(e.key)) return;

			const releasedDirection = getMovementDirectionForKey(e.key);
			if (releasedDirection) {
				heldMovementKeysRef.current.delete(e.key);
				const nextDirection = getNextHeldDirection(
					heldMovementKeysRef.current,
					heldMovementRef.current
				);

				if (nextDirection === heldMovementRef.current) {
					return;
				}

				heldMovementRef.current = nextDirection;
				if (nextDirection) {
					pulseRemoteMovement(nextDirection);
					startRemoteInputPulse();
					return;
				}
			}

			clearRemoteInputPulse();
			sendRemoteMovementEvent(heldMovementRef.current || "");
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		return () => {
			clearRemoteInputPulse();
			heldMovementKeysRef.current = new Set<string>();
			heldMovementRef.current = null;
			setOptimisticPaddlePreview(null);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, [
		isRemoteGame,
		isReady,
		isSpectator,
		clearRemoteInputPulse,
		pulseRemoteMovement,
		sendRemoteMovementEvent,
		startRemoteInputPulse,
	]);

	// Refs for cleanup function to access latest state without re-running effect
	const gameStateRef = useRef(gameState);
	const userRef = useRef(user);
	const gameOverResultRef = useRef(gameOverResult);

	// Keep refs synced for disconnect/navigation cleanup without re-running effects
	useEffect(() => {
		gameStateRef.current = gameState;
	}, [gameState]);

	useEffect(() => {
		userRef.current = user;
		gameOverResultRef.current = gameOverResult;
	}, [user, gameOverResult]);

	// Notify server when player is leaving the game page (for disconnect detection)
	useEffect(() => {
		if (!isRemoteGame) return;

		// Mark component as mounted
		isMountedRef.current = true;

		const handleBeforeUnload = () => {
			const currentGameState = gameStateRef.current;
			const currentUser = userRef.current;

			// Send notification that player is leaving (both players and spectators)
			if (currentGameState?.matchId && currentUser?.id && !isSpectator) {
				sendSocketMessage({
					event: "PLAYER_NAVIGATING_AWAY",
					payload: {
						matchId: currentGameState.matchId,
						userId: currentUser.id
					}
				});
			}
		};

		// Handle browser close/refresh
		window.addEventListener("beforeunload", handleBeforeUnload);

		// Cleanup function - called when component unmounts (navigation away)
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);

			// Mark as unmounted immediately
			isMountedRef.current = false;

			// FIX: Only send PLAYER_NAVIGATING_AWAY if this is the FINAL unmount
			// React's Strict Mode and hot reload can cause multiple mount/unmount cycles
			// We use a small delay to detect if this is a re-render or actual navigation
			setTimeout(() => {
				// If component hasn't remounted after 100ms, it's actual navigation
				if (!isMountedRef.current) {
					const currentGameState = gameStateRef.current;
					const currentUser = userRef.current;
					const currentGameOverResult = gameOverResultRef.current;

					if (currentGameState?.matchId && !currentGameOverResult && currentUser?.id && !isSpectator) {
						sendSocketMessage({
							event: "PLAYER_NAVIGATING_AWAY",
							payload: {
								matchId: currentGameState.matchId,
								userId: currentUser.id
							}
						});
					}
				}
			}, 100);
		};
	}, [isRemoteGame, isSpectator, sendSocketMessage]); // Removed dependencies that change frequently

	// Navigation guard for active:
	// - remote tournament matches
	// - local matches
	// - local tournament matches
	useEffect(() => {
		const shouldGuardNavigation = !gameOverResult && !isSpectator && (isTournamentMatch || !isRemoteGame);
		if (!shouldGuardNavigation) return;

		const handleRouteChange = (e: BeforeUnloadEvent) => {
			const warningMessage = !isRemoteGame && isTournamentMatch
				? "Navigating away will forfeit the entire tournament. Are you sure you want to leave?"
				: !isRemoteGame
					? "Navigating away will forfeit this match. Are you sure you want to leave?"
					: "You have an active tournament. Are you sure you want to leave?";

			e.preventDefault();
			e.returnValue = warningMessage;
			return e.returnValue;
		};

		// Intercept browser navigation (refresh/close)
		window.addEventListener("beforeunload", handleRouteChange);

		// Intercept in-app navigation by listening to clicks on navigation elements
		const handleNavigationClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const link = target.closest("a[href]");
			if (!link) return;

			const href = link.getAttribute("href");
			if (!href || href === "#" || href.startsWith("http")) {
				// Allow external links, empty hrefs, and hash links
				return;
			}
			if (href === pathname) return;

			if (
				shouldAllowTournamentNavigation({
					href,
					isRemoteGame,
					isTournamentMatch,
					tournamentId: gameState?.tournamentId || inferredTournamentId,
				})
			) {
				return;
			}

			// Block navigation to other pages and show confirmation dialog
			e.preventDefault();
			e.stopPropagation();

			// Show confirmation dialog
			setPendingPath(href);
			setShowNavGuard(true);
		};

		// Add click listener to catch navigation attempts
		document.addEventListener("click", handleNavigationClick, true);

		return () => {
			window.removeEventListener("beforeunload", handleRouteChange);
			document.removeEventListener("click", handleNavigationClick, true);
		};
	}, [
		isTournamentMatch,
		gameOverResult,
		isSpectator,
		isRemoteGame,
		gameState,
		inferredTournamentId,
		pathname,
		setShowNavGuard,
		setPendingPath,
	]);

	// Auto-pause remote matches whenever navigation guard opens from an active player session.
	// This covers all guard entry points (header/menu links + in-page link interception).
	useEffect(() => {
		if (!showNavGuard) {
			navGuardPauseSentRef.current = false;
			return;
		}
		if (navGuardPauseSentRef.current) return;
		if (!pendingPath || isSpectator) return;

		if (isRemoteGame) {
			const currentMatchId = gameState?.matchId;
			const isAlreadyPaused = !!gameState?.paused;
			if (!currentMatchId || isAlreadyPaused) return;

			navGuardPauseSentRef.current = true;
			sendSocketMessage({
				event: "GAME_EVENTS",
				payload: {
					matchId: currentMatchId,
					userId: user?.id,
					keyEvent: "PAUSE",
				},
			});
			return;
		}

		// Local match: pause via local WS game loop.
		window.dispatchEvent(
			new CustomEvent("localGuardPauseRequested", {
				detail: { matchId },
			})
		);
		navGuardPauseSentRef.current = true;
	}, [
		showNavGuard,
		pendingPath,
		isRemoteGame,
		isSpectator,
		gameState?.matchId,
		gameState?.paused,
		matchId,
		user?.id,
		sendSocketMessage
	]);

	// Return to lobby handler for spectators
	const returnToLobby = useCallback(() => {
		// Send UNVIEW_MATCH event
		if (matchId) {
			sendSocketMessage({
				event: "UNVIEW_MATCH",
				payload: { matchId }
			});
		}

		// Navigate back to tournament lobby or dashboard
		const tournamentId = gameState?.tournamentId || inferredTournamentId;

		if (tournamentId) {
			router.push(`/game/remote/tournament/${tournamentId}`);
		} else {
			router.push("/dashboard");
		}
	}, [matchId, sendSocketMessage, gameState, inferredTournamentId, router]);

	const handleGameOver = async (
		winner: number | null,
		score: { p1: number; p2: number },
		result: string
	) => {
		const durationSeconds = Math.max(
			0,
			Math.round((gameState?.timer?.timeElapsed ?? 0) / 1000)
		);

		if (matchData) {
			try {
				if (matchData.isTournamentMatch && matchData.tournamentId) {
					const outcome = result === "draw" || winner === null ? "draw" : "win";
					const resultPayload = {
						matchId: matchData.matchId,
						player1Id: matchData.player1?.id,
						player2Id: matchData.player2?.id || null,
						score,
						outcome,
						durationSeconds,
					};
					const pendingKey = `${LOCAL_TOURNAMENT_PENDING_RESULT_PREFIX}${matchData.tournamentId}:${matchData.matchId}`;
					// Write-through outbox: store first, then attempt network submit.
					// This keeps tournament progression recoverable if tab closes/disconnects mid-request.
					localStorage.setItem(
						pendingKey,
						JSON.stringify({
							tournamentId: matchData.tournamentId,
							...resultPayload,
							recordedAt: Date.now(),
						})
					);
					try {
						await axios.post(
							`/api/tournament/${matchData.tournamentId}/match-result`,
							resultPayload
						);
						localStorage.removeItem(pendingKey);
					} catch (submitError: unknown) {
						if (handleSessionExpiredRedirect(submitError, router)) {
							return;
						}
						console.error("Failed to submit tournament result immediately. Pending result kept for replay.", submitError);
					}
				}

				// WS-driven matches persist on the backend runtime to keep a single
				// source of truth for match history writes.
			} catch (error: unknown) {
				if (handleSessionExpiredRedirect(error, router)) {
					return;
				}
				console.error("Failed to save match:", error);
				toast.error("Failed to save match result.");
			}
		}
	};

	const handleExit = () => {
		localStorage.removeItem("current-match");
		if (matchData?.isTournamentMatch && matchData?.tournamentId) {
			router.push(`/game/local/tournament/${matchData.tournamentId}`);
			return;
		}
		router.push("/game/new");
	};

	const normalizedRemoteGameState = useMemo<GameState | null>(() => {
		if (!isRemoteGame || !gameState) return null;
		return normalizeRemoteGameState(gameState, gameOverResult);
	}, [isRemoteGame, gameState, gameOverResult]);

	const displayedRemoteGameState = useMemo(() => {
		if (
			!normalizedRemoteGameState ||
			!optimisticPaddlePreview ||
			!currentPlayerSide
		) {
			return normalizedRemoteGameState;
		}

		const paddleKey = currentPlayerSide === "LEFT" ? "p1" : "p2";
		const authoritativeY = normalizedRemoteGameState.paddles[paddleKey].y;
		if (!isRemotePreviewAhead(authoritativeY, optimisticPaddlePreview)) {
			return normalizedRemoteGameState;
		}

		return {
			...normalizedRemoteGameState,
			paddles: {
				...normalizedRemoteGameState.paddles,
				[paddleKey]: {
					...normalizedRemoteGameState.paddles[paddleKey],
					y: optimisticPaddlePreview.previewY,
				},
			},
		};
	}, [normalizedRemoteGameState, optimisticPaddlePreview, currentPlayerSide]);

	// Remote game rendering
	if (isRemoteGame) {
		// Show loading state while waiting for game state to be restored via WebSocket
		// Also verify that valid gameState matches the current matchId from URL to prevent showing stale state
		const isGameStateValid = gameState && gameState.matchId === matchId;

		if ((!gameState || !isGameStateValid) && !gameOverResult) {
			return (
				<div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20">
					<div className="flex flex-col items-center gap-4">
						<Loader2 className="h-12 w-12 animate-spin text-primary" />
						<h2 className="text-2xl font-bold">Connecting to game...</h2>
						<p className="text-muted-foreground">
							{gameState && gameState.matchId !== matchId
								? "Syncing game state..."
								: "Restoring your game session"}
						</p>
						<Button
							variant="outline"
							onClick={async () => {
								try {
									await axios.post("/api/game/leave", { matchId });
								} catch (e) {
									if (handleSessionExpiredRedirect(e, router)) {
										return;
									}
									console.error("Failed to leave game:", e);
								}
								router.push("/game/new");
							}}
							className="mt-4"
						>
							<ArrowLeft className="mr-2 h-4 w-4" /> Back to Game Menu
						</Button>
					</div>
				</div>
			);
		}

		return (
			<>
				<RemoteGameRuntimeView
					matchId={matchId}
					gameState={gameState}
					normalizedGameState={displayedRemoteGameState}
					gameOverResult={gameOverResult}
					isSpectator={isSpectator}
					returnToLobby={returnToLobby}
					sendSocketMessage={sendSocketMessage}
					user={user}
					setGameOverResult={setGameOverResult}
					opponentConnected={opponentConnected}
					router={router}
					gameStart={gameStart}
					disconnectInfo={disconnectInfo}
					pauseInfo={pauseInfo}
				/>
				<NavigationGuard />
			</>
		);
	}

	return (
		<>
			<LocalGameRuntimeView
				isSpectator={isSpectator}
				returnToLobby={returnToLobby}
				matchId={matchId}
				isAI={Boolean(matchData?.isAI)}
				aiDifficulty={matchData?.aiDifficulty || "medium"}
				handleGameOver={handleGameOver}
				handleExit={handleExit}
				isTournamentMatch={!!matchData?.isTournamentMatch}
				pauseOnGuard={showNavGuard && !isSpectator && !gameOverResult}
			/>
			<NavigationGuard />
		</>
	);
}
