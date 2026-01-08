import { safeSend } from "../../utils/ws-utils.js";

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
              // Broadcast message to all online users
              fastify.onlineUsers.forEach((socket, recipientId) => {
                if (recipientId !== userId) {
                  safeSend(socket, {
                    event: "CHAT_MESSAGE",
                    payload: {
                      username: req.user.username || "User",
                      message: payload.message,
                      timestamp: new Date().toISOString()
                    }
                  }, recipientId);
                }
              });
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
