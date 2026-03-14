import { PrismaClient } from "../../../generated/prisma/index.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/match-history",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        const matches = await prisma.match.findMany({
          where: {
            OR: [
              { player1Id: userId },
              { player2Id: userId },
            ],
          },
          include: {
            player1: { select: { username: true, avatar: true } },
            player2: { select: { username: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const history = matches.map((match) => {
          const isPlayer1 = match.player1Id === userId;

          const playerScore = isPlayer1 ? match.score1 : match.score2;
          const opponentScore = isPlayer1 ? match.score2 : match.score1;

          let result;
          if (playerScore > opponentScore) result = "win";
          else if (playerScore < opponentScore) result = "loss";
          else result = "draw";

          const opponentProfile = isPlayer1 ? match.player2 : match.player1;
          const opponent = opponentProfile?.username ?? "Guest";
          const opponentAvatar = opponentProfile?.avatar ?? null;

          const MODE_LABEL = {
            LOCAL: "local",
            LOCAL_TOURNAMENT: "local-tournament",
            REMOTE: "remote",
            REMOTE_TOURNAMENT: "remote-tournament",
            AI: "ai",
          };

          return {
            id: match.id,
            opponent,
            opponentAvatar,
            playerScore,
            opponentScore,
            result,
            mode: MODE_LABEL[match.mode] ?? match.mode.toLowerCase(),
            durationSeconds: match.durationSeconds,
            date: match.createdAt,
          };
        });

        return reply.code(200).send(history);
      } catch (error) {
        console.error("Error fetching match history:", error);
        return reply.code(500).send({ error: "Failed to fetch match history" });
      }
    }
  );
}
