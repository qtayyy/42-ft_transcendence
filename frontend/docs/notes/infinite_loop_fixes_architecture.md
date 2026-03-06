# Feature Overview: Infinite Loop Resolution

This document explains the architecture and fixes applied to resolve the "Maximum update depth exceeded" errors in the game frontend.

## System Architecture & Context

The frontend receives game state updates via WebSocket at approximately 60 frames per second. These updates are stored in a central `gameState` React state. Many components and hooks subscribe to this state to update their own local UI elements (pause screens, timers, disconnect alerts).

## Workflow & Data Flow

1. **WebSocket Message**: `GAME_STATE` payload arrives.
2. **SocketProvider Handler**: Compares the new payload with the current `gameState`.
3. **Stability Filter**: If only high-frequency visual data (like ball position) changed marginally, the update is skipped for the React state.
4. **GamePage Effects**: Components like `GamePage` use `useEffect` to sync metadata from `gameState` to local UI state (`pauseInfo`, `disconnectInfo`).
5. **Equality Checks**: The `GamePage` effects now perform strict equality checks before calling `setState` to prevent cascading render loops.

## Design Decisions & Trade-offs

- **Threshold Update**: I introduced a 0.1 unit threshold for ball movement in the `SocketProvider`. This significantly reduces the frequency of React re-renders while keeping the game logic (score, pause, etc.) perfectly in sync.
- **Field-level dependencies**: By narrowing `useEffect` dependencies to specific primitive values (e.g., `gameState?.paused`) instead of the entire `gameState` object, we prevent unnecessary hook executions.

## Learning Corner

### Snippet: Stable Pause Info Sync

In `app/(protected)/game/[matchId]/page.tsx`:

```tsx
setPauseInfo(prev => {
    if (prev &&
        prev.pausedBy === pausedBy &&
        prev.pausedByName === pausedByName &&
        prev.myReadyToResume === myReady &&
        prev.opponentReadyToResume === opponentReady
    ) {
        return prev; // No change, prevent re-render
    }
    return { ... }; // Meaningful change, trigger update
});
```

This pattern is essential for nested state objects that derive from frequently changing parent state.
