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
          if (gameState.leftPlayer?.id === userId || gameState.rightPlayer?.id === userId) {
            activeGameState = gameState;
            console.log(`[Disconnect] User ${userId} disconnected from match ${matchId}, starting grace period`);

            // Set a timeout for auto-forfeit
            setTimeout(() => {
              // Check if user reconnected
              if (!fastify.onlineUsers.has(userId)) {
                // User didn't reconnect - forfeit the match
                console.log(`[Disconnect] User ${userId} did not reconnect, forfeiting match ${matchId}`);

                // End the game with forfeit
                const isLeftPlayer = gameState.leftPlayer?.id === userId;
                const winner = isLeftPlayer ? "RIGHT" : "LEFT";
                const winnerId = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;

                // Update game state to show forfeit
                gameState.gameOver = true;
                gameState.winner = winner;
                gameState.forfeit = true;

                // End the game (this will clean up game loop, send GAME_OVER, etc)
                if (fastify.endGame) {
                  fastify.endGame(gameState, fastify).catch(console.error);
                }
              }
            }, DISCONNECT_GRACE_PERIOD);
            break;
          }
        }

        // Clean up any room memberships
        const currentRoomId = fastify.currentRoom.get(userId);
        if (currentRoomId) {
          fastify.leaveRoom(currentRoomId, userId);
        }
      });
    }
  );
}
