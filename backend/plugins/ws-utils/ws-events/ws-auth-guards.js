/**
 * WebSocket authorization helpers: actor identity comes from JWT (connect-ws),
 * not from client-supplied user IDs in payloads.
 */

export function assertActorMatchesPayloadId(actorUserId, payloadId, label) {
  const actor = Number(actorUserId);
  const fromPayload = Number(payloadId);
  if (Number.isNaN(fromPayload) || fromPayload !== actor) {
    console.warn(
      `[WS Auth] Rejected ${label}: socket user ${actor} vs payload id ${payloadId}`,
    );
    return false;
  }
  return true;
}

export async function getProfileUsername(prisma, userId) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return profile?.username ?? "Player";
}

export function isRoomHost(fastify, roomId, userId) {
  const room = fastify.gameRooms.get(roomId);
  if (!room) return false;
  return Number(room.hostId) === Number(userId);
}

/**
 * @returns {{ tournament: object, match: object } | null}
 */
export function getTournamentMatchForUser(fastify, tournamentId, matchId, userId) {
  const tournament = fastify.activeTournaments?.get(tournamentId);
  if (!tournament) return null;
  const match = tournament.matches.find((m) => m.matchId === matchId);
  if (!match) return null;
  const uid = Number(userId);
  const isP1 = Number(match.player1?.id) === uid;
  const isP2 = match.player2 && Number(match.player2.id) === uid;
  if (!isP1 && !isP2) return null;
  return { tournament, match };
}

export function isTournamentParticipant(fastify, tournamentId, userId) {
  const tournament = fastify.activeTournaments?.get(tournamentId);
  if (!tournament?.players) return false;
  const uid = Number(userId);
  return tournament.players.some((p) => Number(p.id) === uid);
}
