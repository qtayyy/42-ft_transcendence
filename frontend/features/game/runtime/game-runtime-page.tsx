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
import { NavigationGuard } from "@/components/game/navigation-guard";
import { handleSessionExpiredRedirect } from "@/lib/session-expired";

// Default canvas dimensions (will use gameState.constant if available)
// These are the logical/game dimensions - display size is controlled separately
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 350;
const LOCAL_TOURNAMENT_PENDING_RESULT_PREFIX = "pending-local-tournament-result:";

const DEFAULT_PADDLE_WIDTH = 12;
const DEFAULT_PADDLE_HEIGHT = 80;
const DEFAULT_BALL_SIZE = 12;
const DEFAULT_MATCH_DURATION = 120000;
const DEFAULT_FPS = 60;
const DEFAULT_TICK_MS = 1000 / DEFAULT_FPS;
const DEFAULT_PADDLE_SPEED = 10;

export default function GameRuntimePage() {
	const params = useParams();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const { sendSocketMessage, isReady } = useSocket();
	const { gameState, setGameState, showNavGuard, setShowNavGuard, pendingPath, setPendingPath } = useGame();
	const matchId = params.matchId as string;
	const [matchData, setMatchData] = useState<any>(null);
	const [gameOverResult, setGameOverResult] = useState<any>(null);
	const [disconnectInfo, setDisconnectInfo] = useState<{
		disconnectedPlayer: string;
		gracePeriodEndsAt: number;
		countdown: number;
	} | null>(null);
	const [pauseInfo, setPauseInfo] = useState<{
		pausedBy: string;
		pausedByName: string;
		myReadyToResume: boolean;
		opponentReadyToResume: boolean;
	} | null>(null);
	const spectatorParam = searchParams.get('spectator') === 'true';
	// Detect spectator mode from query param or gameState
	const isSpectator = spectatorParam || (gameState as any)?.spectatorMode === true;
	const inferredTournamentId = useMemo(() => {
		if (!matchId?.startsWith("RT-")) return null;
		const parts = matchId.split("-m");
		return parts.length > 1 ? parts[0] : null;
	}, [matchId]);

	// Component lifecycle logging for debugging resource leaks
	useEffect(() => {
		console.log(`[GamePage] 🎮 Component MOUNTED for match: ${matchId}`, { isSpectator });
		return () => {
			console.log(`[GamePage] 🧹 Component UNMOUNTING for match: ${matchId}`);
		};
	}, [matchId, isSpectator]);

	// Check if this is a tournament match
	// Use both gameState and matchId fallback so guards still work during reconnect/loading
	const isTournamentMatch =
		gameState?.tournamentId !== undefined && gameState?.tournamentId !== null
			? true
			: !!inferredTournamentId;

	// Determine if this is a remote game (RS-* prefix or RT-* prefix for tournaments)
	const isRemoteGame = matchId.startsWith("RS-") || matchId.startsWith("RT-");

	// For remote games, check if both players are ready
	const gameStart = gameState && !gameState.leftPlayer?.gamePaused && !gameState.rightPlayer?.gamePaused;

	// Track if we've already sent reconnection notification for this session
	const hasNotifiedReconnection = useRef(false);
	// Track if component is mounted to prevent false navigation events during re-renders
	const isMountedRef = useRef(true);
	// Prevent duplicate pause dispatches while the navigation guard stays open
	const navGuardPauseSentRef = useRef(false);

	// Notify server when player returns to game page (reconnection)
	// Only send this if the game state shows we were disconnected, not on initial load
	useEffect(() => {
		if (!isRemoteGame || !isReady || !matchId || isSpectator) return;
		// Only send reconnection if game is paused due to disconnect
		// This prevents false positives on initial game load
		if (!gameState) return;

		const isPausedDueToDisconnect = (gameState as any)?.paused &&
			((gameState as any)?.disconnectedPlayer || (gameState as any)?.disconnectCountdown);

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
			console.log("Spectator subscribing to match:", matchId, { isSpectator, spectatorParam });
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
			console.log("Requesting initial game state for match:", matchId);
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
	const handleGameOverEvent = useCallback((event: CustomEvent) => {
		// Validate that this game over event belongs to the current match
		if (event.detail?.matchId && event.detail.matchId !== matchId) {
			console.log(`Ignoring Game Over event for different match: ${event.detail.matchId} (current: ${matchId})`);
			return;
		}
		// Ensure game-over overlay takes precedence over any pause/disconnect overlays.
		setPauseInfo(null);
		setDisconnectInfo(null);
		setGameOverResult(event.detail);
	}, [matchId]);

	// Listen for game over event
	useEffect(() => {
		console.log(`[GamePage] Registering gameOver listener for match: ${matchId}`);
		window.addEventListener("gameOver", handleGameOverEvent as EventListener);
		return () => {
			console.log(`[GamePage] Removing gameOver listener for match: ${matchId}`);
			window.removeEventListener("gameOver", handleGameOverEvent as EventListener);
		};
	}, [matchId, handleGameOverEvent]);

	// Cleanup spectator state on unmount to prevent blocking LEAVE_ROOM later
	useEffect(() => {
		return () => {
			// In dev Strict Mode, mount->unmount->mount can happen immediately.
			// Only clear if this page is actually being left.
			if (isSpectator && setGameState && window.location.pathname !== `/game/${matchId}`) {
				console.log("Cleaning up spectator state on unmount");
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
		setDisconnectInfo({ disconnectedPlayer, gracePeriodEndsAt, countdown });
		toast.warning("Opponent disconnected! Waiting for reconnection...");
		setOpponentConnected(false);
	}, []);

	const handleReconnect = useCallback((_event: CustomEvent) => {
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
		console.log(`[GamePage] Registering game event listeners for match: ${matchId}`);

		window.addEventListener("opponentDisconnected", handleDisconnect as EventListener);
		window.addEventListener("opponentReconnected", handleReconnect as EventListener);
		window.addEventListener("opponentLeft", handleOpponentLeft as EventListener);
		window.addEventListener("gamePaused", handleGamePaused as EventListener);
		window.addEventListener("gameResumed", handleGameResumed as EventListener);
		window.addEventListener("opponentReadyToResume", handleOpponentReadyToResume as EventListener);
		window.addEventListener("waitingForResume", handleWaitingForResume as EventListener);

		return () => {
			console.log(`[GamePage] Removing game event listeners for match: ${matchId}`);
			window.removeEventListener("opponentDisconnected", handleDisconnect as EventListener);
			window.removeEventListener("opponentReconnected", handleReconnect as EventListener);
			window.removeEventListener("opponentLeft", handleOpponentLeft as EventListener);
			window.removeEventListener("gamePaused", handleGamePaused as EventListener);
			window.removeEventListener("gameResumed", handleGameResumed as EventListener);
			window.removeEventListener("opponentReadyToResume", handleOpponentReadyToResume as EventListener);
			window.removeEventListener("waitingForResume", handleWaitingForResume as EventListener);
		};
	}, [matchId, handleDisconnect, handleReconnect, handleOpponentLeft, handleGamePaused, handleGameResumed, handleOpponentReadyToResume, handleWaitingForResume]);

	// Sync disconnect info from game state (for reconnection scenarios or late state updates)
	useEffect(() => {
		if (!gameState) return;

		// Check if gameState has disconnect countdown info
		const disconnectCountdown = (gameState as any)?.disconnectCountdown;
		if (disconnectCountdown && disconnectCountdown.gracePeriodEndsAt) {
			const countdown = Math.ceil((disconnectCountdown.gracePeriodEndsAt - Date.now()) / 1000);
			if (countdown > 0 && !disconnectInfo) {
				setDisconnectInfo({
					disconnectedPlayer: disconnectCountdown.disconnectedPlayer || (gameState as any)?.disconnectedPlayer,
					gracePeriodEndsAt: disconnectCountdown.gracePeriodEndsAt,
					countdown
				});
				setOpponentConnected(false);
			}
		}

		// Also check if game is paused due to disconnect (from disconnectedPlayer field)
		if ((gameState as any)?.paused && (gameState as any)?.disconnectedPlayer && !disconnectInfo) {
			// Calculate remaining time based on pausedAt (30 second grace period)
			const pausedAt = (gameState as any)?.pausedAt;
			if (pausedAt) {
				const gracePeriodEndsAt = pausedAt + 30000;
				const countdown = Math.ceil((gracePeriodEndsAt - Date.now()) / 1000);
				if (countdown > 0) {
					setDisconnectInfo({
						disconnectedPlayer: (gameState as any).disconnectedPlayer,
						gracePeriodEndsAt,
						countdown
					});
					setOpponentConnected(false);
				}
			}
		}

		// Clear disconnect info if game is no longer paused or no disconnected player
		if (gameState && !(gameState as any)?.paused && disconnectInfo) {
			setDisconnectInfo(null);
			setOpponentConnected(true);
		}
	}, [gameState, disconnectInfo?.disconnectedPlayer, disconnectInfo?.gracePeriodEndsAt]);

	// Sync pauseInfo from gameState to ensure UI is always accurate 
	// (especially for spectators or after a page refresh/reconnect)
	useEffect(() => {
		if (gameState?.paused) {
			const playerSide = gameState.me || (String(user?.id) === String(gameState.leftPlayer?.id) ? "LEFT" : "RIGHT");
			const myReady = gameState.resumeReady?.[playerSide as "LEFT" | "RIGHT"] || false;
			const opponentReady = gameState.resumeReady?.[playerSide === "LEFT" ? "RIGHT" : "LEFT"] || false;
			const pausedBy = gameState.pausedBy || "";
			const pausedByName = gameState.pausedByName || (gameState.pausedBy === "LEFT" ? gameState.leftPlayer?.username : gameState.rightPlayer?.username) || "Unknown";

			// Only update if something changed in pause state
			setPauseInfo(prev => {
				if (prev &&
					prev.pausedBy === pausedBy &&
					prev.pausedByName === pausedByName &&
					prev.myReadyToResume === myReady &&
					prev.opponentReadyToResume === opponentReady
				) {
					return prev;
				}
				return {
					pausedBy,
					pausedByName,
					myReadyToResume: myReady,
					opponentReadyToResume: opponentReady
				};
			});
		} else if (gameState && !gameState.paused && !pendingPath && !showNavGuard) {
			if (pauseInfo !== null) {
				setPauseInfo(null);
			}
		}
	}, [gameState?.paused, gameState?.resumeReady, gameState?.pausedBy, user?.id, pendingPath, showNavGuard]);

	// Countdown timer for disconnect grace period
	useEffect(() => {
		if (!disconnectInfo) return;

		let isActive = true; // Prevent interval accumulation
		console.log(`[GamePage] Starting disconnect countdown for match: ${matchId}`);

		const interval = setInterval(() => {
			if (!isActive) {
				clearInterval(interval);
				return;
			}

			const remaining = Math.ceil((disconnectInfo.gracePeriodEndsAt - Date.now()) / 1000);
			if (remaining <= 0) {
				clearInterval(interval);
				setDisconnectInfo(null);
				console.log(`[GamePage] Disconnect countdown finished for match: ${matchId}`);
			} else {
				setDisconnectInfo(prev => prev ? { ...prev, countdown: remaining } : null);
			}
		}, 1000);

		return () => {
			console.log(`[GamePage] Cleaning up disconnect countdown for match: ${matchId}`);
			isActive = false;
			clearInterval(interval);
		};
	}, [disconnectInfo?.gracePeriodEndsAt, matchId]);

	// Load match data for local games
	useEffect(() => {
		if (!isRemoteGame) {
			const storedMatchData = localStorage.getItem("current-match");
			if (storedMatchData) {
				setMatchData(JSON.parse(storedMatchData));
			}
		}
	}, [isRemoteGame]);

	// Handle keyboard input for remote games
	useEffect(() => {
		if (!isRemoteGame || !isReady || !gameState || isSpectator) return;

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
			if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keyEvent = "UP";
			else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keyEvent = "DOWN";
			else if (e.key === " ") keyEvent = "PAUSE"; // Space = pause/resume game

			sendSocketMessage({
				event: "GAME_EVENTS",
				payload: {
					matchId: gameState.matchId,
					userId: user?.id,
					keyEvent,
				},
			});
		};

		const onKeyUp = (e: KeyboardEvent) => {
			const KEYS = ["w", "W", "s", "S", "ArrowUp", "ArrowDown", "Enter"];
			if (!KEYS.includes(e.key)) return;

			sendSocketMessage({
				event: "GAME_EVENTS",
				payload: {
					matchId: gameState.matchId,
					userId: user?.id,
					keyEvent: "",
				},
			});
		};

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, [isRemoteGame, isReady, sendSocketMessage, gameState, user, isSpectator]);

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
						console.log(`[GamePage] Sending PLAYER_NAVIGATING_AWAY for match: ${currentGameState.matchId}`);
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
			const link = target.closest('a[href]');

				if (link) {
					const href = link.getAttribute('href');
					if (!href || href === '#' || href.startsWith('http')) {
						// Allow external links, empty hrefs, and hash links
						return;
					}
					if (href === pathname) return;

					// For remote tournaments, allow moving between tournament lobby and match pages.
					if (isRemoteGame && isTournamentMatch) {
						const tournamentId = gameState?.tournamentId || inferredTournamentId;
						const tournamentLobbyPath = tournamentId ? `/game/remote/tournament/${tournamentId}` : null;
						if (
							(tournamentLobbyPath && href.includes(tournamentLobbyPath)) ||
							href.includes('/game/')
						) {
							return;
						}
					}

					// Block navigation to other pages and show confirmation dialog
				e.preventDefault();
				e.stopPropagation();

				// Show confirmation dialog
				setPendingPath(href);
				setShowNavGuard(true);
			}
		};

		// Add click listener to catch navigation attempts
		document.addEventListener('click', handleNavigationClick, true);

			return () => {
				window.removeEventListener("beforeunload", handleRouteChange);
				document.removeEventListener('click', handleNavigationClick, true);
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

	const handleGameOver = async (winner: number | null, score: { p1: number; p2: number }, result: string) => {
		console.log(`Game Over! Result: ${result}`, { winner, score });
		const durationSeconds = Math.max(0, Math.round(((gameState as any)?.timer?.timeElapsed ?? 0) / 1000));

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
							await axios.post(`/api/tournament/${matchData.tournamentId}/match-result`, resultPayload);
							localStorage.removeItem(pendingKey);
						} catch (submitError: any) {
							if (handleSessionExpiredRedirect(submitError, router)) {
								return;
							}
							console.error("Failed to submit tournament result immediately. Pending result kept for replay.", submitError);
						}
					}

				if (user) {
					const externalMatchId = matchData.matchId;
					const player1Id = matchData.player1?.isTemp ? null : matchData.player1?.id;
					const player2Id = matchData.player2?.isTemp ? null : matchData.player2?.id;

					if (player1Id || player2Id) {
						await axios.post("/api/game/save-match", {
							matchId: externalMatchId,
							player1Id: player1Id,
							player2Id: player2Id,
							player1Name: matchData.player1?.name,
							player2Name: matchData.player2?.name,
							score1: score.p1,
							score2: score.p2,
							winner: winner,
							mode: "LOCAL",
							durationSeconds,
						});
					}
				}
				} catch (error: any) {
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

		const constants = {
			canvasWidth: gameState.constant?.canvasWidth || DEFAULT_CANVAS_WIDTH,
			canvasHeight: gameState.constant?.canvasHeight || DEFAULT_CANVAS_HEIGHT,
			paddleWidth: gameState.constant?.paddleWidth || DEFAULT_PADDLE_WIDTH,
			paddleHeight: gameState.constant?.paddleHeight || DEFAULT_PADDLE_HEIGHT,
			ballSize: gameState.constant?.ballSize || DEFAULT_BALL_SIZE,
			matchDuration: gameState.constant?.matchDuration || DEFAULT_MATCH_DURATION,
		};

		const left = gameState.leftPlayer;
		const right = gameState.rightPlayer;
		const ball = gameState.ball;
		if (!left || !right || !ball) return null;

		const winnerToken = String(gameOverResult?.winner || "").toUpperCase();
		const winner =
			winnerToken === "LEFT" ? 1 : winnerToken === "RIGHT" ? 2 : null;
		const result = winner ? "win" : gameOverResult ? "draw" : null;

		return {
			status: gameOverResult
				? "finished"
				: gameState.paused
					? "paused"
					: gameState.gameStarted
						? "playing"
						: "waiting",
			constant: {
				canvasWidth: constants.canvasWidth,
				canvasHeight: constants.canvasHeight,
				paddleWidth: constants.paddleWidth,
				paddleHeight: constants.paddleHeight,
				paddleSpeed: DEFAULT_PADDLE_SPEED,
				ballSize: constants.ballSize,
				FPS: DEFAULT_FPS,
				TICK_MS: DEFAULT_TICK_MS,
				matchDuration: constants.matchDuration,
			},
			timer: gameState.timer || {
				timeElapsed: 0,
				timeRemaining: constants.matchDuration,
			},
			ball: {
				x: ball.posX || 0,
				y: ball.posY || 0,
				dx: ball.dx || 0,
				dy: ball.dy || 0,
			},
			paddles: {
				p1: {
					x: left.paddleX || 0,
					y: left.paddleY || 0,
					moving: left.moving || null,
				},
				p2: {
					x: right.paddleX ?? (constants.canvasWidth - constants.paddleWidth),
					y: right.paddleY || 0,
					moving: right.moving || null,
				},
			},
			score: {
				p1: left.score || 0,
				p2: right.score || 0,
			},
			winner,
			result,
			powerUps: gameState.powerUps || [],
			activeEffect: gameState.activeEffect || null,
		};
	}, [isRemoteGame, gameState, gameOverResult]);

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
						normalizedGameState={normalizedRemoteGameState}
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
				handleGameOver={handleGameOver}
				handleExit={handleExit}
				isTournamentMatch={!!matchData?.isTournamentMatch}
				pauseOnGuard={showNavGuard && !isSpectator && !gameOverResult}
			/>
			<NavigationGuard />
		</>
	);
}
