import { safeSend } from "../../utils/ws-utils.js";

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      websocket: true,
    },
    (connection, request) => {
      const userId = request.user.userId;

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
