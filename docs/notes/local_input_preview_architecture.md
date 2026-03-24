# Local Input Preview Architecture

## A. Feature Overview

This note documents the small input preview added to the direct local Pong
WebSocket path.

## B. System Architecture & Context

Local matches still run through the local game runtime and its direct
WebSocket route. The frontend remains synchronized to server snapshots, but it
now bridges the first input frame with a tiny local paddle preview.

## C. Workflow & Data Flow

1. The first `PADDLE_MOVE` input for a player is sent over the direct local
   WebSocket.
2. The hook nudges that player’s paddle locally by one paddle-speed step.
3. The next authoritative local game snapshot clears the optimistic value.
4. Releasing the movement key clears the preview and sends the stop event.

## D. Design Decisions & Trade-offs

- Repeated keydown events for the same held direction are ignored.
- The preview only lasts until the next server snapshot, so the runtime still
  owns collisions, scoring, and actual paddle motion.

## E. Edge Cases & Error Handling

- Player 1 and Player 2 previews are tracked independently.
- If the WebSocket is not open, the hook keeps the existing error path and does
  not pretend movement succeeded.

## F. Learning Corner

The preview is not a second game loop. It is just a one-step visual bridge that
removes the dead-feeling gap before the next local snapshot lands.
