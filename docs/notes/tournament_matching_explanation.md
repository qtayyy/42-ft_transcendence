# Tournament Matching Logic — Feature Explanation (Repo-Grounded)

## 0) Metadata
- Feature: Tournament Matching Logic (Round Robin & Swiss)
- Date: 2026-02-28
- Scope: Explain-only
- Keywords searched: tournament, round robin, swiss, pairing, manager
- Entry points (first guesses): `TournamentManager.js`, `/api/tournament/create`

---

## 1) Feature Overview
### User flow
- Tournament instantiated via "Local Tournament" screen (2-7 guests) or "Remote Matchmaking" (3-8 queue players).
- Backend executes `TournamentManager` to wrap players into structured array brackets mapping `format`, `standings`, and `matches`.
- 3-4 Players (Round Robin): Instantly schedules total matches (everyone plays everyone once). Byes given if count is odd.
- 5-8 Players (Swiss System): Spawns exact pairings dynamically based on point differentials and matchmaking logic per round over 3 fixed rounds.
- Results tabulated mathematically into a finalized Standings leaderboard upon match resolutions.

### Success states
- Precise accurate mathematical pairing and proper byes assigned automatically avoiding duplicates.
- Safe progression of brackets on `updateMatchResult`.
- Graceful forfeit handling granting walkovers sequentially.

### Error / empty states
- Validation error: Impossible player configurations (<3 or >8) trigger 400 rejection APIs or UI blocks.
- Not found: Trying to resolve a match mapped onto an expired bracket ID drops silently.

---

## 2) Repo Discovery Summary (Evidence Map)
> List real files discovered in the repo. Every bullet must be a real path and explain why it matters.

### a) Routes/Pages (UI entry points)
- `frontend/app/(protected)/game/local/tournament/page.tsx:L1-L200` — Front-end instantiation menu blocking bad quantities.

### b) UI Components (render + handlers)
- Not specifically related to internal matching algorithm. Structural maps iterate over API response.

### c) State/Data (useState/useReducer/Context/Redux/Zustand/TanStack Query/etc.)
- Arrays serialized to generic `useState` hooks rendering standard tables natively mapping to backend structures.

### d) API Client Modules (fetch/axios wrappers)
- Standard Axios fetches interrogating `/api/tournament/:id` on regular poll or refresh logic.

### e) Backend Routes/Controllers (request entry)
- `backend/routes/api/tournament/index.js:L1-L150` — Generates instance trigger map to `create` and `match-result` endpoints.

### f) Services / Business Logic (domain rules)
- `backend/game/TournamentManager.js:L1-L700` — Core algorithmic state engine responsible for resolving mathematics of the Swiss/RR structural matrix algorithms.

### g) Data Models / Schemas / Queries (persistence)
- The entire bracket is held in Fastify `memory Map()` structures rather than serialized aggressively step-by-step into PostgreSQL due to transient nature. Only terminal states get pushed into PG historically.

### h) Side Effects / Async (queues/emails/uploads/cron/external APIs)
- N/A

### i) Security / Middleware (auth, perms, validation)
- Protected via `fastify.authenticate`. Standard bounds checking ensures only matching members can inject results.

### j) Observability (logs/metrics/tracing)
- `console.log` arrays mapping verbose Round generation logic.

### k) Tests (unit/integration/e2e)
- N/A

---

## 3) File Index (Navigation Map)
> Quick jump list. Keep it short and only include files actually used by this feature.

- Backend Routes/Controllers:
  - `backend/routes/api/tournament/index.js` — The API wrapper handling generic REST queries to interact with brackets.
- Services:
  - `backend/game/TournamentManager.js` — The core algorithmic powerhouse deciding who plays who.

---

## 4) End-to-End Call Chain Trace (Primary Path)
Trace runtime path:
UI event → state update → API call → backend handler → service → DB → response → UI render

### Step 1: UI Entry
- Component/Handler: Tournament Configuration Dashboard
- Trigger: click `Begin Tournament`
- Inputs: Player array lengths.
- Outputs: POST request.

### Step 2: API Call (Client Boundary)
- File: `frontend/app/(protected)/game/local/tournament/page.tsx`
- Endpoint: `POST /api/tournament/create`
- Request shape: `JSON { mode, players }`

### Step 3: Backend Route/Controller
- File: `backend/routes/api/tournament/index.js`
- Handler: `fastify.post('/create')`
- Inputs: Parsed parameters triggering `new TournamentManager()`.

### Step 4: Service / Business Logic
- File: `backend/game/TournamentManager.js`
- Function: Initialization Routine `generateRoundRobinPairings()` vs `generateFirstRoundPairings()`.
- Responsibilities: Analyzes participant sizes `determineFormat(count)`. Generates mapping of matches for Round 1 sequentially.

### Step 5: Match Resolution (Loop Trigger)
- File: `backend/game/TournamentManager.js`
- Function: `updateMatchResult`
- Responsibilities: Win provides 3 Points, Loss gives 0, Draw 1. Computes total point differential inside internal `standings` array list dynamically evaluating if `currentRound` should progress.

### Step 6: Side Effects / Async (Automatic progression)
- File: `backend/game/TournamentManager.js`
- Triggered effect: Scrutinizes if `allRealMatchesComplete` === true. Automatically cascades by auto-completing pending "Bye" matches, transitioning `currentRound++`, and triggering `generateSubsequentRoundPairings` internally if Swiss format active.

### Step 7: Response → UI Render
- Response: `<TournamentDashboard />` pulls data reflecting new structural pairings dynamically.

---

## 5) Walkthroughs (What happens when…)
> Write this like a narrated trace. For each walkthrough: show what the user does, what the UI shows, what request is sent, what backend does, what DB does, and what the UI shows at the end.
> Include file + function references ONLY at the key steps (not everywhere), so it stays readable.

### Walkthrough 1 — Normal Success (Happy Path)
**User story:** User kicks off a standard 4-person Round Robin tournament.

1) **User action (UI trigger)**
- What user does: Types out 3 guest names and clicks "Begin Tournament".
- Where in code: `frontend/app/(protected)/game/local/tournament/page.tsx:L150` — `handleStartTournament()`

2) **Immediate UI behavior**
- What user sees instantly: Form lock, button changes to loading state.
- What state changes: `setLoading(true)`

3) **Request sent**
- Endpoint: `POST /api/tournament/create`
- Payload (high level): `{ format: "local", players: ["P1", "P2", "P3", "P4"] }`

4) **Backend processing**
- Controller entry: `backend/routes/api/tournament/index.js:L50`
- Business logic: Evaluates player length (`4 < 5`), determines Format is Round Robin. Executes `generateRoundRobinPairings`.
- Where: `backend/game/TournamentManager.js:L80`

5) **Database/persistence**
- What is read/written: In-Memory Map Instantiation.
- Where: `backend/routes/api/tournament/index.js` — `tournaments.set(id, new TournamentManager())`

6) **Response + final UI**
- Response: `200` + `{ tournamentId: "xxxx" }`
- UI update: Router push to dashboard.
- Where: `frontend/app/(protected)/game/local/tournament/page.tsx:L160` — `router.push('/game/local/tournament/xxxx')`
- What user sees: The bracket Dashboard visualizes exactly 3 rounds of matchups instantly.

---

### Walkthrough 2 — Invalid Input (User mistake)
**User story:** User attempts to start a tournament with only 2 people instead of minimum 3.

1) **User action**
- Where: `frontend/app/(protected)/game/local/tournament/page.tsx:L100`

2) **Where validation happens**
- Frontend validation: Yes — UI conditionally disables the CTA button preventing click.
- Backend validation: Yes — `backend/routes/api/tournament/index.js` checks `players.length >= 3` returning `400` if breached via Curl map.

3) **What user sees**
- UI behavior: Button remains greyed out securely. Form fields unchanged.

---

### Walkthrough 4 — Server/Network Failure (Player Disconnection Forfeit)
**User story:** A user disconnects matching memory arrays out of sync.

1) **User action**
- Where: Disconnect event triggers automatically when WS pipeline drops.

2) **Failure mode**
- Tournament expects an outcome to progress the Swiss algorithm, but the player has left.
- Where error is handled: `backend/game/TournamentManager.js` — `resolveFutureMatchesForWithdrawn()`

3) **What user sees**
- System auto-flags any matches that player was supposed to participate in as `walkovers`, granting the remaining available player a free 3 points. Bracket progresses immediately avoiding frozen states.

---

### Walkthrough 5 — Empty Result (Nothing to show, but not an error)
**User story:** First stage dashboard initialization.

1) **Request succeeds**
- Response: `200` with `[]` or `null` for `completedMatches` array.

2) **UI branch**
- Where the empty branch renders: `frontend/app/(protected)/game/local/tournament/[tournamentId]/page.tsx`
- What user sees: Array of null bracket maps showing standard empty boxes requesting "Start Match".

---

## 6) Function-by-Function Catalog
> Only functions/classes actually in the feature path.

For each key function/class:
- Name: `generateRoundRobinPairings`
- File: `backend/game/TournamentManager.js`
- Signature: `generateRoundRobinPairings()`
- Responsibility: Standard 'Circle Method' algorithm. Appends `null` array index if player count odd to distribute Byes naturally. Matches index `i` vs `length-1-i` and splices rotations dynamically sequentially generating total maps.
- Called by: Constructor init.

- Name: `generateSubsequentRoundPairings`
- File: `backend/game/TournamentManager.js`
- Signature: `generateSubsequentRoundPairings(roundNumber)`
- Responsibility: Analyzes Swiss leaderboard. Evaluates priority sorting [1. Match Points, 2. Score Differential, 3. Total Points].
- Important branches: Awards lowest-ranking unpaid player a Bye recursively. Uses greedy lookup validation `!sorted[i].opponents.includes()` mapping strictly unique pairing history logic, falling back gracefully to rematches if absolutely statistically necessary.
- Called by: `updateMatchResult` upon round interval closures.

- Name: `resolveFutureMatchesForWithdrawn`
- File: `backend/game/TournamentManager.js`
- Signature: `resolveFutureMatchesForWithdrawn(playerId)`
- Responsibility: Safety net guaranteeing disconnected players yield free 3pt wins (`walkover`) to remaining users mapped to play them without crashing the structural progression.

---

## 7) Call Graph Diagram

```text
api.post('/api/tournament/create')
  -> TournamentManager.init()
     -> determineFormat()
        -> IF Players < 5 -> generateRoundRobinPairings()
        -> IF Players >= 5 -> generateSwissPairings() -> generateFirstRoundPairings()
  -> Tournament Active Loops
     -> updateMatchResult() -> calculate points
        -> IF Round Ended -> processByes()
           -> _incrementRound() -> generateSubsequentRoundPairings()
              -> Sort Leaderboard (Points, Differential)
              -> Greedy Assign Pairings (Avoid Rematches)
  -> IF Player Drops
     -> resolveFutureMatchesForWithdrawn() -> Flag matches as walkover
```
