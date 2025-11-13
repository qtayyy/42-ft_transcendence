const fastify = require('fastify')({
  logger: true,
  https: {
    key: require('fs').readFileSync('/path/to/key.pem'),
    cert: require('fs').readFileSync('/path/to/cert.pem')
  }
});

fastify.register(require('@fastify/websocket'));

// Secure WebSocket route (WSS)
fastify.get('/wss', { websocket: true }, (connection, req) => {
  console.log('Secure client connected');

  connection.socket.on('message', message => {
    try {
      const data = JSON.parse(message.toString());
      
      // Echo with timestamp
      connection.socket.send(JSON.stringify({
        echo: data,
        timestamp: new Date().toISOString(),
        secure: true
      }));
    } catch (err) {
      connection.socket.send('Error: Invalid JSON');
    }
  });
});

// Start HTTPS server (automatically enables WSS)
fastify.listen({ port: 8443 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log('WSS Server running on wss://localhost:8443');
});