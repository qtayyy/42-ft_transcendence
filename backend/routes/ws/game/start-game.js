import { gameManager } from "../../../game/GameManager";

/*
	Normal HTTP Route : (request, reply) => ...
	Websocket Route : (connection, request) => ....
*/
export default async function (fastify, opts) {
	fastify.get(
		"/:matchId", // Expect a match ID in URL
		{ // The Option (Object)
			onRequest: [fastify.authenticate], // Runs authentication checks
			websocket: true, // Tell Fastify this is a websocket route instead of HTTP page
		},
		(connection, request) => { // A Handler
			const { matchId } = request.params;
			const userId = request.user.id; // request.user is populated by the 'authenticate' decorator
			console.log(`Client connected to match: ${matchId}`);

			// Get game via POST api
			const game = gameManager.getGame(matchId);
			if (!game)
			{
				connection.socket.send(JSON.stringify({ Error: "Game not found. Create it first! "}));
				connection.socket.close();
				return ;
			}

			// Join the game
			// game.join() handles assigning P1/P2/Spectator and Local/Remote logic
			const role = game.join(connection.socket, userId);

			// Listen for messages from specific client
			connection.on("message", (raw) => {
				try {
					const message = JSON.parse(raw);

					if (message.type === "PADDLE_MOVE") {
						game.handleInput(role, message);
					}

					if (message.type === "START" && role == 'host') {
						game.startGameLoop()
					}
				}
				catch (e) {
					console.error("Invalid Websocket Message", e);
				}
			});

			// Handle Disconnect
			connection.socket.on("close", () => {
				console.log(`User ${userId} (Role: ${role}) disconnected`); 
			});
		}
	);
}