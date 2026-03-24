# Canvas Render Loop Architecture

## A. Feature Overview

This note documents the browser-frame render loop used by the Pong canvas.

## B. System Architecture & Context

Gameplay snapshots still come from the existing local and remote game runtimes.
The frontend now decouples drawing from React state commits by rendering on
`requestAnimationFrame`.

## C. Workflow & Data Flow

1. A new authoritative game snapshot arrives.
2. `PongGame` stores the previous and latest snapshots in refs.
3. A `requestAnimationFrame` loop runs independently of React updates.
4. Each frame interpolates ball and paddle positions between the two snapshots.
5. The canvas draws that interpolated frame state.

## D. Design Decisions & Trade-offs

- Rendering no longer waits for each React effect pass before the next draw.
- Interpolation only applies while the match is actively playing.
- Score changes and other discontinuities skip interpolation and render the
  latest authoritative snapshot directly.

## E. Edge Cases & Error Handling

- If there is no previous snapshot yet, the latest snapshot is rendered as-is.
- If the game is paused, waiting, or finished, interpolation is bypassed.

## F. Learning Corner

This is not client-side prediction. The loop only smooths the visual transition
between two server/local snapshots; gameplay authority still lives in the
runtime.
