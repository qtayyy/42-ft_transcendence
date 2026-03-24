# Gameplay Broadcast Rate Note

## Overview

This change keeps routine gameplay broadcasts aligned with the 60 FPS
simulation tick.

## Why It Helps

Power-up collisions and paddle movement are server-authoritative. When the
client only receives routine snapshots at 30 FPS, abrupt server-side changes
such as speed boosts or paddle-size updates can look jumpy and controls can
feel less immediate.

Restoring routine snapshots to 60 FPS reduces the delay between:

- a key press reaching the backend and the next visible paddle update
- a power-up being applied on the server and the next rendered ball/paddle state

## What Did Not Change

- game rules
- simulation tick rate
- pause/resume/game-over logic
- the overall WebSocket architecture

## Trade-off

This increases routine WebSocket traffic compared with 30 FPS broadcasting, but
it gives the client fresher authoritative state and is a better fit for the
current no-interpolation renderer.
