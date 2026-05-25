import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";

import wsGamePlugin from "../plugins/ws-utils/ws-game.js";

function createSocket() {
  const messages = [];
  return {
    readyState: 1,
    messages,
    send(rawMessage) {
      messages.push(JSON.parse(rawMessage));
    },
  };
}

async function createHarness() {
  const fastify = Fastify({ logger: false });

  fastify.decorate("onlineUsers", new Map());
  fastify.decorate("gameRooms", new Map());
  fastify.decorate("currentRoom", new Map());
  fastify.decorate("gameStates", new Map());
  fastify.decorate("activeTournaments", new Map());

  await fastify.register(wsGamePlugin);
  await fastify.ready();

  return fastify;
}

test("single public matchmaking creates a room when no vacant room exists", async () => {
  const fastify = await createHarness();
  const hostSocket = createSocket();
  fastify.onlineUsers.set(1, new Set([hostSocket]));

  fastify.joinMatchmaking(1, "Host", "single");

  assert.equal(fastify.gameRooms.size, 1);
  const [roomId, room] = [...fastify.gameRooms.entries()][0];
  assert.equal(fastify.currentRoom.get(1), roomId);
  assert.equal(room.hostId, 1);
  assert.equal(room.isMatchmade, true);
  assert.equal(room.isPublic, true);
  assert.deepEqual(
    hostSocket.messages.map((message) => message.event),
    ["GAME_ROOM", "MATCHMAKING_HOST"],
  );
  assert.equal(hostSocket.messages[1].payload.roomId, roomId);

  await fastify.close();
});

test("single public matchmaking joins a vacant online room", async () => {
  const fastify = await createHarness();
  const hostSocket = createSocket();
  const guestSocket = createSocket();
  fastify.onlineUsers.set(1, new Set([hostSocket]));
  fastify.onlineUsers.set(2, new Set([guestSocket]));

  fastify.joinMatchmaking(1, "Host", "single");
  hostSocket.messages.length = 0;

  fastify.joinMatchmaking(2, "Guest", "single");

  const [roomId, room] = [...fastify.gameRooms.entries()][0];
  assert.equal(fastify.gameRooms.size, 1);
  assert.equal(fastify.currentRoom.get(2), roomId);
  assert.deepEqual(
    room.joinedPlayers.map((player) => player.id),
    [1, 2],
  );
  assert.deepEqual(
    guestSocket.messages.map((message) => message.event),
    ["GAME_ROOM", "MATCH_FOUND"],
  );
  assert.equal(guestSocket.messages[1].payload.hostId, 1);
  assert.deepEqual(
    hostSocket.messages.map((message) => message.event),
    ["GAME_ROOM", "MATCH_FOUND"],
  );

  await fastify.close();
});

test("single public matchmaking removes orphaned vacant rooms before matching", async () => {
  const fastify = await createHarness();
  const playerSocket = createSocket();
  fastify.onlineUsers.set(1, new Set([playerSocket]));

  const staleRoomId = "550e8400-e29b-41d4-a716-446655440000";
  fastify.currentRoom.set(9, staleRoomId);
  fastify.gameRooms.set(staleRoomId, {
    hostId: 9,
    invitedPlayers: [],
    joinedPlayers: [{ id: 9, username: "Offline Host" }],
    maxPlayers: 2,
    isMatchmade: true,
    isPublic: true,
    isTournament: false,
    tournamentStarted: false,
  });

  fastify.joinMatchmaking(1, "Player", "single");

  assert.equal(fastify.gameRooms.has(staleRoomId), false);
  assert.equal(fastify.currentRoom.has(9), false);
  assert.equal(fastify.gameRooms.size, 1);
  const [newRoomId, newRoom] = [...fastify.gameRooms.entries()][0];
  assert.notEqual(newRoomId, staleRoomId);
  assert.equal(newRoom.hostId, 1);
  assert.equal(fastify.currentRoom.get(1), newRoomId);
  assert.deepEqual(
    playerSocket.messages.map((message) => message.event),
    ["GAME_ROOM", "MATCHMAKING_HOST"],
  );

  await fastify.close();
});

test("room code join accepts private rooms", async () => {
  const fastify = await createHarness();
  const hostSocket = createSocket();
  const guestSocket = createSocket();
  const roomId = "550e8400-e29b-41d4-a716-446655440000";

  fastify.onlineUsers.set(1, new Set([hostSocket]));
  fastify.onlineUsers.set(2, new Set([guestSocket]));
  fastify.currentRoom.set(1, roomId);
  fastify.gameRooms.set(roomId, {
    hostId: 1,
    invitedPlayers: [],
    joinedPlayers: [{ id: 1, username: "Host" }],
    maxPlayers: 2,
    isMatchmade: false,
    isPublic: false,
    isTournament: false,
    tournamentStarted: false,
  });

  fastify.joinRoomByCode(roomId, 2, "Guest", "single");

  const room = fastify.gameRooms.get(roomId);
  assert.deepEqual(
    room.joinedPlayers.map((player) => player.id),
    [1, 2],
  );
  assert.equal(fastify.currentRoom.get(2), roomId);
  assert.deepEqual(
    guestSocket.messages.map((message) => message.event),
    ["JOIN_ROOM", "GAME_ROOM"],
  );

  await fastify.close();
});

test("accepted private invite confirms joined room type to invitee", async () => {
  const fastify = await createHarness();
  const hostSocket = createSocket();
  const guestSocket = createSocket();
  const roomId = "550e8400-e29b-41d4-a716-446655440000";

  fastify.onlineUsers.set(1, new Set([hostSocket]));
  fastify.onlineUsers.set(2, new Set([guestSocket]));
  fastify.currentRoom.set(1, roomId);
  fastify.gameRooms.set(roomId, {
    hostId: 1,
    invitedPlayers: [{ id: 2, username: "Guest" }],
    joinedPlayers: [{ id: 1, username: "Host" }],
    maxPlayers: 2,
    isMatchmade: false,
    isPublic: false,
    isTournament: false,
    tournamentStarted: false,
  });

  fastify.respondInvite("accepted", roomId, 1, 2, "Guest");

  const joinMessage = guestSocket.messages.find(
    (message) => message.event === "JOIN_ROOM",
  );
  assert.deepEqual(joinMessage?.payload, {
    roomId,
    success: true,
    isTournament: false,
  });
  assert.equal(fastify.currentRoom.get(2), roomId);

  await fastify.close();
});

test("room code join rejects public matchmaking rooms", async () => {
  const fastify = await createHarness();
  const guestSocket = createSocket();
  const roomId = "550e8400-e29b-41d4-a716-446655440000";

  fastify.onlineUsers.set(2, new Set([guestSocket]));
  fastify.gameRooms.set(roomId, {
    hostId: 1,
    invitedPlayers: [],
    joinedPlayers: [{ id: 1, username: "Host" }],
    maxPlayers: 2,
    isMatchmade: true,
    isPublic: true,
    isTournament: false,
    tournamentStarted: false,
  });

  assert.throws(
    () => fastify.joinRoomByCode(roomId, 2, "Guest", "single"),
    /only available for private rooms/,
  );
  assert.equal(fastify.currentRoom.has(2), false);

  await fastify.close();
});

test("room code join rejects public tournament matchmaking rooms", async () => {
  const fastify = await createHarness();
  const guestSocket = createSocket();
  const roomId = "650e8400-e29b-41d4-a716-446655440001";

  fastify.onlineUsers.set(2, new Set([guestSocket]));
  fastify.gameRooms.set(roomId, {
    hostId: 1,
    invitedPlayers: [],
    joinedPlayers: [
      { id: 1, username: "Host" },
      { id: 3, username: "Player Three" },
      { id: 4, username: "Player Four" },
    ],
    maxPlayers: 8,
    isMatchmade: true,
    isPublic: true,
    isTournament: true,
    tournamentStarted: false,
  });

  assert.throws(
    () => fastify.joinRoomByCode(roomId, 2, "Guest", "tournament"),
    /only available for private rooms/,
  );
  assert.equal(fastify.currentRoom.has(2), false);

  await fastify.close();
});

test("single room code join rejects private tournament rooms", async () => {
  const fastify = await createHarness();
  const guestSocket = createSocket();
  const roomId = "650e8400-e29b-41d4-a716-446655440001";

  fastify.onlineUsers.set(2, new Set([guestSocket]));
  fastify.gameRooms.set(roomId, {
    hostId: 1,
    invitedPlayers: [],
    joinedPlayers: [
      { id: 1, username: "Host" },
      { id: 3, username: "Player Three" },
      { id: 4, username: "Player Four" },
    ],
    maxPlayers: 8,
    isMatchmade: false,
    isPublic: false,
    isTournament: true,
    tournamentStarted: false,
  });

  assert.throws(
    () => fastify.joinRoomByCode(roomId, 2, "Guest", "single"),
    /Single join can only join single rooms/,
  );
  assert.equal(fastify.currentRoom.has(2), false);

  await fastify.close();
});

test("tournament room code join rejects private single rooms", async () => {
  const fastify = await createHarness();
  const guestSocket = createSocket();
  const roomId = "550e8400-e29b-41d4-a716-446655440000";

  fastify.onlineUsers.set(2, new Set([guestSocket]));
  fastify.gameRooms.set(roomId, {
    hostId: 1,
    invitedPlayers: [],
    joinedPlayers: [{ id: 1, username: "Host" }],
    maxPlayers: 2,
    isMatchmade: false,
    isPublic: false,
    isTournament: false,
    tournamentStarted: false,
  });

  assert.throws(
    () => fastify.joinRoomByCode(roomId, 2, "Guest", "tournament"),
    /Tournament join can only join tournament rooms/,
  );
  assert.equal(fastify.currentRoom.has(2), false);

  await fastify.close();
});
