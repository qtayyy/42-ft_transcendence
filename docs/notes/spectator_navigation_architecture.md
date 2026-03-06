# Spectator Navigation Architecture

## A. Feature Overview
The Spectator Navigation Lock prevents users from navigating away from an active match (either as a player or spectator) via global UI elements like the Header logo or Profile menu. This ensures that the game session remains stable and prevents accidental disconnects or Next.js rendering errors during sensitive game states.

## B. System Architecture & Context
The system relies on the `useGame` hook which provides the global `gameState`. The `Header` component acts as a gatekeeper for global navigation.

## C. Workflow & Data Flow
1. User enters a match (Player or Spectator).
2. `SocketProvider` syncs `gameState`.
3. User attempts to navigate away via `Header` logo/menu or in-app links (`a[href]`).
4. `NavigationGuard` state (`showNavGuard`, `pendingPath`) is triggered instead of immediate navigation.
5. Global `NavigationGuard` dialog displays options: "Stay in Match", "Back to Lobby", or "Leave Game".
6. If "Leave Game" is chosen, the `pendingPath` is pushed and cleanup logic (e.g. `UNVIEW_MATCH`) is executed.

## D. Design Decisions & Trade-offs
- **Decision**: Use a global `NavigationGuard` component in the `RootLayout` synced via `GameContext`.
- **Decision**: Allow the navigation buttons to remain visually active (as requested) but intercept the action to prevent accidental data loss or session errors.
- **Trade-off**: Requires centralizing match cleanup logic in the `NavigationGuard` component.

## E. Learning Corner
```javascript
  const isGameActive = useMemo(() => {
    return gameState && !gameState.gameOver;
  }, [gameState]);
```
This snippet efficiently determines the lock state by checking if a game object exists and hasn't yet reached a "finished" status.

```javascript
  const navigateTo = useCallback((path: string) => {
    if (isGameActive) {
      toast.warning("Navigation disabled during active match.");
      return;
    }
    router.push(path);
  }, [isGameActive, router]);
```
By wrapping navigation in a guarded function, we ensure consistent behavior across all menu items.
