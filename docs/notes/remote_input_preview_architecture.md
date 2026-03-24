# Remote Input Preview Architecture

## A. Feature Overview

This note documents the small client-side input preview added to remote Pong
matches.

## B. System Architecture & Context

Remote matches remain server-authoritative. The frontend still sends movement
commands over the shared WebSocket connection and still renders the latest
authoritative snapshot from the backend.

## C. Workflow & Data Flow

1. On the first `UP` or `DOWN` key press, the client sends one movement event.
2. The frontend applies a one-step optimistic paddle Y preview immediately.
3. The next authoritative `GAME_STATE` snapshot replaces that preview.
4. When the movement key is released, the client sends a stop event and clears
   the preview.

## D. Design Decisions & Trade-offs

- Repeated `keydown` events while holding a movement key are ignored if the
  direction did not change.
- This reduces redundant tunnel traffic and improves responsiveness on the
  first press.
- The preview is intentionally small and short-lived so it does not drift away
  from server truth.

## E. Edge Cases & Error Handling

- Spectators never create input previews.
- If the backend snapshot arrives immediately, the optimistic value is cleared
  and the server position takes over.

## F. Learning Corner

The preview only bridges the gap before the next server snapshot. It does not
replace authoritative movement logic, so collision and scoring behavior stay
fully server-owned.
