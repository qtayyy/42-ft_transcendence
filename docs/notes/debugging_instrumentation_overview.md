# Debugging Instrumentation Overview

This document outlines the logging and instrumentation added to the game matchmaking and start flow to facilitate troubleshooting and monitoring of the game state transitions.

## Overview
To improve the visibility of the game's lifecycle, especially during the critical transition from "Room Lobby" to "Active Game," extensive logging has been added across the stack. This helps identify where messages might be dropped or where role-based permissions (host vs player) are causing issues.

## Instrumented Workflow

### 1. Room Management (Backend)
- **File**: `backend/plugins/ws-utils/game-matches/handlers/start-room-game.js`
- **Instrumentation**: Added `console.log` and `console.error` blocks to track room lookup, player count validation, and player identities when the `START_ROOM_GAME` event is triggered.
- **Key Identifiers**: `[START_ROOM_GAME]`

### 2. WebSocket Communication (Backend)
- **File**: `backend/routes/ws/game.js`
- **Instrumentation**: Logged every incoming WebSocket message type, specific logging for the `START` command, and explicit role validation (ensuring only the 'host' can start the game loop).
- **Key Identifiers**: `[GAME WS]`

### 3. Room Lobby UI (Frontend)
- **File**: `frontend/app/(protected)/game/remote/single/create/page.tsx`
- **Instrumentation**: Logs the state of validation conditions (socket readiness, player count, room existence) when the "Start Match" button is clicked.
- **Key Identifiers**: `[Start Match]`

### 4. Game Loop & Input (Frontend)
- **File**: `frontend/hooks/usePongGame.ts`
- **Instrumentation**: Added logging for keyboard events, WebSocket readiness state, and successful/failed message transmission. Specifically tracks the `Enter` key which triggers the `START` message.
- **Key Identifiers**: `[usePongGame]`

## Learning Corner
- **WebSocket State**: The logs track `socketRef.current?.readyState`. Remember: `1` is `OPEN`, `0` is `CONNECTING`, `2` is `CLOSING`, and `3` is `CLOSED`.
- **Role Validation**: Only the user assigned as `host` in the WebSocket connection can successfully trigger the `game.startGameLoop()` on the backend.

## Design Decisions
- **Console Logs**: Used for immediate visibility in development and staging logs. In a production environment, these should be replaced with a structured logging library if high volume is expected.
- **Explicit Role Check**: Added clear error logging when a non-host player sends a `START` command, helping to debug UI-side role assignment issues.
