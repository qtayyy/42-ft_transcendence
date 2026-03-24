# Gameplay Hot-Path Logging Note

## Overview

This note documents the low-risk performance pass that removes logging from the
realtime gameplay hot path.

## Why It Matters

The Pong runtime sends and receives a large number of messages while a match is
active:

- remote gameplay broadcasts match state every tick
- local gameplay also sends state updates frequently
- player input sends WebSocket messages repeatedly while movement keys are held

When verbose `console.log` calls run inside these loops, the app spends extra
time formatting payloads and writing to stdout. In Docker/dev setups, that can
turn into visible frame hitching or input delay.

## What Was Reduced

- per-message backend send logging
- per-key frontend input logging
- per-input remote match state logging
- generic per-event WebSocket logging during gameplay

## Expected Outcome

This change does not alter game rules, transport, or architecture. It only
reduces overhead in the busiest realtime paths, so matches should feel less
spiky under load.
