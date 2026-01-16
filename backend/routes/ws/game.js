import { gameManager } from "../../game/GameManager.js";

export default async function (fastify, opts) {
	fastify.get(
		"/game",  // This will be /ws/game
		{
			websocket: true,
		},
		(connection, request) => {
			const matchId = request.query.matchId;
			const userId = request.user?.id || 'guest';

			console.log(`[GAME WS] Client connected - matchId: ${matchId}, userId: ${userId}`);

			if (!matchId) {
				console.log("[GAME WS] Error: No matchId");
				connection.send(JSON.stringify({ error: "matchId required" }));
				connection.close();
				return;
			}

			let game = gameManager.getGame(matchId);
			if (!game) {
				let mode = 'local';
				let tournamentId = null;

				if (matchId.startsWith('RS-')) {
					mode = 'remote';
				} else if (matchId.startsWith('RT-')) {
					mode = 'remote';
					// Extract tournamentId (RT-{uuid}) from matchId (RT-{uuid}-m{id})
					const lastDashIndex = matchId.lastIndexOf("-m");
					if (lastDashIndex !== -1) {
						tournamentId = matchId.substring(0, lastDashIndex);
					}
				}

				console.log(`[GAME WS] Creating game: ${matchId} (Mode: ${mode}, Tournament: ${tournamentId})`);
				game = gameManager.createGame(matchId, mode, tournamentId);
			}

			const role = game.join(connection, userId);
			console.log(`[GAME WS] Joined as: ${role}`);

			connection.on("message", (raw) => {
				try {
					const message = JSON.parse(raw);

					if (message.type === "PADDLE_MOVE") {
						game.handleInput(role, message);
					}

					if (message.type === "START" && role == 'host') {
						console.log("[GAME WS] Starting game");
						game.startGameLoop();
					}
				}
				catch (e) {
					console.error("[GAME WS] Error:", e);
				}
			});

			connection.on("close", () => {
				console.log(`[GAME WS] ${userId} disconnected`);
			});
		}
	);
}
