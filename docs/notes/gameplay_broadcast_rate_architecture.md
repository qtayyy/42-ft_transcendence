# Gameplay Broadcast Rate Note

## Overview

This change keeps the game simulation tick at 60 FPS while reducing routine
state broadcasts to 30 FPS.

## Why It Helps

The previous runtime sent a full match snapshot on every simulation tick. That
meant the server was serializing and pushing gameplay state 60 times per second
per active match.

Reducing routine broadcast frequency lowers:

- WebSocket message volume
- JSON serialization work
- React state churn on the client
- the chance that short event-loop hiccups turn into visible stutter

## What Did Not Change

- game rules
- simulation tick rate
- pause/resume/game-over logic
- immediate event-driven state pushes already used by gameplay handlers

## Trade-off

Routine visuals may now be based on 30 FPS snapshots instead of 60 FPS
snapshots, but the server simulation still advances every 16.7ms. This is a
deliberate trade-off to reduce transport overhead before adding any client-side
interpolation layer.
