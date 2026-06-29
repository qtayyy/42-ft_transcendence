# Game Invite: Complete Flow from Accept to Game Start

This document traces the **complete journey** from Bob accepting an invite → joining lobby → starting the game → actual game runtime.

---

## Overview: 3 Major Phases

### Phase 1: **Bob Accepts Invite** (Chat)
Bob clicks Accept in the invite dialog → Navigates to join lobby

### Phase 2: **Both Players in Lobby** (Waiting Room)
Bob joins room → Both players see lobby → Alice clicks "Start Game"

### Phase 3: **Game Starts** (Runtime)
Backend creates game state → Sends GAME_MATCH_START → Both players navigate to game runtime → Game renders

---

## Phase 1: Bob Accepts Invite

### Step 1: Bob Receives Invite Dialog
**Where:** Frontend chat page
**What Happened:** Alice sent invite → Bob sees dialog: "alice invited you to play pong!"

### Step 2: Bob Clicks "Accept"
**File:** `frontend/components/game-invite-dialog.tsx`
**Component:** GameInviteDialog

```typescript
function respondGame(response: string) {
  // Send response via WebSocket
  sendSocketMessage({
    event: "RESPOND_INVITE",
    payload: {
      response: "accepted",
      roomId: "RS-x7k9mP2",
      hostId: 42,            // Alice
      inviteeId: 99,         // Bob
      inviteeUsername: "bob",
    },
  });

  // Remove invite from queue (closes dialog)
  setInvitesReceived(prev => prev.filter((_, index) => index !== 0));
  setDialogOpen(false);
}
```

### Step 3: Backend Processes Accept
**File:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 102)
**Handler:** `RESPOND_INVITE`

```javascript
RESPOND_INVITE: (payload) => {
  (async () => {
    try {
      // Validate invitee matches user
      if (userId !== payload.inviteeId) {
        return; // Stop - not the invitee
      }

      // Call respondInvite service
      fastify.respondInvite(
        payload.response,     // "accepted"
        payload.roomId,       // "RS-x7k9mP2"
        payload.hostId,       // 42
        payload.inviteeId,    // 99
        payload.inviteeUsername // "bob"
      );
    } catch (err) {
      // Send error event on failure
    }
  })();
},
```

### Step 4: Backend Adds Bob to Room
**File:** `backend/plugins/ws-utils/ws-game.js` (line 299)
**Service:** `fastify.respondInvite()`

```javascript
fastify.decorate("respondInvite", (response, roomId, hostId, inviteeId, username) => {
  const normalizedRoomId = normalizeRemoteRoomId(roomId);           // "RS-x7k9mP2"
  const numericHostId = normalizeRemoteUserId(hostId, "Host ID");   // 42
  const numericInviteeId = normalizeRemoteUserId(inviteeId);        // 99
  const safeUsername = normalizeRemoteUsername(username);           // "bob"

  const room = fastify.gameRooms.get(normalizedRoomId);
  if (!room) throw new Error("Room does not exist");

  if (response === "accepted") {
    // CHECK: Room has space?
    if (room.joinedPlayers.length === room.maxPlayers) {
      throw new Error("Room already full");
    }

    // CHECK: Bob not in another room?
    if (resolveRoomMembership(numericInviteeId)) {
      throw new Error("Already in another game room");
    }

    // ✅ ADD BOB TO ROOM
    fastify.currentRoom.set(numericInviteeId, normalizedRoomId);  // Map Bob → room
    room.joinedPlayers.push({
      id: numericInviteeId,
      username: safeUsername,
    });
    // Room now: { joinedPlayers: [alice, bob], invitedPlayers: [] }

    // SEND: JOIN_ROOM event to Bob
    const inviteeSocket = fastify.onlineUsers.get(numericInviteeId);
    safeSend(
      inviteeSocket,
      {
        event: "JOIN_ROOM",
        payload: {
          roomId: normalizedRoomId,
          success: true,
          isTournament: false,
        },
      },
      numericInviteeId
    );

    // SEND: GAME_ROOM event to Bob (room state)
    safeSend(
      inviteeSocket,
      {
        event: "GAME_ROOM",
        payload: {
          roomId: normalizedRoomId,
          hostId: numericHostId,
          invitedPlayers: [],
          joinedPlayers: [
            { id: 42, username: "alice" },
            { id: 99, username: "bob" }
          ],
          maxPlayers: 2,
          isTournament: false,
        },
      },
      numericInviteeId
    );
  }

  // Remove Bob from invitedPlayers
  room.invitedPlayers = room.invitedPlayers.filter(p => Number(p.id) !== numericInviteeId);

  // SEND: GAME_INVITE_RESPONSE to BOTH players
  const inviteResponsePayload = {
    roomId: normalizedRoomId,
    hostId: numericHostId,
    inviteeId: numericInviteeId,
    inviteeUsername: safeUsername,
    response: "accepted",
  };

  safeSend(inviteeSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, numericInviteeId);

  const hostSocket = fastify.onlineUsers.get(numericHostId);
  safeSend(hostSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, numericHostId);

  // SEND: Updated GAME_ROOM to Alice (room state)
  safeSend(
    hostSocket,
    {
      event: "GAME_ROOM",
      payload: {
        roomId: normalizedRoomId,
        hostId: numericHostId,
        invitedPlayers: [],
        joinedPlayers: [
          { id: 42, username: "alice" },
          { id: 99, username: "bob" }
        ],
        maxPlayers: 2,
      },
    },
    numericHostId
  );
});
```

### Step 5: Frontend Receives JOIN_ROOM
**File:** `frontend/context/socket-context.tsx` (line 328)

```typescript
case "JOIN_ROOM":
  toast.success("Joined room successfully!");
  if (payload?.roomId) {
    const roomId = encodeURIComponent(String(payload.roomId));
    const isTournamentRoom = payload?.isTournament === true;
    const currentPath = window.location.pathname;
    const targetPath = isTournamentRoom
      ? `/game/remote/tournament/join?roomId=${roomId}&invite=true`
      : `/game/remote/single/join?roomId=${roomId}&invite=true`;

    // Navigate Bob to join lobby page
    router.push(targetPath);
  }
  break;
```

### Step 6: Bob Navigates to Join Lobby
**Route:** `/game/remote/single/join?roomId=RS-x7k9mP2&invite=true`

```
When Bob arrives at this URL:
1. Page recognizes "invite=true" parameter
2. Auto-joins using the roomId from URL
3. Polling starts to fetch room updates
```

---

## Phase 2: Both Players in Lobby

### Step 1: Bob Joins Lobby Page
**File:** `frontend/app/(protected)/game/remote/single/join/page.tsx`

```typescript
export default function JoinRoomPage() {
  // Extract roomId from URL param
  const roomIdParam = searchParams.get("roomId");    // "RS-x7k9mP2"
  const isInviteFlow = searchParams.get("invite") === "true";

  // Auto-join from invite flow
  useEffect(() => {
    const shouldAutoJoin = Boolean(roomIdParam) && isInviteFlow;
    
    if (shouldAutoJoin && !hasAttemptedAutoJoin.current) {
      setRoomCode(roomCodeResult.value);
      attemptJoin(roomCodeResult.value);  // Send JOIN_ROOM_BY_CODE
    }
  }, [searchParams, isReady, user]);

  // Send WebSocket message to join
  const attemptJoin = (targetRoomCode) => {
    sendSocketMessage({
      event: "JOIN_ROOM_BY_CODE",
      payload: {
        roomId: "RS-x7k9mP2",
        mode: "single",
        userId: user.id,      // 99 (Bob)
        username: user.username, // "bob"
      },
    });
  };
}
```

### Step 2: Backend Validates Join by Code
**File:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 705)

```javascript
JOIN_ROOM_BY_CODE: (payload) => {
  (async () => {
    try {
      const { roomId, mode } = normalizeJoinRoomByCodePayload(payload);
      const username = await getProfileUsername(prisma, userId);
      
      // Call joinRoomByCode service
      fastify.joinRoomByCode(roomId, userId, username, mode);
    } catch (err) {
      // Send error event
      safeSend(connection, {
        event: "JOIN_ROOM_ERROR",
        payload: { message: err.message },
      }, userId);
    }
  })();
},
```

### Step 3: Backend joinRoomByCode Service
**File:** `backend/plugins/ws-utils/ws-game.js` (line 664)

```javascript
fastify.decorate("joinRoomByCode", (roomIdInput, userId, username, mode) => {
  const roomId = normalizeRemoteRoomId(roomIdInput);        // "RS-x7k9mP2"
  const numericUserId = normalizeRemoteUserId(userId);      // 99
  const safeUsername = normalizeRemoteUsername(username);   // "bob"

  const room = fastify.gameRooms.get(roomId);
  if (!room) throw new Error("Room does not exist");

  // CHECK: User not already in this room
  const existingRoom = fastify.currentRoom.get(numericUserId);
  if (existingRoom === roomId) {
    // Already in room - just send current state
    fastify.sendGameRoom(numericUserId);
    return;
  }

  // CHECK: Room not full
  if (room.joinedPlayers.length >= room.maxPlayers) {
    throw new Error("Room is full");
  }

  // ✅ ADD BOB TO JOINED PLAYERS (again - verification)
  fastify.currentRoom.set(numericUserId, roomId);
  room.joinedPlayers.push({ id: numericUserId, username: safeUsername });

  // SEND: JOIN_ROOM event to Bob
  const userSocket = fastify.onlineUsers.get(numericUserId);
  safeSend(userSocket, {
    event: "JOIN_ROOM",
    payload: {
      roomId: roomId,
      success: true,
      isTournament: false,
    },
  }, numericUserId);

  // SEND: Updated GAME_ROOM to ALL players in room
  const allPlayersInRoom = new Set([
    Number(room.hostId),
    ...room.joinedPlayers.map(p => Number(p.id)),
  ]);

  allPlayersInRoom.forEach(playerId => {
    const socket = fastify.onlineUsers.get(playerId);
    if (socket) {
      safeSend(socket, {
        event: "GAME_ROOM",
        payload: {
          roomId,
          hostId: room.hostId,
          invitedPlayers: room.invitedPlayers,
          joinedPlayers: room.joinedPlayers,
          maxPlayers: room.maxPlayers,
          isTournament: false,
          tournamentStarted: false,
        },
      }, playerId);
    }
  });
});
```

### Step 4: Frontend Shows Lobby UI
**File:** `frontend/app/(protected)/game/remote/single/join/page.tsx` (line ~250)

When `joined && gameRoom` is true:

```typescript
// Show lobby view after joining
if ((joined || isMatchmakingMember) && gameRoom) {
  return (
    <div className="lobby">
      <Card>
        <CardHeader>
          <CardTitle>Game Lobby</CardTitle>
          <div className="room-code">Room: RS-x7k9mP2</div>
        </CardHeader>

        <CardContent>
          {/* Player List */}
          <div className="players">
            <div className="player">
              <Crown className="w-4 h-4" /> {/* Host badge */}
              alice (Host)
              {gameRoom.hostId === user?.id && <span className="badge">You</span>}
            </div>
            <div className="player">
              <User className="w-4 h-4" />
              bob
              {99 === user?.id && <span className="badge">You</span>}
            </div>
          </div>

          {/* Status */}
          <div className="status">
            ✓ Both players ready!
          </div>

          {/* Start Button - Only for Host */}
          {isHost && (
            <Button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Game
            </Button>
          )}

          {/* Or waiting message for non-host */}
          {!isHost && (
            <div className="text-center text-muted-foreground">
              Waiting for host to start...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 5: Polling for Room Updates
Both players poll for room state updates every 2 seconds:

```typescript
// Poll for room updates after joining
useEffect(() => {
  if (!joined || !user || !isReady) return;

  sendSocketMessage({
    event: "GET_GAME_ROOM",
    payload: { userId: user.id },
  });

  const interval = setInterval(() => {
    sendSocketMessage({
      event: "GET_GAME_ROOM",
      payload: { userId: user.id },
    });
  }, 2000);

  return () => clearInterval(interval);
}, [joined, user, isReady, sendSocketMessage]);
```

---

## Phase 3: Alice Starts Game

### Step 1: Alice Clicks "Start Game"
**File:** `frontend/app/(protected)/game/remote/single/create/page.tsx` (line ~225)

```typescript
const handleStartGame = () => {
  console.log('🎮 [Start Match] Button clicked!');

  // Validate conditions
  const roomCodeResult = validateRemoteRoomCode(roomId);
  const playerCountResult = validateRemotePlayerCount(
    gameRoom?.joinedPlayers.length,
    "single"
  );

  if (!gameRoom || !roomCodeResult.ok || !playerCountResult.ok || !isReady) {
    console.error('❌ [Start Match] Cannot start game - conditions not met:', {
      gameRoom: !!gameRoom,
      players: gameRoom?.joinedPlayers.length || 0,
      roomId: roomId,
      socketReady: isReady
    });
    setError('Cannot start game - players not ready');
    return;
  }

  console.log('✅ [Start Match] All conditions met! Sending START_ROOM_GAME event');

  // ✅ SEND START_ROOM_GAME WebSocket event
  sendSocketMessage({
    event: "START_ROOM_GAME",
    payload: { roomId: roomCodeResult.value },  // "RS-x7k9mP2"
  });

  console.log('📤 [Start Match] Event sent successfully');
};
```

### Step 2: Backend Receives START_ROOM_GAME
**File:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 748)

```javascript
START_ROOM_GAME: (payload) => {
  try {
    const { roomId } = normalizeStartRoomGamePayload(payload);  // "RS-x7k9mP2"
    
    // Call startRoomGame service - Alice is the userId (host)
    fastify.startRoomGame(roomId, userId);  // userId = 42 (Alice)
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
```

### Step 3: Backend Creates Game State
**File:** `backend/plugins/ws-utils/game-matches/handlers/start-room-game.js` (line 30)

```javascript
export function createStartRoomGameHandler({
  fastify,
  safeSend,
  serializeGameState,
}) {
  return (roomId, actingUserId) => {
    const normalizedRoomId = normalizeRemoteRoomId(roomId);        // "RS-x7k9mP2"
    const normalizedActorId = normalizeRemoteUserId(actingUserId); // 42

    console.log(`🎮 [START_ROOM_GAME] Starting room: ${normalizedRoomId}`);

    // GET the room
    const room = fastify.gameRooms.get(normalizedRoomId);
    if (!room) throw new Error("Room not found");

    // CHECK: Only host can start game
    if (Number(room.hostId) !== normalizedActorId) {
      throw new Error("Only the room host can start the game");
    }

    // CHECK: Room has enough players
    try {
      assertRemoteRoomCanStartSingle(room);  // Must have 2 players
    } catch (err) {
      if (room.joinedPlayers.length < 2) {
        // Clean up room
        fastify.gameRooms.delete(normalizedRoomId);
      }
      throw err;
    }

    // ✅ CREATE INITIAL GAME STATE
    const player1 = room.joinedPlayers[0];  // alice
    const player2 = room.joinedPlayers[1];  // bob
    const matchId = `RS-${normalizedRoomId}`;  // "RS-RS-x7k9mP2"

    const initialGameState = {
      matchId: matchId,
      roomId: normalizedRoomId,
      isRemote: true,
      
      // Ball starts at center
      ball: {
        posX: CANVAS_WIDTH / 2,
        posY: CANVAS_HEIGHT / 2,
        dx: 4,
        dy: 3,
      },

      // Left player (alice)
      leftPlayer: {
        id: player1.id,
        username: player1.username,
        gamePaused: true,        // ← Game hasn't started yet!
        score: 0,
        paddleX: 0,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },

      // Right player (bob)
      rightPlayer: {
        id: player2.id,
        username: player2.username,
        gamePaused: true,        // ← Game hasn't started yet!
        score: 0,
        paddleX: CANVAS_WIDTH - PADDLE_WIDTH,
        paddleY: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
        paddleHeight: PADDLE_HEIGHT,
        moving: "",
      },

      // Game state
      paused: false,
      pausedAt: null,
      disconnectedPlayer: null,
      disconnectedPlayers: new Set(),
      gameStarted: false,
      gameOver: false,

      // Game constants for rendering
      constant: {
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        paddleSpeed: PADDLE_SPEED,
        ballSize: BALL_SIZE,
        winScore: WIN_SCORE,
        matchDuration: MATCH_DURATION,
      },
    };

    // STORE game state on backend
    fastify.gameStates.set(matchId, initialGameState);

    // ✅ SEND GAME_MATCH_START to BOTH players
    const player1Socket = fastify.onlineUsers.get(player1.id);
    safeSend(
      player1Socket,
      {
        event: "GAME_MATCH_START",
        payload: {
          ...serializeGameState(initialGameState),
          me: "LEFT",  // ← Alice is LEFT player
        },
      },
      player1.id
    );

    const player2Socket = fastify.onlineUsers.get(player2.id);
    safeSend(
      player2Socket,
      {
        event: "GAME_MATCH_START",
        payload: {
          ...serializeGameState(initialGameState),
          me: "RIGHT",  // ← Bob is RIGHT player
        },
      },
      player2.id
    );

    console.log(`Remote game started: ${matchId} with ${player1.username} vs ${player2.username}`);
    return matchId;
  };
}
```

### Step 4: Frontend Receives GAME_MATCH_START
**File:** `frontend/context/socket-context.tsx` (line 486)

```typescript
case "GAME_MATCH_START":
  console.log("🎮 Received GAME_MATCH_START:", payload);

  // Store game state in context
  stableDeps.current.setGameState(payload);
  
  // Normalize for rendering
  stableDeps.current.setRemoteRenderGameState(
    normalizeRemoteGameState(payload, null)
  );

  // Show notification
  window.dispatchEvent(
    new CustomEvent("gameNotification", {
      detail: {
        event: "GAME_MATCH_START",
        message: "Game started. Good luck!",
        matchId: payload?.matchId,
      },
    })
  );

  // ✅ NAVIGATE TO GAME PAGE
  if (payload.matchId) {
    console.log(`📍 Navigating to: /game/${payload.matchId}`);
    stableDeps.current.router.push(`/game/${payload.matchId}`);
  }
  break;
```

---

## Phase 4: Game Renders

### Step 1: Navigate to Game Page
**Route:** `/game/RS-RS-x7k9mP2`

Both Alice and Bob navigate to this route.

### Step 2: Game Runtime Page Loads
**File:** `frontend/app/(protected)/game/[matchId]/page.tsx`

```typescript
"use client";

import GameRuntimePage from "@/features/game/runtime/game-runtime-page";

export default function GamePageRoute() {
  return <GameRuntimePage />;
}
```

### Step 3: Game Runtime Component Initializes
**File:** `frontend/features/game/runtime/game-runtime-page.tsx`

```typescript
export default function GameRuntimePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { sendSocketMessage, isReady } = useSocket();
  const { gameState, setGameState } = useGame();
  
  const matchId = params.matchId as string;  // "RS-RS-x7k9mP2"

  // Determine if remote game
  const isRemoteGame = matchId.startsWith("RS-") || matchId.startsWith("RT-");

  // Check if game is started (both players not paused)
  const gameStart =
    !!gameState &&
    !gameState.leftPlayer?.gamePaused &&
    !gameState.rightPlayer?.gamePaused;

  return (
    <div className="game-runtime">
      {isRemoteGame ? (
        <RemoteGameRuntimeView gameState={gameState} />
      ) : (
        <LocalGameRuntimeView gameState={gameState} />
      )}
    </div>
  );
}
```

### Step 4: Render Game View
**File:** `frontend/features/game/runtime/remote-game-runtime-view.tsx`

Renders:
- **Canvas** - Pong game board
- **Ball** - Moving ball (from gameState.ball)
- **Paddles** - Left and right paddles
- **Scores** - Points for each player
- **Disconnect handling** - If a player disconnects
- **Pause handling** - If game is paused
- **Game over** - When someone reaches WIN_SCORE

### Step 5: Game Input Handling
Players use keyboard to control paddles:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      setMovingUp(true);
      sendSocketMessage({
        event: "GAME_INPUT",
        payload: {
          matchId: matchId,
          direction: "UP",
        },
      });
    } else if (e.key === "ArrowDown") {
      setMovingDown(true);
      sendSocketMessage({
        event: "GAME_INPUT",
        payload: {
          matchId: matchId,
          direction: "DOWN",
        },
      });
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [matchId, sendSocketMessage]);
```

### Step 6: Backend Receives Game Input
**File:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js`

```javascript
GAME_INPUT: (payload) => {
  const { matchId, direction } = payload;
  
  const gameState = fastify.gameStates.get(matchId);
  if (!gameState) return;

  // Update player paddle position
  if (gameState.leftPlayer.id === userId) {
    gameState.leftPlayer.moving = direction;  // "UP" or "DOWN" or ""
  } else if (gameState.rightPlayer.id === userId) {
    gameState.rightPlayer.moving = direction;
  }

  // Backend updates ball position every frame
  // Sends updated gameState to both players
},
```

### Step 7: Game Loop (Backend)
The backend runs a game loop that:
1. Updates ball position based on velocity
2. Updates paddle positions based on moving direction
3. Detects collisions (paddle hits, wall bounces)
4. Updates scores
5. Broadcasts updated game state to both players

### Step 8: Game Over
When a player reaches WIN_SCORE:

```javascript
if (gameState.leftPlayer.score >= WIN_SCORE) {
  gameState.gameOver = true;
  gameState.winner = gameState.leftPlayer.id;
  
  // Send GAME_OVER event to both players
  safeSend(player1Socket, {
    event: "GAME_OVER",
    payload: {
      matchId,
      winner: gameState.leftPlayer.username,
      finalScore: `${gameState.leftPlayer.score}-${gameState.rightPlayer.score}`,
    },
  }, player1.id);
}
```

---

## Complete Timeline

```
T=0:00   Alice opens chat with Bob
T=0:05   Alice clicks "Invite to Game"
         → Backend creates room "RS-x7k9mP2"
         → Alice auto-joins as host
T=0:06   Bob receives invite dialog
T=0:10   Bob clicks "Accept"
         → Backend adds Bob to joinedPlayers
         → Bob receives JOIN_ROOM event
T=0:11   Bob navigates to /game/remote/single/join?roomId=RS-x7k9mP2&invite=true
         → Bob auto-joins room
         → Lobby shows both players
T=0:12   Alice sees "bob joined!" status updates
T=0:15   Alice clicks "Start Game"
         → Backend creates game state
         → Sends GAME_MATCH_START to both
T=0:16   Both players receive GAME_MATCH_START event
         → Both navigate to /game/RS-RS-x7k9mP2
T=0:17   Game runtime page loads
         → Canvas renders
         → Both paddles visible
         → Ball at center
         → Game starts rendering
T=0:18   Alice presses arrow keys
         → Sends GAME_INPUT to backend
T=0:19   Backend updates game state
         → Ball moves
         → Paddle moves
         → State sent to both players
T=0:20   Rendering loop updates canvas
         → Players see ball and paddles move
T=~5:00  One player reaches 11 points
         → GAME_OVER event sent
         → Match finishes
         → Results page shown
```

---

## Key Code Files

| Component | File | Purpose |
|-----------|------|---------|
| **Join Lobby** | `frontend/app/(protected)/game/remote/single/join/page.tsx` | Bob joins room, waits for Alice |
| **Create Lobby** | `frontend/app/(protected)/game/remote/single/create/page.tsx` | Alice waits, clicks "Start Game" |
| **Game Start** | `backend/plugins/ws-utils/game-matches/handlers/start-room-game.js` | Creates initial game state |
| **Game Runtime** | `frontend/features/game/runtime/game-runtime-page.tsx` | Main game component |
| **Game View** | `frontend/features/game/runtime/remote-game-runtime-view.tsx` | Renders canvas, paddles, ball |
| **Socket Context** | `frontend/context/socket-context.tsx` | Handles GAME_MATCH_START event |
| **Message Handlers** | `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` | Handles START_ROOM_GAME, GAME_INPUT |
| **Game State** | `backend/plugins/ws-utils/ws-game.js` | Manages rooms and game state |

---

## WebSocket Events Summary

| Event | Direction | Purpose |
|-------|-----------|---------|
| **RESPOND_INVITE** | Frontend → Backend | Bob accepts invite |
| **JOIN_ROOM_BY_CODE** | Frontend → Backend | Bob joins lobby |
| **GET_GAME_ROOM** | Frontend → Backend | Poll for room updates |
| **START_ROOM_GAME** | Frontend → Backend | Alice clicks "Start Game" |
| **GAME_MATCH_START** | Backend → Frontend | Game begins, navigate to runtime |
| **GAME_INPUT** | Frontend → Backend | Player moves paddle |
| **GAME_TICK** | Backend → Frontend | Updated game state each frame |
| **GAME_OVER** | Backend → Frontend | Someone won |

---

## Summary

The complete flow from accepting an invite to playing the game involves:

1. **Accept** - Bob clicks accept in dialog
2. **Join** - Bob joins lobby room
3. **Wait** - Both see each other in lobby
4. **Start** - Alice clicks "Start Game"
5. **Create** - Backend creates game state and matchId
6. **Notify** - Both get GAME_MATCH_START event
7. **Navigate** - Both go to `/game/RS-x7k9mP2`
8. **Render** - Game canvas and paddles display
9. **Play** - Real-time input/output loop
10. **End** - Someone reaches WIN_SCORE

**Total time from click to playable game:** ~5-10 seconds!
