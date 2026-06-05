# Game Invite Flow Architecture (From Chat)

## Table of Contents
1. [Overview](#overview)
3. [System Architecture](#system-architecture)
4. [Complete Invite Flow: Step-by-Step](#complete-invite-flow-step-by-step)
5. [How Accepting Invite Works](#how-accepting-invite-works)
6. [How Declining Invite Works](#how-declining-invite-works)
7. [How Canceling Invite Works](#how-canceling-invite-works)
8. [Real-time WebSocket Events](#real-time-websocket-events)
9. [UI Components](#ui-components)
10. [Key Components](#key-components)
11. [Complete Code Examples](#complete-code-examples)

---

## Overview

The game invite system allows users to invite friends to play Pong directly from the chat interface. The flow includes:

- **Send Invite** - Host clicks "Invite to Game" button in chat
- **Receive Invite** - Friend receives real-time notification
- **Accept/Decline** - Friend responds via dialog or chat message
- **Join Game** - Both players automatically navigate to game lobby
- **Cancel Invite** - Host can cancel pending invite
- **Real-time Updates** - All actions reflected immediately in chat

The system uses:
- **REST API** to create game room
- **WebSocket** for real-time invite delivery and responses
- **React Context** for invite state management
- **Chat Integration** for seamless in-chat invite flow
- **Database** to persist invite messages in chat history

**Key Principle:** Game invites are real-time and immediate. When a user sends an invite, the recipient sees it instantly (if online). All actions (accept/decline/cancel) are broadcast immediately to both parties.

---

**How User IDs Work:**
- User registers → Database assigns ID (e.g., Alice = 42)
- User logs in → JWT token contains their ID
- All WebSocket messages include user ID

**How Room IDs Work:**
- Host creates room → Server generates unique ID: `"RS-" + shortid`
- Example: `"RS-x7k9mP2"` (random, unique)
- Room ID used to track game lobby and match players

**Example:**
```javascript
// Alice (ID: 42) invites Bob (ID: 99)
// 1. Alice clicks "Invite to Game"
// 2. Frontend calls: POST /api/game/room/create
// 3. Backend returns: { roomId: "RS-x7k9mP2" }
// 4. Frontend sends WebSocket: SEND_GAME_INVITE
//    payload: { roomId: "RS-x7k9mP2", hostId: 42, friendId: 99 }
// 5. Backend sends to Bob: GAME_INVITE
//    payload: { roomId: "RS-x7k9mP2", hostId: 42, hostUsername: "alice" }
// 6. Bob sees dialog: "alice invited you to play pong!"
```

---

## System Architecture

### Frontend Components:

1. **Chat Page** (`frontend/app/(protected)/chat/page.tsx`)
   - Displays "Invite to Game" button in friend chat header
   - Shows game invite messages in chat thread
   - Displays Accept/Decline buttons for incoming invites
   - Handles sending invites, responding, and canceling

2. **Game Invite Dialog** (`frontend/components/game-invite-dialog.tsx`)
   - Global modal that pops up when invite received
   - Shows host's username: "X invited you to play pong!"
   - Accept or Decline buttons
   - Sends RESPOND_INVITE WebSocket event

3. **Socket Context** (`frontend/context/socket-context.tsx`)
   - Receives WebSocket events: GAME_INVITE, GAME_INVITE_RESPONSE, etc.
   - Dispatches CustomEvents to notify components
   - Shows toast notifications for invites
   - Manages invitesReceived array in game context

4. **Game Context** (`frontend/context/game-context.tsx`)
   - Stores invitesReceived array (pending invites)
   - Provides setInvitesReceived to add/remove invites
   - Tracks activeInvite (current pending invite sent by user)

### Backend Components:

5. **WebSocket Message Handlers** (`backend/plugins/ws-utils/ws-events/handlers/message-handlers.js`)
   - Handles: SEND_GAME_INVITE, RESPOND_INVITE, CANCEL_GAME_INVITE
   - Validates user authorization (host = inviter, invitee = recipient)
   - Calls backend game invite services

6. **Game Room Service** (`backend/plugins/ws-utils/ws-game.js`)
   - `sendGameInvite()` - Creates room invite, notifies invitee
   - `respondInvite()` - Handles accept/decline responses
   - `cancelGameInvite()` - Removes pending invite
   - Manages gameRooms Map (active game lobbies)
   - Tracks invitedPlayers and joinedPlayers per room

7. **Database (SQLite)**
   - Saves invite as Message record in database
   - Persists chat history so invite survives page reload
   - Content: "{hostUsername} invited you to join private room {roomId}"

---

## Complete Invite Flow: Step-by-Step

### Scenario: Alice Invites Bob to Play

**Step 1: Alice Opens Chat with Bob**
- Alice navigates to `/chat`
- Selects Bob from friends list
- Chat opens with Bob
- "Invite to Game" button appears in chat header

**Step 2: Alice Clicks "Invite to Game"**
- File: `frontend/app/(protected)/chat/page.tsx` (line ~859)
- Function: `handleGameInvite()`
- Validation checks:
  ```typescript
  // Check if Bob is online
  const isFriendOnline = onlineFriends.some(f => f.id === bob.id);
  if (!isFriendOnline) {
    toast.error("Cannot invite an offline friend.");
    return; // STOP - Bob must be online
  }

  // Check if Alice already has a pending invite
  if (activeInvite) {
    toast.error("You already have a pending invitation.");
    return; // STOP - One invite at a time
  }
  ```

**Step 3: Frontend Creates Game Room**
- Frontend calls: `POST /api/game/room/create?maxPlayers=2`
- Backend creates new game room:
  ```javascript
  const roomId = "RS-" + shortid(); // "RS-x7k9mP2"
  gameRooms.set(roomId, {
    roomId: "RS-x7k9mP2",
    hostId: 42,              // Alice
    invitedPlayers: [],
    joinedPlayers: [
      { id: 42, username: "alice" } // Host auto-joins
    ],
    maxPlayers: 2,
    isTournament: false,
  });
  currentRoom.set(42, "RS-x7k9mP2"); // Map Alice to room
  ```
- Backend returns: `{ roomId: "RS-x7k9mP2" }`

**Step 4: Frontend Sends WebSocket Invite**
- Frontend sends WebSocket message:
  ```typescript
  sendSocketMessage({
    event: "SEND_GAME_INVITE",
    payload: {
      roomId: "RS-x7k9mP2",
      hostId: 42,              // Alice
      hostUsername: "alice",
      friendId: 99,            // Bob
      friendUsername: "bob",
    },
  });
  ```

**Step 5: Backend Validates Invite**
- File: `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 41)
- Handler: `SEND_GAME_INVITE`
- Validations:
  ```javascript
  // Verify Alice is the host
  if (userId !== payload.hostId) {
    console.warn("SEND_GAME_INVITE rejected: user not host");
    return; // STOP
  }

  // Verify Alice is the room host
  if (!isRoomHost(fastify, payload.roomId, userId)) {
    console.warn("SEND_GAME_INVITE rejected: not room host");
    return; // STOP
  }

  // Get usernames from database
  const hostUsername = await getProfileUsername(prisma, 42);     // "alice"
  const friendUsername = await getProfileUsername(prisma, 99);   // "bob"
  ```

**Step 6: Backend Sends Invite to Bob**
- Service: `fastify.sendGameInvite()` in `backend/plugins/ws-utils/ws-game.js` (line 175)
- Validations:
  ```javascript
  // Check if Bob is already in another room
  const inviteeInRoom = resolveRoomMembership(99);
  if (inviteeInRoom) {
    throw new Error("Player already in another room");
  }

  // Check if Bob is online (has WebSocket connection)
  const inviteeSocket = fastify.onlineUsers.get(99);
  if (!inviteeSocket || inviteeSocket.size === 0) {
    // Bob is offline - clean up room
    fastify.currentRoom.delete(42);
    fastify.gameRooms.delete("RS-x7k9mP2");
    throw new Error("Friend is not online");
  }

  // Check if Bob was already invited
  const alreadyInvited = room.invitedPlayers.some(p => p.id === 99);
  if (alreadyInvited) {
    // Send GAME_INVITE_PENDING to Alice (already invited)
    return;
  }
  ```

**Step 7: Backend Updates Room State**
- Add Bob to invitedPlayers:
  ```javascript
  room.invitedPlayers.push({
    id: 99,
    username: "bob",
  });
  // Room now has: { invitedPlayers: [{ id: 99, username: "bob" }] }
  ```

**Step 8: Backend Sends WebSocket to Bob**
- Send GAME_INVITE event:
  ```javascript
  safeSend(
    inviteeSocket,
    {
      event: "GAME_INVITE",
      payload: {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        hostUsername: "alice",
      },
    },
    99 // Bob's user ID
  );
  ```

**Step 9: Backend Persists Invite in Database**
- Save as Message record:
  ```javascript
  prisma.message.create({
    data: {
      senderId: 42,        // Alice
      recipientId: 99,     // Bob
      content: "alice invited you to join private room RS-x7k9mP2",
    },
  });
  ```
- This ensures invite persists in chat history

**Step 10: Backend Updates Alice's Room**
- Send GAME_ROOM event to Alice:
  ```javascript
  safeSend(
    hostSocket,
    {
      event: "GAME_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        invitedPlayers: [{ id: 99, username: "bob" }],
        joinedPlayers: [{ id: 42, username: "alice" }],
        maxPlayers: 2,
        isTournament: false,
      },
    },
    42 // Alice's user ID
  );
  ```

**Step 11: Frontend (Alice) Updates Chat**
- Add message to chat thread:
  ```typescript
  setMessages(prev => [
    ...prev,
    {
      username: "alice",
      senderId: 42,
      message: "You invited bob to room RS-x7k9mP2",
      timestamp: new Date().toISOString(),
      type: "game-invite-sent",
      meta: {
        inviteType: "room",
        roomId: "RS-x7k9mP2",
        hostId: 42,
      },
    },
  ]);
  ```
- Set activeInvite:
  ```typescript
  setActiveInvite({
    roomId: "RS-x7k9mP2",
    inviteeId: "99", // Bob
  });
  ```
- Navigate to game lobby:
  ```typescript
  router.push("/game/remote/single/create?roomId=RS-x7k9mP2&fromChatInvite=true");
  ```

**Step 12: Frontend (Bob) Receives Invite**
- File: `frontend/context/socket-context.tsx` (line 295)
- Socket receives GAME_INVITE event:
  ```typescript
  case "GAME_INVITE":
    // Add to invitesReceived array
    setInvitesReceived(prev => [
      ...prev,
      {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        hostUsername: "alice",
      },
    ]);

    // Show toast notification
    toast.info("alice invited you to a room");

    // Trigger GameInviteDialog to open
    window.dispatchEvent(
      new CustomEvent("gameInvite", {
        detail: {
          roomId: "RS-x7k9mP2",
          hostId: 42,
          hostUsername: "alice",
        },
      })
    );
  ```

**Step 13: Frontend (Bob) Shows Dialog**
- File: `frontend/components/game-invite-dialog.tsx`
- Dialog opens automatically:
  ```typescript
  useEffect(() => {
    if (invitesReceived.length > 0) {
      setDialogOpen(true); // Open dialog
    }
  }, [invitesReceived]);
  ```


**Step 14: Frontend (Bob) Updates Chat**
- If Bob has chat with Alice open:
  ```typescript
  // Add invite message to chat thread
  setMessages(prev => [
    ...prev,
    {
      username: "alice",
      senderId: 42,
      message: "alice invited you to join a private game room",
      timestamp: new Date().toISOString(),
      type: "game-invite",
      meta: {
        inviteType: "room",
        roomId: "RS-x7k9mP2",
        hostId: 42,
        inviteStatus: "pending",
      },
    },
  ]);
  ```
- Message shows with Accept/Decline buttons in chat

**Step 15: Invite Waiting State**
- Alice waits in game lobby (`/game/remote/single/create`)
- Lobby shows: "Waiting for bob to join..."
- Room state: `{ invitedPlayers: [bob], joinedPlayers: [alice] }`
- Bob has dialog open + invite message in chat
- Bob can respond via dialog OR chat buttons

---

## How Accepting Invite Works

### Complete Step-by-Step Flow (Bob Accepts):

**Step 1: Bob Clicks "Accept"**
- Bob clicks Accept button in GameInviteDialog OR in chat message
- Function called: `respondGame("accepted")` or `handleRespondInviteFromChat(msg, "accepted")`

**Step 2: Frontend Sends WebSocket Response**
- Frontend sends:
  ```typescript
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
  ```

**Step 3: Frontend Navigates Bob to Lobby**
- Close dialog:
  ```typescript
  setDialogOpen(false);
  ```
- Remove invite from list:
  ```typescript
  setInvitesReceived(prev => prev.filter(inv => inv.roomId !== "RS-x7k9mP2"));
  ```
- Navigate to game lobby:
  ```typescript
  router.push("/game/remote/single/join?roomId=RS-x7k9mP2&invite=true");
  ```

**Step 4: Backend Receives Response**
- File: `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 102)
- Handler: `RESPOND_INVITE`
- Validates Bob is the invitee:
  ```javascript
  if (userId !== payload.inviteeId) {
    console.warn("RESPOND_INVITE rejected: user not invitee");
    return; // STOP
  }
  ```

**Step 5: Backend Processes Accept**
- Service: `fastify.respondInvite()` in `backend/plugins/ws-utils/ws-game.js` (line 299)
- Validations:
  ```javascript
  const room = gameRooms.get("RS-x7k9mP2");
  if (!room) throw new Error("Room does not exist");

  // Verify Bob was invited
  if (!room.invitedPlayers.some(p => p.id === 99)) {
    throw new Error("Player not invited to this room");
  }

  // Check if room is full
  if (room.joinedPlayers.length === room.maxPlayers) {
    // Remove Bob from invitedPlayers
    room.invitedPlayers = room.invitedPlayers.filter(p => p.id !== 99);
    throw new Error("Room already full");
  }

  // Check if Bob is already in another room
  if (resolveRoomMembership(99)) {
    throw new Error("Already in another game room");
  }
  ```

**Step 6: Backend Updates Room State**
- Add Bob to room:
  ```javascript
  currentRoom.set(99, "RS-x7k9mP2"); // Map Bob to room
  room.joinedPlayers.push({
    id: 99,
    username: "bob",
  });
  ```
- Remove Bob from invitedPlayers:
  ```javascript
  room.invitedPlayers = room.invitedPlayers.filter(p => p.id !== 99);
  ```
- Room state now:
  ```javascript
  {
    roomId: "RS-x7k9mP2",
    hostId: 42,
    invitedPlayers: [],           // Empty - Bob accepted
    joinedPlayers: [
      { id: 42, username: "alice" },
      { id: 99, username: "bob" }  // Bob joined!
    ],
    maxPlayers: 2,
  }
  ```

**Step 7: Backend Sends JOIN_ROOM to Bob**
- Confirm Bob joined successfully:
  ```javascript
  safeSend(
    inviteeSocket,
    {
      event: "JOIN_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        success: true,
        isTournament: false,
      },
    },
    99
  );
  ```

**Step 8: Backend Sends GAME_ROOM to Bob**
- Send updated room state:
  ```javascript
  safeSend(
    inviteeSocket,
    {
      event: "GAME_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        invitedPlayers: [],
        joinedPlayers: [
          { id: 42, username: "alice" },
          { id: 99, username: "bob" }
        ],
        maxPlayers: 2,
      },
    },
    99
  );
  ```

**Step 9: Backend Sends GAME_INVITE_RESPONSE to Both**
- Notify both Alice and Bob of response:
  ```javascript
  const inviteResponsePayload = {
    roomId: "RS-x7k9mP2",
    hostId: 42,
    inviteeId: 99,
    inviteeUsername: "bob",
    response: "accepted",
  };

  // Send to Bob (invitee)
  safeSend(inviteeSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, 99);

  // Send to Alice (host)
  safeSend(hostSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, 42);
  ```

**Step 10: Backend Sends GAME_ROOM to Alice**
- Update Alice's room state:
  ```javascript
  safeSend(
    hostSocket,
    {
      event: "GAME_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        invitedPlayers: [],           // Bob no longer pending
        joinedPlayers: [
          { id: 42, username: "alice" },
          { id: 99, username: "bob" } // Bob joined!
        ],
        maxPlayers: 2,
      },
    },
    42
  );
  ```

**Step 11: Frontend (Alice) Updates Lobby**
- Alice's lobby page receives GAME_ROOM event
- Updates room state in React:
  ```typescript
  setGameRoom({
    roomId: "RS-x7k9mP2",
    hostId: 42,
    invitedPlayers: [],
    joinedPlayers: [
      { id: 42, username: "alice" },
      { id: 99, username: "bob" }
    ],
    maxPlayers: 2,
  });
  ```
- UI changes:
  - "Waiting for bob..." → "bob joined!" (green checkmark)
  - "Start Game" button becomes enabled
  - Shows both players in lobby

**Step 12: Frontend (Alice) Updates Chat**
- Socket context receives GAME_INVITE_RESPONSE
- Dispatches CustomEvent: `gameInviteResponse`
- Chat page listens for event:
  ```typescript
  const handleGameInviteResponse = (event: CustomEvent) => {
    const data = event.detail;
    if (data.response === "accepted") {
      // Update chat message to show accepted status
      setMessages(prev =>
        prev.map(msg =>
          msg.type === "game-invite-sent" && msg.meta?.roomId === data.roomId
            ? {
                ...msg,
                meta: { ...msg.meta, inviteStatus: "accepted" }
              }
            : msg
        )
      );
      // Clear activeInvite
      setActiveInvite(null);
    }
  };
  ```

**Step 13: Frontend (Bob) Joins Lobby**
- Bob's page receives JOIN_ROOM event
- Toast appears: "Joined room successfully!"
- Router navigates to: `/game/remote/single/join?roomId=RS-x7k9mP2&invite=true`
- Lobby page loads
- Receives GAME_ROOM event
- Shows both players (Alice as host, Bob as player)

**Step 14: Both Players Ready**
- Alice and Bob are now in the same lobby
- Both see: "alice" and "bob" in player list
- Alice (host) can click "Start Game" button
- When started, both navigate to game runtime page
- Game begins!

---

## How Declining Invite Works

### Complete Step-by-Step Flow (Bob Declines):

**Step 1: Bob Clicks "Decline"**
- Bob clicks Decline button in GameInviteDialog OR in chat message
- Function called: `respondGame("rejected")` or `handleRespondInviteFromChat(msg, "rejected")`

**Step 2: Frontend Sends WebSocket Response**
- Frontend sends:
  ```typescript
  sendSocketMessage({
    event: "RESPOND_INVITE",
    payload: {
      response: "rejected",
      roomId: "RS-x7k9mP2",
      hostId: 42,            // Alice
      inviteeId: 99,         // Bob
      inviteeUsername: "bob",
    },
  });
  ```

**Step 3: Frontend Updates Bob's Chat**
- If Bob has chat with Alice open:
  ```typescript
  setMessages(prev =>
    prev.map(msg =>
      msg.type === "game-invite" && msg.meta?.roomId === "RS-x7k9mP2"
        ? {
            ...msg,
            type: "notification",
            message: "You declined the game invite. You were not added to the room.",
            meta: { ...msg.meta, inviteStatus: "rejected" },
          }
        : msg
    )
  );
  ```
- Invite message changes to notification showing "You declined..."

**Step 4: Frontend Closes Dialog**
- Close dialog:
  ```typescript
  setDialogOpen(false);
  ```
- Remove invite from list:
  ```typescript
  setInvitesReceived(prev => prev.filter(inv => inv.roomId !== "RS-x7k9mP2"));
  ```
- Bob stays on current page (does NOT navigate)

**Step 5: Backend Receives Response**
- Handler: `RESPOND_INVITE` validates Bob is invitee
- Service: `fastify.respondInvite()` processes decline

**Step 6: Backend Updates Room State**
- Remove Bob from invitedPlayers:
  ```javascript
  room.invitedPlayers = room.invitedPlayers.filter(p => p.id !== 99);
  ```
- Room state now:
  ```javascript
  {
    roomId: "RS-x7k9mP2",
    hostId: 42,
    invitedPlayers: [],           // Bob removed
    joinedPlayers: [
      { id: 42, username: "alice" }  // Only Alice
    ],
    maxPlayers: 2,
  }
  ```

**Step 7: Backend Checks If Room Should Close**
- Decline logic:
  ```javascript
  const shouldCloseRoomAfterReject =
    response === "rejected" &&
    room.hostId === 42 &&
    room.joinedPlayers.length <= 1 &&  // Only host in room
    room.invitedPlayers.length === 0;  // No more pending invites

  if (shouldCloseRoomAfterReject) {
    fastify.leaveRoom("RS-x7k9mP2", 42); // Remove Alice, delete room
    return; // STOP - Room closed
  }
  ```
- In this case: YES, room should close (only Alice, no invites)

**Step 8: Backend Closes Room**
- Remove Alice from room:
  ```javascript
  currentRoom.delete(42); // Alice no longer in any room
  ```
- Delete room:
  ```javascript
  gameRooms.delete("RS-x7k9mP2"); // Room no longer exists
  ```

**Step 9: Backend Sends GAME_INVITE_RESPONSE to Both**
- Notify both Alice and Bob of decline:
  ```javascript
  const inviteResponsePayload = {
    roomId: "RS-x7k9mP2",
    hostId: 42,
    inviteeId: 99,
    inviteeUsername: "bob",
    response: "rejected",
  };

  // Send to Bob
  safeSend(inviteeSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, 99);

  // Send to Alice
  safeSend(hostSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, 42);
  ```

**Step 10: Frontend (Alice) Receives Response**
- Socket context receives GAME_INVITE_RESPONSE
- Checks response === "rejected":
  ```typescript
  if (data.response === "rejected") {
    // Show toast
    toast.error("bob declined your game invite. Room closed.");

    // Update chat message
    setMessages(prev => [
      ...prev,
      {
        username: "System",
        message: "bob declined your game invite. Room closed.",
        timestamp: new Date().toISOString(),
        type: "notification",
      },
    ]);

    // Clear activeInvite
    setActiveInvite(null);

    // Remove game-invite-sent messages for this room
    setMessages(prev =>
      prev.filter(msg =>
        !(msg.type === "game-invite-sent" && msg.meta?.roomId === "RS-x7k9mP2")
      )
    );
  }
  ```

**Step 11: Frontend (Alice) Redirected**
- Alice was in lobby waiting
- Lobby page detects room closed (receives room deletion event or notices disconnection)
- Shows message: "Room closed - player declined invite"
- Auto-redirects to `/dashboard` or `/game/new`

**Step 12: Result**
- Bob stays on current page (did not join)
- Alice kicked out of lobby (room closed)
- Room no longer exists
- Both users can send new invites

---

## How Canceling Invite Works

### Complete Step-by-Step Flow (Alice Cancels):

**Step 1: Alice Clicks "Cancel"**
- Alice is waiting in lobby for Bob to respond
- Alice clicks "Cancel Invite" button
- Function: Sends WebSocket message

**Step 2: Frontend Sends WebSocket Cancel**
- Frontend sends:
  ```typescript
  sendSocketMessage({
    event: "CANCEL_GAME_INVITE",
    payload: {
      roomId: "RS-x7k9mP2",
      hostId: 42,         // Alice
      inviteeId: 99,      // Bob
    },
  });
  ```

**Step 3: Backend Receives Cancel**
- File: `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 80)
- Handler: `CANCEL_GAME_INVITE`
- Validates Alice is the host:
  ```javascript
  if (userId !== payload.hostId) {
    console.warn("CANCEL_GAME_INVITE rejected: user not host");
    return; // STOP
  }
  ```

**Step 4: Backend Cancels Invite**
- Service: `fastify.cancelGameInvite()` in `backend/plugins/ws-utils/ws-game.js` (line 424)
- Get room:
  ```javascript
  const room = gameRooms.get("RS-x7k9mP2");
  if (!room) throw new Error("Room does not exist");
  ```
- Remove Bob from invitedPlayers:
  ```javascript
  room.invitedPlayers = room.invitedPlayers.filter(p => p.id !== 99);
  ```

**Step 5: Backend Sends GAME_INVITE_CANCELLED to Bob**
- Notify Bob that invite was cancelled:
  ```javascript
  const inviteeSocket = onlineUsers.get(99);
  if (inviteeSocket) {
    safeSend(
      inviteeSocket,
      {
        event: "GAME_INVITE_CANCELLED",
        payload: {
          roomId: "RS-x7k9mP2",
          hostId: 42,
          hostUsername: "alice",
        },
      },
      99
    );
  }
  ```

**Step 6: Backend Updates Alice's Room**
- Send updated GAME_ROOM to Alice:
  ```javascript
  safeSend(
    hostSocket,
    {
      event: "GAME_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        invitedPlayers: [],           // Bob removed
        joinedPlayers: [
          { id: 42, username: "alice" }
        ],
        maxPlayers: 2,
      },
    },
    42
  );
  ```

**Step 7: Frontend (Bob) Receives Cancellation**
- Socket context receives GAME_INVITE_CANCELLED
- Closes dialog if open:
  ```typescript
  case "GAME_INVITE_CANCELLED":
    // Remove from invitesReceived
    setInvitesReceived(prev =>
      prev.filter(inv => inv.roomId !== payload.roomId)
    );

    // Show toast
    toast.info("The game invite was cancelled by the host.");

    // Dispatch event for chat to update
    window.dispatchEvent(
      new CustomEvent("gameInviteCancelled", { detail: payload })
    );
  ```

**Step 8: Frontend (Bob) Updates Chat**
- Chat page listens for `gameInviteCancelled` event:
  ```typescript
  const handleGameInviteCancelled = (event: CustomEvent) => {
    const data = event.detail;

    // Update invite message to show cancelled
    setMessages(prev =>
      prev.map(msg =>
        msg.type === "game-invite" && msg.meta?.roomId === data.roomId
          ? {
              ...msg,
              type: "notification",
              message: "The game invite was cancelled by the host.",
              meta: { ...msg.meta, inviteStatus: "cancelled" },
            }
          : msg
      )
    );
  };
  ```

**Step 9: Frontend (Alice) Updates Lobby**
- Alice's lobby receives GAME_ROOM event
- Updates UI:
  - "Waiting for bob..." disappears
  - Shows "No pending invites"
  - Alice can invite another player or leave room

**Step 10: Result**
- Bob's dialog closed (invite gone)
- Bob's chat shows "invite cancelled" notification
- Alice's lobby updated (Bob no longer pending)
- Room still exists (Alice still in it)
- Alice can send new invite or leave

---

## Real-time WebSocket Events

### WebSocket Events Used in Game Invite Flow:

**1. SEND_GAME_INVITE** (Sent by Alice)
```typescript
event: "SEND_GAME_INVITE"
payload: {
  roomId: "RS-x7k9mP2",
  hostId: 42,
  hostUsername: "alice",
  friendId: 99,
  friendUsername: "bob",
}
```
**Purpose:** Request backend to send invite to friend  
**Direction:** Alice → Backend

---

**2. GAME_INVITE** (Received by Bob)
```typescript
event: "GAME_INVITE"
payload: {
  roomId: "RS-x7k9mP2",
  hostId: 42,
  hostUsername: "alice",
}
```
**Purpose:** Notify Bob that Alice invited him  
**Direction:** Backend → Bob  
**Triggers:** Dialog opens, toast notification, chat message added

---

**3. RESPOND_INVITE** (Sent by Bob)
```typescript
event: "RESPOND_INVITE"
payload: {
  response: "accepted" | "rejected",
  roomId: "RS-x7k9mP2",
  hostId: 42,
  inviteeId: 99,
  inviteeUsername: "bob",
}
```
**Purpose:** Bob responds to Alice's invite  
**Direction:** Bob → Backend

---

**4. GAME_INVITE_RESPONSE** (Received by Both)
```typescript
event: "GAME_INVITE_RESPONSE"
payload: {
  roomId: "RS-x7k9mP2",
  hostId: 42,
  inviteeId: 99,
  inviteeUsername: "bob",
  response: "accepted" | "rejected",
}
```
**Purpose:** Notify both players of response  
**Direction:** Backend → Alice AND Bob  
**Triggers:** Update chat messages, close invite, clear pending state

---

**5. JOIN_ROOM** (Received by Bob on Accept)
```typescript
event: "JOIN_ROOM"
payload: {
  roomId: "RS-x7k9mP2",
  success: true,
  isTournament: false,
}
```
**Purpose:** Confirm Bob successfully joined room  
**Direction:** Backend → Bob  
**Triggers:** Toast notification, navigation to lobby

---

**6. GAME_ROOM** (Received by Alice and Bob)
```typescript
event: "GAME_ROOM"
payload: {
  roomId: "RS-x7k9mP2",
  hostId: 42,
  invitedPlayers: [...],
  joinedPlayers: [...],
  maxPlayers: 2,
  isTournament: false,
}
```
**Purpose:** Update room state (who's invited, who's joined)  
**Direction:** Backend → Alice AND Bob  
**Triggers:** Update lobby UI, show player list

---

**7. CANCEL_GAME_INVITE** (Sent by Alice)
```typescript
event: "CANCEL_GAME_INVITE"
payload: {
  roomId: "RS-x7k9mP2",
  hostId: 42,
  inviteeId: 99,
}
```
**Purpose:** Cancel pending invite to Bob  
**Direction:** Alice → Backend

---

**8. GAME_INVITE_CANCELLED** (Received by Bob)
```typescript
event: "GAME_INVITE_CANCELLED"
payload: {
  roomId: "RS-x7k9mP2",
  hostId: 42,
  hostUsername: "alice",
}
```
**Purpose:** Notify Bob that invite was cancelled  
**Direction:** Backend → Bob  
**Triggers:** Close dialog, remove invite, update chat

---

**9. GAME_INVITE_PENDING** (Received by Alice on Duplicate)
```typescript
event: "GAME_INVITE_PENDING"
payload: {
  friendId: 99,
  friendUsername: "bob",
  roomId: "RS-x7k9mP2",
  reason: "already-invited" | "already-joined",
}
```
**Purpose:** Inform Alice that Bob was already invited/joined  
**Direction:** Backend → Alice  
**Triggers:** Show error message

---

## UI Components

### 1. Chat Page - "Invite to Game" Button

**Location:** Chat header next to friend's name

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={handleGameInvite}
  disabled={isInviteButtonDisabled}
>
  <Gamepad2 className="w-4 h-4" />
  <span>
    {isSelectedFriendInvitePending 
      ? "Invitation Pending" 
      : "Invite to Game"}
  </span>
</Button>
```

**Button States:**
- **Enabled:** "Invite to Game" (friend is online, no pending invite)
- **Disabled:** "Invitation Pending" (invite already sent to this friend)
- **Disabled:** Button grayed out if friend is offline

---

### 2. Game Invite Dialog (Global Modal)

**Opens when invite received**

```
┌──────────────────────────────────┐
│  Game Invitation                 │
│                                  │
│  alice invited you to play pong! │
│                                  │
│  [Decline]         [Accept]      │
└──────────────────────────────────┘
```

**Features:**
- Shows host's username
- Accept button: Green, primary
- Decline button: Gray, secondary
- Auto-opens when invite received
- Closing (X button) = auto-decline

---

### 3. Chat Message - Game Invite (Recipient View)

**Received invite message in chat:**

```
┌────────────────────────────────────┐
│ alice                              │
│ ┌────────────────────────────────┐ │
│ │ alice invited you to join a    │ │
│ │ private game room              │ │
│ │                                │ │
│ │ [Accept]  [Decline]            │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Features:**
- Shows in chat thread
- Accept/Decline buttons inline
- Same functionality as dialog
- Message persists in history

---

### 4. Chat Message - Game Invite Sent (Sender View)

**Sent invite message in chat:**

```
┌────────────────────────────────────┐
│                               You  │
│ ┌────────────────────────────────┐ │
│ │ You invited bob to room        │ │
│ │ RS-x7k9mP2                     │ │
│ │                                │ │
│ │ [Start game now]  [Cancel]     │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Features:**
- Shows room ID
- "Start game now" button (if both players ready)
- "Cancel" button (removes invite)
- Updates when friend accepts/declines

---

## Key Components

### 1. Frontend: Chat Page - handleGameInvite

**File:** `frontend/app/(protected)/chat/page.tsx` (line ~859)

**Purpose:** Send game invite to selected friend

```typescript
const handleGameInvite = async () => {
  if (!selectedFriend || !isReady || !user?.id || !user?.username) return;

  // Validate friend is online
  const isFriendOnline = onlineFriends.some(
    f => String(f.id) === String(selectedFriend.id)
  );
  if (!isFriendOnline) {
    pushNotificationMessage("Cannot invite an offline friend.");
    return;
  }

  // Check for existing pending invite
  if (activeInvite) {
    pushNotificationMessage(
      "You already have a pending invitation. Cancel it first or wait for a response."
    );
    return;
  }

  // Mark invite as pending for this friend
  markInvitePendingForFriend(selectedFriend.id);

  try {
    // Step 1: Create game room
    const response = await fetch('/api/game/room/create?maxPlayers=2');
    if (!response.ok) {
      clearInvitePendingForFriend(selectedFriend.id);
      pushNotificationMessage("Failed to create room for invite.");
      return;
    }

    const data = await response.json();
    const roomId = data?.roomId;
    if (!roomId) {
      clearInvitePendingForFriend(selectedFriend.id);
      pushNotificationMessage("Room creation failed. Missing room id.");
      return;
    }

    // Step 2: Send invite via WebSocket
    sendSocketMessage({
      event: "SEND_GAME_INVITE",
      payload: {
        roomId,
        hostId: Number(user.id),
        hostUsername: user.username,
        friendId: Number(selectedFriend.id),
        friendUsername: selectedFriend.username,
      },
    });

    // Step 3: Add message to chat
    setMessages(prev => [
      ...prev,
      {
        username: user.username,
        senderId: Number(user.id),
        message: `You invited ${selectedFriend.username} to room ${roomId}`,
        timestamp: new Date().toISOString(),
        type: "game-invite-sent",
        meta: {
          inviteType: "room",
          roomId,
          hostId: Number(user.id),
        },
      },
    ]);

    // Step 4: Track active invite
    setActiveInvite({
      roomId,
      inviteeId: String(selectedFriend.id),
    });
    sessionStorage.setItem("ft_chat_invite_room", roomId);

    // Step 5: Navigate to lobby
    router.push(`/game/remote/single/create?roomId=${roomId}&fromChatInvite=true`);
  } catch (error) {
    console.error("Error sending room invite from chat:", error);
    clearInvitePendingForFriend(selectedFriend.id);
    pushNotificationMessage("Failed to create room for invite.");
  }
};
```

**Key Points:**
- Creates room first (REST API)
- Sends invite via WebSocket
- Adds message to chat thread
- Navigates host to lobby
- Tracks activeInvite globally

---

### 2. Frontend: Chat Page - handleRespondInviteFromChat

**File:** `frontend/app/(protected)/chat/page.tsx` (line ~926)

**Purpose:** Accept or decline invite from chat message

```typescript
const handleRespondInviteFromChat = (
  msg: Message,
  response: "accepted" | "rejected"
) => {
  const roomId = msg.meta?.roomId;
  const hostId = msg.meta?.hostId;

  if (!roomId || !hostId || !user?.id || !user?.username || !isReady) {
    pushNotificationMessage("Cannot respond to invite. Missing room details.");
    return;
  }

  // If declining, update message immediately
  if (response === "rejected") {
    setMessages(prev =>
      prev.map(entry =>
        entry.type === "game-invite" && entry.meta?.roomId === roomId
          ? {
              ...entry,
              type: "notification",
              message: "You declined the game invite. You were not added to the room.",
              meta: { ...entry.meta, inviteStatus: "rejected" },
            }
          : entry
      )
    );
  }

  // Send response via WebSocket
  sendSocketMessage({
    event: "RESPOND_INVITE",
    payload: {
      response,
      roomId,
      hostId,
      inviteeId: Number(user.id),
      inviteeUsername: user.username,
    },
  });

  // Remove from invitesReceived array (closes dialog if open)
  setInvitesReceived(prev =>
    prev.filter(invite => invite.roomId !== roomId)
  );

  // If accepting, navigate to lobby
  if (response === "accepted") {
    router.push(`/game/remote/single/join?roomId=${roomId}&invite=true`);
  }
};
```

**Key Points:**
- Works for both Accept and Decline
- Updates chat message immediately on decline
- Sends WebSocket response
- Navigates to lobby on accept
- Removes from invitesReceived

---

### 3. Frontend: GameInviteDialog

**File:** `frontend/components/game-invite-dialog.tsx`

**Purpose:** Global modal for game invites

```typescript
export default function GameInviteDialog() {
  const { sendSocketMessage } = useSocket();
  const { invitesReceived, setInvitesReceived } = useGame();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  // Auto-open dialog when invite received
  useEffect(() => {
    if (invitesReceived.length > 0) {
      setDialogOpen(true);
    }
  }, [invitesReceived]);

  function respondGame(response: string) {
    sendSocketMessage({
      event: "RESPOND_INVITE",
      payload: {
        response,
        roomId: invitesReceived[0].roomId,
        hostId: invitesReceived[0].hostId,
        inviteeId: user?.id,
        inviteeUsername: user?.username,
      },
    });

    // Remove invite from queue
    setInvitesReceived(prev => prev.filter((_, index) => index !== 0));
    setDialogOpen(false);
  }

  if (invitesReceived.length === 0) return null;

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Closing dialog = auto-decline
          respondGame("rejected");
          setInvitesReceived(prev => prev.filter((_, index) => index !== 0));
        }
        setDialogOpen(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game Invitation</DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{invitesReceived[0].hostUsername}</span>
            {" "}invited you to play pong!
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="secondary"
            onClick={() => respondGame("rejected")}
          >
            Decline
          </Button>
          <Button
            variant="default"
            onClick={() => respondGame("accepted")}
          >
            Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Points:**
- Auto-opens when invitesReceived has items
- Shows first invite in queue
- Closing dialog = decline
- Sends RESPOND_INVITE WebSocket
- Removes invite from queue

---

### 4. Backend: SEND_GAME_INVITE Handler

**File:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js` (line 41)

**Purpose:** Process game invite request from host

```javascript
SEND_GAME_INVITE: (payload) => {
  (async () => {
    try {
      // Validate host is sending the invite
      if (!assertActorMatchesPayloadId(userId, payload.hostId, "SEND_GAME_INVITE host")) {
        return;
      }

      // Verify user is the room host
      if (!isRoomHost(fastify, payload.roomId, userId)) {
        console.warn("[WS] SEND_GAME_INVITE rejected: not room host");
        return;
      }

      // Get usernames from database
      const hostUsername = await getProfileUsername(prisma, userId);
      const friendUsername = await getProfileUsername(prisma, Number(payload.friendId));

      // Call game invite service
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
```

**Key Points:**
- Validates host authorization
- Fetches usernames from database
- Calls sendGameInvite service
- Sends error event on failure

---

### 5. Backend: sendGameInvite Service

**File:** `backend/plugins/ws-utils/ws-game.js` (line 175)

**Purpose:** Send invite to friend, update room state

```javascript
fastify.decorate("sendGameInvite", (roomId, hostId, hostUsername, friendId, friendUsername) => {
  // Normalize IDs
  const normalizedRoomId = normalizeRemoteRoomId(roomId);
  const numericFriendId = normalizeRemoteUserId(friendId, "Friend ID");
  const numericHostId = normalizeRemoteUserId(hostId, "Host ID");
  const safeHostUsername = normalizeRemoteUsername(hostUsername, "Host username");
  const safeFriendUsername = normalizeRemoteUsername(friendUsername, "Friend username");

  // Check if friend is already in another room
  const inviteeInRoom = resolveRoomMembership(numericFriendId);
  if (inviteeInRoom) throw new Error("Player already in another room");

  // Check if friend is online
  const inviteeSocket = fastify.onlineUsers.get(numericFriendId);
  if (!inviteeSocket || inviteeSocket.size === 0) {
    // Clean up room
    fastify.currentRoom.delete(numericHostId);
    fastify.gameRooms.delete(normalizedRoomId);
    throw new Error("Friend is not online");
  }

  const room = fastify.gameRooms.get(normalizedRoomId);
  if (!room) throw new Error("Room does not exist");

  const hostSocket = fastify.onlineUsers.get(numericHostId);

  // Check if already invited
  const alreadyInvited = room.invitedPlayers.some(p => Number(p.id) === numericFriendId);
  if (alreadyInvited) {
    safeSend(hostSocket, {
      event: "GAME_INVITE_PENDING",
      payload: {
        friendId: numericFriendId,
        friendUsername: safeFriendUsername,
        roomId: normalizedRoomId,
        reason: "already-pending",
      },
    }, numericHostId);
    return;
  }

  // Add to invitedPlayers
  room.invitedPlayers.push({
    id: numericFriendId,
    username: safeFriendUsername,
  });

  // Send GAME_INVITE to friend
  safeSend(inviteeSocket, {
    event: "GAME_INVITE",
    payload: {
      roomId: normalizedRoomId,
      hostId: numericHostId,
      hostUsername: safeHostUsername,
    },
  }, numericFriendId);

  // Persist in chat history (database)
  prisma.message.create({
    data: {
      senderId: numericHostId,
      recipientId: numericFriendId,
      content: `${safeHostUsername} invited you to join private room ${normalizedRoomId}`,
    },
  }).catch(err => {
    console.error("Failed to persist room invite message:", err);
  });

  // Send updated GAME_ROOM to host
  safeSend(hostSocket, {
    event: "GAME_ROOM",
    payload: {
      roomId: normalizedRoomId,
      hostId: room.hostId,
      invitedPlayers: room.invitedPlayers,
      joinedPlayers: room.joinedPlayers,
      maxPlayers: room.maxPlayers,
      isTournament: room.isTournament || false,
    },
  }, numericHostId);
});
```

**Key Points:**
- Validates friend is online
- Checks for duplicate invites
- Adds friend to invitedPlayers
- Sends GAME_INVITE WebSocket to friend
- Persists invite in database
- Updates host's room state

---

### 6. Backend: respondInvite Service

**File:** `backend/plugins/ws-utils/ws-game.js` (line 299)

**Purpose:** Handle accept/decline response

```javascript
fastify.decorate("respondInvite", (response, roomId, hostId, inviteeId, username) => {
  // Normalize IDs
  const normalizedRoomId = normalizeRemoteRoomId(roomId);
  const numericHostId = normalizeRemoteUserId(hostId, "Host ID");
  const numericInviteeId = normalizeRemoteUserId(inviteeId, "Invitee ID");
  const safeUsername = normalizeRemoteUsername(username, "Invitee username");
  const normalizedResponse = String(response ?? "").trim().toLowerCase();

  // Validate response
  if (!["accepted", "rejected"].includes(normalizedResponse)) {
    throw new Error("Invite response is invalid");
  }

  const room = fastify.gameRooms.get(normalizedRoomId);
  if (!room) throw new Error("Room does not exist");

  // Verify invitee was actually invited
  if (!room.invitedPlayers.some(p => Number(p.id) === numericInviteeId)) {
    throw new Error("Player not invited to this room");
  }

  // Check if already in another room
  if (resolveRoomMembership(numericInviteeId)) {
    throw new Error("Already in another game room");
  }

  const hostSocket = fastify.onlineUsers.get(numericHostId);
  const inviteeSocket = fastify.onlineUsers.get(numericInviteeId);

  const inviteResponsePayload = {
    roomId: normalizedRoomId,
    hostId: numericHostId,
    inviteeId: numericInviteeId,
    inviteeUsername: safeUsername,
    response: normalizedResponse,
  };

  if (normalizedResponse === "accepted") {
    // Check if room is full
    if (room.joinedPlayers.length === room.maxPlayers) {
      room.invitedPlayers = room.invitedPlayers.filter(p => Number(p.id) !== numericInviteeId);
      safeSend(hostSocket, {
        event: "GAME_ROOM",
        payload: buildPayload(),
      }, numericHostId);
      throw new Error("Room already full");
    }

    // Add invitee to room
    fastify.currentRoom.set(numericInviteeId, normalizedRoomId);
    room.joinedPlayers.push({
      id: numericInviteeId,
      username: safeUsername,
    });

    // Send JOIN_ROOM to invitee
    safeSend(inviteeSocket, {
      event: "JOIN_ROOM",
      payload: {
        roomId: normalizedRoomId,
        success: true,
        isTournament: Boolean(room.isTournament),
      },
    }, numericInviteeId);

    // Send GAME_ROOM to invitee
    safeSend(inviteeSocket, {
      event: "GAME_ROOM",
      payload: buildPayload(),
    }, numericInviteeId);
  }

  // Remove from invitedPlayers
  room.invitedPlayers = room.invitedPlayers.filter(p => Number(p.id) !== numericInviteeId);

  // Check if room should close (declined, host alone, no invites)
  const shouldCloseRoomAfterReject =
    normalizedResponse === "rejected" &&
    Number(room.hostId) === numericHostId &&
    room.joinedPlayers.length <= 1 &&
    room.invitedPlayers.length === 0;

  // Send GAME_INVITE_RESPONSE to both players
  safeSend(inviteeSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, numericInviteeId);

  safeSend(hostSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: inviteResponsePayload,
  }, numericHostId);

  // Close room if needed
  if (shouldCloseRoomAfterReject) {
    fastify.leaveRoom(normalizedRoomId, numericHostId);
    return;
  }

  // Update host's room state
  safeSend(hostSocket, {
    event: "GAME_ROOM",
    payload: buildPayload(),
  }, numericHostId);
});
```

**Key Points:**
- Validates response (accepted/rejected)
- On accept: Adds invitee to joinedPlayers
- On accept: Sends JOIN_ROOM and GAME_ROOM to invitee
- On decline: Checks if room should close
- Sends GAME_INVITE_RESPONSE to both players
- Updates host's room state

---

## Complete Code Examples

### Example 1: Full Invite Flow (Frontend)

```typescript
// File: frontend/app/(protected)/chat/page.tsx

// User clicks "Invite to Game" button
const handleGameInvite = async () => {
  // Validate friend is online
  if (!onlineFriends.some(f => f.id === selectedFriend.id)) {
    toast.error("Cannot invite an offline friend.");
    return;
  }

  // Check for existing invite
  if (activeInvite) {
    toast.error("You already have a pending invitation.");
    return;
  }

  // Create game room via REST API
  const response = await fetch('/api/game/room/create?maxPlayers=2');
  const { roomId } = await response.json();
  // Server created room: "RS-x7k9mP2"
  // Alice (ID: 42) auto-joined as host

  // Send invite via WebSocket
  sendSocketMessage({
    event: "SEND_GAME_INVITE",
    payload: {
      roomId: "RS-x7k9mP2",
      hostId: 42,              // Alice
      hostUsername: "alice",
      friendId: 99,            // Bob
      friendUsername: "bob",
    },
  });

  // Add message to chat
  setMessages(prev => [
    ...prev,
    {
      username: "alice",
      senderId: 42,
      message: "You invited bob to room RS-x7k9mP2",
      timestamp: new Date().toISOString(),
      type: "game-invite-sent",
      meta: { roomId: "RS-x7k9mP2", hostId: 42 },
    },
  ]);

  // Track active invite
  setActiveInvite({ roomId: "RS-x7k9mP2", inviteeId: "99" });

  // Navigate to lobby
  router.push("/game/remote/single/create?roomId=RS-x7k9mP2&fromChatInvite=true");
};
```

### Example 2: Receiving Invite (Frontend)

```typescript
// File: frontend/context/socket-context.tsx

// WebSocket message received
websocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.event) {
    case "GAME_INVITE":
      const { roomId, hostId, hostUsername } = msg.payload;

      // Add to invitesReceived array
      setInvitesReceived(prev => [
        ...prev,
        {
          roomId: "RS-x7k9mP2",
          hostId: 42,
          hostUsername: "alice",
        },
      ]);
      // This triggers GameInviteDialog to open

      // Show toast notification
      toast.info("alice invited you to a room");

      // Dispatch event for chat to listen
      window.dispatchEvent(
        new CustomEvent("gameInvite", {
          detail: { roomId, hostId, hostUsername },
        })
      );
      break;
  }
};
```

### Example 3: Accepting Invite (Frontend)

```typescript
// File: frontend/components/game-invite-dialog.tsx

// User clicks "Accept" button
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

  // Remove invite from queue
  setInvitesReceived(prev => prev.filter((_, index) => index !== 0));

  // Close dialog
  setDialogOpen(false);

  // Navigate to lobby (happens automatically after JOIN_ROOM event)
}
```

### Example 4: Backend Processes Accept

```javascript
// File: backend/plugins/ws-utils/ws-game.js

fastify.decorate("respondInvite", (response, roomId, hostId, inviteeId, username) => {
  const room = gameRooms.get("RS-x7k9mP2");

  if (response === "accepted") {
    // Add Bob to room
    currentRoom.set(99, "RS-x7k9mP2");
    room.joinedPlayers.push({ id: 99, username: "bob" });

    // Remove Bob from invitedPlayers
    room.invitedPlayers = room.invitedPlayers.filter(p => p.id !== 99);

    // Send JOIN_ROOM to Bob
    safeSend(inviteeSocket, {
      event: "JOIN_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        success: true,
        isTournament: false,
      },
    }, 99);

    // Send updated GAME_ROOM to Bob
    safeSend(inviteeSocket, {
      event: "GAME_ROOM",
      payload: {
        roomId: "RS-x7k9mP2",
        hostId: 42,
        invitedPlayers: [],
        joinedPlayers: [
          { id: 42, username: "alice" },
          { id: 99, username: "bob" }
        ],
        maxPlayers: 2,
      },
    }, 99);
  }

  // Send GAME_INVITE_RESPONSE to both players
  const responsePayload = {
    roomId: "RS-x7k9mP2",
    hostId: 42,
    inviteeId: 99,
    inviteeUsername: "bob",
    response: "accepted",
  };

  safeSend(inviteeSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: responsePayload,
  }, 99);

  safeSend(hostSocket, {
    event: "GAME_INVITE_RESPONSE",
    payload: responsePayload,
  }, 42);

  // Send updated GAME_ROOM to Alice
  safeSend(hostSocket, {
    event: "GAME_ROOM",
    payload: {
      roomId: "RS-x7k9mP2",
      hostId: 42,
      invitedPlayers: [],
      joinedPlayers: [
        { id: 42, username: "alice" },
        { id: 99, username: "bob" }
      ],
      maxPlayers: 2,
    },
  }, 42);
});
```

### Example 5: Complete Timeline

```
T = 0:00 - Alice opens chat with Bob

T = 0:05 - Alice clicks "Invite to Game"
├─ Frontend calls POST /api/game/room/create
├─ Backend creates room "RS-x7k9mP2"
├─ Alice auto-joins as host
└─ Backend returns { roomId: "RS-x7k9mP2" }

T = 0:06 - Frontend sends SEND_GAME_INVITE WebSocket
├─ Backend validates Alice is host
├─ Backend adds Bob to invitedPlayers
├─ Backend sends GAME_INVITE to Bob
├─ Backend persists invite in database
└─ Backend sends GAME_ROOM to Alice

T = 0:07 - Alice navigates to lobby
├─ URL: /game/remote/single/create?roomId=RS-x7k9mP2
├─ Lobby shows: "Waiting for bob to join..."
└─ Room: { invitedPlayers: [bob], joinedPlayers: [alice] }

T = 0:07 - Bob receives GAME_INVITE event
├─ Socket context adds to invitesReceived
├─ GameInviteDialog opens
├─ Toast notification: "alice invited you to a room"
└─ Chat message added (if chat with Alice open)

T = 0:10 - Bob clicks "Accept"
├─ Frontend sends RESPOND_INVITE WebSocket
├─ Backend validates Bob is invitee
├─ Backend adds Bob to joinedPlayers
├─ Backend sends JOIN_ROOM to Bob
├─ Backend sends GAME_ROOM to Bob
├─ Backend sends GAME_INVITE_RESPONSE to Alice and Bob
└─ Backend sends updated GAME_ROOM to Alice

T = 0:11 - Bob navigates to lobby
├─ URL: /game/remote/single/join?roomId=RS-x7k9mP2&invite=true
├─ Lobby shows: Alice and Bob both in room
└─ Bob sees: "alice (Host)" and "bob (You)"

T = 0:11 - Alice's lobby updates
├─ Receives GAME_ROOM event
├─ UI changes: "bob joined!" (green checkmark)
├─ "Start Game" button becomes enabled
└─ Alice can now start the match

T = 0:15 - Alice clicks "Start Game"
├─ Both players navigate to game runtime
└─ Game begins!
```

---

## Summary

The game invite flow provides seamless, real-time invitations directly from chat:

✅ **One-Click Invite** - "Invite to Game" button in chat header  
✅ **Real-time Delivery** - WebSocket ensures instant notification  
✅ **Dual Interface** - Respond via dialog OR chat buttons  
✅ **Persistent History** - Invites saved in database, survive reload  
✅ **Auto-Navigation** - Sender and receiver both redirected to lobby  
✅ **Cancel Support** - Host can cancel pending invites  
✅ **Online Validation** - Only online friends can be invited  
✅ **Room Management** - Automatic room creation and cleanup  

### Key Design Decisions:

**Why REST + WebSocket Hybrid?**
- REST API creates room (stateful resource)
- WebSocket sends invite (real-time notification)
- Best of both: Reliable room creation + instant delivery

**Why Global Dialog AND Chat Buttons?**
- Dialog: Catches attention immediately
- Chat buttons: Keeps context in conversation
- User can respond from either location

**Why Persist Invites in Database?**
- Survives page refresh
- Maintains chat history
- Can re-display if user reloads

**Why One Active Invite at a Time?**
- Prevents spam
- Keeps UI simple (one pending at a time)
- Forces user to resolve before sending another

**Why Auto-Close Room on Decline?**
- No point keeping empty room (host alone, no invites)
- Cleans up resources
- Host sees clear "declined" message

**Why Navigate Host to Lobby?**
- Shows waiting status
- Displays pending invites
- Allows host to cancel or start when ready

### User Experience:

**From Alice's Perspective (Sender):**
1. Open chat with Bob → Click "Invite to Game"
2. Auto-navigate to lobby → See "Waiting for bob..."
3. Bob accepts → See "bob joined!" → Start game

**From Bob's Perspective (Receiver):**
1. Receive toast: "alice invited you to a room"
2. Dialog pops up: "alice invited you to play pong!"
3. Click Accept → Auto-navigate to lobby → See Alice → Ready to play

**Result:** Fast, intuitive, seamless invitation flow that "just works."
