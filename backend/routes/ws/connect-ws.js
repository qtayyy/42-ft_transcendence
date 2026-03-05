import { safeSend } from "../../utils/ws-utils.js";
import { PrismaClient } from "../../generated/prisma/index.js";

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
      console.log(`[WS Connect] User connected: ${userId} (type: ${typeof userId})`);

      // Check if this user was in a grace period for a game (was disconnected)
      // Only process if the player was actually marked as disconnected
      if (fastify.gameStates) {
        for (const [matchId, gameState] of fastify.gameStates.entries()) {
          const leftId = String(gameState.leftPlayer?.id);
          const rightId = String(gameState.rightPlayer?.id);
          const uId = String(userId);

          // Check if user is in this game and it's not over
          if ((leftId === uId || rightId === uId) && !gameState.gameOver) {
            const isLeftPlayer = leftId === uId;
            const reconnectedPlayer = isLeftPlayer ? "LEFT" : "RIGHT";
            const opponentId = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;

            // IMPORTANT: Only process reconnection if this player was actually marked as disconnected
            // This prevents false positives on initial game join
            const wasDisconnected = gameState.disconnectedPlayers && gameState.disconnectedPlayers.has(reconnectedPlayer);
            if (!wasDisconnected) {
              console.log(`[WS Connect] User ${userId} connected to match ${matchId} (not a reconnection - not in disconnectedPlayers set)`);
              continue; // Skip reconnection logic for this player
            }

            console.log(`[WS Connect] User ${userId} RECONNECTED to match ${matchId}. Was disconnected.`);

            // Clear any pending forfeit timeout for this specific player
            const timeoutKey = isLeftPlayer ? 'leftDisconnectTimeout' : 'rightDisconnectTimeout';
            if (gameState[timeoutKey]) {
              console.log(`[WS Connect] Clearing disconnect timeout for ${reconnectedPlayer} in match ${matchId}`);
              clearTimeout(gameState[timeoutKey]);
              gameState[timeoutKey] = null;
            }

            // Remove player from disconnectedPlayers set
            gameState.disconnectedPlayers.delete(reconnectedPlayer);
            console.log(`[WS Connect] Remaining disconnected players: ${[...gameState.disconnectedPlayers].join(', ') || 'none'}`);

            // Clear legacy disconnect info if this was the last disconnected player
            if (gameState.disconnectedPlayers.size === 0) {
              gameState.disconnectedPlayer = null;
              // Resume game if both players are now connected
              gameState.paused = false;
              gameState.pausedAt = null;
            }

            // Notify opponent about reconnection
            const opponentSocket = fastify.onlineUsers.get(opponentId);
            if (opponentSocket) {
              safeSend(opponentSocket, {
                event: "OPPONENT_RECONNECTED",
                payload: {
                  matchId,
                  reconnectedPlayer,
                }
              }, opponentId);
            }

            // Also notify spectators
            if (fastify.matchSpectators) {
              const spectators = fastify.matchSpectators.get(matchId);
              if (spectators) {
                spectators.forEach(spectatorId => {
                  const spectatorSocket = fastify.onlineUsers.get(spectatorId);
                  if (spectatorSocket) {
                    safeSend(spectatorSocket, {
                      event: "OPPONENT_RECONNECTED",
                      payload: {
                        matchId,
                        reconnectedPlayer,
                      }
                    }, spectatorId);
                  }
                });
              }
            }

            // Send the current state so the client knows to show the appropriate UI
            if (connection.readyState === 1) {
              safeSend(connection, {
                event: "GAME_STATE",
                payload: {
                  ...gameState,
                  me: leftId === uId ? "LEFT" : "RIGHT",
                  // Include disconnect countdown info if opponent is still disconnected
                  disconnectCountdown: gameState.disconnectedPlayers?.size > 0 ? {
                    disconnectedPlayers: [...gameState.disconnectedPlayers],
                    gracePeriodEndsAt: gameState.pausedAt ? gameState.pausedAt + 30000 : null
                  } : null
                }
              }, userId);
            }
          }
        }
      }

      fastify.onlineUsers.set(userId, connection);
      fastify.notifyFriendStatus(userId, "online");

      connection.on("message", (message) => {
        const data = JSON.parse(message);
        const { event, payload } = data;
        try {
          switch (event) {
            case "PING":
              safeSend(connection, { event: "PONG" }, userId);
              break;

            case "GET_GAME_ROOM":
              console.log(`[WS GET_GAME_ROOM] Request from userId: ${payload.userId} (type: ${typeof payload.userId})`);
              fastify.sendGameRoom(payload.userId);
              break;

            case "SEND_GAME_INVITE":
              fastify.sendGameInvite(
                payload.roomId,
                payload.hostId,
                payload.hostUsername,
                payload.friendId,
                payload.friendUsername
              );
              break;

            case "RESPOND_INVITE":
              fastify.respondInvite(
                payload.roomId,
                payload.hostId,
                payload.inviteeId,
                payload.inviteeUsername,
                payload.response
              );
              break;

            case "JOIN_ROOM_BY_CODE":
              fastify.joinRoomByCode(
                payload.roomId,
                payload.userId,
                payload.username
              );
              break;

            case "START_TOURNAMENT":
              fastify.startTournament(payload.roomId, payload.tournamentId);
              break;

            case "START_TOURNAMENT_MATCH":
              fastify.startTournamentMatch(
                payload.matchId,
                payload.tournamentId,
                payload.player1Id,
                payload.player1Name,
                payload.player2Id,
                payload.player2Name
              );
              break;

            case "PLAYER_LOBBY_READY":
              fastify.handleLobbyReady(
                payload.tournamentId,
                payload.matchId,
                payload.userId
              );
              break;

            case "REMATCH":
              fastify.startRematch(
                payload.player1Id,
                payload.player1Username,
                payload.player2Id,
                payload.player2Username
              );
              break;

            case "LEAVE_GAME":
              // Notify opponent that this player left
              const opponentSocket = fastify.onlineUsers.get(payload.opponentId);
              if (opponentSocket) {
                safeSend(
                  opponentSocket,
                  {
                    event: "OPPONENT_LEFT",
                  },
                  payload.opponentId
                );
              }
              break;

            case "LEAVE_ROOM":
              fastify.leaveRoom(payload.roomId, payload.userId);
              break;

            case "GAME_EVENTS":
              // console.log(payload);
              fastify.updateGameState(payload.matchId, payload.userId, payload.keyEvent);
              break;

            case "PLAYER_NAVIGATING_AWAY":
              // Player is navigating away from game page - treat as disconnect
              console.log(`[Navigate Away] User ${payload.userId} navigating away from match ${payload.matchId}`);
              fastify.handlePlayerNavigatingAway(payload.matchId, payload.userId);
              break;

            case "PLAYER_RECONNECTING":
              // Player returned to game page - handle reconnection
              console.log(`[Reconnect] User ${payload.userId} reconnecting to match ${payload.matchId}`);
              fastify.handlePlayerReconnecting(payload.matchId, payload.userId);
              break;

            case "CHAT_MESSAGE":
              // Handle chat message with specific recipient
              (async () => {
                try {
                  const recipientId = parseInt(payload.recipientId);
                  const messageContent = payload.message;

                  if (!recipientId || isNaN(recipientId)) {
                    safeSend(connection, {
                      event: "CHAT_MESSAGE",
                      error: "Invalid recipient ID"
                    }, userId);
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
                    safeSend(connection, {
                      event: "CHAT_MESSAGE",
                      error: "Not friends with this user"
                    }, userId);
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
                  const recipientSocket = fastify.onlineUsers.get(recipientId);
                  if (recipientSocket) {
                    console.log(`Sending CHAT_MESSAGE to recipient ${recipientId}:`, messagePayload);
                    safeSend(recipientSocket, {
                      event: "CHAT_MESSAGE",
                      payload: messagePayload,
                    }, recipientId);
                  } else {
                    console.log(`Recipient ${recipientId} is not online. Message saved but not delivered.`);
                  }

                  // Send saved message back to sender (so they can update optimistic message with real DB data)
                  console.log(`Sending CHAT_MESSAGE confirmation back to sender ${userId}:`, messagePayload);
                  safeSend(connection, {
                    event: "CHAT_MESSAGE",
                    payload: messagePayload,
                  }, userId);
                } catch (err) {
                  console.error("Error handling chat message:", err);
                  safeSend(connection, {
                    event: "CHAT_MESSAGE",
                    error: "Failed to send message"
                  }, userId);
                }
              })();
              break;

            case "GET_GAME_STATE":
              fastify.getGameState(payload.matchId, userId);
              break;

            case "JOIN_MATCHMAKING":
              fastify.joinMatchmaking(
                payload.userId,
                payload.username,
                payload.mode
              );
              break;

            case "LEAVE_MATCHMAKING":
              fastify.leaveMatchmaking(payload.userId);
              break;

            case "START_ROOM_GAME":
              fastify.startRoomGame(payload.roomId);
              break;

            case "SET_PLAYER_READY":
              // Set player ready state in tournament
              if (fastify.activeTournaments && payload.tournamentId) {
                const tournament = fastify.activeTournaments.get(payload.tournamentId);
                if (tournament) {
                  tournament.playerReadyStates.set(payload.userId, payload.isReady);
                  console.log(`[Tournament] Player ${payload.userId} ready state: ${payload.isReady}`);
                }
              }
              break;

            case "GET_PLAYER_READY":
              // Get player ready state from tournament
              if (fastify.activeTournaments && payload.tournamentId) {
                const tournament = fastify.activeTournaments.get(payload.tournamentId);
                const isReady = tournament?.playerReadyStates.get(payload.userId) || false;
                const socket = fastify.onlineUsers.get(userId);
                safeSend(socket, {
                  event: "PLAYER_READY_STATE",
                  payload: { userId: payload.userId, isReady }
                }, userId);
              }
              break;

            case "VIEW_MATCH":
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
                  const socket = fastify.onlineUsers.get(userId);
                  // Convert Set to array for JSON serialization
                  const serializedState = {
                    ...gameState,
                    disconnectedPlayers: gameState.disconnectedPlayers instanceof Set
                      ? [...gameState.disconnectedPlayers]
                      : (gameState.disconnectedPlayers || [])
                  };
                  safeSend(socket, {
                    event: "GAME_STATE",
                    payload: { ...serializedState, spectatorMode: true }
                  }, userId);
                }
              }
              break;

            case "UNVIEW_MATCH":
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
              break;

            default:
              console.log("Unknown event:", event);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          // Send error back to client so they don't hang
          safeSend(connection, {
            event: "JOIN_ROOM_ERROR",
            payload: { message: error.message || "Unknown error occurred" }
          }, userId);
        }
      });

      connection.on("close", () => {
        console.log(`[WS Close] User ${userId} connection closed`);
        fastify.onlineUsers.delete(userId);
        fastify.notifyFriendStatus(userId, "offline");

        // Handle leaving queue if in matchmaking
        fastify.leaveMatchmaking(userId);

        // Check if user has an active game and implement disconnect timeout
        const DISCONNECT_GRACE_PERIOD = 30000; // 30 seconds
        let activeGameState = null;

        console.log(`[WS Close] Checking gameStates for user ${userId}. Total games: ${fastify.gameStates?.size || 0}`);

        // Find if user is in any active game
        for (const [matchId, gameState] of fastify.gameStates.entries()) {
          const leftId = String(gameState.leftPlayer?.id);
          const rightId = String(gameState.rightPlayer?.id);
          const uId = String(userId);
          console.log(`[WS Close] Checking match ${matchId}: leftId=${leftId}, rightId=${rightId}, userId=${uId}`);

          if (leftId === uId || rightId === uId) {
            // Skip disconnect handling if game hasn't started or is already over
            // This prevents false positive disconnects during the "Are you ready?" phase
            if (!gameState.gameStarted || gameState.gameOver) {
              console.log(`[WS Close] Skipping disconnect for match ${matchId}: gameStarted=${gameState.gameStarted}, gameOver=${gameState.gameOver}`);
              continue;
            }

            activeGameState = gameState;
            const isLeftPlayer = leftId === uId;
            const disconnectedPlayer = isLeftPlayer ? "LEFT" : "RIGHT";
            const opponentIdRaw = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;
            // Ensure opponentId is a number to match onlineUsers key type
            const opponentId = Number(opponentIdRaw);

            console.log(`[Disconnect] User ${userId} disconnected from match ${matchId}, starting grace period`);
            console.log(`[Disconnect] Looking for opponent ${opponentId} (raw: ${opponentIdRaw}, type: ${typeof opponentIdRaw})`);

            // Check if opponent is also disconnected (both players disconnect scenario)
            const opponentSocket = fastify.onlineUsers.get(opponentId);
            const opponentDisconnected = !opponentSocket || opponentSocket.readyState !== 1;
            console.log(`[Disconnect] Opponent socket found: ${!!opponentSocket}, readyState: ${opponentSocket?.readyState}, disconnected: ${opponentDisconnected}`);

            // Pause the game loop
            // Record when pause started for timer adjustment
            if (!activeGameState.paused) {
              activeGameState.paused = true;
              activeGameState.pausedAt = Date.now();
            }

            // Track which player(s) are disconnected
            if (!activeGameState.disconnectedPlayers) {
              activeGameState.disconnectedPlayers = new Set();
            }
            activeGameState.disconnectedPlayers.add(disconnectedPlayer);
            activeGameState.disconnectedPlayer = disconnectedPlayer;
            console.log(`Paused game ${matchId} due to disconnect. Disconnected players: ${[...activeGameState.disconnectedPlayers].join(', ')}`);

            // Notify opponent about disconnect with countdown info (if online)
            if (opponentSocket && !opponentDisconnected) {
              console.log(`[Disconnect] Sending OPPONENT_DISCONNECTED and GAME_STATE to opponent ${opponentId}`);
              safeSend(opponentSocket, {
                event: "OPPONENT_DISCONNECTED",
                payload: {
                  matchId,
                  disconnectedPlayer,
                  gracePeriod: DISCONNECT_GRACE_PERIOD,
                  gracePeriodEndsAt: Date.now() + DISCONNECT_GRACE_PERIOD,
                }
              }, opponentId);

              // Also send updated game state with paused flag so UI shows pause overlay
              const opponentSide = isLeftPlayer ? "RIGHT" : "LEFT";
              const gameStatePayload = {
                ...activeGameState,
                // Convert Set to array for JSON serialization
                disconnectedPlayers: activeGameState.disconnectedPlayers ? [...activeGameState.disconnectedPlayers] : [],
                me: opponentSide,
                disconnectCountdown: {
                  disconnectedPlayer,
                  gracePeriodEndsAt: Date.now() + DISCONNECT_GRACE_PERIOD
                }
              };
              console.log(`[Disconnect] Sending GAME_STATE with paused=${gameStatePayload.paused}, disconnectedPlayer=${gameStatePayload.disconnectedPlayer}`);
              safeSend(opponentSocket, {
                event: "GAME_STATE",
                payload: gameStatePayload
              }, opponentId);
            } else {
              console.log(`[Disconnect] Cannot notify opponent: socket=${!!opponentSocket}, disconnected=${opponentDisconnected}`);
            }

            // Also notify spectators
            if (fastify.matchSpectators) {
              const spectators = fastify.matchSpectators.get(matchId);
              if (spectators) {
                spectators.forEach(spectatorId => {
                  const spectatorSocket = fastify.onlineUsers.get(spectatorId);
                  if (spectatorSocket) {
                    safeSend(spectatorSocket, {
                      event: "OPPONENT_DISCONNECTED",
                      payload: {
                        matchId,
                        disconnectedPlayer,
                        gracePeriod: DISCONNECT_GRACE_PERIOD,
                        gracePeriodEndsAt: Date.now() + DISCONNECT_GRACE_PERIOD,
                        bothDisconnected: activeGameState.disconnectedPlayers?.size >= 2
                      }
                    }, spectatorId);
                  }
                });
              }
            }

            // Set a timeout for auto-forfeit (only if no timeout already set for this player)
            const timeoutKey = isLeftPlayer ? 'leftDisconnectTimeout' : 'rightDisconnectTimeout';
            if (!activeGameState[timeoutKey]) {
              activeGameState[timeoutKey] = setTimeout(() => {
                console.log(`[Disconnect] Grace period expired for User ${userId} (${disconnectedPlayer}), checking match ${matchId} status`);

                // Check if both players are disconnected
                const bothDisconnected = activeGameState.disconnectedPlayers?.size >= 2;

                if (bothDisconnected) {
                  // Both players disconnected and didn't return in time
                  // Both lose - no winner, game ends as double forfeit
                  console.log(`[Disconnect] Both players forfeited match ${matchId} - double forfeit`);

                  gameState.gameOver = true;
                  gameState.winner = null;
                  gameState.winnerId = null;
                  gameState.doubleForfeit = true;
                  gameState.forfeit = true;

                  // For tournament matches, handle both players losing
                  if (gameState.tournamentId && fastify.activeTournaments) {
                    const tournament = fastify.activeTournaments.get(gameState.tournamentId);
                    if (tournament) {
                      // Mark both players as withdrawn
                      tournament.markPlayerWithdrawn(gameState.leftPlayer?.id);
                      tournament.markPlayerWithdrawn(gameState.rightPlayer?.id);
                    }
                  }
                } else {
                  // Only this player forfeited
                  const winner = isLeftPlayer ? "RIGHT" : "LEFT";
                  const winnerId = isLeftPlayer ? gameState.rightPlayer?.id : gameState.leftPlayer?.id;

                  gameState.gameOver = true;
                  gameState.winner = winner;
                  gameState.winnerId = winnerId;
                  gameState.forfeit = true;
                }

                // End the game
                if (fastify.endGame) {
                  fastify.endGame(gameState, fastify).catch(console.error);
                }

                // Clean up timeouts
                activeGameState.leftDisconnectTimeout = null;
                activeGameState.rightDisconnectTimeout = null;
              }, DISCONNECT_GRACE_PERIOD);
            }
            break;
          }
        }

        // Clean up any room memberships ONLY if not in an active game (grace period)
        // If in grace period, we want to keep them in the room so they can resume
        if (!activeGameState) {
          // Additional check: If user is in a tournament and has a pending match (even if game hasn't started yet),
          // DO NOT leave the room. Leaving triggers markPlayerWithdrawn which auto-forfeits them.
          let hasPendingMatch = false;
          // Check if they are part of any pending match in gameStates (even if not started)
          for (const [mid, gs] of fastify.gameStates.entries()) {
            if ((String(gs.leftPlayer?.id) === String(userId) || String(gs.rightPlayer?.id) === String(userId)) && !gs.gameOver) {
              hasPendingMatch = true;
              console.log(`[WS Close] User ${userId} has pending match ${mid}, NOT leaving room/tournament.`);
              break;
            }
          }

          if (!hasPendingMatch) {
            const currentRoomId = fastify.currentRoom.get(userId);
            if (currentRoomId) {
              fastify.leaveRoom(currentRoomId, userId);
            }
          }
        }
      });
    }
  );
}
