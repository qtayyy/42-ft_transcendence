# Remote Play (1v1 & Tournament) — Feature Explanation (Repo-Grounded)

## 0) Metadata
- Feature: Remote Play (1v1 & Tournament)
- Date: 2026-02-28
- Scope: Explain-only
- Keywords searched: remote play, websocket, matchmaking, game loop
- Entry points (first guesses): `/game/remote/*`, `backend/plugins/ws-utils/*`

---

## 1) Feature Overview
### User flow
- Select "Remote Play" -> "Single Match" or "Tournament" in `/game/new`
- User connects to real-time `WebSocket` pipeline bridging to the game backend.
- UI drops user into a Matchmaking queue `waiting` state overlay.
- Backend resolves match and fires `MATCH_FOUND` resulting in transition lock to the active arena URL `/game/<matchId>`.
- Client streams keystrokes `W/S/Arrow`.
- Server-authoritative engine calculates exact ball bounce matrix and broadcasts definitive `GAME_STATE` to all peers at 60 FPS.
- Server engine dictates timer end, saving automatically to PostgreSQL and firing `GAME_OVER`.

### Success states
- Peer-to-peer visual mirror where the ball bounces identically on both screens without manual local offset calculation.

### Error / empty states
- Validation error: Incorrect URL access without existing `ws-game` room drops user back.
- Not found: Stale match UUID.
- Server/network error: WebSocket disconnect initiates a 30-second automated grace period pause state.
- Unauthorized: Anonymous users cannot make WS connections.

---

## 2) Repo Discovery Summary (Evidence Map)
> List real files discovered in the repo. Every bullet must be a real path and explain why it matters.

### a) Routes/Pages (UI entry points)
- `frontend/app/(protected)/game/remote/single/page.tsx:L1-L150` — Remote matchmaking wait-room UI.
- `frontend/app/(protected)/game/[matchId]/page.tsx:L1-L300` — Central renderer.

### b) UI Components (render + handlers)
- `frontend/components/game/PongGame.tsx:L1-L216` — Drawing loop interpreting strict backend `gameState` payload map instead of calculating it via local loop.

### c) State/Data (useState/useReducer/Context/Redux/Zustand/TanStack Query/etc.)
- `frontend/context/socket-context.tsx:L1-L400` — Central nervous system mapping WS traffic to React Context wrappers. Ensures single valid connection across navigations.

### d) API Client Modules (fetch/axios wrappers)
- N/A natively (Handled exclusively by standard WS browser protocols).

### e) Backend Routes/Controllers (request entry)
- `backend/routes/ws/connect-ws.js:L1-L100` — Initial Fastify WebSocket handshake route interceptor.

### f) Services / Business Logic (domain rules)
- `backend/plugins/ws-utils/ws-game.js:L380-L690` — Queue sorter and lobby instantiation factory.
- `backend/plugins/ws-utils/ws-game-matches.js:L801-L1392` — Authoritative real-time 60fps NodeJS mathematical map engine. Deals with physics vectors.

### g) Data Models / Schemas / Queries (persistence)
- `backend/plugins/ws-utils/ws-game-matches.js` — Invokes `prisma.match.create` natively closing the loop upon zero-hour timers.

### h) Side Effects / Async (queues/emails/uploads/cron/external APIs)
- Disconnect loops executing `setTimeout` arrays counting 30,000 milliseconds for forfeit timers.

### i) Security / Middleware (auth, perms, validation)
- WS connection upgrades are verified using the JWT intercept layer mapping socket connections strictly to verified database user IDs.

### j) Observability (logs/metrics/tracing)
- Rapid real-time console tracing for physics abnormalities. `debug overlay` in `PongGame.tsx`.

### k) Tests (unit/integration/e2e)
- N/A

---

## 3) File Index (Navigation Map)
> Quick jump list. Keep it short and only include files actually used by this feature.

- UI:
  - `frontend/app/(protected)/game/[matchId]/page.tsx` — Arena Shell
  - `frontend/components/game/PongGame.tsx` — Canvas Renderer
- State/Data:
  - `frontend/context/socket-context.tsx` — WebSocket Global context
- API Client:
  - (WebSocket native wrapper)
- Backend Routes/Controllers:
  - `backend/routes/ws/connect-ws.js` — Connection Entry
- Services:
  - `backend/plugins/ws-utils/ws-game.js` — Matchmaker
  - `backend/plugins/ws-utils/ws-game-matches.js` — Physics Engine
- Data Layer:
  - Inline Prisma queries
- Side Effects/Async:
  - Memory-based Interval and Timeout hooks

---

## 4) End-to-End Call Chain Trace (Primary Path)
Trace runtime path:
UI event → state update → API call → backend handler → service → DB → response → UI render

### Step 1: UI Entry
- Component/Handler: Matchmaking Page button click `joinMatchmaking()`
- Trigger: click
- Inputs: mode ("single")
- Outputs: sends WebSocket message `{ event: "JOIN_MATCHMAKING" }`

### Step 2: Backend Route/Controller
- File: `backend/plugins/ws-utils/ws-game.js`
- Handler: `fastify.decorate("joinMatchmaking")`
- Inputs: parsed Socket message payload.
- Outputs: evaluates length of open rooms.

### Step 3: Service / Business Logic
- File: `backend/plugins/ws-utils/ws-game-matches.js`
- Function: `tryMatchPlayers()` triggering `startRoomGame()`
- Responsibilities: Assigning players to Left/Right bounding box arrays.
- Important branches: Only starts after exactly 2 slots fill.

### Step 4: Side Effects / Async (Physics Engine)
- File: `backend/plugins/ws-utils/ws-game-matches.js`
- Triggered effect: `setInterval(() => { ... }, 16.6)` creating 60 calls per second loop.
- Outputs: Broadcasts WS signal `{ event: "GAME_STATE" }` on every tick.

### Step 5: Response → UI Render
- Response: `WS Message` JSON payload.
- UI update location: `socket-context.tsx` -> updates context -> re-renders `PongGame.tsx`.
- What user sees: Native rendering of exact X/Y coordinates fed directly from backend.

### Step 6: Data Layer / DB
- File: `ws-game-matches.js` -> `endGame()`
- Model/Table: `Match`
- Query/Repo function: `prisma.match.create()`
- Outputs: `WS { event: "GAME_OVER" }` completing connection array requirement.

---

## 5) Walkthroughs (What happens when…)
> Write this like a narrated trace. For each walkthrough: show what the user does, what the UI shows, what request is sent, what backend does, what DB does, and what the UI shows at the end.
> Include file + function references ONLY at the key steps (not everywhere), so it stays readable.

### Walkthrough 1 — Normal Success (Happy Path)
**User story:** User enters matchmaking pool and instantly finds opponent.

1) **User action (UI trigger)**
- What user does: Clicks "Find Match" button.
- Where in code: `frontend/app/(protected)/game/remote/single/page.tsx:L50` — `<Button onClick={joinMatchmaking}>`

2) **Immediate UI behavior**
- What user sees instantly: A loading queue spinner.
- What state changes: Context sets `socketMode = "waiting"`.
- Where: `frontend/context/socket-context.tsx:L80` — `setMatchStatus('searching')`

3) **Request sent**
- Endpoint: WebSocket native stream.
- Client function that sends it: `frontend/context/socket-context.tsx:L120` — `ws.current.send()`
- Payload (high level): `{ event: "JOIN_MATCHMAKING", mode: "single" }`

4) **Backend processing**
- Controller entry: `backend/plugins/ws-utils/ws-game.js:L300` — `fastify.decorate("joinMatchmaking")`
- Business logic: `backend/plugins/ws-utils/ws-game-matches.js:L900` — `tryMatchPlayers()`
- Key rule(s) applied: Must pair exactly two open socket slots together.

5) **Database/persistence**
- What is read/written: Map array insertions (Memory only, no DB initially).
- Where: `backend/plugins/ws-utils/ws-game-matches.js:L920` — `activeMatches.set()`

6) **Response + final UI**
- Response: WS emit `{ event: "GAME_MATCH_START", matchId: "xxx" }`
- UI update: Next.js router transitions contextually.
- Where: `frontend/context/socket-context.tsx:L250` — `router.push('/game/xxx')`
- What user sees: The live renderer pinging 60fps states to Canvas.

---

### Walkthrough 2 — Invalid Input (User mistake)
**User story:** User attempts to force start a game omitting a game mode.

1) **User action**
- Where: UI logic doesn't allow this natively, but tampered packet: `{ event: "JOIN_MATCHMAKING" }`

2) **Where validation happens**
- Frontend validation: No.
- Backend validation: Yes — `backend/plugins/ws-utils/ws-game.js:L310` — `if (!payload.mode) return`

3) **What user sees**
- UI behavior: Indefinite spinner (request drops silently on backend due to schema failure).
- State behavior: Remainder in `searching` mode.

4) **If backend rejects**
- Response status: Unary WS drop.
- Error format: `{ event: "ERROR", message: "Invalid payload" }`
- UI mapping: `<GameOverDialog />` triggers on socket disconnect.

---

### Walkthrough 3 — Not Logged In / Not Allowed
**User story:** User attempts to open WS pipeline holding an expired token.

1) **User action**
- Where: Root `_app.tsx` implicit socket hydration mount.

2) **Where it’s blocked**
- Backend middleware/guard: `backend/routes/ws/connect-ws.js:L20` — `fastify.authenticate()` pre-upgrade validation.

3) **What happens**
- Response: Upgrade request drops. `401 Unauthorized` WS Handshake closure.
- UI behavior: Redirection to login page immediately upon Next.js app hook hydration.

---

### Walkthrough 4 — Server/Network Failure (Request can’t complete)
**User story:** Opponent drops WiFi connection strictly mid-match.

1) **User action**
- Where: N/A - physical network disruption.

2) **Failure mode**
- `onClose` hook fires on backend WS structure.
- Where error is handled: `backend/plugins/ws-utils/ws-game-matches.js:L1200` — `handlePlayerNavigatingAway()`

3) **What user sees**
- UI fallback: Surviving user sees `<PauseDialog />` countdown of 30 seconds giving opponent a chance to reconnect.
- Retry behavior: Dropped client automatically initiates reconnection loop on socket-context.

---

### Walkthrough 5 — Empty Result (Nothing to show, but not an error)
**User story:** N/A (WebSockets are natively persistent streaming loops, not standard polling arrays).

---

## 6) Function-by-Function Catalog
> Only functions/classes actually in the feature path.

For each key function/class:
- Name: `startGameLoop`
- File: `backend/plugins/ws-utils/ws-game-matches.js`
- Signature: `function startGameLoop(gameState, fastify)`
- Responsibility: Main authoritative physics engine. Adjusts velocity vectors.
- Inputs/Outputs: Outputs continuous WebSocket broadcast `GAME_STATE` payload injections.
- Called by: Matchmaker hook trigger.
- Calls: `updateBall`, `updatePaddles`, `broadcastState`.
- Important branches: Throttles or skips physics calculation if `gameState.paused` is evaluated to true ensuring fairness on disconnection.

- Name: `handleSocketMessage`
- File: `frontend/context/socket-context.tsx`
- Signature: `const handleSocketMessage = useCallback((event) => { ... })`
- Responsibility: Main central frontend router and global state setter.
- Important branches: Huge `switch/case` evaluating events like `GAME_MATCH_START` vs `ERROR_MESSAGE`.

---

## 7) Call Graph Diagram
```text
Matchmaking.UI.Button()
  -> SocketContext.ws.send("JOIN_MATCHMAKING")
     -> backend/ws-game.js 
        -> push to queue memory
        -> array full -> instantiate room
           -> send("GAME_MATCH_START")
  -> Router updates location to Arena
  -> Client streams "PADDLE_MOVE" via WS continuously
     -> backend/ws-game-matches.js (setInterval 16.6ms)
        -> calculates ball physics
        -> calculates collisions
        -> send("GAME_STATE") 60x per sec
  -> <PongGame /> redraws Canvas strictly to match incoming GAME_STATE JSON.
  -> Timer 120s concludes 
     -> prisma.match.create()
     -> send("GAME_OVER")
  -> <GameOverDialog /> renders overlay locally
```
