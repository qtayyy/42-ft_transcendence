import { PrismaClient } from "../../../generated/prisma/index.js";
import { gameManager } from "../../../game/GameManager.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
	fastify.post(
	"/create",
	{
		onRequest: [fastify.authenticate],
	},
	async (request, reply) => {
		try {
			// Fetch Data from Frontend
			// Expected body: { mode: 'local' | 'remote' }
			const { mode } = request.body;
			const userId = request.body.id;

			if (!mode || (mode !== 'local' && mode !== 'remote')) {
				return reply.code(400).send({
					Error: "Invalid Game Mode"
				});
			}

			// Generate a unique Match ID
			const matchId = Math.random().toString(36).substring(2, 9);

			// Initialize the Game in Memory
			gameManager.createGame(matchId, mode);

			// Return the Match ID to frontend
			// Frontend will use this ID to connect via websocket
			return reply.code(200).send({
				matchId: matchId,
				mode: mode
			});

			// I only handle 2 players now
			// if (players.length !== 2)
			// 	return reply
			// 	.code(400).send({error: "Two players required"});

			// // Create a single tournament for all players
			// const tournament = await prisma.tournament.create({
			// 	data: {
			// 	players: {
			// 		connect: players.map((player) => ({ id: player.id })),
			// 	},
		}
		catch (error) {
			console.log(error);
			return reply.code(500).send({
				Error: "Failed to create game"
			});
		}
		});

		// // Shuffle the players (For > 2 players)
		// players.sort(() => Math.random() - 0.5);

		// // Hard-coded for even num of players (need to handle 3 players)
		// const pairs = [[players[0], players[1]]];
		// const matches = await prisma.$transaction(
		// 	pairs.map(([p1, p2]) =>
		// 	prisma.match.create({
		// 		data: {
		// 		player1Id: p1.id,
		// 		player2Id: p2.id,
		// 		score1: 0,
		// 		score2: 0,
		// 		tournamentId: tournament.id,
		// 		},
		// 		include: {
		// 		player1: { select: { username: true } },
		// 		player2: { select: { username: true } },
		// 		},
		// 	})
		// 	)
		// );

		// fastify.dispatchMatches(matches);

		// reply.code(200).send({ success: true });
		// } 
		
		// catch (error) {
		// // To-do: Handle errors properly
		// throw error;
		// }
}
// 	);
// }
