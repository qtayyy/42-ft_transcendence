# Public Matchmaking Room Exit Architecture

## A. Feature Overview

Public 1v1 matchmaking has two user-facing actions that must feel immediate:

1. leaving the host lobby
2. entering public matchmaking and joining an available room instead of being pulled back into stale lobby state

The failure mode here was not a single broken button. It was a loop between stale room state, delayed websocket events, and page-level auto-join behavior.

## B. System Architecture & Context

Relevant files:

- `frontend/app/(protected)/game/remote/single/create/page.tsx`
- `frontend/app/(protected)/game/remote/single/matchmaking/page.tsx`
- `frontend/context/socket-context.tsx`

The create page automatically joins matchmaking when `matchmaking=true`. The matchmaking page also auto-joins and redirects based on `gameRoom`. The socket context owns the global room state and performs route changes when websocket events such as `GAME_ROOM`, `MATCH_FOUND`, and `MATCHMAKING_HOST` arrive.

## C. Workflow & Data Flow

Broken flow:

1. User presses Leave Room or Cancel Search.
2. The page sends `LEAVE_MATCHMAKING` and sometimes `LEAVE_ROOM`.
3. A late `GAME_ROOM`, `MATCH_FOUND`, or `MATCHMAKING_HOST` event arrives from the socket.
4. The stale event restores or redirects the user back into the lobby.
5. The create page sees no stable guard against leaving and auto-sends `JOIN_MATCHMAKING` again.
6. The user looks stuck, and public matchmaking appears unable to join fresh rooms.

Fixed flow:

1. The page marks itself as leaving before navigation.
2. Auto-join and retry effects stop firing while leave is in progress.
3. The shared room state is cleared immediately on leave and again on `MATCHMAKING_LEFT`.
4. The socket context ignores late matchmaking redirect events for a short exit window.
5. A new explicit `JOIN_MATCHMAKING` clears that suppression window so intentional queue joins still work.

## D. Design Decisions & Trade-offs

- The leave suppression lives in the socket context because late websocket events are global, not page-local.
- The page-local `isLeavingRef` guards the immediate race where React effects can fire again before the route change completes.
- The suppression window is short and is reset on new queue/join actions, which keeps the guard narrow instead of globally muting matchmaking behavior.

## E. Edge Cases & Error Handling

- If navigation is slow, the page will still avoid requeueing because `isLeavingRef` blocks the auto-join effects.
- If a late `MATCHMAKING_HOST` or `MATCH_FOUND` arrives after leaving, it is ignored instead of forcing a stale redirect.
- If the user intentionally joins matchmaking again, the next outgoing `JOIN_MATCHMAKING` clears the suppression window immediately.

## F. Learning Corner

Snippet 1:

```tsx
if (isLeavingRef.current) return;
```

This is the smallest possible guard, but it matters a lot. It prevents the page from rejoining queue during the short gap between sending leave events and finishing navigation.

Snippet 2:

```tsx
if (payload?.event === "LEAVE_MATCHMAKING" || payload?.event === "LEAVE_ROOM") {
  suppressMatchmakingRedirectsUntil.current = Date.now() + 3000;
}
```

This creates a brief quarantine period for stale socket events after the user explicitly exits.

Snippet 3:

```tsx
case "MATCHMAKING_LEFT":
  stableDeps.current.setGameRoom(null);
  stableDeps.current.setGameRoomLoaded(true);
  stableDeps.current.setGameState(null);
```

The queue-leave acknowledgement must clear global room state. Without this, later recovery logic can treat old lobby data as still active.
