import { gameManager } from "../../../game/gameManager";

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
			console.log(`Client connected to match: ${matchId}`);

			// Get or create game
			let game = gameManager.getGame(matchId);
			if (!game)
				gameManager.createGame(matchId);

			/*
				Assign sockets to game logic
				FUTURE: Ideally need to check request.user.id to check is p1 or p2
				NOW: assign p1 if empty, else p2
			*/
			let playerSlot = 0;
			if (!game.players.p1) {
				playerSlot = 1;
				game.addPlayer(connection, 1);
			}
			else if (!game.players.p2) {
				playerSlot = 2;
				game.addPlayer(connection, 2);
			}
			else
			{
				connection.send(JSON.stringify({ error: "Game Full!"}));
				connection.close();
				return ;
			}

			// Listen for messages from specific client
			connection.on("message", (raw) => {
				let message = JSON.parse(raw);

				if (message.type === "PADDLE_MOVE") {
					game.handleInput(playerSlot, message.direction);
				}

				if (message.type === "START") {
					game.startGameLoop()
				}
			});
		}
	);
}