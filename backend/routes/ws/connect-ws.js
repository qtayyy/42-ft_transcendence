/*
===============================================================================
FILE PURPOSE
This route manages authenticated WebSocket connections for realtime features:
- Game/lobby/tournament events
- Spectator subscriptions
- Chat delivery
- Connection cleanup and disconnect grace logic
===============================================================================
*/

import { safeSend, serializeGameState } from "../../utils/ws-utils.js";
import { PrismaClient } from "../../generated/prisma/index.js";
import { createWsEventHandlers } from "../../plugins/ws-utils/ws-events/handlers/message-handlers.js";

const prisma = new PrismaClient();

export default async function (fastify, opts) {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      websocket: true,
    },
    (connection, req) => {
      // In fastify-websocket v4+, the first arg is the connection (SocketStream or WebSocket)
      // The previous working code used connection.on("message"), so we'll stick to that.
      // And we use req.user which is populated by fastify.authenticate.

      const userId = Number(req.user.userId);
      console.log(
        `[WS Connect] User connected: ${userId} (type: ${typeof userId})`,
      );

      // Clear any pending lobby disconnect timeout
      if (fastify.lobbyDisconnectTimeouts?.has(userId)) {
        console.log(
          `[WS Connect] User ${userId} reconnected, clearing lobby grace period.`,
        );
        clearTimeout(fastify.lobbyDisconnectTimeouts.get(userId));
        fastify.lobbyDisconnectTimeouts.delete(userId);
      }

      // Check if this user was in a grace period for a game (was disconnected)
      if (fastify.gameStates && fastify.handlePlayerReconnecting) {
        for (const [matchId, gameState] of fastify.gameStates.entries()) {
          const leftId = String(gameState.leftPlayer?.id);
          const rightId = String(gameState.rightPlayer?.id);
          const uId = String(userId);

          if ((leftId === uId || rightId === uId) && !gameState.gameOver) {
            fastify.handlePlayerReconnecting(matchId, userId);

            // Send initial state sync to this specific connection
            if (connection.readyState === 1) {
              safeSend(
                connection,
                {
                  event: "GAME_STATE",
                  payload: {
                    ...serializeGameState(gameState),
                    me: leftId === uId ? "LEFT" : "RIGHT",
                  },
                },
                userId,
              );
            }
          }
        }
      }

      // Handle multiple sockets per user
      if (!fastify.onlineUsers.has(userId)) {
        fastify.onlineUsers.set(userId, new Set());
      }
      fastify.onlineUsers.get(userId).add(connection);

      fastify.notifyFriendStatus(userId, "online");

      const eventHandlers = createWsEventHandlers({
        fastify,
        connection,
        userId,
        prisma,
        safeSend,
        serializeGameState,
      });

      connection.on("message", (message) => {
        const data = JSON.parse(message);
        const { event, payload } = data;
        try {
          const handler = eventHandlers[event];
          if (handler) {
            handler(payload);
          } else {
            console.warn("Unknown event:", event);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          // Send error back to client so they don't hang
          safeSend(
            connection,
            {
              event: "JOIN_ROOM_ERROR",
              payload: { message: error.message || "Unknown error occurred" },
            },
            userId,
          );
        }
      });

      connection.on("close", () => {
        console.log(`[WS Close] User ${userId} connection closed`);

        const sockets = fastify.onlineUsers.get(Number(userId));
        if (sockets) {
          sockets.delete(connection);
          if (sockets.size === 0) {
            fastify.onlineUsers.delete(userId);
            fastify.notifyFriendStatus(userId, "offline");

            // --- ONLY CLEANUP WHEN LAST TAB IS CLOSED ---

            // Handle leaving queue if in matchmaking
            // Passing false means "don't evict from room immediately, let grace period handle it"
            fastify.leaveMatchmaking(userId, false);

            // Check if user has an active game and implement disconnect timeout
            let isInActiveMatch = false;
            if (fastify.gameStates && fastify.handlePlayerDisconnecting) {
              for (const [matchId, gameState] of fastify.gameStates.entries()) {
                const leftId = String(gameState.leftPlayer?.id);
                const rightId = String(gameState.rightPlayer?.id);
                const uId = String(userId);

                if (
                  (leftId === uId || rightId === uId) &&
                  !gameState.gameOver &&
                  gameState.gameStarted
                ) {
                  fastify.handlePlayerDisconnecting(matchId, userId);
                  isInActiveMatch = true;
                }
              }
            }

            // Clean up any room memberships ONLY if not in an active game (grace period)
            // If in grace period, we want to keep them in the room so they can resume
            if (!isInActiveMatch) {
              // Additional check: If user is in a tournament and has a pending match (even if game hasn't started yet),
              // DO NOT leave the room. Leaving triggers markPlayerWithdrawn which auto-forfeits them.
              let hasPendingMatch = false;
              // Check if they are part of any pending match in gameStates (even if not started)
              for (const [mid, gs] of fastify.gameStates.entries()) {
                if (
                  (String(gs.leftPlayer?.id) === String(userId) ||
                    String(gs.rightPlayer?.id) === String(userId)) &&
                  !gs.gameOver
                ) {
                  hasPendingMatch = true;
                  console.log(
                    `[WS Close] User ${userId} has pending match ${mid}, NOT leaving room/tournament.`,
                  );
                  break;
                }
              }

              // ---------------------------------------------------------------
              // TOURNAMENT GUARD: also check activeTournaments.
              // When a match ends and players navigate back to the tournament
              // lobby, their WS connection briefly drops during the React page
              // transition. At that point gameStates no longer has the finished
              // match, so hasPendingMatch above was false. We must NOT eject them
              // from the room because that calls markPlayerWithdrawn and cascades
              // walkover wins for all their remaining scheduled matches.
              // ---------------------------------------------------------------
              if (!hasPendingMatch && fastify.activeTournaments) {
                const currentRoomId = fastify.currentRoom.get(userId);
                if (currentRoomId) {
                  const tournamentId = `RT-${currentRoomId}`;
                  const tournament = fastify.activeTournaments.get(tournamentId);
                  if (tournament && !tournament.isComplete()) {
                    // Player is an active participant in an ongoing tournament.
                    // Check if they are NOT withdrawn yet before protecting them.
                    const isStillActive = !tournament.isPlayerWithdrawn(userId);
                    if (isStillActive) {
                      hasPendingMatch = true;
                      console.log(
                        `[WS Close] User ${userId} is in ongoing tournament ${tournamentId}, NOT leaving room.`,
                      );
                    }
                  }
                }
              }

              if (!hasPendingMatch) {
                const currentRoomId = fastify.currentRoom.get(userId);
                if (currentRoomId) {
                  // LOBBY GRACE PERIOD:
                  // If we are in a lobby (not active game/tournament match),
                  // don't kick immediately. Wait 5s for possible refresh/reconnect.
                  console.log(
                    `[WS Close] User ${userId} left lobby room ${currentRoomId}. Starting 5s grace period...`,
                  );

                  const timeout = setTimeout(() => {
                    console.log(
                      `[WS Grace] Grace period expired for user ${userId} in room ${currentRoomId}. Removing...`,
                    );
                    fastify.lobbyDisconnectTimeouts.delete(userId);
                    fastify.leaveRoom(currentRoomId, userId);
                  }, 5000); // 5 seconds is plenty for HMR / page refresh

                  fastify.lobbyDisconnectTimeouts.set(userId, timeout);
                }
              }
            }
          }
        }
      });
    },
  );
}
