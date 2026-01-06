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
    (connection, request) => {
      // Ensure userId is a number for consistent Map lookups
      const userId = parseInt(request.user.userId);

      // Set user online and notify friends
      fastify.onlineUsers.set(userId, connection);
      fastify.notifyFriendStatus(userId, "online");

      // Parse and handle any messages from client
      connection.on("message", (message) => {
        const data = JSON.parse(message.toString());
        const { event, payload } = data;
        try {
          switch (event) {
            case "PING":
              safeSend(connection, { event: "PONG" }, userId);
              break;

            case "GET_GAME_ROOM":
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
                payload.response,
                payload.roomId,
                payload.hostId,
                payload.inviteeId,
                payload.inviteeUsername
              );
              break;

            case "LEAVE_ROOM":
              fastify.leaveRoom(payload.roomId, payload.userId);
              break;

            case "GAME_EVENTS":
              console.log(payload);
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

            case "JOIN_ROOM_BY_CODE":
              fastify.joinRoomByCode(
                payload.roomId,
                payload.userId,
                payload.username
              );
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
                    payload: { matchId: payload.matchId }
                  },
                  payload.opponentId
                );
              }
              break;

            default:
              safeSend(
                connection.socket,
                { event, error: "Unknown event" },
                userId
              );
              break;
          }
        } catch (err) {
          console.log("sending socket error:");
          safeSend(connection, { event, error: err.message }, userId);
        }
      });

      connection.on("close", () => {
        /**
         * Do not remove players from their room in case of disconenction
         * issues to allow them to reconnect
         *  */
        // const roomId = fastify.currentRoom.get(userId);
        // if (roomId)
        //   fastify.leaveRoom(roomId, userId);
        fastify.onlineUsers.delete(userId);
        fastify.notifyFriendStatus(userId, "offline");
      });
    }
  );
}
