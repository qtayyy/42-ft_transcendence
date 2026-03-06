import { safeSend, serializeGameState } from "../../utils/ws-utils.js";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      websocket: true,
    },
    (connection, req) => {
      // In fastify-websocket v4+, the first arg is the connection (SocketStream or WebSocket)
      // The previous working code used connection.on("message"), so we'll stick to that.
      // And we use req.user which is populated by fastify.authenticate.

      const userId = Number(req.user.userId);
      console.log(
        `[WS Connect] User connected: ${userId} (type: ${typeof userId})`,
      );

      // Clear any pending lobby disconnect timeout
      if (fastify.lobbyDisconnectTimeouts?.has(userId)) {
        console.log(
          `[WS Connect] User ${userId} reconnected, clearing lobby grace period.`,
        );
        clearTimeout(fastify.lobbyDisconnectTimeouts.get(userId));
        fastify.lobbyDisconnectTimeouts.delete(userId);
      }

      // Check if this user was in a grace period for a game (was disconnected)
      if (fastify.gameStates && fastify.handlePlayerReconnecting) {
        for (const [matchId, gameState] of fastify.gameStates.entries()) {
          const leftId = String(gameState.leftPlayer?.id);
          const rightId = String(gameState.rightPlayer?.id);
          const uId = String(userId);

          if ((leftId === uId || rightId === uId) && !gameState.gameOver) {
            fastify.handlePlayerReconnecting(matchId, userId);
            
            // Send initial state sync to this specific connection
            if (connection.readyState === 1) {
              safeSend(
                connection,
                {
                  event: "GAME_STATE",
                  payload: {
                    ...serializeGameState(gameState),
                    me: leftId === uId ? "LEFT" : "RIGHT",
                  },
                },
                userId,
              );
            }
          }
        }
      }

      // Handle multiple sockets per user
      if (!fastify.onlineUsers.has(userId)) {
        fastify.onlineUsers.set(userId, new Set());
      }
      fastify.onlineUsers.get(userId).add(connection);

      fastify.notifyFriendStatus(userId, "online");

      connection.on("message", (message) => {
        const data = JSON.parse(message);
        const { event, payload } = data;
        console.log(`[WS Message] User ${userId} sent event: ${event}`);
        try {
          switch (event) {
            case "PING":
              safeSend(connection, { event: "PONG" }, userId);
              break;

            case "GET_GAME_ROOM":
              console.log(
                `[WS GET_GAME_ROOM] Request from userId: ${payload.userId} (type: ${typeof payload.userId})`,
              );
              fastify.sendGameRoom(payload.userId);
              break;

            case "SEND_GAME_INVITE":
              fastify.sendGameInvite(
                payload.roomId,
                payload.hostId,
                payload.hostUsername,
                payload.friendId,
                payload.friendUsername,
              );
              break;

            case "RESPOND_INVITE":
              fastify.respondInvite(
                payload.roomId,
                payload.hostId,
                payload.inviteeId,
                payload.inviteeUsername,
                payload.response,
              );
              break;

            case "JOIN_ROOM_BY_CODE":
              fastify.joinRoomByCode(
                payload.roomId,
                payload.userId,
                payload.username,
              );
              break;

            case "START_TOURNAMENT":
              fastify.startTournament(payload.roomId, payload.tournamentId);
              break;

            case "START_TOURNAMENT_MATCH":
              fastify.startTournamentMatch(
                payload.matchId,
                payload.tournamentId,
                payload.player1Id,
                payload.player1Name,
                payload.player2Id,
                payload.player2Name,
              );
              break;

            case "PLAYER_LOBBY_READY":
              fastify.handleLobbyReady(
                payload.tournamentId,
                payload.matchId,
                payload.userId,
              );
              break;

            case "REMATCH":
              fastify.startRematch(
                payload.player1Id,
                payload.player1Username,
                payload.player2Id,
                payload.player2Username,
              );
              break;

            case "LEAVE_GAME":
              // Notify opponent that this player left
              const opponentSocket = fastify.onlineUsers.get(
                Number(payload.opponentId),
              );
              if (opponentSocket) {
                safeSend(
                  opponentSocket,
                  {
                    event: "OPPONENT_LEFT",
                  },
                  payload.opponentId,
                );
              }
              break;

            case "LEAVE_ROOM":
              fastify.leaveRoom(payload.roomId, payload.userId);
              break;
            
            case "FORCE_CLEANUP":
              console.log(`[FORCE_CLEANUP] Requested for user ${userId}`);
              // 1. Leave any matchmaking queue
              fastify.leaveMatchmaking(userId, true);
              
              // 2. Leave any pre-game room
              const currentRoomId = fastify.currentRoom.get(userId);
              if (currentRoomId) {
                console.log(`[FORCE_CLEANUP] Leaving room ${currentRoomId} for user ${userId}`);
                fastify.leaveRoom(currentRoomId, userId);
              }
              
              // 3. Forfeit any active game match
              if (fastify.gameStates) {
                for (const [matchId, state] of fastify.gameStates.entries()) {
                  if (state.gameOver) continue;
                  if (Number(state.leftPlayer.id) === userId || Number(state.rightPlayer.id) === userId) {
                    console.log(`[FORCE_CLEANUP] Forfeiting match ${matchId} for user ${userId}`);
                    try {
                      fastify.forfeitMatch(matchId, userId);
                    } catch (e) {
                      console.error(`[FORCE_CLEANUP] Forfeit failed: ${e.message}`);
                    }
                  }
                }
              }
              break;

            case "GAME_EVENTS":
              // console.log(payload);
              fastify.updateGameState(
                payload.matchId,
                userId, // Use standardized variable from connection scope
                payload.keyEvent,
              );
              break;

            case "PLAYER_NAVIGATING_AWAY":
              // Player is navigating away from game page - treat as disconnect
              console.log(
                `[Navigate Away] User ${payload.userId} navigating away from match ${payload.matchId}`,
              );
              fastify.handlePlayerNavigatingAway(
                payload.matchId,
                payload.userId,
              );
              break;

            case "PLAYER_RECONNECTING":
              // Player returned to game page - handle reconnection
              console.log(
                `[Reconnect] User ${payload.userId} reconnecting to match ${payload.matchId}`,
              );
              fastify.handlePlayerReconnecting(payload.matchId, payload.userId);
              break;

            case "CHAT_MESSAGE":
              // Handle chat message with specific recipient
              (async () => {
                try {
                  const recipientId = parseInt(payload.recipientId);
                  const messageContent = payload.message;

                  if (!recipientId || isNaN(recipientId)) {
                    safeSend(
                      connection,
                      {
                        event: "CHAT_MESSAGE",
                        error: "Invalid recipient ID",
                      },
                      userId,
                    );
                    return;
                  }

                  // Verify friendship exists
                  const friendship = await prisma.friendship.findFirst({
                    where: {
                      status: "ACCEPTED",
                      OR: [
                        { requesterId: userId, addresseeId: recipientId },
                        { requesterId: recipientId, addresseeId: userId },
                      ],
                    },
                  });

                  if (!friendship) {
                    safeSend(
                      connection,
                      {
                        event: "CHAT_MESSAGE",
                        error: "Not friends with this user",
                      },
                      userId,
                    );
                    return;
                  }

                  // Save message to database
                  const savedMessage = await prisma.message.create({
                    data: {
                      senderId: userId,
                      recipientId: recipientId,
                      content: messageContent,
                    },
                    include: {
                      sender: {
                        select: {
                          id: true,
                          username: true,
                          avatar: true,
                        },
                      },
                    },
                  });

                  const messagePayload = {
                    id: savedMessage.id,
                    username: savedMessage.sender.username,
                    senderId: savedMessage.senderId,
                    avatar: savedMessage.sender.avatar || null,
                    message: savedMessage.content,
                    timestamp: savedMessage.createdAt.toISOString(),
                  };

                  // Send message to recipient if online
                  const recipientSocket = fastify.onlineUsers.get(
                    Number(recipientId),
                  );
                  if (recipientSocket) {
                    console.log(
                      `Sending CHAT_MESSAGE to recipient ${recipientId}:`,
                      messagePayload,
                    );
                    safeSend(
                      recipientSocket,
                      {
                        event: "CHAT_MESSAGE",
                        payload: messagePayload,
                      },
                      recipientId,
                    );
                  } else {
                    console.log(
                      `Recipient ${recipientId} is not online. Message saved but not delivered.`,
                    );
                  }

                  // Send saved message back to sender (so they can update optimistic message with real DB data)
                  console.log(
                    `Sending CHAT_MESSAGE confirmation back to sender ${userId}:`,
                    messagePayload,
                  );
                  safeSend(
                    connection,
                    {
                      event: "CHAT_MESSAGE",
                      payload: messagePayload,
                    },
                    userId,
                  );
                } catch (err) {
                  console.error("Error handling chat message:", err);
                  safeSend(
                    connection,
                    {
                      event: "CHAT_MESSAGE",
                      error: "Failed to send message",
                    },
                    userId,
                  );
                }
              })();
              break;

            case "GET_GAME_STATE":
              fastify.getGameState(payload.matchId, userId);
              break;

            case "JOIN_MATCHMAKING":
              fastify.joinMatchmaking(
                payload.userId,
                payload.username,
                payload.mode,
              );
              break;

            case "LEAVE_MATCHMAKING":
              fastify.leaveMatchmaking(payload.userId);
              break;

            case "START_ROOM_GAME":
              fastify.startRoomGame(payload.roomId);
              break;

            case "SET_PLAYER_READY":
              // Set player ready state in tournament
              if (fastify.activeTournaments && payload.tournamentId) {
                const tournament = fastify.activeTournaments.get(
                  payload.tournamentId,
                );
                if (tournament) {
                  tournament.playerReadyStates.set(
                    payload.userId,
                    payload.isReady,
                  );
                  console.log(
                    `[Tournament] Player ${payload.userId} ready state: ${payload.isReady}`,
                  );
                }
              }
              break;

            case "GET_PLAYER_READY":
              // Get player ready state from tournament
              if (fastify.activeTournaments && payload.tournamentId) {
                const tournament = fastify.activeTournaments.get(
                  payload.tournamentId,
                );
                const isReady =
                  tournament?.playerReadyStates.get(Number(payload.userId)) ||
                  false;
                const socket = fastify.onlineUsers.get(Number(userId));
                safeSend(
                  socket,
                  {
                    event: "PLAYER_READY_STATE",
                    payload: { userId: Number(payload.userId), isReady },
                  },
                  Number(userId),
                );
              }
              break;

            case "VIEW_MATCH":
              // Subscribe user to match as spectator
              if (payload.matchId && fastify.matchSpectators) {
                const { matchId } = payload;
                if (!fastify.matchSpectators.has(matchId)) {
                  fastify.matchSpectators.set(matchId, new Set());
                }
                fastify.matchSpectators.get(matchId).add(userId);
                console.log(
                  `[Spectator] User ${userId} viewing match ${matchId}`,
                );

                // Send current game state immediately
                const gameState = fastify.gameStates.get(matchId);
                if (gameState) {
                  const socket = fastify.onlineUsers.get(Number(userId));
                  safeSend(
                    socket,
                    {
                      event: "GAME_STATE",
                      payload: {
                        ...serializeGameState(gameState),
                        spectatorMode: true,
                      },
                    },
                    userId,
                  );
                }
              }
              break;

            case "UNVIEW_MATCH":
              // Unsubscribe user from match
              if (payload.matchId && fastify.matchSpectators) {
                const spectators = fastify.matchSpectators.get(payload.matchId);
                if (spectators) {
                  spectators.delete(userId);
                  if (spectators.size === 0) {
                    fastify.matchSpectators.delete(payload.matchId);
                  }
                }
                console.log(
                  `[Spectator] User ${userId} stopped viewing ${payload.matchId}`,
                );
              }
              break;

            default:
              console.log("Unknown event:", event);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          // Send error back to client so they don't hang
          safeSend(
            connection,
            {
              event: "JOIN_ROOM_ERROR",
              payload: { message: error.message || "Unknown error occurred" },
            },
            userId,
          );
        }
      });

      connection.on("close", () => {
        console.log(`[WS Close] User ${userId} connection closed`);

        const sockets = fastify.onlineUsers.get(Number(userId));
        if (sockets) {
          sockets.delete(connection);
          if (sockets.size === 0) {
            fastify.onlineUsers.delete(userId);
            fastify.notifyFriendStatus(userId, "offline");

            // --- ONLY CLEANUP WHEN LAST TAB IS CLOSED ---

            // Handle leaving queue if in matchmaking
            // Passing false means "don't evict from room immediately, let grace period handle it"
            fastify.leaveMatchmaking(userId, false);

            // Check if user has an active game and implement disconnect timeout
            let isInActiveMatch = false;
            if (fastify.gameStates && fastify.handlePlayerDisconnecting) {
              for (const [matchId, gameState] of fastify.gameStates.entries()) {
                const leftId = String(gameState.leftPlayer?.id);
                const rightId = String(gameState.rightPlayer?.id);
                const uId = String(userId);

                if ((leftId === uId || rightId === uId) && !gameState.gameOver && gameState.gameStarted) {
                  fastify.handlePlayerDisconnecting(matchId, userId);
                  isInActiveMatch = true;
                }
              }
            }

            // Clean up any room memberships ONLY if not in an active game (grace period)
            // If in grace period, we want to keep them in the room so they can resume
            if (!isInActiveMatch) {
              // Additional check: If user is in a tournament and has a pending match (even if game hasn't started yet),
              // DO NOT leave the room. Leaving triggers markPlayerWithdrawn which auto-forfeits them.
              let hasPendingMatch = false;
              // Check if they are part of any pending match in gameStates (even if not started)
              for (const [mid, gs] of fastify.gameStates.entries()) {
                if (
                  (String(gs.leftPlayer?.id) === String(userId) ||
                    String(gs.rightPlayer?.id) === String(userId)) &&
                  !gs.gameOver
                ) {
                  hasPendingMatch = true;
                  console.log(
                    `[WS Close] User ${userId} has pending match ${mid}, NOT leaving room/tournament.`,
                  );
                  break;
                }
              }

              // ---------------------------------------------------------------
              // TOURNAMENT GUARD: also check activeTournaments.
              // When a match ends and players navigate back to the tournament
              // lobby, their WS connection briefly drops during the React page
              // transition. At that point gameStates no longer has the finished
              // match, so hasPendingMatch above was false. We must NOT eject them
              // from the room because that calls markPlayerWithdrawn and cascades
              // walkover wins for all their remaining scheduled matches.
              // ---------------------------------------------------------------
              if (!hasPendingMatch && fastify.activeTournaments) {
                const currentRoomId = fastify.currentRoom.get(userId);
                if (currentRoomId) {
                  const tournamentId = `RT-${currentRoomId}`;
                  const tournament =
                    fastify.activeTournaments.get(tournamentId);
                  if (tournament && !tournament.isComplete()) {
                    // Player is an active participant in an ongoing tournament.
                    // Check if they are NOT withdrawn yet before protecting them.
                    const isStillActive = !tournament.isPlayerWithdrawn(userId);
                    if (isStillActive) {
                      hasPendingMatch = true;
                      console.log(
                        `[WS Close] User ${userId} is in ongoing tournament ${tournamentId}, NOT leaving room.`,
                      );
                    }
                  }
                }
              }

              if (!hasPendingMatch) {
                const currentRoomId = fastify.currentRoom.get(userId);
                if (currentRoomId) {
                  // LOBBY GRACE PERIOD:
                  // If we are in a lobby (not active game/tournament match),
                  // don't kick immediately. Wait 5s for possible refresh/reconnect.
                  console.log(
                    `[WS Close] User ${userId} left lobby room ${currentRoomId}. Starting 5s grace period...`,
                  );

                  const timeout = setTimeout(() => {
                    console.log(
                      `[WS Grace] Grace period expired for user ${userId} in room ${currentRoomId}. Removing...`,
                    );
                    fastify.lobbyDisconnectTimeouts.delete(userId);
                    fastify.leaveRoom(currentRoomId, userId);
                  }, 5000); // 5 seconds is plenty for HMR / page refresh

                  fastify.lobbyDisconnectTimeouts.set(userId, timeout);
                }
              }
            }
          }
        }
      });
    },
  );
}
