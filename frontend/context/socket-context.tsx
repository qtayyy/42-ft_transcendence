"use client";

import {
	createContext,
	startTransition,
	useRef,
	useEffect,
	useContext,
	useState,
	useCallback,
	useMemo,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
	GameStateValue,
	RemoteGameplayTickPayload,
	SocketContextValue,
} from "@/types/types";
import type { GameState } from "@/types/game";
import { useGameDispatch } from "@/hooks/use-game";
import { usePathname, useRouter } from "next/navigation";
import { getWebSocketBaseUrl } from "@/lib/runtime-url";
import { normalizeRemoteGameState } from "@/features/game/runtime/runtime-helpers";

const SocketContext = createContext<SocketContextValue | null>(null);

function hasSamePowerUps(prevPowerUps: any[] = [], nextPowerUps: any[] = []) {
	if (prevPowerUps.length !== nextPowerUps.length) return false;

	return prevPowerUps.every((powerUp, index) => {
		const nextPowerUp = nextPowerUps[index];
		return (
			powerUp?.id === nextPowerUp?.id &&
			powerUp?.type === nextPowerUp?.type &&
			powerUp?.x === nextPowerUp?.x &&
			powerUp?.y === nextPowerUp?.y
		);
	});
}

function hasSameActiveEffect(prevEffect: any, nextEffect: any) {
	return (
		prevEffect?.type === nextEffect?.type &&
		prevEffect?.expiresAt === nextEffect?.expiresAt
	);
}

function getRemoteRenderStatus(payload: RemoteGameplayTickPayload) {
	return payload.paused ? "paused" : payload.gameStarted ? "playing" : "waiting";
}

function mergeRemoteGameplayTickIntoRenderState(
	prev: GameState | null,
	payload: RemoteGameplayTickPayload
) {
	if (!prev) return prev;

	const timer = payload.timer
		? {
			...(prev.timer || {
				timeElapsed: 0,
				timeRemaining: 0,
			}),
			...payload.timer,
		}
		: prev.timer;
	const nextStatus = getRemoteRenderStatus(payload);
	const ballUnchanged =
		prev.ball?.x === payload.ball?.posX &&
		prev.ball?.y === payload.ball?.posY &&
		prev.ball?.dx === payload.ball?.dx &&
		prev.ball?.dy === payload.ball?.dy;
	const paddlesUnchanged =
		prev.paddles?.p1?.y === payload.leftPlayer?.paddleY &&
		prev.paddles?.p2?.y === payload.rightPlayer?.paddleY;
	const timerUnchanged =
		(prev.timer?.timeElapsed ?? null) === (timer?.timeElapsed ?? null) &&
		(prev.timer?.timeRemaining ?? null) === (timer?.timeRemaining ?? null);

	if (ballUnchanged && paddlesUnchanged && timerUnchanged && prev.status === nextStatus) {
		return prev;
	}

	return {
		...prev,
		status: nextStatus,
		ball: {
			...prev.ball,
			x: payload.ball.posX,
			y: payload.ball.posY,
			dx: payload.ball.dx,
			dy: payload.ball.dy,
		},
		timer,
		paddles: {
			...prev.paddles,
			p1: {
				...prev.paddles.p1,
				y: payload.leftPlayer.paddleY,
			},
			p2: {
				...prev.paddles.p2,
				y: payload.rightPlayer.paddleY,
			},
		},
	};
}

export const SocketProvider = ({ children }) => {
	const wsRef = useRef<WebSocket | null>(null);
	const connectRef = useRef<(() => void) | null>(null);
	const { user } = useAuth();
	const gameDispatch = useGameDispatch();
	const {
		setOnlineFriends,
		setInvitesReceived,
		setGameRoom,
		setGameRoomLoaded,
		setGameState,
		setRemoteRenderGameState,
		getLatestGameRoom,
		getLatestGameState,
	} = gameDispatch;

	const pathname = usePathname();
	const router = useRouter();
	const [isReady, setIsReady] = useState(false);
	// Set this to NULL when a match ends
	const hasActiveGame = useRef(false);
	const prevPathname = useRef(pathname);
	const suppressMatchmakingRedirectsUntil = useRef(0);

	// STABLE DEPS REF: This pattern prevents the WebSocket from re-connecting
	// whenever the router or context setters change identity/reference.
	const stableDeps = useRef({
		setOnlineFriends,
		setInvitesReceived,
		setGameRoom,
		setGameRoomLoaded,
		setGameState,
		setRemoteRenderGameState,
		getLatestGameRoom,
		getLatestGameState,
		router,
		pathname,
	});

	useEffect(() => {
		stableDeps.current = {
			setOnlineFriends,
			setInvitesReceived,
			setGameRoom,
			setGameRoomLoaded,
			setGameState,
			setRemoteRenderGameState,
			getLatestGameRoom,
			getLatestGameState,
			router,
			pathname,
		};
	});

	// Navigation on match start is now handled in the message handlers
	// to avoid reactive loops depending on gameState.


	useEffect(() => {
		let isMounted = true;
		if (!user) {
			connectRef.current = null;
			return;
		}

		const connect = () => {
			const currentSocket = wsRef.current;
			if (
				currentSocket?.readyState === WebSocket.OPEN ||
				currentSocket?.readyState === WebSocket.CONNECTING
			) {
				return;
			}

			const websocket = new WebSocket(getWebSocketBaseUrl());
			wsRef.current = websocket;

			// Heartbeat
			const interval = setInterval(
				() => {
					if (websocket.readyState === WebSocket.OPEN) {
						websocket.send(JSON.stringify({ event: "PING" }));
					}
				},
				30000
			);

			websocket.onopen = () => {
				console.log("WebSocket connected");
				setIsReady(true);
			};

			websocket.onmessage = (event) => {
					try {
						const msg = JSON.parse(event.data);
						if (msg.error) {
							toast.error(msg.error);
							return;
						}
						const payload = msg.payload;

						switch (msg.event) {
							case "PONG":
								break;

							case "FRIEND_REQUEST":
								toast.info(
									`${payload.requesterUsername} sent you a friend request!`
								);
								break;

							case "FRIEND_STATUS":
								const { id, username, status } = msg.payload;

								stableDeps.current.setOnlineFriends((prev) => {
									const exists = prev.find((f) => f.id === id);

									if (status === "online" && !exists) {
										return [...prev, { id, username }];
									}

									if (status === "offline" && exists) {
										return prev.filter((f) => f.id !== id);
									}

									return prev;
								});

								toast.info(`${username} is now ${status}!`);
								break;

								case "GAME_ROOM":
									if (Date.now() < suppressMatchmakingRedirectsUntil.current) {
										console.log("[SocketContext] Ignoring late GAME_ROOM after room exit");
										break;
									}
									stableDeps.current.setGameRoom({
										roomId: payload.roomId,
									hostId: payload.hostId,
									invitedPlayers: payload.invitedPlayers,
									joinedPlayers: payload.joinedPlayers,
									maxPlayers: payload.maxPlayers,
									isTournament: payload.isTournament || false,
									tournamentStarted: payload.tournamentStarted || false,
								});
								stableDeps.current.setGameRoomLoaded(true);
								break;

							case "ROOM_NOT_FOUND":
								stableDeps.current.setGameRoom(null);
								stableDeps.current.setGameRoomLoaded(true);
								break;

							case "GAME_INVITE":
								console.log("Received GAME_INVITE via WebSocket:", payload);
								if (payload?.roomId && payload?.hostId) {
									// Room-based invite flow used by private lobby invites.
									stableDeps.current.setInvitesReceived((prev) => [
										...prev,
										{
											roomId: payload.roomId,
											hostId: payload.hostId,
											hostUsername: payload.hostUsername,
										},
									]);
									toast.info(`${payload.hostUsername || "A friend"} invited you to a room`);
								} else {
									// Chat-triggered invite notification (no room yet).
									window.dispatchEvent(
										new CustomEvent("gameInvite", { detail: payload })
									);
									toast.info(`${payload.inviterName || "A friend"} invited you to play a game!`);
								}
								break;

							case "JOIN_ROOM":
								// Room joined successfully - pages handle their own state
								// No redirect needed as new pages stay in place
								toast.success("Joined room successfully!");
								window.dispatchEvent(
									new CustomEvent("JOIN_ROOM", { detail: payload })
								);
								window.dispatchEvent(
									new CustomEvent("gameNotification", {
										detail: {
											event: "JOIN_ROOM",
											message: `Joined room ${payload?.roomId || ""}`.trim(),
											roomId: payload?.roomId,
										},
									})
								);
								break;

							case "JOIN_ROOM_ERROR":
								toast.error(payload.message || "Failed to join room");
								window.dispatchEvent(
									new CustomEvent("JOIN_ROOM_ERROR", { detail: payload })
								);
								window.dispatchEvent(
									new CustomEvent("gameNotification", {
										detail: {
											event: "JOIN_ROOM_ERROR",
											message: payload.message || "Failed to join room",
											roomId: payload?.roomId,
										},
									})
								);
								break;


								case "MATCH_FOUND":
									if (Date.now() < suppressMatchmakingRedirectsUntil.current) {
										console.log("[SocketContext] Ignoring late MATCH_FOUND after room exit");
										break;
									}
									// Navigate to lobby based on actual host identity (more reliable than pathname checks).
									{
									const hostId = Number(payload?.hostId);
									const myId = Number(user?.id);
									const hostKnown = !Number.isNaN(hostId);
									const iAmHost = hostKnown && !Number.isNaN(myId) && hostId === myId;

									if (hostKnown) {
										if (iAmHost) {
											if (!window.location.pathname.includes("/game/remote/single/create")) {
												stableDeps.current.router.push("/game/remote/single/create?matchmaking=true");
											}
										} else {
											stableDeps.current.router.push(`/game/remote/single/join?roomId=${payload.roomId}&matchmaking=true`);
										}
									} else {
										// Backward-compatible fallback for older payloads.
										const isHostPage = window.location.pathname.includes("/game/remote/single/create");
										if (!isHostPage) {
											stableDeps.current.router.push(`/game/remote/single/join?roomId=${payload.roomId}&matchmaking=true`);
										}
									}

									window.dispatchEvent(
										new CustomEvent("gameNotification", {
											detail: {
												event: "MATCH_FOUND",
												message: `Match found. Room ${payload?.roomId || "ready"}`,
												roomId: payload?.roomId,
												hostId: payload?.hostId,
											},
										})
									);
								}
								break;

							case "TOURNAMENT_FOUND":
								// Dispatch event so matchmaking page can handle it (show lobby)
								window.dispatchEvent(
									new CustomEvent("TOURNAMENT_FOUND", { detail: payload })
								);
								break;

							case "MATCHMAKING_JOINED":
								// Optionally show queue position
								console.log("Joined matchmaking queue, position:", payload.position);
								window.dispatchEvent(
									new CustomEvent("MATCHMAKING_JOINED", { detail: payload })
								);
								break;

								case "MATCHMAKING_HOST":
									if (Date.now() < suppressMatchmakingRedirectsUntil.current) {
										console.log("[SocketContext] Ignoring late MATCHMAKING_HOST after room exit");
										break;
									}
									// User has been designated as host for a new matchmade room
									// Redirect to the create page which acts as the lobby
									stableDeps.current.router.push("/game/remote/single/create?matchmaking=true");
									break;

								case "MATCHMAKING_LEFT":
									stableDeps.current.setGameRoom(null);
									stableDeps.current.setGameRoomLoaded(true);
									stableDeps.current.setGameState(null);
									stableDeps.current.setRemoteRenderGameState(null);
									hasActiveGame.current = false;
									break;

							case "TOURNAMENT_UPDATE":
								console.log("Socket Context: Dispatching TOURNAMENT_UPDATE", payload);
								window.dispatchEvent(
									new CustomEvent("tournamentUpdate", { detail: payload })
								);
								break;

							case "LEAVE_ROOM":
								stableDeps.current.setGameRoom(null);
								// Safely clear undefined property access if any component relies on it
								stableDeps.current.setGameState(null);
								stableDeps.current.setRemoteRenderGameState(null);
								hasActiveGame.current = false;
								toast.info("You're removed from the game room");
								window.dispatchEvent(
									new CustomEvent("gameNotification", {
										detail: {
											event: "LEAVE_ROOM",
											message: "You were removed from the game room",
											roomId: payload?.roomId,
										},
									})
								);
								break;

							case "GAME_MATCH_START":
								stableDeps.current.setGameState(payload);
								stableDeps.current.setRemoteRenderGameState(
									normalizeRemoteGameState(payload, null)
								);
								window.dispatchEvent(
									new CustomEvent("gameNotification", {
										detail: {
											event: "GAME_MATCH_START",
											message: "Game started. Good luck!",
											matchId: payload?.matchId,
										},
									})
								);
								// Navigate to game page for the match
								if (payload.matchId) {
									stableDeps.current.router.push(`/game/${payload.matchId}`);
								}
								break;

							case "TOURNAMENT_START":
								window.dispatchEvent(
									new CustomEvent("TOURNAMENT_START", { detail: payload })
								);
								stableDeps.current.setGameRoom({
									roomId: payload.roomId,
									joinedPlayers: payload.players,
									invitedPlayers: [],
									hostId: payload.players[0]?.id,
									maxPlayers: payload.players.length,
									isTournament: true,
									tournamentStarted: true
								});
								// Navigate all players to the remote tournament game page
								stableDeps.current.router.push(`/game/remote/tournament/${payload.tournamentId}`);
								break;

							case "GAME_STATE":
								// Handle navigation if we just joined/reconnected and aren't on the game page yet
								if (!hasActiveGame.current) {
									hasActiveGame.current = true;
									const matchId = String(payload.matchId);
									const currentPath = window.location.pathname;
									if (!currentPath.includes(`/game/${matchId}`)) {
										console.log(`[SocketContext] Redirecting to active match ${matchId}`);
										const targetPath = payload.spectatorMode
											? `/game/${matchId}?spectator=true`
											: `/game/${matchId}`;
										stableDeps.current.router.push(targetPath);
									}
								}

								// Only update if something actually changed to avoid excessive re-render loops
								startTransition(() => {
									stableDeps.current.setGameState((prev: any) => {
										if (!prev) return { ...payload };

										// Remote matches are server-authoritative, so dedupe must still
										// notice effect/power-up snapshots even when paddles barely move.
										const ballMovedSignificantly =
											Math.abs((prev.ball?.posX || 0) - (payload.ball?.posX || 0)) > 0.1 ||
											Math.abs((prev.ball?.posY || 0) - (payload.ball?.posY || 0)) > 0.1;
										const disconnectStateChanged =
											prev.disconnectedPlayer !== payload.disconnectedPlayer ||
											prev.pausedAt !== payload.pausedAt ||
											prev.disconnectCountdown?.disconnectedPlayer !== payload.disconnectCountdown?.disconnectedPlayer ||
											prev.disconnectCountdown?.gracePeriodEndsAt !== payload.disconnectCountdown?.gracePeriodEndsAt;
										const powerUpsChanged = !hasSamePowerUps(prev.powerUps, payload.powerUps);
										const activeEffectChanged = !hasSameActiveEffect(prev.activeEffect, payload.activeEffect);
										const paddleSizingChanged =
											prev.leftPlayer?.paddleHeight !== payload.leftPlayer?.paddleHeight ||
											prev.rightPlayer?.paddleHeight !== payload.rightPlayer?.paddleHeight;
										const ballSizingChanged =
											prev.constant?.ballSize !== payload.constant?.ballSize;

										if (prev.matchId === payload.matchId &&
											!ballMovedSignificantly &&
											!disconnectStateChanged &&
											!powerUpsChanged &&
											!activeEffectChanged &&
											!paddleSizingChanged &&
											!ballSizingChanged &&
											prev.leftPlayer?.score === payload.leftPlayer?.score &&
											prev.rightPlayer?.score === payload.rightPlayer?.score &&
											prev.leftPlayer?.gamePaused === payload.leftPlayer?.gamePaused &&
											prev.rightPlayer?.gamePaused === payload.rightPlayer?.gamePaused &&
											prev.gameStarted === payload.gameStarted &&
											prev.paused === payload.paused &&
											prev.resumeReady?.LEFT === payload.resumeReady?.LEFT &&
											prev.resumeReady?.RIGHT === payload.resumeReady?.RIGHT &&
											prev.leftPlayer?.paddleY === payload.leftPlayer?.paddleY &&
											prev.rightPlayer?.paddleY === payload.rightPlayer?.paddleY
										) {
											return prev;
										}
										return { ...payload };
									});
								});
								stableDeps.current.setRemoteRenderGameState(
									normalizeRemoteGameState(payload, null)
								);
								break;

							case "GAME_TICK":
								if (!hasActiveGame.current) {
									hasActiveGame.current = true;
									const matchId = String(payload.matchId);
									const currentPath = window.location.pathname;
									if (!currentPath.includes(`/game/${matchId}`)) {
										console.log(`[SocketContext] Redirecting to active match ${matchId}`);
										const latestGameState = stableDeps.current.getLatestGameState();
										const shouldOpenAsSpectator =
											latestGameState?.spectatorMode === true ||
											window.location.search.includes("spectator=true");
										const targetPath = shouldOpenAsSpectator
											? `/game/${matchId}?spectator=true`
											: `/game/${matchId}`;
										stableDeps.current.router.push(targetPath);
									}
								}

								stableDeps.current.setRemoteRenderGameState((prev: GameState | null) =>
									mergeRemoteGameplayTickIntoRenderState(
										prev,
										payload as RemoteGameplayTickPayload
									)
								);
								break;

							case "GAME_OVER":
								// Dispatch custom event for game page to show results
								window.dispatchEvent(
									new CustomEvent("gameOver", { detail: payload })
								);
								// Reset state after a delay to allow results screen
								setTimeout(() => {
									stableDeps.current.setGameState(null);
									stableDeps.current.setRemoteRenderGameState(null);
									// IMPORTANT: Don't clear gameRoom if we're in a tournament!
									// The user is still in the tournament lobby, and we need this state
									// so that navigating away to the dashboard correctly fires LEAVE_ROOM.
									if (!payload.tournamentId) {
										stableDeps.current.setGameRoom(null);
									}
									hasActiveGame.current = false;
								}, 5000);
								break;

							case "REMATCH_FAILED":
								toast.error(payload.reason || "Rematch failed");
								stableDeps.current.setGameState(null);
								stableDeps.current.setRemoteRenderGameState(null);
								stableDeps.current.setGameRoom(null);
								hasActiveGame.current = false;
								stableDeps.current.router.push("/game/new");
								break;

							case "OPPONENT_LEFT":
								// Dispatch event for game page to handle (disable rematch)
								// We do NOT redirect here, allowing the user to stay on the results screen
								window.dispatchEvent(new CustomEvent("opponentLeft"));
								toast.info("Your opponent has left the game");
								break;

							case "OPPONENT_DISCONNECTED":
								// Dispatch event for game page to show disconnect UI with countdown
								window.dispatchEvent(
									new CustomEvent("opponentDisconnected", { detail: payload })
								);
								break;

							case "OPPONENT_RECONNECTED":
								// Dispatch event for game page to clear disconnect UI
								window.dispatchEvent(
									new CustomEvent("opponentReconnected", { detail: payload })
								);
								break;

							case "GAME_PAUSED":
								// Dispatch event for game page to show pause UI
								window.dispatchEvent(
									new CustomEvent("gamePaused", { detail: payload })
								);
								toast.info(`Game paused by ${payload.pausedByName}`);
								break;

							case "GAME_RESUMED":
								// Dispatch event for game page to resume game
								window.dispatchEvent(
									new CustomEvent("gameResumed", { detail: payload })
								);
								toast.success("Game resumed!");
								break;

							case "OPPONENT_READY_TO_RESUME":
								window.dispatchEvent(
									new CustomEvent("opponentReadyToResume", { detail: payload })
								);
								toast.info("Opponent is ready to resume. Press SPACE to continue.");
								break;

							case "WAITING_FOR_RESUME":
								// Dispatch event showing we're waiting for opponent
								window.dispatchEvent(
									new CustomEvent("waitingForResume", { detail: payload })
								);
								break;

							case "MATCH_WALKOVER":
								// Dispatch event for walkover win (opponent left)
								window.dispatchEvent(
									new CustomEvent("matchWalkover", { detail: payload })
								);
								toast.success(payload.reason || "You win by walkover!");
								break;

							case "TOURNAMENT_PLAYER_LEFT":
								// A player left the tournament
								toast.warning("A player has left the tournament");
								window.dispatchEvent(
									new CustomEvent("tournamentPlayerLeft", { detail: payload })
								);
								break;

							case "CHAT_MESSAGE":
								console.log("Received CHAT_MESSAGE via WebSocket:", payload);
								window.dispatchEvent(
									new CustomEvent("chatMessage", { detail: payload })
								);
								break;

							case "TYPING_INDICATOR":
								console.log("Received TYPING_INDICATOR via WebSocket:", payload);
								window.dispatchEvent(
									new CustomEvent("typingIndicator", { detail: payload })
								);
								break;

							case "MESSAGE_READ":
								console.log("Received MESSAGE_READ via WebSocket:", payload);
								window.dispatchEvent(
									new CustomEvent("messageRead", { detail: payload })
								);
								break;

							case "GAME_INVITE_SENT":
								console.log("Game invite sent successfully:", payload);
								window.dispatchEvent(
									new CustomEvent("gameInviteSent", { detail: payload })
								);
								toast.success("Game invite sent!");
								break;

							case "GAME_INVITE_RESPONSE":
								window.dispatchEvent(
									new CustomEvent("gameInviteResponse", { detail: payload })
								);
								if (payload?.response === "rejected") {
									toast.info(`${payload?.inviteeUsername || "A player"} declined your invite`);
								} else if (payload?.response === "accepted") {
									toast.success(`${payload?.inviteeUsername || "A player"} accepted your invite`);
								}
								break;

							case "GAME_INVITE_PENDING":
								window.dispatchEvent(
									new CustomEvent("gameInvitePending", { detail: payload })
								);
								toast.info("Invitation already sent. Waiting for response.");
								break;

							case "PLAYER_READY_STATE":
								// Dispatch custom event for ready state persistence
								window.dispatchEvent(new CustomEvent("PLAYER_READY_STATE", { detail: payload }));
								break;

							default:
								console.log("Unknown event:", msg.event);
								break;
						}
					} catch (err) {
						// think about how to handle errors
						console.warn("Non-JSON WebSocket message or error handling message:", event.data, err);
					}
			};

			websocket.onerror = (err) => {
				if (websocket.readyState === WebSocket.CLOSING || websocket.readyState === WebSocket.CLOSED) return;
				console.error("WebSocket error:", err);
			};

			websocket.onclose = (event) => {
				setIsReady(false);
				console.log("WebSocket closed", event.code, event.reason);
				clearInterval(interval);
				if (wsRef.current === websocket) wsRef.current = null;

				// Attempt reconnection with exponential backoff if not closed intentionally
				if (isMounted && event.code !== 1000 && event.code !== 1005) {
					setTimeout(() => {
						console.log("Attempting to reconnect...");
						connect();
					}, 3000);
				}
			};
		};

		connectRef.current = connect;
		connect();

		return () => {
			isMounted = false;
			connectRef.current = null;
			if (wsRef.current) {
				wsRef.current.close(1000, "User logged out");
				wsRef.current = null;
			}
		};
	}, [user?.id]);

	useEffect(() => {
		if (!user) return;

		const reconnectIfNeeded = () => {
			if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
				connectRef.current?.();
			}
		};

		window.addEventListener("focus", reconnectIfNeeded);
		document.addEventListener("visibilitychange", reconnectIfNeeded);

		return () => {
			window.removeEventListener("focus", reconnectIfNeeded);
			document.removeEventListener("visibilitychange", reconnectIfNeeded);
		};
	}, [user?.id]);

	const sendSocketMessage = useCallback((payload: any) => {
		const socket = wsRef.current;
		if (payload?.event === "LEAVE_MATCHMAKING" || payload?.event === "LEAVE_ROOM") {
			suppressMatchmakingRedirectsUntil.current = Date.now() + 3000;
		}
		if (
			payload?.event === "JOIN_MATCHMAKING" ||
			payload?.event === "JOIN_ROOM_BY_CODE"
		) {
			suppressMatchmakingRedirectsUntil.current = 0;
		}
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			console.warn("Client socket isn't ready");
			connectRef.current?.();
			return;
		}
		socket.send(JSON.stringify(payload));
	}, []);

	const reconnectSocket = useCallback(() => {
		connectRef.current?.();
	}, []);

	useEffect(() => {
		const { getLatestGameRoom, getLatestGameState } = stableDeps.current;
		const gameRoom = getLatestGameRoom();
		const gameState = getLatestGameState();

		if (pathname && gameRoom?.roomId && user?.id) {
			// Define menu pages where we SHOULD auto-leave
			const isMenuPage = pathname === '/game' ||
				pathname === '/game/new' ||
				pathname === '/game/remote' ||
				pathname === '/game/remote/tournament' ||
				pathname === '/game/remote/single' ||
				pathname === '/game/local' ||
				pathname === '/dashboard';

			// Define lobby/game pages where we SHOULD NOT auto-leave
			const isLobbyPage = pathname.includes('/tournament/create') ||
				pathname.includes('/tournament/join') ||
				pathname.includes('/tournament/RT-') ||
				pathname.includes('/single/create') ||
				pathname.includes('/single/join') ||
				pathname.includes('/single/RS-') ||
				pathname.startsWith('/game/') && !isMenuPage;

			// Logic: We only want to trigger auto-leave if the pathname has ACTUALLY CHANGED
			// and we moved from a non-menu page to a menu page.
			const pathChanged = pathname !== prevPathname.current;

			if (pathChanged && (isMenuPage || !pathname.startsWith('/game')) && !isLobbyPage) {
				const isTournamentRoom = gameRoom?.isTournament === true;
				if (isTournamentRoom) {
					console.log(`[SocketContext] Skipping auto-leave for ongoing tournament room ${gameRoom.roomId}`);
					prevPathname.current = pathname;
					return;
				}

				// Only leave if they are not in an active game state, otherwise wait for game over / disconnect handler
				const isSpectating = (gameState as any)?.spectatorMode;

				// FIX: Add proper checks for active game state
				const isInActiveMatch = gameState &&
					gameState.gameStarted &&
					!gameState.gameOver &&
					!isSpectating;

				// FIX: Only leave if definitively NOT in active match
				if (!isInActiveMatch) {
					console.log(`[SocketContext] Auto-leaving room ${gameRoom.roomId} due to navigation to ${pathname}`);
					sendSocketMessage({
						event: "LEAVE_ROOM",
						payload: { roomId: gameRoom.roomId, userId: user.id }
					});
					stableDeps.current.setGameRoom(null);
				} else {
					console.log(`[SocketContext] Skipping auto-leave: player in active match`);
				}
			}
		}
		prevPathname.current = pathname;
	}, [pathname, user?.id, sendSocketMessage]); // No longer depends on gameRoom or gameState!

	const forceCleanup = useCallback(() => {
		stableDeps.current.setGameRoom(null);
		stableDeps.current.setGameState(null);
		stableDeps.current.setRemoteRenderGameState(null);
		hasActiveGame.current = false;
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ event: "FORCE_CLEANUP" }));
		}
	}, []);

	const contextValue = useMemo(
		() => ({
			sendSocketMessage,
			isReady,
			forceCleanup,
			reconnectSocket,
		}),
		[sendSocketMessage, isReady, forceCleanup, reconnectSocket]
	);

	return (
		<SocketContext.Provider value={contextValue}>
			{children}
		</SocketContext.Provider>
	);
};

export const useSocketContext = () => {
	const context = useContext(SocketContext);
	if (!context) {
		throw new Error("useSocketContext must be used within SocketProvider");
	}
	return context;
};
