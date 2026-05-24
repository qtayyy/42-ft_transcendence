/*
===============================================================================
FILE PURPOSE
This module builds the WebSocket event handler map used by `connect-ws`.
It maps incoming event names to the same backend actions previously in switch.
===============================================================================
*/

import {
  assertActorMatchesPayloadId,
  getProfileUsername,
  getTournamentMatchForUser,
  isRoomHost,
  isTournamentParticipant,
} from "../ws-auth-guards.js";
import {
  normalizeJoinMatchmakingPayload,
  normalizeJoinRoomByCodePayload,
  normalizeLeaveRoomPayload,
  normalizeStartRoomGamePayload,
  normalizeStartTournamentPayload,
} from "../../../../lib/remote-play-validation.js";

export function createWsEventHandlers({
  fastify,
  connection,
  userId,
  prisma,
  safeSend,
  serializeGameState,
}) {
  return {
    PING: () => {
      safeSend(connection, { event: "PONG" }, userId);
    },

    GET_GAME_ROOM: () => {
      fastify.sendGameRoom(userId);
    },

    SEND_GAME_INVITE: (payload) => {
      (async () => {
        try {
          if (
            !assertActorMatchesPayloadId(
              userId,
              payload.hostId,
              "SEND_GAME_INVITE host",
            )
          ) {
            return;
          }
          if (!isRoomHost(fastify, payload.roomId, userId)) {
            console.warn("[WS] SEND_GAME_INVITE rejected: not room host");
            return;
          }
          const hostUsername = await getProfileUsername(prisma, userId);
          const friendUsername = await getProfileUsername(
            prisma,
            Number(payload.friendId),
          );
          fastify.sendGameInvite(
            payload.roomId,
            userId,
            hostUsername,
            payload.friendId,
            friendUsername,
          );
        } catch (err) {
          console.error("[WS] SEND_GAME_INVITE failed:", err.message);
          safeSend(
            connection,
            { event: "GAME_INVITE_ERROR", error: err.message || "Invite failed" },
            userId,
          );
        }
      })();
    },

    CANCEL_GAME_INVITE: (payload) => {
      try {
        if (
          !assertActorMatchesPayloadId(
            userId,
            payload.hostId,
            "CANCEL_GAME_INVITE host",
          )
        ) {
          return;
        }
        fastify.cancelGameInvite(
          payload.roomId,
          userId,
          payload.inviteeId,
        );
      } catch (err) {
        console.error("[WS] CANCEL_GAME_INVITE failed:", err.message);
      }
    },

    RESPOND_INVITE: (payload) => {
      (async () => {
        try {
          if (
            !assertActorMatchesPayloadId(
              userId,
              payload.inviteeId,
              "RESPOND_INVITE invitee",
            )
          ) {
            return;
          }
          const room = fastify.gameRooms.get(payload.roomId);
          if (!room || Number(room.hostId) !== Number(payload.hostId)) {
            console.warn("[WS] RESPOND_INVITE rejected: host/room mismatch");
            return;
          }
          const inviteeUsername = await getProfileUsername(prisma, userId);
          fastify.respondInvite(
            payload.response,
            payload.roomId,
            payload.hostId,
            userId,
            inviteeUsername,
          );
        } catch (err) {
          console.error("[WS] RESPOND_INVITE failed:", err.message);
        }
      })();
    },

    JOIN_ROOM_BY_CODE: (payload) => {
      (async () => {
        try {
          const { roomId } = normalizeJoinRoomByCodePayload(payload);
          const username = await getProfileUsername(prisma, userId);
          fastify.joinRoomByCode(roomId, userId, username);
        } catch (err) {
          console.error("[WS] JOIN_ROOM_BY_CODE failed:", err.message);
          safeSend(
            connection,
            {
              event: "JOIN_ROOM_ERROR",
              payload: { message: err.message || "Failed to join room" },
            },
            userId,
          );
        }
      })();
    },

    START_TOURNAMENT: (payload) => {
      try {
        const { roomId, tournamentId } = normalizeStartTournamentPayload(payload);
        fastify.startTournament(
          roomId,
          tournamentId,
          userId,
        );
      } catch (err) {
        console.error("[WS] START_TOURNAMENT failed:", err.message);
        safeSend(
          connection,
          {
            event: "JOIN_ROOM_ERROR",
            payload: { message: err.message || "Failed to start tournament" },
          },
          userId,
        );
      }
    },

    START_TOURNAMENT_MATCH: (payload) => {
      const ctx = getTournamentMatchForUser(
        fastify,
        payload.tournamentId,
        payload.matchId,
        userId,
      );
      if (!ctx) {
        console.warn("[WS] START_TOURNAMENT_MATCH rejected");
        return;
      }
      const { match } = ctx;
      if (!match.player2) return;
      fastify.startTournamentMatch(
        match.matchId,
        match.tournamentId,
        match.player1.id,
        match.player1.username || match.player1.name,
        match.player2.id,
        match.player2.username || match.player2.name,
      );
    },

    PLAYER_LOBBY_READY: (payload) => {
      fastify.handleLobbyReady(payload.tournamentId, payload.matchId, userId);
    },

    REMATCH: (payload) => {
      (async () => {
        const p1 = Number(payload.player1Id);
        const p2 = Number(payload.player2Id);
        const matchId = payload.matchId;
        if (!p1 || !p2 || p1 === p2) return;
        if (userId !== p1 && userId !== p2) {
          console.warn("[WS] REMATCH rejected: socket user not a declared player");
          return;
        }
        const rematchStatus =
          typeof fastify.canStartPostGameRematch === "function"
            ? fastify.canStartPostGameRematch(matchId, p1, p2)
            : { ok: false, reason: "Rematch not allowed" };
        if (!rematchStatus.ok) {
          safeSend(
            connection,
            {
              event: "REMATCH_FAILED",
              payload: { reason: rematchStatus.reason || "Rematch not allowed" },
            },
            userId,
          );
          return;
        }
        const otherId = userId === p1 ? p2 : p1;
        const friendship = await prisma.friendship.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: userId, addresseeId: otherId },
              { requesterId: otherId, addresseeId: userId },
            ],
          },
        });
        if (!friendship) {
          console.warn("[WS] REMATCH rejected: players are not friends");
          safeSend(
            connection,
            {
              event: "REMATCH_FAILED",
              payload: { reason: "Rematch not allowed" },
            },
            userId,
          );
          return;
        }
        const name1 = await getProfileUsername(prisma, p1);
        const name2 = await getProfileUsername(prisma, p2);
        const newMatchId = fastify.startRematch(p1, name1, p2, name2);
        if (
          newMatchId &&
          typeof fastify.clearPostGameRematchSession === "function"
        ) {
          fastify.clearPostGameRematchSession(matchId);
        }
      })();
    },

    LEAVE_GAME: (payload) => {
      const matchId = payload?.matchId;
      if (!matchId) return;
      const state = fastify.gameStates?.get(matchId);
      const uid = Number(userId);
      let opponentId = null;

      if (state && !state.gameOver) {
        const leftId = Number(state.leftPlayer?.id);
        const rightId = Number(state.rightPlayer?.id);
        if (uid !== leftId && uid !== rightId) return;
        opponentId = uid === leftId ? rightId : leftId;
      } else {
        const leaveResult =
          typeof fastify.markPostGamePlayerLeft === "function"
            ? fastify.markPostGamePlayerLeft(matchId, uid)
            : null;
        if (!leaveResult) return;
        opponentId = leaveResult.opponentId;
      }

      const opponentSocket = fastify.onlineUsers.get(opponentId);
      if (opponentSocket) {
        safeSend(
          opponentSocket,
          {
            event: "OPPONENT_LEFT",
          },
          opponentId,
        );
      }
    },

    LEAVE_ROOM: (payload) => {
      try {
        const { roomId } = normalizeLeaveRoomPayload(payload);
        fastify.leaveRoom(roomId, userId);
      } catch (err) {
        console.error("[WS] LEAVE_ROOM failed:", err.message);
        safeSend(
          connection,
          {
            event: "JOIN_ROOM_ERROR",
            payload: { message: err.message || "Failed to leave room" },
          },
          userId,
        );
      }
    },

    FORCE_CLEANUP: () => {
      console.log(`[FORCE_CLEANUP] Requested for user ${userId}`);
      // 1. Leave any matchmaking queue
      fastify.leaveMatchmaking(userId, true);

      // 2. Leave any pre-game room
      const currentRoomId = fastify.currentRoom.get(userId);
      if (currentRoomId) {
        console.log(
          `[FORCE_CLEANUP] Leaving room ${currentRoomId} for user ${userId}`,
        );
        fastify.leaveRoom(currentRoomId, userId);
      }

      // 3. Forfeit any active game match
      if (fastify.gameStates) {
        for (const [matchId, state] of fastify.gameStates.entries()) {
          if (state.gameOver) continue;
          if (
            Number(state.leftPlayer.id) === userId ||
            Number(state.rightPlayer.id) === userId
          ) {
            console.log(
              `[FORCE_CLEANUP] Forfeiting match ${matchId} for user ${userId}`,
            );
            try {
              fastify.forfeitMatch(matchId, userId);
            } catch (e) {
              console.error(`[FORCE_CLEANUP] Forfeit failed: ${e.message}`);
            }
          }
        }
      }
    },

    GAME_EVENTS: (payload) => {
      // console.log(payload);
      fastify.updateGameState(
        payload.matchId,
        userId, // Use standardized variable from connection scope
        payload.keyEvent,
      );
    },

    PLAYER_NAVIGATING_AWAY: (payload) => {
      console.log(
        `[Navigate Away] User ${userId} navigating away from match ${payload.matchId}`,
      );
      fastify.handlePlayerNavigatingAway(payload.matchId, userId);
    },

    PLAYER_RECONNECTING: (payload) => {
      console.log(
        `[Reconnect] User ${userId} reconnecting to match ${payload.matchId}`,
      );
      fastify.handlePlayerReconnecting(payload.matchId, userId);
    },

    CHAT_MESSAGE: (payload) => {
      // Handle chat message with specific recipient
      (async () => {
        try {
          const recipientId = parseInt(payload.recipientId);
          const messageContent = payload.message;

          if (!recipientId || isNaN(recipientId)) {
            safeSend(
              connection,
              {
                event: "CHAT_MESSAGE",
                error: "Invalid recipient ID",
              },
              userId,
            );
            return;
          }

          // Check if either user has blocked the other
          const blockExists = await prisma.block.findFirst({
            where: {
              OR: [
                { blockerId: userId, blockedId: recipientId },
                { blockerId: recipientId, blockedId: userId },
              ],
            },
          });

          if (blockExists) {
            safeSend(
              connection,
              {
                event: "CHAT_MESSAGE",
                error: "Cannot send message to blocked user",
              },
              userId,
            );
            return;
          }

          // Verify friendship exists
          const friendship = await prisma.friendship.findFirst({
            where: {
              status: "ACCEPTED",
              OR: [
                { requesterId: userId, addresseeId: recipientId },
                { requesterId: recipientId, addresseeId: userId },
              ],
            },
          });

          if (!friendship) {
            safeSend(
              connection,
              {
                event: "CHAT_MESSAGE",
                error: "Not friends with this user",
              },
              userId,
            );
            return;
          }

          // Save message to database
          const savedMessage = await prisma.message.create({
            data: {
              senderId: userId,
              recipientId: recipientId,
              content: messageContent,
            },
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          });

          const messagePayload = {
            id: savedMessage.id,
            username: savedMessage.sender.username,
            senderId: savedMessage.senderId,
            avatar: savedMessage.sender.avatar || null,
            message: savedMessage.content,
            timestamp: savedMessage.createdAt.toISOString(),
            read: savedMessage.read,
            readAt: savedMessage.readAt?.toISOString() || null,
          };

          // Send message to recipient if online
          const recipientSocket = fastify.onlineUsers.get(Number(recipientId));
          if (recipientSocket) {
            console.log(
              `Sending CHAT_MESSAGE to recipient ${recipientId}:`,
              messagePayload,
            );
            safeSend(
              recipientSocket,
              {
                event: "CHAT_MESSAGE",
                payload: messagePayload,
              },
              recipientId,
            );
          } else {
            console.log(
              `Recipient ${recipientId} is not online. Message saved but not delivered.`,
            );
          }

          // Send saved message back to sender (so they can update optimistic message with real DB data)
          console.log(
            `Sending CHAT_MESSAGE confirmation back to sender ${userId}:`,
            messagePayload,
          );
          safeSend(
            connection,
            {
              event: "CHAT_MESSAGE",
              payload: messagePayload,
            },
            userId,
          );
        } catch (err) {
          console.error("Error handling chat message:", err);
          safeSend(
            connection,
            {
              event: "CHAT_MESSAGE",
              error: "Failed to send message",
            },
            userId,
          );
        }
      })();
    },

    TYPING_INDICATOR: (payload) => {
      (async () => {
        const recipientId = parseInt(payload.recipientId);
        const isTyping = payload.isTyping;

        if (!recipientId || isNaN(recipientId)) {
          return;
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: userId, addresseeId: recipientId },
              { requesterId: recipientId, addresseeId: userId },
            ],
          },
        });
        if (!friendship) return;

        const recipientSocket = fastify.onlineUsers.get(Number(recipientId));
        if (recipientSocket) {
          safeSend(
            recipientSocket,
            {
              event: "TYPING_INDICATOR",
              payload: {
                userId: userId,
                isTyping: isTyping,
              },
            },
            recipientId,
          );
        }
      })();
    },

    MESSAGE_READ: (payload) => {
      // Handle message read receipt
      (async () => {
        try {
          console.log(`User ${userId} sending MESSAGE_READ for message ${payload.messageId}`);
          const messageId = parseInt(payload.messageId);

          if (!messageId || isNaN(messageId)) {
            console.log(`Invalid messageId: ${payload.messageId}`);
            return;
          }

          // Update message as read
          const updatedMessage = await prisma.message.updateMany({
            where: {
              id: messageId,
              recipientId: userId,
            },
            data: {
              read: true,
              readAt: new Date(),
            },
          });

          console.log(`Updated ${updatedMessage.count} message(s) as read`);

          if (updatedMessage.count > 0) {
            // Notify sender that message was read
            const message = await prisma.message.findUnique({
              where: { id: messageId },
            });

            if (message) {
              console.log(`Message ${messageId} marked as read by user ${userId}, notifying sender ${message.senderId}`);
              const senderSocket = fastify.onlineUsers.get(Number(message.senderId));
              console.log(`Sender socket found:`, !!senderSocket);
              if (senderSocket) {
                console.log(`Sending MESSAGE_READ to sender ${message.senderId} for message ${messageId}`);
                safeSend(
                  senderSocket,
                  {
                    event: "MESSAGE_READ",
                    payload: {
                      messageId: messageId,
                      readAt: new Date().toISOString(),
                      senderId: message.senderId,
                      recipientId: message.recipientId,
                    },
                  },
                  message.senderId,
                );
              } else {
                console.log(`Sender ${message.senderId} is not online, cannot send read receipt`);
              }
            }
          }
        } catch (err) {
          console.error("Error marking message as read:", err);
        }
      })();
    },

    GAME_INVITE: (payload) => {
      // Handle game invite
      (async () => {
        try {
          const recipientId = parseInt(payload.recipientId);
          const inviteType = payload.inviteType || "normal"; // normal, tournament

          if (!recipientId || isNaN(recipientId)) {
            safeSend(
              connection,
              {
                event: "GAME_INVITE",
                error: "Invalid recipient ID",
              },
              userId,
            );
            return;
          }

          // Check if recipient is blocked
          const blockExists = await prisma.block.findFirst({
            where: {
              OR: [
                { blockerId: userId, blockedId: recipientId },
                { blockerId: recipientId, blockedId: userId },
              ],
            },
          });

          if (blockExists) {
            safeSend(
              connection,
              {
                event: "GAME_INVITE",
                error: "Cannot invite blocked user",
              },
              userId,
            );
            return;
          }

          // Get sender info
          const sender = await prisma.profile.findUnique({
            where: { id: userId },
            select: { username: true, avatar: true },
          });

          // Send invite to recipient if online
          const recipientSocket = fastify.onlineUsers.get(Number(recipientId));
          if (recipientSocket) {
            safeSend(
              recipientSocket,
              {
                event: "GAME_INVITE",
                payload: {
                  inviterId: userId,
                  inviterName: sender?.username || "Unknown",
                  inviterAvatar: sender?.avatar,
                  inviteType: inviteType,
                  timestamp: new Date().toISOString(),
                },
              },
              recipientId,
            );

            // Store invite as a chat message so it appears in history after reload.
            await prisma.message.create({
              data: {
                senderId: userId,
                recipientId: recipientId,
                content: `${sender?.username || "A friend"} invited you to play a game`,
              },
            });

            // Confirm invite sent to sender
            safeSend(
              connection,
              {
                event: "GAME_INVITE_SENT",
                payload: {
                  recipientId: recipientId,
                  inviteType: inviteType,
                },
              },
              userId,
            );
          } else {
            safeSend(
              connection,
              {
                event: "GAME_INVITE",
                error: "User is offline",
              },
              userId,
            );
          }
        } catch (err) {
          console.error("Error sending game invite:", err);
          safeSend(
            connection,
            {
              event: "GAME_INVITE",
              error: "Failed to send invite",
            },
            userId,
          );
        }
      })();
    },

    GET_GAME_STATE: (payload) => {
      fastify.getGameState(payload.matchId, userId);
    },

    JOIN_MATCHMAKING: (payload) => {
      (async () => {
        try {
          const { mode } = normalizeJoinMatchmakingPayload(payload);
          const username = await getProfileUsername(prisma, userId);
          fastify.joinMatchmaking(userId, username, mode);
        } catch (err) {
          console.error("[WS] JOIN_MATCHMAKING failed:", err.message);
          safeSend(
            connection,
            {
              event: "JOIN_ROOM_ERROR",
              payload: { message: err.message || "Failed to join matchmaking" },
            },
            userId,
          );
        }
      })();
    },

    LEAVE_MATCHMAKING: () => {
      fastify.leaveMatchmaking(userId);
    },

    START_ROOM_GAME: (payload) => {
      try {
        const { roomId } = normalizeStartRoomGamePayload(payload);
        fastify.startRoomGame(roomId, userId);
      } catch (err) {
        console.error("[WS] START_ROOM_GAME failed:", err.message);
        safeSend(
          connection,
          {
            event: "JOIN_ROOM_ERROR",
            payload: { message: err.message || "Failed to start game" },
          },
          userId,
        );
      }
    },

    SET_PLAYER_READY: (payload) => {
      if (!fastify.activeTournaments || !payload.tournamentId) return;
      if (!isTournamentParticipant(fastify, payload.tournamentId, userId)) {
        console.warn("[WS] SET_PLAYER_READY rejected: not a tournament participant");
        return;
      }
      const tournament = fastify.activeTournaments.get(payload.tournamentId);
      if (tournament) {
        tournament.playerReadyStates.set(userId, payload.isReady);
        console.log(
          `[Tournament] Player ${userId} ready state: ${payload.isReady}`,
        );
      }
    },

    GET_PLAYER_READY: (payload) => {
      if (!fastify.activeTournaments || !payload.tournamentId) return;
      const tournament = fastify.activeTournaments.get(payload.tournamentId);
      if (!tournament) return;
      const queryId = Number(payload.userId);
      if (
        !isTournamentParticipant(fastify, payload.tournamentId, userId) ||
        !tournament.players.some((p) => Number(p.id) === queryId)
      ) {
        console.warn("[WS] GET_PLAYER_READY rejected");
        return;
      }
      const isReady =
        tournament.playerReadyStates.get(queryId) || false;
      const socket = fastify.onlineUsers.get(Number(userId));
      safeSend(
        socket,
        {
          event: "PLAYER_READY_STATE",
          payload: { userId: queryId, isReady },
        },
        Number(userId),
      );
    },

    VIEW_MATCH: (payload) => {
      if (payload.matchId && fastify.matchSpectators) {
        const { matchId } = payload;
        if (!fastify.gameStates?.has(matchId)) {
          console.warn("[WS] VIEW_MATCH rejected: no active match");
          return;
        }
        if (!fastify.matchSpectators.has(matchId)) {
          fastify.matchSpectators.set(matchId, new Set());
        }
        fastify.matchSpectators.get(matchId).add(userId);
        console.log(`[Spectator] User ${userId} viewing match ${matchId}`);

        const gameState = fastify.gameStates.get(matchId);
        if (gameState) {
          const socket = fastify.onlineUsers.get(Number(userId));
          safeSend(
            socket,
            {
              event: "GAME_STATE",
              payload: {
                ...serializeGameState(gameState),
                spectatorMode: true,
              },
            },
            userId,
          );
        }
      }
    },

    UNVIEW_MATCH: (payload) => {
      // Unsubscribe user from match
      if (payload.matchId && fastify.matchSpectators) {
        const spectators = fastify.matchSpectators.get(payload.matchId);
        if (spectators) {
          spectators.delete(userId);
          if (spectators.size === 0) {
            fastify.matchSpectators.delete(payload.matchId);
          }
        }
        console.log(`[Spectator] User ${userId} stopped viewing ${payload.matchId}`);
      }
    },
  };
}
