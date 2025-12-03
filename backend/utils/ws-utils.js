export function safeSend(socket, data, userId) {
  if (!socket) {
    console.warn(`WS missing for user ${userId}. Was trying to send:`);
    console.warn(data)
    return;
  }

  if (socket.readyState !== WebSocket.OPEN) {
    console.warn(`WS for user ${userId} is not open`);
    return;
  }

  try {
    console.log(`Sending to user ${userId}:`);
    console.log(data);
    socket.send(JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to send to user ${userId}`, err);
  }
}
