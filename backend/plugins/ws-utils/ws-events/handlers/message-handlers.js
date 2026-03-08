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
        payload.roomId,
        payload.hostId,
        payload.inviteeId,
        payload.inviteeUsername,
        payload.response,
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
