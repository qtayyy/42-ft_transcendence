export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      websocket: true,
    },
    (connection, request) => {
      const userId = request.user.userId;

      fastify.onlineUsers.set(userId, connection);
      fastify.notifyFriendStatus(userId, 'online')

      connection.on('close', () => {
        fastify.onlineUsers.delete(userId);
        fastify.notifyFriendStatus(userId, 'offline')
      })
    }
  );
}