"use client";

import {
	createContext,
	useRef,
	useEffect,
	useContext,
	useState,
	useCallback,
	useMemo,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { SocketContextValue } from "@/types/types";
import { useGameDispatch } from "@/hooks/use-game";
import { usePathname, useRouter } from "next/navigation";

const SocketContext = createContext<SocketContextValue | null>(null);

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
		getLatestGameRoom,
		getLatestGameState,
	} = gameDispatch;

	const pathname = usePathname();
	const router = useRouter();
	const [isReady, setIsReady] = useState(false);
	// Set this to NULL when a match ends
	const hasActiveGame = useRef(false);
	const prevPathname = useRef(pathname);

	// STABLE DEPS REF: This pattern prevents the WebSocket from re-connecting
	// whenever the router or context setters change identity/reference.
	const stableDeps = useRef({
		setOnlineFriends,
		setInvitesReceived,
		setGameRoom,
		setGameRoomLoaded,
		setGameState,
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

			const websocket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || "wss://localhost:8443/ws");
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
							// Dispatch event for chat page to refresh pending requests
							window.dispatchEvent(
								new CustomEvent("friendRequest", { detail: payload })
							);
							break;

						case "FRIEND_STATUS":
							const { id, username, status } = msg.payload;

							stableDeps.current.setOnlineFriends((prev) => {
								const exists = prev.find((f) => String(f.id) === String(id));

								if (status === "online" && !exists) {
									return [...prev, { id: String(id), username }];
								}

								if (status === "offline" && exists) {
									return prev.filter((f) => String(f.id) !== String(id));
								}

								return prev;
							});

							// Dispatch event for components to react to status changes
							window.dispatchEvent(
								new CustomEvent("friendStatusChange", { 
									detail: { id, username, status } 
								})
							);

							toast.info(`${username} is now ${status}!`);
							break;

						case "GAME_ROOM":
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
								// User has been designated as host for a new matchmade room
								// Redirect to the create page which acts as the lobby
								stableDeps.current.router.push("/game/remote/single/create?matchmaking=true");
								break;

							case "MATCHMAKING_LEFT":
								// Confirm left queue
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
								stableDeps.current.setGameState((prev: any) => {
									if (!prev) return { ...payload };

									// Increased threshold for ball movement to avoid jitter/loops if updates are too fast
									const ballMovedSignificantly =
										Math.abs((prev.ball?.posX || 0) - (payload.ball?.posX || 0)) > 0.1 ||
										Math.abs((prev.ball?.posY || 0) - (payload.ball?.posY || 0)) > 0.1;
									const disconnectStateChanged =
										prev.disconnectedPlayer !== payload.disconnectedPlayer ||
										prev.pausedAt !== payload.pausedAt ||
										prev.disconnectCountdown?.disconnectedPlayer !== payload.disconnectCountdown?.disconnectedPlayer ||
										prev.disconnectCountdown?.gracePeriodEndsAt !== payload.disconnectCountdown?.gracePeriodEndsAt;

									if (prev.matchId === payload.matchId &&
										!ballMovedSignificantly &&
										!disconnectStateChanged &&
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
								break;

							case "GAME_OVER":
								// Dispatch custom event for game page to show results
								window.dispatchEvent(
									new CustomEvent("gameOver", { detail: payload })
								);
								// Reset state after a delay to allow results screen
								setTimeout(() => {
									stableDeps.current.setGameState(null);
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
								// Invite sent from chat: return host to chat when invitee declines (room is closed server-side).
								try {
									const pendingChatRoom = sessionStorage.getItem("ft_chat_invite_room");
									if (
										payload?.roomId &&
										pendingChatRoom === payload.roomId &&
										user?.id &&
										Number(payload?.hostId) === Number(user.id)
									) {
										sessionStorage.removeItem("ft_chat_invite_room");
										if (payload.response === "rejected") {
											stableDeps.current.router.push("/chat");
										}
									}
								} catch {
									/* sessionStorage unavailable */
								}
								break;

							case "GAME_INVITE_PENDING":
								window.dispatchEvent(
									new CustomEvent("gameInvitePending", { detail: payload })
								);
								toast.info("Invitation already sent. Waiting for response.");
								break;

						case "GAME_INVITE_CANCELLED":
							// Invitee: the host cancelled your pending invite
							stableDeps.current.setInvitesReceived((prev) =>
								prev.filter((inv) => inv.roomId !== payload?.roomId)
							);
							window.dispatchEvent(
								new CustomEvent("gameInviteCancelled", { detail: payload })
							);
							toast.info("The game invite was cancelled by the host.");
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
			// Host waiting on invite responses: do not auto-leave — that would destroy the room
			// before the invitee accepts or declines (e.g. navigating from /chat to /dashboard).
			const myId = Number(user.id);
			const isHost = Number(gameRoom.hostId) === myId;
			const hasPendingOutgoingInvite =
				isHost && (gameRoom.invitedPlayers?.length ?? 0) > 0;
			if (hasPendingOutgoingInvite) {
				prevPathname.current = pathname;
				return;
			}

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
