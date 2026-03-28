import { gameManager } from "../../game/GameManager.js";

// Legacy direct-game WebSocket route used by the shared local game runtime.

function toAIDifficulty(value) {
	if (typeof value !== "string") return "medium";
	const normalized = value.trim().toLowerCase();
	if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
		return normalized;
	}
	return "medium";
}

function toAIEnabled(value) {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return false;
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
}

export default async function (fastify, opts) {
	fastify.get(
		"/game",  // This will be /ws/game
		{
			onRequest: [fastify.authenticate],
			websocket: true,
		},
		(connection, request) => {
			const matchId = request.query.matchId;
			const isAI = toAIEnabled(request.query.isAI);
			const aiDifficulty = toAIDifficulty(request.query.aiDifficulty);
			const userId = Number(request.user?.userId);

			console.log(`[GAME WS] Client connected - matchId: ${matchId}, userId: ${userId}, isAI: ${isAI}, aiDifficulty: ${aiDifficulty}`);

			if (!matchId) {
				console.log("[GAME WS] Error: No matchId");
				connection.send(JSON.stringify({ error: "matchId required" }));
				connection.close();
				return;
			}

			if (!Number.isInteger(userId) || userId <= 0) {
				console.log("[GAME WS] Error: Invalid authenticated user");
				connection.send(JSON.stringify({ error: "authenticated user required" }));
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

				console.log(`[GAME WS] Creating game: ${matchId} (Mode: ${mode}, Tournament: ${tournamentId}, AI: ${isAI}, Difficulty: ${aiDifficulty})`);
				game = gameManager.createGame(matchId, mode, tournamentId, {
					isAI,
					aiDifficulty,
				});
			}

			const role = game.join(connection, userId);
			console.log(`[GAME WS] Joined as: ${role}`);

			connection.on("message", (raw) => {
				try {
					const message = JSON.parse(raw);
					console.log(`[GAME WS] 📩 Received message:`, { type: message.type, role, matchId });

					if (message.type === "PADDLE_MOVE") {
						game.handleInput(role, message);
					}

					if (message.type === "START") {
						console.log(`[GAME WS] 🎯 START command received! Role: ${role}, Expected: 'host'`);
						if (role == 'host') {
							console.log("[GAME WS] ✅ Role matches! Starting game loop...");
							game.startGameLoop();
						} else {
							console.error(`[GAME WS] ❌ Role mismatch! Cannot start. Role: '${role}' (type: ${typeof role})`);
						}
					}

					if (message.type === "PAUSE" && role == 'host') {
						if (game.running) {
							game.pause();
						} else if (game.gameState.status === "paused") {
							game.resume();
						}
					}
				}
				catch (e) {
					console.error("[GAME WS] Error:", e);
				}
			});

			connection.on("close", () => {
				console.log(`[GAME WS] ${userId} disconnected`);

				// Local games should freeze immediately when the host tab disappears.
				// Browser unload messages are best-effort, so the server backs that up here.
				// We still keep the host identity so the same user can reconnect later.
				if (game.mode === 'local') {
					if (game.players.p1.socket === connection) {
						if (game.running && game.gameState.status === "playing") {
							console.log(`[GAME WS] Pausing local game ${matchId} on host disconnect`);
							game.pause();
						}
						console.log(`[GAME WS] Clearing local host slot for reconnection`);
						game.players.p1.socket = null;
						// Don't clear the id to allow same user to reconnect
					}
				}
			});
		}
	);
}
