import { PrismaClient } from "../../../../generated/prisma/index.js";
import { replyIfValidationError } from "../../../../lib/auth-validation.js";
import { validateFriendSearchQuery } from "../../../../lib/friends-validation.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const myId = Number(request.user.userId);
        const identifier = validateFriendSearchQuery(request.query.user);

        const [relationships, blocks] = await Promise.all([
          prisma.friendship.findMany({
            where: {
              OR: [{ requesterId: myId }, { addresseeId: myId }],
            },
            select: { requesterId: true, addresseeId: true, status: true },
          }),
          prisma.block.findMany({
            where: {
              OR: [{ blockerId: myId }, { blockedId: myId }],
            },
            select: { blockerId: true, blockedId: true },
          }),
        ]);

        const excludedIds = new Set([Number(myId)]);
        for (const relationship of relationships) {
          if (relationship.status === "DECLINED") continue;
          excludedIds.add(
            relationship.requesterId === myId
              ? relationship.addresseeId
              : relationship.requesterId,
          );
        }
        for (const block of blocks) {
          excludedIds.add(block.blockerId === myId ? block.blockedId : block.blockerId);
        }

        const users = await prisma.profile.findMany({
          where: {
            id: { notIn: [...excludedIds] },
            OR: [
              { username: { contains: identifier } },
              { fullname: { contains: identifier } },
            ],
          },
          select: {
            id: true,
            username: true,
            fullname: true,
            avatar: true,
          },
          take: 20,
        });

        const query = identifier.toLocaleLowerCase();
        const rank = (profile) => {
          const username = profile.username.toLocaleLowerCase();
          const fullname = profile.fullname.toLocaleLowerCase();
          if (username === query) return 0;
          if (username.startsWith(query)) return 1;
          if (fullname.startsWith(query)) return 2;
          return 3;
        };

        users.sort((left, right) => {
          const rankDifference = rank(left) - rank(right);
          return rankDifference || left.username.localeCompare(right.username);
        });

        return reply.code(200).send(users.slice(0, 8));
      } catch (error) {
        if (replyIfValidationError(error, reply)) return;
        console.error("Error fetching friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
