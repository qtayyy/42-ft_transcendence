import { activeTournaments } from "../game/TournamentManager.js";
import { gameManager } from "../game/GameManager.js";
import { safeSend } from "../utils/ws-utils.js";

export const SESSION_REPLACED_CLOSE_CODE = 4001;
export const SESSION_REPLACED_CODE = "SESSION_REPLACED";
export const ACTIVE_SESSION_IN_MATCH_CODE = "ACTIVE_SESSION_IN_MATCH";

/** Find a remote match that should be protected from an unconfirmed takeover. */
export function findActiveRemoteMatch(fastify, userId) {
  const wantedId = String(userId);

  for (const [matchId, state] of fastify.gameStates ?? []) {
    const isPlayer =
      String(state.leftPlayer?.id) === wantedId ||
      String(state.rightPlayer?.id) === wantedId;
    if (isPlayer && !state.gameOver) {
      return {
        active: true,
        type: state.tournamentId ? "tournament" : "game",
        matchId,
        tournamentId: state.tournamentId || undefined,
      };
    }
  }

  for (const [, tournament] of activeTournaments) {
    // Local tournaments contain temporary players and belong to one browser;
    // they cannot be safely resumed as a remote session on another device.
    if (tournament.players?.some((player) => player.isTemp)) continue;
    const match = tournament.matches?.find(
      (candidate) =>
        candidate.status === "inprogress" &&
        (String(candidate.player1?.id) === wantedId ||
          String(candidate.player2?.id) === wantedId),
    );
    if (match) {
      return {
        active: true,
        type: "tournament",
        matchId: match.matchId,
        tournamentId: tournament.tournamentId,
      };
    }
  }

  for (const [matchId, game] of gameManager.activeGames) {
    const isPlayer =
      String(game.players?.p1?.id) === wantedId ||
      String(game.players?.p2?.id) === wantedId;
    if (game.mode === "remote" && isPlayer && game.gameState?.status === "playing") {
      return { active: true, type: "game", matchId };
    }
  }

  return null;
}

/** Return a conflict only while another browser is both connected and mid-match. */
export function getTakeoverConflict(fastify, userId) {
  const sockets = fastify.onlineUsers?.get(Number(userId));
  if (!sockets?.size) return null;
  return findActiveRemoteMatch(fastify, userId);
}

/**
 * Rotate the account session and disconnect every socket authenticated with the
 * previous version. Updating the database first makes concurrent logins safe:
 * only the last issued token remains valid.
 */
export async function establishSession(fastify, prisma, userId) {
  const user = await prisma.user.update({
    where: { id: Number(userId) },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });

  const sockets = fastify.onlineUsers?.get(Number(userId));
  if (sockets?.size) {
    for (const socket of [...sockets]) {
      safeSend(socket, {
        event: "SESSION_REPLACED",
        payload: { message: "Your account was signed in on another device." },
      });
      socket.close(
        SESSION_REPLACED_CLOSE_CODE,
        "Signed in on another device",
      );
    }
  }

  return user.sessionVersion;
}

/** Create the only JWT shape accepted by authenticated HTTP and WS routes. */
export function signSessionToken(fastify, userId, sessionVersion) {
  return fastify.jwt.sign(
    { userId: Number(userId), sessionVersion },
    { expiresIn: "1h" },
  );
}

export function takeoverRequiredReply(reply, activeMatch) {
  return reply.code(409).send({
    error: "This account is currently playing a match.",
    code: ACTIVE_SESSION_IN_MATCH_CODE,
    activeMatch,
  });
}
