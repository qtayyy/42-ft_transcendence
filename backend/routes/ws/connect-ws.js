import { safeSend } from "../../utils/ws-utils.js";
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
      console.log(`[WS Connect] User connected: ${userId} (type: ${typeof userId})`);

      // Check if this user was in a grace period for a game
      // Logic to resume game if they were in one
      // Iterating fastify.gameStates to find if this user belongs to a paused game
      if (fastify.gameStates) {
        for (const [matchId, gameState] of fastify.gameStates.entries()) {
          const leftId = String(gameState.leftPlayer?.id);
          const rightId = String(gameState.rightPlayer?.id);
          const uId = String(userId);

          // Check if user is in this game and it's not over
          if ((leftId === uId || rightId === uId) && !gameState.gameOver) {
            const isLeftPlayer = leftId === uId;
            const reconnectedPlayer = isLeftPlayer ? "LEFT" : "RIGHT";
            const opponentId = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;

            console.log(`[WS Connect] User ${userId} reconnected to match ${matchId}. Game is paused.`);

            // Clear any pending forfeit timeout
            if (gameState.disconnectTimeout) {
              console.log(`[WS Connect] Clearing disconnect timeout for match ${matchId}`);
              clearTimeout(gameState.disconnectTimeout);
              gameState.disconnectTimeout = null;
            }

            // Clear disconnect info
            gameState.disconnectedPlayer = null;

            // Notify opponent about reconnection
            const opponentSocket = fastify.onlineUsers.get(opponentId);
            if (opponentSocket) {
              safeSend(opponentSocket, {
                event: "OPPONENT_RECONNECTED",
                payload: {
                  matchId,
                  reconnectedPlayer,
                }
              }, opponentId);
            }

            // Also notify spectators
            if (fastify.matchSpectators) {
              const spectators = fastify.matchSpectators.get(matchId);
              if (spectators) {
                spectators.forEach(spectatorId => {
                  const spectatorSocket = fastify.onlineUsers.get(spectatorId);
                  if (spectatorSocket) {
                    safeSend(spectatorSocket, {
                      event: "OPPONENT_RECONNECTED",
                      payload: {
                        matchId,
                        reconnectedPlayer,
                      }
                    }, spectatorId);
                  }
                });
              }
            }

            // DO NOT call gameState.resume(). Wait for client to send START.
            // Send the current (paused) state so the client knows to show the "Resume" UI.
            if (connection.readyState === 1) {
              safeSend(connection, {
                event: "GAME_STATE",
                payload: {
                  ...gameState,
                  me: leftId === uId ? "LEFT" : "RIGHT"
                }
              }, userId);
            }
          }
        }
      }

      fastify.onlineUsers.set(userId, connection);
      fastify.notifyFriendStatus(userId, "online");

      connection.on("message", (message) => {
        const data = JSON.parse(message);
        const { event, payload } = data;
        try {
          switch (event) {
            case "PING":
              safeSend(connection, { event: "PONG" }, userId);
              break;

            case "GET_GAME_ROOM":
              console.log(`[WS GET_GAME_ROOM] Request from userId: ${payload.userId} (type: ${typeof payload.userId})`);
              fastify.sendGameRoom(payload.userId);
              break;

            case "SEND_GAME_INVITE":
              fastify.sendGameInvite(
                payload.roomId,
                payload.hostId,
                payload.hostUsername,
                payload.friendId,
                payload.friendUsername
              );
              break;

            case "RESPOND_INVITE":
              fastify.respondInvite(
                payload.roomId,
                payload.hostId,
                payload.inviteeId,
                payload.inviteeUsername,
                payload.response
              );
              break;

            case "JOIN_ROOM_BY_CODE":
              fastify.joinRoomByCode(
                payload.roomId,
                payload.userId,
                payload.username
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
                payload.player2Name
              );
              break;

            case "PLAYER_LOBBY_READY":
              fastify.handleLobbyReady(
                payload.tournamentId,
                payload.matchId,
                payload.userId
              );
              break;

            case "REMATCH":
              fastify.startRematch(
                payload.player1Id,
                payload.player1Username,
                payload.player2Id,
                payload.player2Username
              );
              break;

            case "LEAVE_GAME":
              // Notify opponent that this player left
              const opponentSocket = fastify.onlineUsers.get(payload.opponentId);
              if (opponentSocket) {
                safeSend(
                  opponentSocket,
                  {
                    event: "OPPONENT_LEFT",
                  },
                  payload.opponentId
                );
              }
              break;

            case "LEAVE_ROOM":
              fastify.leaveRoom(payload.roomId, payload.userId);
              break;

            case "GAME_EVENTS":
              // console.log(payload);
              fastify.updateGameState(payload.matchId, payload.userId, payload.keyEvent);
              break;

            case "CHAT_MESSAGE":
              // Handle chat message with specific recipient
              (async () => {
                try {
                  const recipientId = parseInt(payload.recipientId);
                  const messageContent = payload.message;

                  if (!recipientId || isNaN(recipientId)) {
                    safeSend(connection, {
                      event: "CHAT_MESSAGE",
                      error: "Invalid recipient ID"
                    }, userId);
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
                    safeSend(connection, {
                      event: "CHAT_MESSAGE",
                      error: "Not friends with this user"
                    }, userId);
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
                  const recipientSocket = fastify.onlineUsers.get(recipientId);
                  if (recipientSocket) {
                    console.log(`Sending CHAT_MESSAGE to recipient ${recipientId}:`, messagePayload);
                    safeSend(recipientSocket, {
                      event: "CHAT_MESSAGE",
                      payload: messagePayload,
                    }, recipientId);
                  } else {
                    console.log(`Recipient ${recipientId} is not online. Message saved but not delivered.`);
                  }

                  // Send saved message back to sender (so they can update optimistic message with real DB data)
                  console.log(`Sending CHAT_MESSAGE confirmation back to sender ${userId}:`, messagePayload);
                  safeSend(connection, {
                    event: "CHAT_MESSAGE",
                    payload: messagePayload,
                  }, userId);
                } catch (err) {
                  console.error("Error handling chat message:", err);
                  safeSend(connection, {
                    event: "CHAT_MESSAGE",
                    error: "Failed to send message"
                  }, userId);
                }
              })();
              break;

            case "JOIN_MATCHMAKING":
              fastify.joinMatchmaking(
                payload.userId,
                payload.username,
                payload.mode
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
                const tournament = fastify.activeTournaments.get(payload.tournamentId);
                if (tournament) {
                  tournament.playerReadyStates.set(payload.userId, payload.isReady);
                  console.log(`[Tournament] Player ${payload.userId} ready state: ${payload.isReady}`);
                }
              }
              break;

            case "GET_PLAYER_READY":
              // Get player ready state from tournament
              if (fastify.activeTournaments && payload.tournamentId) {
                const tournament = fastify.activeTournaments.get(payload.tournamentId);
                const isReady = tournament?.playerReadyStates.get(payload.userId) || false;
                const socket = fastify.onlineUsers.get(userId);
                safeSend(socket, {
                  event: "PLAYER_READY_STATE",
                  payload: { userId: payload.userId, isReady }
                }, userId);
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
                console.log(`[Spectator] User ${userId} viewing match ${matchId}`);

                // Send current game state immediately
                const gameState = fastify.gameStates.get(matchId);
                if (gameState) {
                  const socket = fastify.onlineUsers.get(userId);
                  safeSend(socket, {
                    event: "GAME_STATE",
                    payload: { ...gameState, spectatorMode: true }
                  }, userId);
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
                console.log(`[Spectator] User ${userId} stopped viewing ${payload.matchId}`);
              }
              break;

            default:
              console.log("Unknown event:", event);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          // Send error back to client so they don't hang
          safeSend(connection, {
            event: "JOIN_ROOM_ERROR",
            payload: { message: error.message || "Unknown error occurred" }
          }, userId);
        }
      });

      connection.on("close", () => {
        fastify.onlineUsers.delete(userId);
        fastify.notifyFriendStatus(userId, "offline");

        // Handle leaving queue if in matchmaking
        fastify.leaveMatchmaking(userId);

        // Check if user has an active game and implement disconnect timeout
        const DISCONNECT_GRACE_PERIOD = 30000; // 30 seconds
        let activeGameState = null;

        // Find if user is in any active game
        for (const [matchId, gameState] of fastify.gameStates.entries()) {
          const leftId = String(gameState.leftPlayer?.id);
          const rightId = String(gameState.rightPlayer?.id);
          const uId = String(userId);

          if (leftId === uId || rightId === uId) {
            activeGameState = gameState;
            const isLeftPlayer = leftId === uId;
            const disconnectedPlayer = isLeftPlayer ? "LEFT" : "RIGHT";
            const opponentId = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;

            console.log(`[Disconnect] User ${userId} disconnected from match ${matchId}, starting grace period`);

            // Pause the game loop
            // Note: GameState is a POJO, so we set a property that the loop checks
            if (activeGameState && typeof activeGameState.pause === 'function') {
              activeGameState.pause();
            } else if (activeGameState) {
              // Record when pause started for timer adjustment
              activeGameState.paused = true;
              activeGameState.pausedAt = Date.now();
              activeGameState.disconnectedPlayer = disconnectedPlayer;
              console.log(`Paused game ${matchId} due to disconnect`);
            }

            // Notify opponent about disconnect with countdown info
            const opponentSocket = fastify.onlineUsers.get(opponentId);
            if (opponentSocket) {
              safeSend(opponentSocket, {
                event: "OPPONENT_DISCONNECTED",
                payload: {
                  matchId,
                  disconnectedPlayer,
                  gracePeriod: DISCONNECT_GRACE_PERIOD,
                  gracePeriodEndsAt: Date.now() + DISCONNECT_GRACE_PERIOD,
                }
              }, opponentId);
            }

            // Also notify spectators
            if (fastify.matchSpectators) {
              const spectators = fastify.matchSpectators.get(matchId);
              if (spectators) {
                spectators.forEach(spectatorId => {
                  const spectatorSocket = fastify.onlineUsers.get(spectatorId);
                  if (spectatorSocket) {
                    safeSend(spectatorSocket, {
                      event: "OPPONENT_DISCONNECTED",
                      payload: {
                        matchId,
                        disconnectedPlayer,
                        gracePeriod: DISCONNECT_GRACE_PERIOD,
                        gracePeriodEndsAt: Date.now() + DISCONNECT_GRACE_PERIOD,
                      }
                    }, spectatorId);
                  }
                });
              }
            }

            // Set a timeout for auto-forfeit
            activeGameState.disconnectTimeout = setTimeout(() => {
              // Check if user is actually back online? (Double check, although we clear timeout on reconnect)
              // If timeout triggers, it means they didn't reconnect in time.
              console.log(`[Disconnect] Grace period expired for User ${userId}, forfeiting match ${matchId}`);

              // End the game with forfeit
              const winner = isLeftPlayer ? "RIGHT" : "LEFT";
              const winnerId = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;

              // Correct activeGameState reference inside closure
              gameState.gameOver = true;
              gameState.winner = winner;
              gameState.winnerId = winnerId;
              gameState.forfeit = true;

              if (fastify.endGame) {
                fastify.endGame(gameState, fastify).catch(console.error);
              }
              gameState.disconnectTimeout = null;
            }, DISCONNECT_GRACE_PERIOD);
            break;
          }
        }

        // Clean up any room memberships ONLY if not in an active game (grace period)
        // If in grace period, we want to keep them in the room so they can resume
        if (!activeGameState) {
          const currentRoomId = fastify.currentRoom.get(userId);
          if (currentRoomId) {
            fastify.leaveRoom(currentRoomId, userId);
          }
        }
      });
    }
  );
}
