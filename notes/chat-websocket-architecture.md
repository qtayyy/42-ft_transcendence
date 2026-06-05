# Chat & WebSocket Architecture

## Table of Contents
1. [Overview](#overview)
3. [WebSocket Chat Handler](#websocket-chat-handler)
4. [How Message Sending Works (Step-by-Step)](#how-message-sending-works-step-by-step)
5. [Key Components](#key-components)
6. [Complete Code Examples](#complete-code-examples)

---

## Overview

The chat system uses a **hybrid architecture**:
- **WebSocket** for real-time message delivery
- **REST API** for message persistence and history
- **Event-driven** communication between frontend components


## System Architecture (Explained in Words)

### Frontend Components:

1. **Chat Page** (`frontend/app/(protected)/chat/page.tsx`)
   - The UI where users see and send messages
   - Makes REST API calls to load chat history
   - Connects to Socket Context for real-time updates

2. **Socket Context** (`frontend/context/socket-context.tsx`)
   - Manages the WebSocket connection
   - Receives all WebSocket events from server
   - Dispatches CustomEvents to notify other components

3. **REST API Calls**
   - `GET /api/chat/:friendId` - Load message history
   - `POST /api/chat/read/:friendId` - Mark messages as read
   - `GET /api/chat/unread` - Get unread count

### Backend Components:

4. **WebSocket Route** (`backend/routes/ws/connect-ws.js`)
   - Authenticates WebSocket connections
   - Tracks online users in a Map
   - Routes incoming messages to event handlers

5. **Message Handlers** (`backend/plugins/ws-utils/ws-events/handlers/message-handlers.js`)
   - **CHAT_MESSAGE** - Handles sending/receiving messages
   - **TYPING_INDICATOR** - Forwards typing status
   - **MESSAGE_READ** - Handles read receipts

6. **REST API Routes** (`backend/routes/api/chat/index.js`)
   - Provides endpoints for fetching history
   - Handles marking messages as read
   - Returns unread counts

7. **Database** (SQLite with Prisma)
   - Stores all messages permanently
   - Message table with sender, recipient, content, read status

### Real-time Flow:

When a message is sent, the **CHAT_MESSAGE handler**:
- Saves message to database
- Looks up recipient in **onlineUsers Map**
- If found, sends to all recipient's WebSocket connections
- Also confirms back to sender with database ID

---

## WebSocket Chat Handler

### Where Chat is Handled in WebSocket

**Location:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js`

The WebSocket connection (`/ws/connect`) uses an **event handler map** that routes incoming WebSocket messages to specific handlers. Chat is handled by three main events:

1. **CHAT_MESSAGE** - Send/receive messages
2. **TYPING_INDICATOR** - Real-time typing status
3. **MESSAGE_READ** - Read receipts

### Event Handler Structure

```javascript
// backend/routes/ws/connect-ws.js
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
  
  const handler = eventHandlers[event];
  if (handler) {
    handler(payload);  // Routes to CHAT_MESSAGE, TYPING_INDICATOR, etc.
  }
});
```

---

## How Message Sending Works (Step-by-Step)

### Complete Flow from Start to Finish:

**Step 1: User Types and Clicks Send**
- User types "Hello!" in the chat input
- User clicks the Send button

**Step 2: Optimistic UI Update (Instant Feedback)**
- Frontend immediately adds message to the UI
- Message shows WITHOUT a database ID yet (temporary)
- This happens BEFORE sending to server
- User sees their message instantly (no waiting)

**Step 3: Send to WebSocket Server**
- Frontend sends WebSocket event: `CHAT_MESSAGE`
- Payload includes: `{ message: "Hello!", recipientId: 99 }`
- This goes through the persistent WebSocket connection

**Step 4: Server Validation**
- Server checks: Is recipient blocked? (If yes, return error)
- Server checks: Are they friends? (If no, return error)
- Both checks must pass to continue

**Step 5: Save to Database (ALWAYS)**
- Server calls: `prisma.message.create()`
- Inserts into Message table with:
  - senderId (from JWT authentication)
  - recipientId (from payload)
  - content ("Hello!")
  - read: false
  - createdAt: current timestamp
- Database generates an ID (e.g., 789)
- Server gets back complete message object

**Step 6: Check Recipient's Online Status**
- Server looks up: `fastify.onlineUsers.get(recipientId)`
- Two possible outcomes:

  **6a. If Recipient is ONLINE:**
  - Server finds their WebSocket connection(s)
  - Sends message to ALL their connections (multi-tab support)
  - Recipient's frontend receives WebSocket event
  - Recipient's frontend dispatches CustomEvent
  - Message appears instantly on recipient's screen

  **6b. If Recipient is OFFLINE:**
  - Server skips WebSocket sending
  - Message is already saved in database
  - Recipient will fetch it when they log in and open chat

**Step 7: Confirm to Sender**
- Server sends confirmation back to sender via WebSocket
- Includes the real database ID (789) and timestamp
- Sender's frontend receives this
- Replaces the optimistic message (no ID) with real one (ID: 789)
- Checkmark updates from pending ⏳ to delivered ✓

### Why This Design?

**Optimistic Update:** User sees message instantly without waiting for server
**Database First:** Message is always saved, even if recipient is offline
**Parallel Delivery:** Both sender and recipient updated at same time
**Confirmation:** Sender knows the message was successfully saved

---

## How Read Receipts Work (Step-by-Step)

**Step 1: Recipient Opens Chat**
- User clicks on a friend's chat to open it
- Frontend calls REST API: `POST /api/chat/read/:friendId`
- This marks ALL unread messages from that friend as read (batch operation)

**Step 2: Individual Message Read Tracking**
- As recipient scrolls and views messages
- Frontend sends WebSocket event: `MESSAGE_READ`
- Payload: `{ messageId: 789 }`

**Step 3: Server Updates Database**
- Server updates Message table:
  - Sets `read = true`
  - Sets `readAt = current timestamp`
- Only works if the message recipient is the current user

**Step 4: Notify Original Sender**
- Server looks up the message to find original sender
- Server checks: `fastify.onlineUsers.get(senderId)`

  **4a. If Sender is ONLINE:**
  - Server sends WebSocket event: `MESSAGE_READ`
  - Payload: `{ messageId: 789, readAt: "2026-05-27T10:30:00Z" }`
  - Sender's frontend receives event
  - Updates UI: single checkmark ✓ → double checkmark ✓✓

  **4b. If Sender is OFFLINE:**
  - Nothing sent via WebSocket
  - Read status is in database
  - Sender will see double checkmark when they next load chat history

---

## How Typing Indicator Works (Step-by-Step)

**Step 1: User Types in Input Field**
- User starts typing in the chat input
- Frontend detects input change event

**Step 2: Debounced WebSocket Send**
- Frontend waits briefly (debounce to avoid spam)
- Sends WebSocket event: `TYPING_INDICATOR`
- Payload: `{ recipientId: 99, isTyping: true }`

**Step 3: Server Verifies Friendship**
- Server checks that sender and recipient are friends
- If not friends, silently ignore (don't send)

**Step 4: Forward to Recipient**
- Server looks up: `fastify.onlineUsers.get(recipientId)`
- If recipient is online, forwards the typing event
- Payload: `{ userId: 42, isTyping: true }`

**Step 5: Recipient Sees Indicator**
- Recipient's frontend receives WebSocket event
- Displays: "Alice is typing..."
- Auto-clears after 3 seconds if no update received

**Step 6: User Stops Typing**
- After 2 seconds of no input, frontend sends:
- WebSocket event: `TYPING_INDICATOR`
- Payload: `{ recipientId: 99, isTyping: false }`
- Server forwards to recipient
- Recipient's UI clears the "typing..." indicator



---

## Key Components

### 1. Frontend: Socket Context

**File:** `frontend/context/socket-context.tsx`

**Purpose:** Central WebSocket connection manager

```typescript
// Establishes WebSocket connection
const websocket = new WebSocket(getWebSocketBaseUrl());

// Receives all WebSocket events
websocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  const payload = msg.payload;
  
  switch (msg.event) {
    case "CHAT_MESSAGE":
      // Dispatch to window so chat page can listen
      window.dispatchEvent(
        new CustomEvent("chatMessage", { detail: payload })
      );
      break;
      
    case "TYPING_INDICATOR":
      window.dispatchEvent(
        new CustomEvent("typingIndicator", { detail: payload })
      );
      break;
      
    case "MESSAGE_READ":
      window.dispatchEvent(
        new CustomEvent("messageRead", { detail: payload })
      );
      break;
  }
};
```

**Why CustomEvents?**
- Decouples WebSocket logic from chat UI
- Allows multiple components to listen to same events
- Chat page can mount/unmount without affecting WebSocket connection

### 2. Frontend: Chat Page

**File:** `frontend/app/(protected)/chat/page.tsx`

**Purpose:** Chat UI and message management

```typescript
// Listen for incoming messages
useEffect(() => {
  const handleNewMessage = (event: CustomEvent) => {
    const data: Message = event.detail;
    
    // Only show messages relevant to current conversation
    if (selectedFriend) {
      const isFromSelectedFriend = 
        data.senderId.toString() === selectedFriend.id;
      const isFromCurrentUser = 
        data.senderId.toString() === user?.id;
      
      if (isFromSelectedFriend || isFromCurrentUser) {
        setMessages((prev) => {
          // Avoid duplicates
          if (data.id && prev.some(msg => msg.id === data.id)) {
            return prev;
          }
          return [...prev, data];
        });
      }
    }
  };
  
  window.addEventListener("chatMessage", handleNewMessage);
  return () => {
    window.removeEventListener("chatMessage", handleNewMessage);
  };
}, [selectedFriend, user]);
```

### 3. Backend: WebSocket Connection Manager

**File:** `backend/routes/ws/connect-ws.js`

**Purpose:** Manage user connections and online status

```javascript
// Track online users (supports multiple tabs/devices)
fastify.onlineUsers.set(userId, new Set());
fastify.onlineUsers.get(userId).add(connection);

// Notify friends when user comes online
fastify.notifyFriendStatus(userId, "online");

// Handle disconnection
connection.on("close", () => {
  const sockets = fastify.onlineUsers.get(userId);
  sockets.delete(connection);
  
  // Only mark offline when last tab closes
  if (sockets.size === 0) {
    fastify.onlineUsers.delete(userId);
    fastify.notifyFriendStatus(userId, "offline");
  }
});
```

**onlineUsers Map Structure:**
```javascript
// NOT HARDCODED - User IDs come from database/JWT tokens!

// Real example when users connect:
Map {
  42 => Set { WebSocket_Connection_A, WebSocket_Connection_B },  
  // User ID 42 has 2 browser tabs open
  
  99 => Set { WebSocket_Connection_C },              
  // User ID 99 has 1 tab open
  
  1234 => Set { WebSocket_Connection_D, WebSocket_Connection_E, WebSocket_Connection_F }
  // User ID 1234 has 3 devices connected (phone, laptop, tablet)
}

// How it's actually used in code:
const recipientId = 42; // From the message payload
const recipientConnections = fastify.onlineUsers.get(recipientId);
// Returns: Set { WebSocket_Connection_A, WebSocket_Connection_B }

// Send message to ALL of user 42's connections
recipientConnections.forEach((socket) => {
  socket.send(JSON.stringify(message));
});
// Message appears on BOTH tabs simultaneously!
```

**Key Points:**
- User IDs (42, 99, 1234) come from your **database** when user registers
- WebSocket connections are created when user **logs in**
- One user can have **multiple connections** (multi-tab, multi-device)
- Messages are sent to **ALL connections** for that user

### Real Code Example: How User IDs are Used

```javascript
// 1. User logs in → JWT token contains their database ID
// Token payload: { userId: 42, username: "alice" }

// 2. WebSocket connects with authentication
fastify.get("/", { onRequest: [fastify.authenticate] }, (connection, req) => {
  // Extract REAL user ID from JWT (NOT HARDCODED!)
  const userId = Number(req.user.userId); // e.g., 42
  
  // 3. Store this user's WebSocket connection(s)
  if (!fastify.onlineUsers.has(userId)) {
    fastify.onlineUsers.set(userId, new Set());
  }
  fastify.onlineUsers.get(userId).add(connection);
  // Now: Map { 42 => Set { connection1 } }
});

// 4. When user 99 sends message to user 42:
CHAT_MESSAGE: (payload) => {
  const senderId = userId; // 99 (from JWT)
  const recipientId = parseInt(payload.recipientId); // 42 (from message)
  
  // 5. Save to database
  const savedMessage = await prisma.message.create({
    data: {
      senderId: 99,      // From authentication
      recipientId: 42,   // From payload
      content: "Hey!"
    }
  });
  // Returns: { id: 1523, senderId: 99, recipientId: 42, content: "Hey!" }
  
  // 6. Get recipient's connections
  const recipientSockets = fastify.onlineUsers.get(42);
  // Returns: Set { connection1, connection2 } (if user 42 has 2 tabs open)
  
  // 7. Send to ALL recipient's connections
  recipientSockets.forEach(socket => {
    safeSend(socket, { event: "CHAT_MESSAGE", payload: messageData });
  });
  // Message appears on BOTH of user 42's tabs!
}
```

### Visual Example with Real Flow

```
DATABASE (Users table):
┌────┬──────────┬───────────┐
│ id │ username │ password  │
├────┼──────────┼───────────┤
│ 42 │ alice    │ ********* │  ← User ID comes from here!
│ 99 │ bob      │ ******>>> │
└────┴──────────┴───────────┘

When alice logs in:
  ↓
JWT Token created: { userId: 42, username: "alice" }
  ↓
WebSocket connects with token
  ↓
onlineUsers Map updated:
  Map { 42 => Set { WebSocket_1 } }

When alice opens another tab:
  ↓
New WebSocket connects with same token
  ↓
onlineUsers Map updated:
  Map { 42 => Set { WebSocket_1, WebSocket_2 } }

When bob (ID: 99) sends message to alice (ID: 42):
  ↓
Backend looks up: onlineUsers.get(42)
  ↓
Finds: Set { WebSocket_1, WebSocket_2 }
  ↓
Sends message to BOTH WebSockets
  ↓
Alice sees message on both tabs simultaneously!
```

### 4. Backend: CHAT_MESSAGE Handler

**File:** `backend/plugins/ws-utils/ws-events/handlers/message-handlers.js`

**Purpose:** Core message handling logic

```javascript
CHAT_MESSAGE: (payload) => {
  (async () => {
    try {
      const recipientId = parseInt(payload.recipientId);
      const messageContent = payload.message;

      // 1. VALIDATION
      if (!recipientId || isNaN(recipientId)) {
        safeSend(connection, {
          event: "CHAT_MESSAGE",
          error: "Invalid recipient ID"
        }, userId);
        return;
      }

      // 2. CHECK BLOCKS
      const blockExists = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: recipientId },
            { blockerId: recipientId, blockedId: userId }
          ]
        }
      });

      if (blockExists) {
        safeSend(connection, {
          event: "CHAT_MESSAGE",
          error: "Cannot send message to blocked user"
        }, userId);
        return;
      }

      // 3. VERIFY FRIENDSHIP
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: userId, addresseeId: recipientId },
            { requesterId: recipientId, addresseeId: userId }
          ]
        }
      });

      if (!friendship) {
        safeSend(connection, {
          event: "CHAT_MESSAGE",
          error: "Not friends with this user"
        }, userId);
        return;
      }

      // 4. SAVE TO DATABASE
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

      // 5. FORMAT PAYLOAD
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

      // 6. SEND TO RECIPIENT (if online)
      const recipientSocket = fastify.onlineUsers.get(Number(recipientId));
      if (recipientSocket) {
        console.log(`Sending CHAT_MESSAGE to recipient ${recipientId}`);
        safeSend(recipientSocket, {
          event: "CHAT_MESSAGE",
          payload: messagePayload
        }, recipientId);
      } else {
        console.log(`Recipient ${recipientId} offline. Message saved.`);
      }

      // 7. CONFIRM TO SENDER (with DB ID)
      console.log(`Confirming CHAT_MESSAGE to sender ${userId}`);
      safeSend(connection, {
        event: "CHAT_MESSAGE",
        payload: messagePayload
      }, userId);
      
    } catch (err) {
      console.error("Error handling chat message:", err);
      safeSend(connection, {
        event: "CHAT_MESSAGE",
        error: "Failed to send message"
      }, userId);
    }
  })();
},
```

### 5. Backend: TYPING_INDICATOR Handler

```javascript
TYPING_INDICATOR: (payload) => {
  (async () => {
    const recipientId = parseInt(payload.recipientId);
    const isTyping = payload.isTyping;

    if (!recipientId || isNaN(recipientId)) return;

    // Verify friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addresseeId: recipientId },
          { requesterId: recipientId, addresseeId: userId }
        ]
      }
    });
    
    if (!friendship) return;

    // Forward to recipient if online
    const recipientSocket = fastify.onlineUsers.get(Number(recipientId));
    if (recipientSocket) {
      safeSend(recipientSocket, {
        event: "TYPING_INDICATOR",
        payload: {
          userId: userId,
          isTyping: isTyping
        }
      }, recipientId);
    }
  })();
},
```

### 6. Backend: MESSAGE_READ Handler

```javascript
MESSAGE_READ: (payload) => {
  (async () => {
    try {
      const messageId = parseInt(payload.messageId);
      
      if (!messageId || isNaN(messageId)) return;

      // Update message as read in database
      const updatedMessage = await prisma.message.updateMany({
        where: {
          id: messageId,
          recipientId: userId,  // Only recipient can mark as read
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      if (updatedMessage.count > 0) {
        // Get message to find original sender
        const message = await prisma.message.findUnique({
          where: { id: messageId }
        });

        if (message) {
          // Notify sender that message was read
          const senderSocket = fastify.onlineUsers.get(
            Number(message.senderId)
          );
          
          if (senderSocket) {
            safeSend(senderSocket, {
              event: "MESSAGE_READ",
              payload: {
                messageId: messageId,
                readAt: new Date().toISOString(),
                senderId: message.senderId,
                recipientId: message.recipientId,
              }
            }, message.senderId);
          }
        }
      }
    } catch (err) {
      console.error("Error handling MESSAGE_READ:", err);
    }
  })();
},
```

---

## Complete Code Examples

### Example 1: Sending a Message (Frontend)

```typescript
// frontend/app/(protected)/chat/page.tsx

const handleSend = () => {
  if (!inputValue.trim() || !isReady || !selectedFriend) return;

  const messageContent = inputValue.trim();
  
  // 1. Create optimistic message (instant UI feedback)
  const tempMessage: Message = {
    username: user?.username || "You",
    senderId: user?.id ? parseInt(user.id) : undefined,
    message: messageContent,
    timestamp: new Date().toISOString(),
    // No ID yet - will be replaced when server confirms
  };

  // 2. Add to UI immediately
  setMessages((prev) => [...prev, tempMessage]);

  // 3. Send via WebSocket
  sendSocketMessage({
    event: "CHAT_MESSAGE",
    payload: {
      message: messageContent,
      recipientId: parseInt(selectedFriend.id),
    },
  });

  // 4. Clear input
  setInputValue("");
  
  // 5. Send typing indicator (stopped)
  sendSocketMessage({
    event: "TYPING_INDICATOR",
    payload: {
      recipientId: parseInt(selectedFriend.id),
      isTyping: false,
    },
  });
};
```

### Example 2: Loading Chat History (Frontend)

```typescript
// Load chat history when friend is selected
useEffect(() => {
  if (!selectedFriend) {
    setMessages([]);
    return;
  }

  const loadChatHistory = async () => {
    setLoadingHistory(true);
    try {
      const friendId = selectedFriend.id.toString();
      
      // Fetch from REST API
      const response = await fetch(`/api/chat/${friendId}`);
      
      if (!response.ok) {
        throw new Error("Failed to load chat history");
      }
      
      const history = await response.json();
      setMessages(history || []);
      
      // Mark all messages from this friend as read
      await fetch(`/api/chat/read/${friendId}`, {
        method: 'POST',
      });
      
    } catch (error) {
      console.error("Error loading chat history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  loadChatHistory();
}, [selectedFriend]);
```

### Example 3: Typing Indicator (Frontend)

```typescript
// Handle input changes with debouncing
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value;
  setInputValue(value);

  if (!selectedFriend || !isReady) return;

  // Clear previous timeout
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }

  // Send typing = true
  if (!isTyping && value.trim()) {
    setIsTyping(true);
    sendSocketMessage({
      event: "TYPING_INDICATOR",
      payload: {
        recipientId: parseInt(selectedFriend.id),
        isTyping: true,
      },
    });
  }

  // Auto-stop typing after 2 seconds of no input
  typingTimeoutRef.current = setTimeout(() => {
    setIsTyping(false);
    sendSocketMessage({
      event: "TYPING_INDICATOR",
      payload: {
        recipientId: parseInt(selectedFriend.id),
        isTyping: false,
      },
    });
  }, 2000);
};
```

### Example 4: REST API - Get Chat History (Backend)

```javascript
// backend/routes/api/chat/index.js

fastify.get(
  "/:friendId",
  { onRequest: [fastify.authenticate] },
  async (request, reply) => {
    try {
      const myId = request.user.userId;
      const friendId = parseInt(request.params.friendId);

      // Validate friend ID
      if (!friendId || isNaN(friendId)) {
        return reply.code(400).send({ error: "Invalid friend ID" });
      }

      // Check for blocks
      const blockExists = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: myId, blockedId: friendId },
            { blockerId: friendId, blockedId: myId },
          ],
        },
      });

      if (blockExists) {
        return reply.code(403).send({ 
          error: "Cannot access chat with blocked user" 
        });
      }

      // Verify friendship
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { requesterId: myId, addresseeId: friendId },
            { requesterId: friendId, addresseeId: myId },
          ],
        },
      });

      if (!friendship) {
        return reply.code(403).send({ 
          error: "Not friends with this user" 
        });
      }

      // Get all messages between the two users
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: myId, recipientId: friendId },
            { senderId: friendId, recipientId: myId },
          ],
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
        orderBy: {
          createdAt: "asc",
        },
      });

      // Format for frontend
      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        username: msg.sender.username,
        senderId: msg.senderId,
        avatar: msg.sender.avatar || null,
        message: msg.content,
        timestamp: msg.createdAt.toISOString(),
        read: msg.read,
        readAt: msg.readAt?.toISOString() || null,
      }));

      return reply.code(200).send(formattedMessages);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      return reply.code(500).send({ error: "Internal server error" });
    }
  }
);
```

---

## Database Schema

```prisma
model Message {
  id          Int       @id @default(autoincrement())
  
  sender      Profile   @relation("MessageSender", fields: [senderId], references: [id])
  senderId    Int
  
  recipient   Profile   @relation("MessageReceiver", fields: [recipientId], references: [id])
  recipientId Int
  
  content     String
  read        Boolean   @default(false)
  readAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([senderId, recipientId])
  @@index([recipientId, senderId])
}
```

**Why two indexes?**
- `[senderId, recipientId]` - Fast query: "messages I sent to X"
- `[recipientId, senderId]` - Fast query: "messages I received from X"

---

## Key Design Decisions

### 1. Why Hybrid WebSocket + REST?

**WebSocket:**
- ✅ Real-time delivery
- ✅ Bi-directional communication
- ✅ Low latency
- ❌ Not suitable for fetching history
- ❌ More complex error handling

**REST API:**
- ✅ Simple, stateless
- ✅ Perfect for bulk data (history)
- ✅ Built-in HTTP caching
- ❌ Not real-time
- ❌ Requires polling for updates

**Solution:** Use both!
- WebSocket for new messages
- REST for history and batch operations

### 2. Why CustomEvents instead of Props?

```typescript
// ❌ BAD: Tightly coupled
<ChatPage onMessage={(msg) => console.log(msg)} />

// ✅ GOOD: Loosely coupled
window.addEventListener("chatMessage", handler);
```

**Benefits:**
- Socket context doesn't need to know about chat page
- Multiple components can listen to same events
- Components can mount/unmount independently
- Cleaner separation of concerns

### 3. Why Optimistic Updates?

```typescript
// 1. Add message to UI immediately (no waiting)
setMessages((prev) => [...prev, tempMessage]);

// 2. Send to server
sendSocketMessage({ event: "CHAT_MESSAGE", payload: {...} });

// 3. Replace with real message when confirmed
// (includes database ID, server timestamp)
```

**Benefits:**
- Instant UI feedback
- Better perceived performance
- Handles slow networks gracefully
- Can rollback if server rejects

### 4. Why Multiple WebSocket Connections per User?

```javascript
// User can have multiple tabs/devices
onlineUsers.set(userId, new Set([ws1, ws2, ws3]));
```

**Benefits:**
- User stays "online" even if one tab closes
- Messages delivered to all open tabs
- Better user experience
- Handles reconnection gracefully

---

## Debugging Tips

### 1. Check WebSocket Connection

```javascript
// Frontend console
console.log(wsRef.current?.readyState);
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
```

### 2. Monitor Message Flow

```javascript
// Backend: message-handlers.js
console.log(`[CHAT_MESSAGE] User ${userId} → User ${recipientId}`);
console.log(`[CHAT_MESSAGE] Payload:`, messagePayload);
```

### 3. Check Online Status

```javascript
// Backend: connect-ws.js
console.log(`Online users:`, Array.from(fastify.onlineUsers.keys()));
```

### 4. Verify Database

```bash
# Check recent messages
sqlite3 data/dev.db "SELECT * FROM Message ORDER BY createdAt DESC LIMIT 10;"
```

---

## Performance Considerations

### 1. Message Pagination (TODO)

Currently loads all messages - should implement pagination:

```javascript
// Add limit & offset
const messages = await prisma.message.findMany({
  where: { ... },
  take: 50,
  skip: offset,
  orderBy: { createdAt: "desc" },
});
```

### 2. WebSocket Connection Pooling

Already implemented via `onlineUsers` Map - efficient for 1000s of users.

### 3. Database Indexes

Already optimized with composite indexes on `[senderId, recipientId]`.

---

## Security Features

✅ **Authentication:** WebSocket requires `fastify.authenticate`  
✅ **Authorization:** Verifies friendship before sending messages  
✅ **Block System:** Cannot message blocked users  
✅ **Input Validation:** Validates recipient ID, message content  
✅ **SQL Injection:** Protected by Prisma ORM  
✅ **XSS Protection:** Frontend sanitizes message display

---

## Summary

The chat system elegantly combines:

1. **WebSocket** for instant message delivery and typing indicators
2. **REST API** for message history and batch operations
3. **CustomEvents** for loosely-coupled frontend architecture
4. **Optimistic updates** for perceived performance
5. **Multi-device support** via Set-based connection tracking
6. **Read receipts** with real-time delivery when sender is online

This architecture scales well and provides a smooth, WhatsApp-like experience!
