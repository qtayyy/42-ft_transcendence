# Friend Request System Architecture

## Table of Contents
1. [Overview](#overview)
3. [Database Schema](#database-schema)
4. [System Architecture](#system-architecture)
5. [How Sending Friend Request Works](#how-sending-friend-request-works)
6. [How Accepting Friend Request Works](#how-accepting-friend-request-works)
7. [How Declining Friend Request Works](#how-declining-friend-request-works)
8. [How Removing Friends Works](#how-removing-friends-works)
9. [How Getting Friends List Works](#how-getting-friends-list-works)
10. [Real-time Notifications](#real-time-notifications)
11. [Key Components](#key-components)
12. [Complete Code Examples](#complete-code-examples)

---

## Overview

The friend request system allows users to:
- **Send friend requests** to other users
- **Accept or decline** incoming friend requests
- **View their friends list** (only accepted friendships)
- **View pending requests** (requests they received)
- **Remove friends** (unfriend)
- **Receive real-time notifications** when requests are sent or accepted

The system uses:
- **REST API** for all CRUD operations (create, read, update, delete)
- **WebSocket** for real-time notifications only
- **Database (SQLite)** to persist friendships
- **Block system integration** (cannot send requests to blocked users)

---

## Database Schema

### Friendship Model (Prisma)

```prisma
enum FriendshipStatus {
  PENDING   // Request sent but not yet accepted
  ACCEPTED  // Both users are now friends
  DECLINED  // Request was rejected
}

model Friendship {
  id          Int              @id @default(autoincrement())
  
  requester   Profile          @relation("RequesterRelations", fields: [requesterId], references: [id])
  requesterId Int              // User who sent the request
  
  addressee   Profile          @relation("AddresseeRelations", fields: [addresseeId], references: [id])
  addresseeId Int              // User who received the request
  
  status      FriendshipStatus @default(PENDING)
  createdAt   DateTime         @default(now())

  @@unique([requesterId, addresseeId])  // Prevents duplicate requests
}
```

**Key Points:**
- **requester** = User who sent the friend request
- **addressee** = User who received the friend request
- **status** = PENDING → ACCEPTED or DECLINED
- **Unique constraint** = Can't send duplicate requests to same person
- **Bidirectional lookup** = Can find friendship from either user's perspective

---

## System Architecture

### Frontend Components:

1. **useFriends Hook** (`frontend/hooks/use-friends.tsx`)
   - Fetches friends list and pending requests
   - Provides `refetch()` function to reload data
   - Listens for real-time updates via CustomEvents

2. **Profile Page** (`frontend/app/(protected)/profile/[username]/page.tsx`)
   - Displays "Add Friend" button on other users' profiles
   - Handles sending friend requests
   - Shows request status (pending, accepted, etc.)

3. **Chat Page** (`frontend/app/(protected)/chat/page.tsx`)
   - Shows friends list in sidebar
   - Listens for friend request notifications
   - Auto-refreshes when requests accepted

4. **Socket Context** (`frontend/context/socket-context.tsx`)
   - Receives WebSocket events: `FRIEND_REQUEST`, `FRIEND_ACCEPTED`
   - Dispatches CustomEvents to notify components
   - Shows toast notifications

### Backend Components:

5. **Friend Request Routes** (`backend/routes/api/friends/`)
   - `POST /api/friends/request` - Send friend request
   - `PUT /api/friends/request/:id/accept` - Accept request
   - `PUT /api/friends/request/:id/decline` - Decline request
   - `GET /api/friends` - Get all accepted friends
   - `GET /api/friends/pending` - Get pending requests (received)
   - `DELETE /api/friends/:friendId` - Remove friend

6. **WebSocket Friend Notifier** (`backend/plugins/ws-utils/ws-friend.js`)
   - `notifyFriendReq()` - Send real-time notification to addressee
   - `notifyFriendStatus()` - Notify all friends when user goes online/offline

7. **Database (SQLite)**
   - Stores all Friendship records
   - Enforces unique constraint (no duplicates)
   - Indexed for fast lookups

---

## How Sending Friend Request Works

### Complete Step-by-Step Flow:

**Step 1: User Initiates Request**
- User visits another user's profile page
- Clicks "Add Friend" button
- Frontend sends `POST /api/friends/request`
- Request body: `{ username: "bob" }`

**Step 2: Backend Validates Request**
- Extracts requester ID from JWT token (e.g., Alice = 42)
- Looks up addressee by username (e.g., Bob = 99)
- Validates requester exists in database
- Validates addressee exists in database

**Step 3: Check Block Status**
- Queries Block table for any blocks between users
- Checks both directions: (Alice blocked Bob OR Bob blocked Alice)
- If block exists, return error 403: "Cannot send friend request to this user"

**Step 4: Check Existing Friendship**
- Queries Friendship table for existing relationship
- Checks both directions: (Alice→Bob OR Bob→Alice)
- Handles different statuses:
  - **PENDING**: Return error "Request already sent"
  - **ACCEPTED**: Return error "Already friends"
  - **DECLINED**: Delete old record (allow re-request)
  - **None**: Proceed to create

**Step 5: Create Friendship Record**
- Inserts new row in Friendship table:
  ```javascript
  {
    requesterId: 42,    // Alice
    addresseeId: 99,    // Bob
    status: "PENDING",
    createdAt: now()
  }
  ```
- Database assigns an ID (e.g., 789)

**Step 6: Send Real-time Notification**
- Server checks if Bob is online: `onlineUsers.get(99)`
- If Bob is online:
  - Sends WebSocket event: `FRIEND_REQUEST`
  - Payload includes requester info: `{ requesterId: 42, requesterUsername: "alice" }`
  - Bob's browser receives notification
  - Toast appears: "alice sent you a friend request!"
- If Bob is offline:
  - No WebSocket sent
  - Bob will see request when he logs in and loads pending requests

**Step 7: Confirm to Sender**
- Returns success response: "Friend request sent"
- Alice sees success message on UI
- "Add Friend" button changes to "Pending"

---

## How Accepting Friend Request Works

### Complete Step-by-Step Flow:

**Step 1: User Views Pending Requests**
- Bob logs in or navigates to friends/chat page
- Frontend calls: `GET /api/friends/pending`
- Backend returns all friendships where:
  - `addresseeId = Bob's ID`
  - `status = "PENDING"`
- Bob sees Alice's pending request

**Step 2: User Clicks Accept**
- Bob clicks "Accept" button next to Alice's request
- Frontend sends: `PUT /api/friends/request/789/accept`
- Request ID (789) is the Friendship record ID

**Step 3: Backend Validates Authorization**
- Extracts Bob's ID from JWT token (99)
- Looks up Friendship record by ID (789)
- Checks if Bob is the addressee: `friendRequest.addresseeId === 99`
- If not, return error 403: "Forbidden"
- If request doesn't exist, return error 404: "Friend request not found"

**Step 4: Update Friendship Status**
- Updates database record:
  ```javascript
  UPDATE Friendship
  SET status = "ACCEPTED"
  WHERE id = 789
  ```
- Alice and Bob are now friends!

**Step 5: Send Real-time Notification to Requester**
- Server looks up Bob's profile info (username, avatar)
- Checks if Alice (original requester) is online: `onlineUsers.get(42)`
- If Alice is online:
  - Sends WebSocket event: `FRIEND_ACCEPTED`
  - Payload: `{ accepterId: 99, accepterUsername: "bob", accepterAvatar: "..." }`
  - Alice's browser receives notification
  - Toast appears: "bob accepted your friend request!"
  - Alice's friends list automatically refreshes (CustomEvent listener)
- If Alice is offline:
  - No WebSocket sent
  - Alice will see Bob in friends list when she logs in

**Step 6: Confirm to Accepter**
- Returns success response: "Friend request accepted"
- Bob's pending requests list removes Alice's request
- Bob's friends list now includes Alice

---

## How Declining Friend Request Works

### Complete Step-by-Step Flow:

**Step 1: User Clicks Decline**
- Bob sees Alice's pending friend request
- Clicks "Decline" or "Reject" button
- Frontend sends: `PUT /api/friends/request/789/decline`

**Step 2: Backend Validates Authorization**
- Extracts Bob's ID from JWT token (99)
- Looks up Friendship record by ID (789)
- Checks if Bob is the addressee: `friendRequest.addresseeId === 99`
- If not, return error 403: "Forbidden"
- If request doesn't exist, return error 404: "Not found"

**Step 3: Update Friendship Status**
- Updates database record:
  ```javascript
  UPDATE Friendship
  SET status = "DECLINED"
  WHERE id = 789
  ```
- Record remains in database with DECLINED status
- Alice can send another request later (old DECLINED record will be deleted)

**Step 4: No Real-time Notification Sent**
- Server does NOT notify Alice that Bob declined
- This is intentional for privacy
- Alice won't get a notification, request just stays "Pending" from her view

**Step 5: Confirm to Decliner**
- Returns success response: "Friend request declined"
- Bob's pending requests list removes Alice's request
- Alice does NOT appear in Bob's friends list

---

## How Removing Friends Works

### Complete Step-by-Step Flow:

**Step 1: User Initiates Unfriend**
- User clicks "Remove Friend" or "Unfriend" button
- Frontend confirms action (optional confirmation dialog)
- Frontend sends: `DELETE /api/friends/99`
- Parameter is the friend's user ID

**Step 2: Backend Validates Request**
- Extracts requester's ID from JWT token (Alice = 42)
- Extracts friend ID from URL parameter (Bob = 99)
- Validates friend ID is valid number
- Validates friend ID is not same as requester (can't unfriend yourself)

**Step 3: Find Existing Friendship**
- Queries database for ACCEPTED friendship:
  ```javascript
  WHERE status = "ACCEPTED" AND (
    (requesterId = 42 AND addresseeId = 99) OR
    (requesterId = 99 AND addresseeId = 42)
  )
  ```
- Checks both directions (doesn't matter who sent original request)
- If not found, return error 404: "Friendship not found"

**Step 4: Delete Friendship Record**
- Permanently deletes from database:
  ```javascript
  DELETE FROM Friendship WHERE id = 789
  ```
- Record is completely removed
- Either user can send a new friend request later

**Step 5: No Real-time Notification Sent**
- Server does NOT notify the other user
- Other user will see friend removed when they refresh
- No WebSocket event sent

**Step 6: Confirm to Requester**
- Returns success response: "Friend removed successfully"
- Frontend removes friend from local friends list
- UI updates immediately

---

## How Getting Friends List Works

### Complete Step-by-Step Flow:

**Step 1: Frontend Requests Friends**
- Page loads or user navigates to friends/chat
- Frontend calls: `GET /api/friends`
- No parameters needed (uses JWT authentication)

**Step 2: Backend Gets User's Blocks**
- Extracts user ID from JWT token (Alice = 42)
- Queries Block table for all blocks involving Alice:
  ```javascript
  WHERE blockerId = 42 OR blockedId = 42
  ```
- Creates Set of blocked user IDs
- This ensures blocked users don't appear in friends list

**Step 3: Query All Friendships**
- Queries Friendship table:
  ```javascript
  WHERE status = "ACCEPTED" AND (
    requesterId = 42 OR addresseeId = 42
  )
  INCLUDE requester (id, username, avatar)
  INCLUDE addressee (id, username, avatar)
  ```
- Gets all accepted friendships where Alice is either requester or addressee
- Includes full profile data for both users

**Step 4: Map to Friend Objects**
- For each friendship, determine which user is the friend:
  ```javascript
  const friend = friendship.requesterId === myId 
    ? friendship.addressee  // I was requester, friend is addressee
    : friendship.requester; // I was addressee, friend is requester
  ```
- Creates array of friend profile objects

**Step 5: Filter Out Blocked Users**
- Removes any friends who are in the blocked set
- This handles edge case where friendship exists but users blocked each other after

**Step 6: Return Friends List**
- Returns array of friend objects:
  ```javascript
  [
    { id: 99, username: "bob", avatar: "..." },
    { id: 123, username: "charlie", avatar: "..." },
    { id: 456, username: "diana", avatar: null }
  ]
  ```
- Frontend receives list and displays in UI

### Getting Pending Requests:

**Similar flow for `GET /api/friends/pending`:**

**Step 1:** Frontend calls endpoint

**Step 2:** Backend queries:
```javascript
WHERE status = "PENDING" AND addresseeId = 42
INCLUDE requester (id, username, avatar)
```

**Step 3:** Returns only requests WHERE current user is the ADDRESSEE (received requests)

**Step 4:** Frontend displays pending requests with Accept/Decline buttons

---

## Real-time Notifications

### When User Comes Online:

**Step 1: User Logs In**
- User authenticates and WebSocket connects
- `connect-ws.js` extracts user ID from JWT

**Step 2: Add to Online Users**
- Server adds connection to Map:
  ```javascript
  onlineUsers.set(42, new Set([connection]))
  ```

**Step 3: Notify All Friends**
- Server calls: `fastify.notifyFriendStatus(42, "online")`
- Queries database for all Alice's ACCEPTED friendships
- Gets list of all friend IDs

**Step 4: Send to Each Friend**
- For each friend, checks if they're online
- If online, sends WebSocket event:
  ```javascript
  {
    event: "FRIEND_STATUS",
    payload: {
      id: 42,
      username: "alice",
      status: "online"
    }
  }
  ```

**Step 5: Friends Receive Notification**
- Each online friend's browser receives event
- Socket context dispatches CustomEvent: `friendStatusChange`
- UI updates friend's status indicator to "online" (green dot)
- Optional toast: "alice is now online!"

### When User Goes Offline:

**Same process but with `status: "offline"`**
- Triggered when last WebSocket connection closes
- All friends notified that user went offline
- Status indicator changes to "offline" (gray dot)

### When Friend Request Sent:

**Step 1:** Requester sends POST request

**Step 2:** Server creates Friendship record with PENDING status

**Step 3:** Server checks if addressee is online

**Step 4:** If online, sends WebSocket event:
```javascript
{
  event: "FRIEND_REQUEST",
  payload: {
    requesterId: 42,
    requesterUsername: "alice",
    addresseeId: 99
  }
}
```

**Step 5:** Addressee's browser receives event
- Socket context dispatches CustomEvent: `friendRequest`
- Toast appears: "alice sent you a friend request!"
- Pending requests list automatically refreshes

### When Friend Request Accepted:

**Step 1:** Addressee accepts request

**Step 2:** Server updates Friendship status to ACCEPTED

**Step 3:** Server checks if original requester is online

**Step 4:** If online, sends WebSocket event:
```javascript
{
  event: "FRIEND_ACCEPTED",
  payload: {
    accepterId: 99,
    accepterUsername: "bob",
    accepterAvatar: "..."
  }
}
```

**Step 5:** Requester's browser receives event
- Socket context dispatches CustomEvent: `friendAccepted`
- Toast appears: "bob accepted your friend request!"
- Friends list automatically refreshes (via useFriends hook)

---

## Key Components

### 1. Frontend: useFriends Hook

**File:** `frontend/hooks/use-friends.tsx`

**Purpose:** Fetch and manage friends data

```typescript
export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both friends and pending requests in parallel
      const [friendsRes, pendingRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/friends/pending'),
      ]);
      
      if (!friendsRes.ok) throw new Error('Failed to fetch friends');
      if (!pendingRes.ok) throw new Error('Failed to fetch pending requests');
      
      const friendsData = await friendsRes.json();
      const pendingData = await pendingRes.json();
      
      setFriends(friendsData || []);
      setPending(pendingData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Listen for real-time updates
  useEffect(() => {
    const handleFriendAccepted = () => fetchAll();
    window.addEventListener("friendAccepted", handleFriendAccepted);
    return () => window.removeEventListener("friendAccepted", handleFriendAccepted);
  }, [fetchAll]);

  // Expose refetch function for manual refresh
  const refetch = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  return { friends, pending, loading, error, refetch };
}
```

**Usage:**
```typescript
const { friends, pending, loading, error, refetch } = useFriends();

// Display friends list
{friends.map(friend => (
  <div key={friend.id}>{friend.username}</div>
))}

// Display pending requests
{pending.map(req => (
  <div key={req.id}>
    {req.requester.username}
    <button onClick={() => acceptRequest(req.id)}>Accept</button>
  </div>
))}
```

### 2. Frontend: Socket Context

**File:** `frontend/context/socket-context.tsx`

**Purpose:** Handle WebSocket events for friend updates

```typescript
websocket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  const payload = msg.payload;
  
  switch (msg.event) {
    case "FRIEND_REQUEST":
      // Someone sent you a friend request
      toast.info(`${payload.requesterUsername} sent you a friend request!`);
      
      // Dispatch CustomEvent so components can react
      window.dispatchEvent(
        new CustomEvent("friendRequest", { detail: payload })
      );
      break;

    case "FRIEND_ACCEPTED":
      // Your friend request was accepted
      toast.success(`${payload.accepterUsername} accepted your friend request!`);
      
      // Dispatch CustomEvent to refresh friends list
      window.dispatchEvent(
        new CustomEvent("friendAccepted", { detail: payload })
      );
      break;

    case "FRIEND_STATUS":
      // Friend went online or offline
      const { id, username, status } = payload;
      
      // Update online friends list in context
      setOnlineFriends(prev => {
        if (status === "online") {
          return [...prev, { id, username }];
        } else {
          return prev.filter(f => f.id !== id);
        }
      });
      
      // Optional toast notification
      if (status === "online") {
        toast.info(`${username} is now online!`);
      }
      
      // Dispatch for other components
      window.dispatchEvent(
        new CustomEvent("friendStatusChange", { 
          detail: { id, username, status } 
        })
      );
      break;
  }
};
```

### 3. Backend: Send Friend Request

**File:** `backend/routes/api/friends/request/send-friend-request.js`

**Purpose:** Create new friend request

```javascript
export default async function (fastify, opts) {
  fastify.post(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;
        const { username } = request.body;

        // 1. Validate both users exist
        const myProfile = await prisma.profile.findUnique({
          where: { id: myId },
        });
        if (!myProfile) {
          return reply.code(400).send({ error: "Invalid user" });
        }

        const addressee = await prisma.profile.findUnique({
          where: { username: username },
        });
        if (!addressee) {
          return reply.code(400).send({ error: "User not found" });
        }

        const addresseeId = addressee.id;

        // 2. Can't add yourself
        if (addresseeId === myId) {
          return reply.code(400).send({ error: "Cannot add yourself" });
        }

        // 3. Check for blocks
        const blockExists = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: myId, blockedId: addresseeId },
              { blockerId: addresseeId, blockedId: myId },
            ],
          },
        });

        if (blockExists) {
          return reply.code(403).send({ 
            error: "Cannot send friend request to this user" 
          });
        }

        // 4. Check existing friendship
        const existing = await prisma.friendship.findFirst({
          where: {
            OR: [
              { requesterId: myId, addresseeId: addresseeId },
              { requesterId: addresseeId, addresseeId: myId },
            ],
          },
        });

        if (existing?.status === "PENDING") {
          return reply.code(400).send({ error: "Request already sent" });
        }
        
        if (existing?.status === "ACCEPTED") {
          return reply.code(400).send({ error: "Already friends" });
        }
        
        // Delete old DECLINED record to allow re-request
        if (existing?.status === "DECLINED") {
          await prisma.friendship.delete({ where: { id: existing.id } });
        }

        // 5. Create new friendship request
        await prisma.friendship.create({
          data: {
            requesterId: myId,
            addresseeId: addresseeId,
            status: "PENDING",
          },
        });

        // 6. Send real-time notification if addressee is online
        const addresseeOnline = fastify.onlineUsers.get(addresseeId);
        if (addresseeOnline) {
          fastify.notifyFriendReq(addresseeId, {
            event: "FRIEND_REQUEST",
            payload: {
              requesterId: myId,
              requesterUsername: myProfile.username,
              addresseeId,
            },
          });
        }

        return reply.code(200).send({ message: "Friend request sent" });
      } catch (error) {
        console.error("Friend request error:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
```

### 4. Backend: Accept Friend Request

**File:** `backend/routes/api/friends/request/:id/accept-friend-request.js`

**Purpose:** Accept pending friend request

```javascript
export default async function (fastify, opts) {
  fastify.put(
    "/accept",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const requestId = Number(request.params.id);
        
        // 1. Find the friend request
        const friendRequest = await prisma.friendship.findUnique({
          where: { id: requestId }
        });

        if (!friendRequest) {
          return reply.status(404).send({ 
            error: "Friend request not found" 
          });
        }

        // 2. Verify current user is the addressee
        if (friendRequest.addresseeId !== request.user.userId) {
          return reply.status(403).send({ error: "Forbidden" });
        }

        // 3. Update status to ACCEPTED
        await prisma.friendship.update({
          where: { id: requestId },
          data: { status: "ACCEPTED" },
        });

        // 4. Notify the original requester
        const accepter = await prisma.profile.findUnique({
          where: { id: request.user.userId },
          select: { id: true, username: true, avatar: true },
        });

        if (accepter) {
          fastify.notifyFriendReq(friendRequest.requesterId, {
            event: "FRIEND_ACCEPTED",
            payload: {
              accepterId: accepter.id,
              accepterUsername: accepter.username,
              accepterAvatar: accepter.avatar ?? null,
            },
          });
        }

        return reply.code(200).send("Friend request accepted");
      } catch (error) {
        console.error("Accept friend request error:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
```

### 5. Backend: Get All Friends

**File:** `backend/routes/api/friends/get-all-friends.js`

**Purpose:** Get list of accepted friends

```javascript
export default async function (fastify, opts) {
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const myId = request.user.userId;

        // 1. Get all blocked user IDs (both directions)
        const blockedUsers = await prisma.block.findMany({
          where: {
            OR: [
              { blockerId: myId },
              { blockedId: myId },
            ],
          },
          select: {
            blockerId: true,
            blockedId: true,
          },
        });

        // Create Set of blocked IDs
        const blockedIds = new Set();
        blockedUsers.forEach((block) => {
          if (block.blockerId === myId) {
            blockedIds.add(block.blockedId);
          } else {
            blockedIds.add(block.blockerId);
          }
        });

        // 2. Get all accepted friendships
        const friends = await prisma.friendship.findMany({
          where: {
            status: "ACCEPTED",
            OR: [
              { requesterId: myId }, 
              { addresseeId: myId }
            ],
          },
          include: {
            requester: { 
              select: { id: true, username: true, avatar: true } 
            },
            addressee: { 
              select: { id: true, username: true, avatar: true } 
            },
          },
        });
        
        // 3. Map to friend objects and filter out blocked users
        const cleanedFriends = friends
          .map((f) => {
            // Return the OTHER user (not me)
            return f.requesterId === myId ? f.addressee : f.requester;
          })
          .filter((friend) => !blockedIds.has(friend.id));
        
        return reply.code(200).send(cleanedFriends);
      } catch (error) {
        console.error("Error fetching friends:", error);
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
```

### 6. Backend: WebSocket Friend Notifier

**File:** `backend/plugins/ws-utils/ws-friend.js`

**Purpose:** Send real-time notifications about friend events

```javascript
import { PrismaClient } from "../../generated/prisma/index.js";
import fp from "fastify-plugin";
import { safeSend } from "../../utils/ws-utils.js";

const prisma = new PrismaClient();

export default fp(async (fastify) => {
  // Notify specific user about friend request or acceptance
  fastify.decorate("notifyFriendReq", (addresseeId, payload) => {
    const conn = fastify.onlineUsers.get(addresseeId);
    safeSend(conn, payload, addresseeId);
  });

  // Notify all friends when user goes online or offline
  fastify.decorate("notifyFriendStatus", async (userId, status) => {
    // 1. Get all of user's accepted friendships
    const friends = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId }, 
          { addresseeId: userId }
        ],
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });

    // 2. Send notification to each friend
    friends.forEach((f) => {
      // Get the friend's ID (not the current user)
      const friendId = f.requesterId === userId 
        ? f.addresseeId 
        : f.requesterId;

      // Check if friend is online
      const friendSocket = fastify.onlineUsers.get(friendId);
      if (!friendSocket) return; // Friend is offline, skip

      // Send status update
      safeSend(
        friendSocket,
        {
          event: "FRIEND_STATUS",
          payload: {
            id: userId,
            username: f.requesterId === userId
              ? f.requester.username
              : f.addressee.username,
            status, // "online" or "offline"
          },
        },
        friendId
      );
    });
  });
});
```

---

## Complete Code Examples

### Example 1: Sending Friend Request (Frontend)

```typescript
// Profile page of user "bob"
const handleSendFriendRequest = async () => {
  try {
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob' }),
    });

    if (!response.ok) {
      const error = await response.json();
      toast.error(error.error || 'Failed to send request');
      return;
    }

    const data = await response.json();
    toast.success(data.message); // "Friend request sent"
    
    // Update UI to show "Pending" instead of "Add Friend"
    setRequestStatus('pending');
  } catch (error) {
    toast.error('Failed to send friend request');
  }
};
```

### Example 2: Accepting Friend Request (Frontend)

```typescript
// Pending requests list
const handleAcceptRequest = async (requestId: number) => {
  try {
    const response = await fetch(`/api/friends/request/${requestId}/accept`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Failed to accept request');
    }

    toast.success('Friend request accepted!');
    
    // Refresh both pending and friends lists
    refetch();
  } catch (error) {
    toast.error('Failed to accept friend request');
  }
};
```

### Example 3: Displaying Friends List

```typescript
// Chat page or friends page
export default function FriendsPage() {
  const { friends, pending, loading, error } = useFriends();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* Friends List */}
      <h2>Friends ({friends.length})</h2>
      {friends.map(friend => (
        <div key={friend.id} className="friend-item">
          <img src={friend.avatar || '/default-avatar.png'} alt="" />
          <span>{friend.username}</span>
          <button onClick={() => removeFriend(friend.id)}>
            Unfriend
          </button>
        </div>
      ))}

      {/* Pending Requests */}
      <h2>Pending Requests ({pending.length})</h2>
      {pending.map(req => (
        <div key={req.id} className="pending-item">
          <img src={req.requester.avatar || '/default-avatar.png'} alt="" />
          <span>{req.requester.username}</span>
          <button onClick={() => acceptRequest(req.id)}>Accept</button>
          <button onClick={() => declineRequest(req.id)}>Decline</button>
        </div>
      ))}
    </div>
  );
}
```

### Example 4: Real-time Friend Request Notification

```typescript
// In component that displays notifications
useEffect(() => {
  const handleFriendRequest = (event: CustomEvent) => {
    const { requesterUsername } = event.detail;
    
    // Show notification
    toast.info(`${requesterUsername} sent you a friend request!`, {
      action: {
        label: 'View',
        onClick: () => router.push('/friends'),
      },
    });
    
    // Refresh pending requests list
    refetch();
  };

  window.addEventListener("friendRequest", handleFriendRequest as EventListener);
  
  return () => {
    window.removeEventListener("friendRequest", handleFriendRequest as EventListener);
  };
}, [refetch, router]);
```

### Example 5: Database Query - Find Friendship

```javascript
// Check if friendship exists between two users
const friendship = await prisma.friendship.findFirst({
  where: {
    OR: [
      { requesterId: 42, addresseeId: 99 },  // Alice → Bob
      { requesterId: 99, addresseeId: 42 },  // Bob → Alice
    ],
  },
});

if (friendship) {
  switch (friendship.status) {
    case "PENDING":
      console.log("Request is pending");
      break;
    case "ACCEPTED":
      console.log("They are friends");
      break;
    case "DECLINED":
      console.log("Request was declined");
      break;
  }
} else {
  console.log("No friendship record exists");
}
```

---

## Summary

The friend request system provides a complete social connection feature with:

✅ **Send Requests** - Users can send friend requests by username  
✅ **Accept/Decline** - Recipients can accept or decline requests  
✅ **Friends List** - View all accepted friends  
✅ **Pending Requests** - View incoming requests  
✅ **Remove Friends** - Unfriend option available  
✅ **Block Integration** - Cannot send requests to blocked users  
✅ **Real-time Notifications** - WebSocket notifications for requests and acceptance  
✅ **Online Status** - Friends notified when you go online/offline  
✅ **Bidirectional Lookup** - Friendship works both ways regardless of who requested  
✅ **Duplicate Prevention** - Unique constraint prevents duplicate requests

### Key Design Decisions:

**Why Bidirectional Lookup?**
- Friendship is mutual - doesn't matter who sent request
- Both users can see each other in friends list
- Queries check both `requesterId` and `addresseeId`

**Why Keep DECLINED Records?**
- Prevents spam (can track declined requests)
- Deleted when user sends new request
- Allows re-requesting after decline

**Why No Notification on Decline?**
- Privacy consideration
- Requester doesn't get explicit rejection notification
- Request simply stays "Pending" from their view

**Why Block Check?**
- Prevents harassment
- Users can't send requests to people who blocked them
- Works both directions

**Why WebSocket for Notifications Only?**
- REST API is simpler for CRUD operations
- WebSocket adds real-time feel for important events
- Hybrid approach provides best UX
