import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import { activeTournaments } from "../game/TournamentManager.js";

export default fp(async (fastify) => {
  fastify.register(websocket);

  // userId: socket
  const onlineUsers = new Map();

  // hostId: GameRoom object
  const gameRooms = new Map();

  // Track which room each user is currently in
  //    userId: roomId
  const currentRoom = new Map();

  // matchId: gameState
  const gameStates = new Map();

  fastify.decorate("onlineUsers", onlineUsers);
  fastify.decorate("gameRooms", gameRooms);
  fastify.decorate("currentRoom", currentRoom);
  fastify.decorate("gameStates", gameStates);

  // Shared active tournaments map
  fastify.decorate("activeTournaments", activeTournaments);
});
