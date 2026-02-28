# Local Play (1v1 & Tournament) — Feature Explanation (Repo-Grounded)

## 0) Metadata
- Feature: Local Play (1v1 & Tournament)
- Date: 2026-02-28
- Scope: Explain-only
- Keywords searched: local play, 1v1, tournament, matchId
- Entry points (first guesses): `/game/new` (UI routing), `/game/local/*` (sub-routes)

---

## 1) Feature Overview
### User flow
- Select "Local Play" from the `/game/new` menu.
- Choose between "Single Match" or "Tournament".
- For Single Match, input guest player name; for Tournament, input 2-7 guest names.
- Configuration is saved to `localStorage` representing the match intent.
- User is routed to the game canvas (`/game/<matchId>`), and the game runs locally on the browser client (W/S vs Arrow keys).
- Upon match conclusion, the final score and winner are submitted to the backend to persist the statistics.

### Success states
- Local match initializes correctly using the defined configuration without requiring server websockets.
- Match completion successfully persists the database result to postgres via the REST API.
- Tournament standings update correctly after local matches conclude.

### Error / empty states
- Validation error: Adding fewer than 3 players disables the "Begin Tournament" CTA button on the client side.
- Not found: Attempting to query an invalid tournament UUID yields a "Tournament Not Found" UI.
- Empty data state: A freshly made tournament bracket shows empty matches waiting to be played.

---

## 2) Repo Discovery Summary (Evidence Map)
> List real files discovered in the repo. Every bullet must be a real path and explain why it matters.

### a) Routes/Pages (UI entry points)
- `frontend/app/(protected)/game/new/page.tsx:L1-L130` — Root selection screen for choosing game mode.
- `frontend/app/(protected)/game/local/single/page.tsx:L1-L150` — Setup form for a local 1v1 match.
- `frontend/app/(protected)/game/local/tournament/page.tsx:L1-L200` — Setup form for a local tournament.
- `frontend/app/(protected)/game/local/tournament/[tournamentId]/page.tsx:L1-L200` — Dashboard for viewing local tournament bracket and launching pending matches.
- `frontend/app/(protected)/game/[matchId]/page.tsx:L1-L300` — The core "game runtime" shell that mounts the `<PongGame />`.

### b) UI Components (render + handlers)
- `frontend/components/game/PongGame.tsx:L1-L216` — The presentation component that draws the canvas and handles UI overlays.
- `frontend/components/game/GameOverDialog.tsx:L1-L50` — Dialog triggered when a match concludes to show the winner and close the game loop.

### c) State/Data (useState/useReducer/Context/Redux/Zustand/TanStack Query/etc.)
- `localStorage ("current-match")` — Due to local play not having a server session, match parameters are smuggled across routes via standard browser storage.
- `frontend/hooks/usePongGame.ts:L1-L122` — Manages the physical 60fps local game loop via requestAnimationFrame or interval polling.

### d) API Client Modules (fetch/axios wrappers)
- `axios` (inline inside components) — Makes the POST request to save the match data at game end.

### e) Backend Routes/Controllers (request entry)
- `backend/routes/api/tournament/index.js:L1-L150` — Generates and retrieves tournament bracket representations.
- `backend/routes/api/game/index.js:L1-L100` — Contains the `POST /save-match` handler.

### f) Services / Business Logic (domain rules)
- `backend/game/TournamentManager.js:L1-L700` — Algorithm generating the RR or Swiss bracket for the tournament mode.

### g) Data Models / Schemas / Queries (persistence)
- `backend/routes/api/game/index.js` — Uses Prisma natively `prisma.match.create` to serialize the game result into PostgreSQL.

### h) Side Effects / Async (queues/emails/uploads/cron/external APIs)
- N/A

### i) Security / Middleware (auth, perms, validation)
- Fastify JWT hooks protect the `/api/game/save-match` route. Only authenticated users can save stats.

### j) Observability (logs/metrics/tracing)
- `console.log` traces in tournament bracket calculation loops.

### k) Tests (unit/integration/e2e)
- N/A

---

## 3) File Index (Navigation Map)
> Quick jump list. Keep it short and only include files actually used by this feature.

- UI:
  - `frontend/app/(protected)/game/new/page.tsx` — Mode selection
  - `frontend/app/(protected)/game/local/single/page.tsx` — Local 1v1 setup
  - `frontend/app/(protected)/game/local/tournament/page.tsx` — Tournament setup
  - `frontend/app/(protected)/game/local/tournament/[tournamentId]/page.tsx` — Tourney dashboard
  - `frontend/app/(protected)/game/[matchId]/page.tsx` — Active match rendering shell
  - `frontend/components/game/PongGame.tsx` — Core canvas
- State/Data:
  - `frontend/hooks/usePongGame.ts` — Loop hook
- API Client:
  - (Embedded axios calls)
- Backend Routes/Controllers:
  - `backend/routes/api/tournament/index.js` — Tourney API
  - `backend/routes/api/game/index.js` — Save API
- Services:
  - `backend/game/TournamentManager.js` — Algorithmic logic
- Data Layer:
  - SQL Schema for Match tracking

---

## 4) End-to-End Call Chain Trace (Primary Path)
Trace runtime path:
UI event → state update → API call → backend handler → service → DB → response → UI render

### Step 1: UI Entry
- Component/Handler: `page.tsx`.`handleGameOver()`
- Trigger: Match completes natively via physics collision conditions.
- Inputs: Final `{ p1, p2 }` score string and winner status.
- Outputs: Triggers the axios call sequence.

### Step 2: State/Data Flow
- File: `frontend/app/(protected)/game/[matchId]/page.tsx`
- State owner: `useState` for local game tracking.
- Transitions:
  - Before: `playing`
  - After: `gameOver` screen displayed.

### Step 3: API Call (Client Boundary)
- File: `frontend/app/(protected)/game/[matchId]/page.tsx`
- Endpoint: `POST /api/game/save-match`
- Request shape: `JSON { mode: "local", matchId: string, player1Score, player2Score... }`
- Response shape: `JSON { success: true }`
- Error handling: generic try-catch returning fallback empty response.

### Step 4: Backend Route/Controller
- File: `backend/routes/api/game/index.js`
- Handler: `fastify.post('/save-match')`
- Middleware chain: `onRequest: [fastify.authenticate]`
- Inputs: Authenticated `req.user` + body payload.
- Outputs: 200 OK after DB save.

### Step 5: Service / Business Logic
- N/A (Skips direct business logic outside of generic validation logic unless tournament mode is active)

### Step 6: Data Layer / DB
- File: `backend/routes/api/game/index.js`
- Model/Table: `Match`
- Query/Repo function: `prisma.match.create()`
- Constraints/indexes: Indexed via primary UUID key.

### Step 7: Side Effects / Async (if any)
- N/A

### Step 8: Response → UI Render
- Response: `200 OK`
- UI update location: Stops any pending loops.
- What user sees: Results mapped onto `<GameOverDialog />` providing a button to "Return to Menu".

---

## 5) Walkthroughs (What happens when…)
> Write this like a narrated trace. For each walkthrough: show what the user does, what the UI shows, what request is sent, what backend does, what DB does, and what the UI shows at the end.
> Include file + function references ONLY at the key steps (not everywhere), so it stays readable.

### Walkthrough 1 — Normal Success (Happy Path)
**User story:** User completes a local play match and sees the GameOver dialog.

1) **User action (UI trigger)**
- What user does: Match completes natively via physics collision conditions.
- Where in code: `frontend/app/(protected)/game/[matchId]/page.tsx:L100` — `handleGameOver()`

2) **Immediate UI behavior**
- What user sees instantly: The game loop stops rendering paddles.
- What state changes: `setGameOver(true)`
- Where: `frontend/app/(protected)/game/[matchId]/page.tsx:L105` — `setIsGameOver(true)`

3) **Request sent**
- Endpoint: `POST /api/game/save-match`
- Client function that sends it: `frontend/app/(protected)/game/[matchId]/page.tsx:L110` — `axios.post()`
- Payload (high level): `{ mode: "local", matchId, player1Score, player2Score }`

4) **Backend processing**
- Controller entry: `backend/routes/api/game/index.js:L50` — `fastify.post('/save-match')`
- Business logic: Validates payload shape.
- Key rule(s) applied: User must be authenticated (`onRequest: [fastify.authenticate]`).

5) **Database/persistence**
- What is read/written: Match table insert
- Where: `backend/routes/api/game/index.js:L60` — `prisma.match.create()`

6) **Response + final UI**
- Response: `200` + `{ success: true, matchId }`
- UI update: Displays the GameOver overlay natively.
- Where: `frontend/app/(protected)/game/[matchId]/page.tsx:L150` — `<GameOverDialog />`
- What user sees: Match result dialog with "Return to Menu" button.

---

### Walkthrough 2 — Invalid Input (User mistake)
**User story:** User submits an empty guest name when starting a local single match.

1) **User action**
- Where: `frontend/app/(protected)/game/local/single/page.tsx:L50` — `handleStartMatch`

2) **Where validation happens**
- Frontend validation: Yes — `frontend/app/(protected)/game/local/single/page.tsx:L55` — `guestName.trim() === ""`
- Backend validation: No — Never reaches backend if frontend catches.

3) **What user sees**
- UI behavior: "Start Match" button is disabled; native HTML validation tooltip limits submission.
- State behavior: Input preserved in `guestName` `useState`.

4) **If backend rejects**
- Response status: `400`
- Error format: fastify generic schema error `{ statusCode: 400, message: "Invalid payload" }`
- UI mapping: Form error toast.

---

### Walkthrough 3 — Not Logged In / Not Allowed
**User story:** User's token expires right before the match ends.

1) **User action**
- Where: `frontend/app/(protected)/game/[matchId]/page.tsx:L110` — `axios.post()` save attempt

2) **Where it’s blocked**
- Backend middleware/guard: `backend/routes/api/game/index.js:L50` — `onRequest: [fastify.authenticate]`

3) **What happens**
- Response: `401 Unauthorized`
- UI behavior: AXIOS global interceptor redirects user instantly to `/login`.

---

### Walkthrough 4 — Server/Network Failure (Request can’t complete)
**User story:** Network drops out at exact moment game concludes.

1) **User action**
- Where: `frontend/app/(protected)/game/[matchId]/page.tsx:L110` — `handleGameOver`

2) **Failure mode**
- request times out / `500`
- Where error is handled: `frontend/app/(protected)/game/[matchId]/page.tsx:L120` — `catch (err) { console.error }`

3) **What user sees**
- UI fallback: `<GameOverDialog />` overlay continues to show smoothly.
- Retry behavior: No automatic retry; match results are lost but local flow continues.

---

### Walkthrough 5 — Empty Result (Nothing to show, but not an error)
**User story:** User visits newly created Tournament dashboard.

1) **Request succeeds**
- Response: `200` with array of null matches awaiting play.

2) **UI branch**
- Where the empty branch renders: `frontend/app/(protected)/game/local/tournament/[tournamentId]/page.tsx`
- What user sees: Empty bracket boxes requesting players to "Start Match" iteratively.

---

## 6) Function-by-Function Catalog
> Only functions/classes actually in the feature path.

For each key function/class:
- Name: `handleStartMatch`
- File: `frontend/app/(protected)/game/local/single/page.tsx`
- Signature: `const handleStartMatch = () => void`
- Responsibility: Packages setup options and sets local game pointer state.
- Inputs/Outputs: Outputs `localStorage` payload insertion.
- Called by: UI Button click.
- Calls: Browser Native Storage API `localStorage.setItem`.
- Important branches: Only executes if strings are formulated properly.
- Pitfalls: Sync issues if `localStorage` fails or quota limits.

- Name: `POST /save-match`
- File: `backend/routes/api/game/index.js`
- Signature: `fastify.post('/save-match', async (req, res))`
- Responsibility: Save match data.
- Inputs/Outputs: Input `req.body` containing game outcome -> Output SQL transaction.
- Called by: Game loop exit hook.
- Calls: `prisma.match.create()`.
- Pitfalls: Lacks rigorous payload verification; assumes client outcome is truthful for local play.

---

## 7) Call Graph Diagram
```text
UI_Menu.handleStartMatch()
  -> localStorage.setItem("current-match")
  -> router.push('/game/<matchId>')
     -> <PongGame /> loop running natively
        -> handleGameOver()
           -> axios.post('/api/game/save-match')
              -> fastify.post('/save-match')
                 -> prisma.match.create()
                 -> return { success: true }
           -> <GameOverDialog> renders
```
