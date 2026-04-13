/*
===============================================================================
FILE PURPOSE
This module builds the WebSocket event handler map used by `connect-ws`.
It maps incoming event names to the same backend actions previously in switch.
===============================================================================
*/

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

    GET_GAME_ROOM: (payload) => {
      console.log(
        `[WS GET_GAME_ROOM] Request from userId: ${payload.userId} (type: ${typeof payload.userId})`,
      );
      fastify.sendGameRoom(payload.userId);
    },

    SEND_GAME_INVITE: (payload) => {
      fastify.sendGameInvite(
        payload.roomId,
        payload.hostId,
        payload.hostUsername,
        payload.friendId,
        payload.friendUsername,
      );
    },

    RESPOND_INVITE: (payload) => {
      fastify.respondInvite(
        payload.response,
        payload.roomId,
        payload.hostId,
        payload.inviteeId,
        payload.inviteeUsername,
      );
    },

    JOIN_ROOM_BY_CODE: (payload) => {
      fastify.joinRoomByCode(payload.roomId, payload.userId, payload.username);
    },

    START_TOURNAMENT: (payload) => {
      fastify.startTournament(payload.roomId, payload.tournamentId);
    },

    START_TOURNAMENT_MATCH: (payload) => {
      fastify.startTournamentMatch(
        payload.matchId,
        payload.tournamentId,
        payload.player1Id,
        payload.player1Name,
        payload.player2Id,
        payload.player2Name,
      );
    },

    PLAYER_LOBBY_READY: (payload) => {
      fastify.handleLobbyReady(payload.tournamentId, payload.matchId, payload.userId);
    },

    REMATCH: (payload) => {
      fastify.startRematch(
        payload.player1Id,
        payload.player1Username,
        payload.player2Id,
        payload.player2Username,
      );
    },

    LEAVE_GAME: (payload) => {
      // Notify opponent that this player left
      const opponentSocket = fastify.onlineUsers.get(Number(payload.opponentId));
      if (opponentSocket) {
        safeSend(
          opponentSocket,
          {
            event: "OPPONENT_LEFT",
          },
          payload.opponentId,
        );
      }
    },

    LEAVE_ROOM: (payload) => {
      fastify.leaveRoom(payload.roomId, payload.userId);
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
      // Player is navigating away from game page - treat as disconnect
      console.log(
        `[Navigate Away] User ${payload.userId} navigating away from match ${payload.matchId}`,
      );
      fastify.handlePlayerNavigatingAway(payload.matchId, payload.userId);
    },

    PLAYER_RECONNECTING: (payload) => {
      // Player returned to game page - handle reconnection
      console.log(
        `[Reconnect] User ${payload.userId} reconnecting to match ${payload.matchId}`,
      );
      fastify.handlePlayerReconnecting(payload.matchId, payload.userId);
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
      // Handle typing indicator
      const recipientId = parseInt(payload.recipientId);
      const isTyping = payload.isTyping;

      if (!recipientId || isNaN(recipientId)) {
        return;
      }

      // Send typing indicator to recipient if online
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
      fastify.joinMatchmaking(payload.userId, payload.username, payload.mode);
    },

    LEAVE_MATCHMAKING: (payload) => {
      fastify.leaveMatchmaking(payload.userId);
    },

    START_ROOM_GAME: (payload) => {
      fastify.startRoomGame(payload.roomId);
    },

    SET_PLAYER_READY: (payload) => {
      // Set player ready state in tournament
      if (fastify.activeTournaments && payload.tournamentId) {
        const tournament = fastify.activeTournaments.get(payload.tournamentId);
        if (tournament) {
          tournament.playerReadyStates.set(payload.userId, payload.isReady);
          console.log(
            `[Tournament] Player ${payload.userId} ready state: ${payload.isReady}`,
          );
        }
      }
    },

    GET_PLAYER_READY: (payload) => {
      // Get player ready state from tournament
      if (fastify.activeTournaments && payload.tournamentId) {
        const tournament = fastify.activeTournaments.get(payload.tournamentId);
        const isReady =
          tournament?.playerReadyStates.get(Number(payload.userId)) || false;
        const socket = fastify.onlineUsers.get(Number(userId));
        safeSend(
          socket,
          {
            event: "PLAYER_READY_STATE",
            payload: { userId: Number(payload.userId), isReady },
          },
          Number(userId),
        );
      }
    },

    VIEW_MATCH: (payload) => {
      // Subscribe user to match as spectator
      if (payload.matchId && fastify.matchSpectators) {
        const { matchId } = payload;
        if (!fastify.matchSpectators.has(matchId)) {
          fastify.matchSpectators.set(matchId, new Set());
        }
        fastify.matchSpectators.get(matchId).add(userId);
        console.log(`[Spectator] User ${userId} viewing match ${matchId}`);

        // Send current game state immediately
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
