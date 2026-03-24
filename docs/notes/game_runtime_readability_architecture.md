# Game Runtime Readability

## A. Feature Overview

This refactor makes the gameplay runtime easier to read and maintain without changing the overall architecture.

The main goals were:

- move pure runtime logic out of page components
- replace `any`-heavy props with named interfaces
- make optimistic paddle previews easier to understand
- keep remote and local runtime rendering behavior consistent

## B. System Architecture & Context

The gameplay UI still follows the same high-level shape:

- `game-runtime-page.tsx` coordinates runtime state, navigation guards, and remote/local routing
- `remote-game-runtime-view.tsx` renders the remote match shell and overlays
- `usePongGame.ts` manages direct local WebSocket gameplay state
- `gameRenderer.ts` handles canvas interpolation and drawing

The new helper file, `runtime-helpers.ts`, now owns the pure logic that was previously mixed directly into the page:

- remote state normalization
- pause/disconnect derived data
- tournament guard navigation decisions
- keyboard direction helpers

## C. Workflow & Data Flow

### Remote runtime

1. `game-runtime-page.tsx` reads the authoritative remote game state from context.
2. `runtime-helpers.ts` converts it into the normalized `GameState` shape used by `PongGame`.
3. `remote-game-runtime-view.tsx` renders overlays from named booleans instead of inline JSX condition trees.
4. `PongGame.tsx` renders the canvas using the already-normalized state.

### Local runtime

1. `usePongGame.ts` receives direct WebSocket snapshots.
2. Local optimistic paddle previews are applied only while the authoritative paddle still matches the source position that created the preview.
3. As soon as the authoritative paddle moves, the preview naturally expires without needing a separate reset effect.

## D. Design Decisions & Trade-offs

### Helper extraction

`game-runtime-page.tsx` was carrying a lot of pure logic inline. Extracting that logic into `runtime-helpers.ts` improves readability and reduces accidental duplication.

Trade-off:

- one more file to navigate
- much clearer page-level flow

### Source-based optimistic previews

Instead of resetting optimistic paddle state inside effects, previews now keep both:

- the `sourceY` from the authoritative paddle
- the optimistic `previewY`

That lets the UI show the preview only while the server is still on the original paddle position.

Trade-off:

- slightly richer state shape
- fewer effect-driven resets and clearer intent

### Typed runtime props

`remote-game-runtime-view.tsx` now uses named runtime interfaces rather than `any` props. This makes JSX easier to follow and gives better editor help.

## E. Edge Cases & Error Handling

- Tournament navigation still allows movement between tournament pages while blocking destructive exits.
- Pause and disconnect overlays still sync from authoritative server state after refresh or reconnect.
- Optimistic paddle previews automatically stop applying once a new authoritative paddle position arrives.
- Local tournament result persistence still uses the existing localStorage outbox behavior.

## F. Learning Corner

### Snippet 1: Expiring optimistic previews without an effect

```ts
if (authoritativeY !== optimisticPaddlePreview.sourceY) {
	return normalizedRemoteGameState;
}
```

Why this helps:

- the preview only applies while the server still reflects the original paddle position
- once the server moves, the UI naturally falls back to authoritative state
- no extra reset effect is required

### Snippet 2: Pure runtime normalization

```ts
const normalizedRemoteGameState = useMemo(() => {
	if (!isRemoteGame || !gameState) return null;
	return normalizeRemoteGameState(gameState, gameOverResult);
}, [isRemoteGame, gameState, gameOverResult]);
```

Why this helps:

- the page reads as orchestration code instead of data-massaging code
- the conversion logic becomes easier to test and reason about separately

### Snippet 3: Named overlay booleans in the remote view

```ts
const showWaitingOverlay =
	!!gameState &&
	!gameState.gameStarted &&
	!gameStart &&
	!gameState.paused &&
	!gameOverResult;
```

Why this helps:

- JSX becomes easier to scan
- overlay conditions are easier to debug
- the screen logic reads like intent instead of nested conditionals
