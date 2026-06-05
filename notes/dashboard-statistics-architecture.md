# Dashboard Statistics Architecture

## Table of Contents
1. [Overview](#overview)
2. [Important: Understanding User IDs](#important-understanding-user-ids)
3. [Database Schema](#database-schema)
4. [System Architecture](#system-architecture)
5. [How Game Results Are Saved](#how-game-results-are-saved)
6. [How Dashboard Gets Statistics](#how-dashboard-gets-statistics)
7. [How Match History Works](#how-match-history-works)
8. [How Activity Tracking Works](#how-activity-tracking-works)
9. [Real-time vs Refresh Behavior](#real-time-vs-refresh-behavior)
10. [Complete Game-to-Dashboard Flow](#complete-game-to-dashboard-flow)
12. [Key Components](#key-components)
13. [Complete Code Examples](#complete-code-examples)

---

## Overview

The dashboard displays user statistics including:
- **Level and XP** (experience points with progress bar)
- **Total Wins, Losses, Draws** (with color-coded badges)
- **Win Rate** (calculated percentage)
- **Match History** (recent games with filtering)
- **Friends List** (online/offline status)

The system uses:
- **Database (SQLite)** as the single source of truth for all statistics
- **REST API** to fetch statistics and match history
- **Profile Table** to store aggregated stats (totalWins, totalLosses, totalDraws, totalXP, level)
- **Match Table** to store individual game records
- **No Real-time WebSocket** for dashboard updates - stats are fetched fresh on page load

**Key Principle:** Game results are saved to the database **immediately** when a game ends. When users navigate to the dashboard, they see updated stats because fresh data is fetched from the database.

---

## Important: Understanding User IDs

### User IDs are NOT Hardcoded!

**IMPORTANT:** When you see user IDs like `42`, `99`, `1234` in documentation, these are **real examples** from your database, **NOT hardcoded values**.

**How User IDs Work:**
- User registers → Database assigns auto-increment ID (e.g., 42)
- User logs in → JWT token contains their database ID
- All API calls use the ID from the JWT token
- Statistics are stored per user ID

**Example:**
```javascript
// Alice registers → Database ID: 42
// Alice plays game and wins
// Profile updated: { id: 42, totalWins: 1, totalXP: 100, level: 1 }

// Alice navigates to dashboard:
// Frontend calls: GET /api/profile/stats
// JWT token contains: { userId: 42 }
// Backend returns stats for user ID 42
```

---

## Database Schema

### Profile Model (Stores Aggregated Statistics)

```prisma
model Profile {
  id       Int     @id @default(autoincrement())
  username String  @unique
  email    String  @unique
  avatar   String?
  bio      String?

  // XP and progression - Updated after EVERY match
  totalXP     Int @default(0)      // Total experience points earned
  level       Int @default(1)       // Current level (calculated from totalXP)
  totalWins   Int @default(0)      // All wins across all game modes
  totalLosses Int @default(0)      // All losses across all game modes
  totalDraws  Int @default(0)      // All draws across all game modes

  // Relations
  matchesAsPlayer1 Match[] @relation("MatchPlayer1")
  matchesAsPlayer2 Match[] @relation("MatchPlayer2")
  achievements     Achievement[]
}
```

**Key Points:**
- **totalWins/Losses/Draws** = Incremented by +1 after each match
- **totalXP** = Accumulated XP from all matches (never decreases)
- **level** = Calculated from totalXP using formula: `level = floor(sqrt(totalXP / 100))`
- These fields are the **source of truth** for dashboard statistics

### Match Model (Stores Individual Game Records)

```prisma
enum MatchMode {
  LOCAL              // Local 1v1 (same device)
  LOCAL_TOURNAMENT   // Local tournament match
  REMOTE             // Remote 1v1 (online)
  REMOTE_TOURNAMENT  // Remote tournament match
  AI                 // vs AI
}

model Match {
  id Int @id @default(autoincrement())

  // Stable runtime identifier for idempotency (prevents duplicate saves)
  externalMatchId String? @unique

  // Runtime tournament key (for tournament matches)
  externalTournamentId String?

  // Player 1 is always the Host/LoggedIn user (REQUIRED)
  player1Id Int
  player1   Profile @relation("MatchPlayer1", fields: [player1Id], references: [id])

  // Player 2 is Optional (Nullable) to support Local Guest players
  player2Id Int?
  player2   Profile? @relation("MatchPlayer2", fields: [player2Id], references: [id])

  score1 Int  // Player 1 final score
  score2 Int  // Player 2 final score

  // Duration of the match in seconds
  durationSeconds Int?

  // Track game mode (local/remote/ai)
  mode MatchMode @default(REMOTE)

  // Optional relation to Tournament table
  tournament   Tournament? @relation(fields: [tournamentId], references: [id])
  tournamentId Int?

  createdAt DateTime @default(now())

  @@index([externalTournamentId])
}
```

**Key Points:**
- **externalMatchId** = Unique identifier from game runtime (prevents saving same match twice)
- **mode** = Distinguishes game types (affects XP rewards)
- **durationSeconds** = How long the match took
- **createdAt** = Timestamp for match history sorting

---

## System Architecture

### Frontend Components:

1. **Dashboard Page** (`frontend/app/(protected)/dashboard/page.tsx`)
   - Displays user statistics via UserStats component
   - Shows match history with filters (date, mode, result)
   - Lists online and offline friends
   - Fetches data on page load (useEffect)

2. **UserStats Component** (`frontend/components/game/UserStats.tsx`)
   - Calls `GET /api/profile/stats` on mount
   - Displays level, XP, wins, losses, draws, win rate
   - Shows XP progress bar to next level
   - NO automatic refresh - only fetches on component mount

3. **Match History List**
   - Calls `GET /api/game/match-history` on mount
   - Displays opponent, scores, result (win/loss/draw), mode, date
   - Client-side filtering by date range, mode, result

### Backend Components:

4. **Match Finalization Service** (`backend/services/match-finalization.js`)
   - Central service called after EVERY game completion
   - Saves match record to Match table
   - Updates player statistics in Profile table
   - Runs in database transaction (all-or-nothing)

5. **Profile Progression Service** (`backend/services/progression-profile.js`)
   - Calculates XP earned based on game mode and result
   - Updates Profile fields: totalXP, level, totalWins/Losses/Draws
   - Checks and unlocks new achievements

6. **Stats API Endpoint** (`backend/routes/api/profile/stats.js`)
   - GET /api/profile/stats
   - Fetches current user's Profile record
   - Calculates win rate from totals
   - Returns: totalXP, level, totalWins, totalLosses, totalDraws, winRate, achievements

7. **Match History API Endpoint** (`backend/routes/api/game/match-history.js`)
   - GET /api/game/match-history
   - Fetches all Match records where user is player1 or player2
   - Determines opponent, result, and mode for each match
   - Returns sorted by date (newest first)

---

## How Game Results Are Saved

### Complete Step-by-Step Flow (Immediate Persistence):

**Step 1: Game Ends**
- Game runtime detects win condition:
  - **Remote Game:** Score reaches 7 OR timer expires
  - **Local Game:** Score reaches 7 OR timer expires
  - **Tournament:** Same as above for each individual match
- Game state is frozen (no more inputs)
- Final scores locked: player1Score, player2Score

**Step 2: Match Finalization Triggered**
- **Remote Games:** Backend WebSocket handler calls `finalizeMatchResult()` automatically
  - File: `backend/plugins/ws-utils/game-matches/lifecycle.js` (line 178)
  - Triggered by `endGame()` function
- **Local Games:** Frontend calls `POST /api/game/save-match` endpoint
  - File: `backend/routes/api/game/save-match.js`
  - Frontend sends match data after game over screen
- **Tournament Games:** Same as above, but includes `tournamentId` parameter

**Step 3: Save Match Record (Idempotent)**
- Service: `persistMatchRecord()` in `backend/services/match-persistence.js`
- Checks if match already exists using `externalMatchId`
  ```javascript
  const existing = await prisma.match.findUnique({
    where: { externalMatchId: "RS-abc123" }
  });
  ```
- If match exists: Skip save, return existing record
- If match is new: Insert into Match table:
  ```javascript
  await prisma.match.create({
    data: {
      externalMatchId: "RS-abc123",
      player1Id: 42,        // Alice
      player2Id: 99,        // Bob
      score1: 7,            // Alice scored 7
      score2: 5,            // Bob scored 5
      durationSeconds: 180, // 3 minutes
      mode: "REMOTE",
      tournamentId: null,
      createdAt: now()
    }
  });
  ```

**Step 4: Calculate XP Earned**
- Service: `calculateXPForMatch()` in `backend/services/xp-service.js`
- XP values based on mode and result:
  ```javascript
  const XP_VALUES = {
    WIN_1V1: 100,        // Regular 1v1 win
    WIN_TOURNAMENT: 150, // Tournament match win
    DRAW: 25,            // Draw
    LOSS: 0              // No XP for loss
  };
  ```
- Determine result for each player:
  ```javascript
  // Alice (player1): 7 > 5 → WIN → +100 XP
  // Bob (player2): 5 < 7 → LOSS → +0 XP
  ```

**Step 5: Update Player 1 Statistics**
- Service: `applyProfileProgression()` in `backend/services/progression-profile.js`
- Fetch current Alice's profile:
  ```javascript
  const profile = await prisma.profile.findUnique({
    where: { id: 42 },
    include: { achievements: true }
  });
  // Returns: { totalXP: 400, level: 2, totalWins: 4, totalLosses: 2, totalDraws: 0 }
  ```
- Calculate new values:
  ```javascript
  const xpGained = 100;  // WIN_1V1
  const newTotalXP = 400 + 100 = 500;
  const newLevel = calculateLevelFromXP(500) = 2;  // Still level 2
  const newTotalWins = 4 + 1 = 5;
  const newTotalLosses = 2;  // Unchanged (Alice won)
  const newTotalDraws = 0;   // Unchanged
  ```
- Update database:
  ```javascript
  await prisma.profile.update({
    where: { id: 42 },
    data: {
      totalXP: 500,
      level: 2,
      totalWins: 5,
      totalLosses: 2,
      totalDraws: 0
    }
  });
  ```

**Step 6: Update Player 2 Statistics**
- Same process for Bob (player2Id: 99):
  ```javascript
  // Current: { totalXP: 300, level: 1, totalWins: 2, totalLosses: 3, totalDraws: 1 }
  const xpGained = 0;  // LOSS
  const newTotalXP = 300 + 0 = 300;
  const newLevel = 1;
  const newTotalWins = 2;       // Unchanged (Bob lost)
  const newTotalLosses = 3 + 1 = 4;
  const newTotalDraws = 1;      // Unchanged

  await prisma.profile.update({
    where: { id: 99 },
    data: {
      totalXP: 300,
      level: 1,
      totalWins: 2,
      totalLosses: 4,
      totalDraws: 1
    }
  });
  ```

**Step 7: Check and Unlock Achievements**
- Service: `checkNewAchievements()` in `backend/services/achievement-service.js`
- Checks if new stats qualify for achievements:
  ```javascript
  // Alice now has 5 total wins
  // Check: TOTAL_WINS_5 achievement? → Yes, unlocked!
  await prisma.achievement.create({
    data: {
      profileId: 42,
      achievementKey: "TOTAL_WINS_5",
      unlockedAt: now()
    }
  });
  ```

**Step 8: Transaction Commit**
- All changes (Match insert + Profile updates + Achievement inserts) commit as one atomic transaction
- If any step fails, ALL changes are rolled back
- Ensures database consistency

**Step 9: Return Success**
- Backend returns confirmation to frontend/runtime
- Game over screen displays (frontend)
- Users can navigate away safely - results are ALREADY saved

---

## How Dashboard Gets Statistics

### Complete Step-by-Step Flow (Fresh Fetch on Load):

**Step 1: User Navigates to Dashboard**
- User clicks "Dashboard" link in header/sidebar
- Router navigates to `/dashboard`
- Dashboard page component mounts

**Step 2: UserStats Component Mounts**
- File: `frontend/components/game/UserStats.tsx`
- useEffect hook runs on mount:
  ```typescript
  useEffect(() => {
    async function fetch() {
      try {
        const res = await axios.get("/api/profile/stats");
        setStats(res.data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []); // Empty dependency array = runs once on mount
  ```

**Step 3: Backend Fetches User's Profile**
- Endpoint: `GET /api/profile/stats`
- File: `backend/routes/api/profile/stats.js`
- Extract user ID from JWT token:
  ```javascript
  const userId = Number(request.user.userId); // Alice = 42
  ```
- Query Profile table:
  ```javascript
  const profile = await prisma.profile.findUnique({
    where: { id: 42 },
    select: {
      totalXP: true,
      level: true,
      totalWins: true,
      totalLosses: true,
      totalDraws: true,
      achievements: { select: { achievementKey: true, unlockedAt: true } }
    }
  });
  // Returns: {
  //   totalXP: 500,
  //   level: 2,
  //   totalWins: 5,
  //   totalLosses: 2,
  //   totalDraws: 0,
  //   achievements: [...]
  // }
  ```

**Step 4: Calculate Win Rate**
- Backend calculates win rate from totals:
  ```javascript
  const total = 5 + 2 + 0 = 7;  // totalWins + totalLosses + totalDraws
  const winRate = total > 0 ? (5 / 7) * 100 : 0;
  const winRateFormatted = parseFloat(winRate.toFixed(2)); // 71.43%
  ```

**Step 5: Return Statistics**
- Backend sends response:
  ```javascript
  return reply.code(200).send({
    totalXP: 500,
    level: 2,
    totalWins: 5,
    totalLosses: 2,
    totalDraws: 0,
    winRate: 71.43,
    totalGames: 7,
    achievements: [...]
  });
  ```

**Step 6: Frontend Displays Stats**
- UserStats component receives data
- Calculates XP progress:
  ```typescript
  const nextLevelXP = 100 * (level + 1) * level;        // 100 * 3 * 2 = 600
  const currentLevelXP = 100 * level * (level - 1);     // 100 * 2 * 1 = 200
  const progress = ((500 - 200) / (600 - 200)) * 100;   // 75% progress to level 3
  ```
- Renders UI:
  ```typescript
  <CardTitle>Level {stats.level}</CardTitle>           // "Level 2"
  <span>{stats.totalXP} XP</span>                       // "500 XP"
  <Badge>{stats.totalWins}</Badge>                      // "5" (green)
  <Badge variant="destructive">{stats.totalLosses}</Badge>  // "2" (red)
  <span>{stats.winRate}%</span>                         // "71.43%"
  <div style={{ width: `${progress}%` }} />             // 75% progress bar
  ```

**Step 7: User Sees Updated Statistics**
- Stats reflect ALL games played up to this moment
- Includes the game that just finished before navigating here
- Win rate, level, XP all accurate and current

---

## How Match History Works

### Complete Step-by-Step Flow:

**Step 1: Dashboard Component Mounts**
- File: `frontend/app/(protected)/dashboard/page.tsx`
- useEffect hook runs on mount:
  ```typescript
  useEffect(() => {
    async function fetchRecentMatches() {
      try {
        const response = await axios.get<MatchEntry[]>("/api/game/match-history");
        setMatchHistory(response.data || []);
      } catch (error) {
        console.error("Failed to load recent matches", error);
        setMatchHistory([]);
      } finally {
        setRecentMatchesLoading(false);
      }
    }
    fetchRecentMatches();
  }, []); // Runs once on mount
  ```

**Step 2: Backend Fetches User's Matches**
- Endpoint: `GET /api/game/match-history`
- File: `backend/routes/api/game/match-history.js`
- Extract user ID from JWT:
  ```javascript
  const userId = request.user.userId; // Alice = 42
  ```
- Query Match table (both as player1 and player2):
  ```javascript
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { player1Id: 42 },  // Alice as player1
        { player2Id: 42 },  // Alice as player2
      ],
    },
    include: {
      player1: { select: { username: true, avatar: true } },
      player2: { select: { username: true, avatar: true } },
    },
    orderBy: { createdAt: "desc" },  // Newest first
  });
  ```

**Step 3: Transform Matches for Frontend**
- For each match, determine:
  - Who is the opponent?
  - What was my score vs opponent's score?
  - Did I win, lose, or draw?
  ```javascript
  const history = matches.map((match) => {
    const isPlayer1 = match.player1Id === 42;

    // Extract my score and opponent's score
    const playerScore = isPlayer1 ? match.score1 : match.score2;     // 7
    const opponentScore = isPlayer1 ? match.score2 : match.score1;   // 5

    // Determine result
    let result;
    if (playerScore > opponentScore) result = "win";
    else if (playerScore < opponentScore) result = "loss";
    else result = "draw";

    // Get opponent profile
    const opponentProfile = isPlayer1 ? match.player2 : match.player1;
    const opponent = opponentProfile?.username ?? "Guest";
    const opponentAvatar = opponentProfile?.avatar ?? null;

    // Map mode enum to frontend format
    const MODE_LABEL = {
      LOCAL: "local",
      LOCAL_TOURNAMENT: "local-tournament",
      REMOTE: "remote",
      REMOTE_TOURNAMENT: "remote-tournament",
      AI: "ai",
    };

    return {
      id: match.id,
      opponent,
      opponentAvatar,
      playerScore,
      opponentScore,
      result,                                    // "win", "loss", "draw"
      mode: MODE_LABEL[match.mode],              // "remote"
      durationSeconds: match.durationSeconds,    // 180
      date: match.createdAt,                     // "2026-05-27T10:30:00Z"
    };
  });
  ```

**Step 4: Return Match History**
- Backend sends array of match entries:
  ```javascript
  return reply.code(200).send(history);
  ```

**Step 5: Frontend Displays Match History**
- Dashboard component receives data
- Filters matches based on user's selections:
  ```typescript
  const filteredMatchHistory = matchHistory.filter((match) => {
    // Date range filter
    const matchDate = new Date(match.date);
    if (fromDate && matchDate < new Date(fromDate)) return false;
    if (toDate && matchDate > new Date(toDate)) return false;

    // Mode filter
    if (modeFilter !== "all" && match.mode !== modeFilter) return false;

    // Result filter
    if (resultFilter !== "all" && match.result !== resultFilter) return false;

    return true;
  });
  ```
- Renders match cards:
  ```typescript
  {filteredMatchHistory.map(match => (
    <div key={match.id} className="match-card">
      <img src={match.opponentAvatar} />
      <span>{match.opponent}</span>
      <span>{match.playerScore} - {match.opponentScore}</span>
      <Badge variant={match.result === "win" ? "success" : "destructive"}>
        {match.result}
      </Badge>
      <span>{MODE_LABEL[match.mode]}</span>
      <span>{formatDate(match.date)}</span>
    </div>
  ))}
  ```

**Step 6: User Sees Complete Match History**
- All matches displayed, newest first
- Can filter by date range, mode, result
- Includes game that just finished (if any)

---

## How Activity Tracking Works

### Overview

The activity chart shows games played per day/week/month. Unlike statistics and match history, **activity tracking requires no separate backend API call** — it's calculated entirely on the frontend by grouping the match history data.

### Data Source

- **Component:** `frontend/app/(protected)/dashboard/page.tsx`
- **Data:** Derived from match history (reuses `GET /api/game/match-history` response)
- **Database Query:** None (calculated on frontend)
- **Display:** Bar chart with 3 view modes (day, week, month)

### How It Works

**Step 1: Dashboard Fetches Match History**
- Dashboard page mounts
- Frontend calls `GET /api/game/match-history` (same call as before)
- Backend returns array of matches with dates:
  ```javascript
  [
    { id: 123, opponent: "Bob", date: "2026-05-27T10:30:00Z", result: "win", ... },
    { id: 122, opponent: "Alice", date: "2026-05-26T14:15:00Z", result: "loss", ... },
    { id: 121, opponent: "Charlie", date: "2026-05-26T09:00:00Z", result: "win", ... },
    ...
  ]
  ```

**Step 2: Frontend Groups Matches by Time Period**

Dashboard component calculates activity bars based on user's selected view:

```typescript
const [activityView, setActivityView] = useState<"day" | "week" | "month">("week");

const activityBars = (() => {
  const now = new Date();

  // View 1: Last 7 days (each bar = 1 day)
  if (activityView === "day") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));

      // Count matches on this day
      const count = filteredMatchHistory.filter((m) => {
        const md = new Date(m.date);
        return md.toDateString() === d.toDateString();
      }).length;

      return {
        label: d.toLocaleDateString(undefined, { weekday: "short" }), // "Mon", "Tue"
        count: count,  // 0, 1, 2, 3...
        title: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) // "May 26"
      };
    });
  }

  // View 2: Last 4 weeks (each bar = 1 week)
  if (activityView === "week") {
    return Array.from({ length: 4 }, (_, i) => {
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - now.getDay() - (3 - i) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Count matches in this week
      const count = filteredMatchHistory.filter((m) => {
        const md = new Date(m.date);
        return md >= weekStart && md <= weekEnd;
      }).length;

      const label = String(i + 1); // "1", "2", "3", "4"
      const title = `${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}`; // "May 19 – May 25"
      return { label, count, title };
    });
  }

  // View 3: Last 6 months (each bar = 1 month)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    // Count matches in this month
    const count = filteredMatchHistory.filter((m) => {
      const md = new Date(m.date);
      return md >= d && md <= monthEnd;
    }).length;

    const label = d.toLocaleDateString(undefined, { month: "short" }); // "Jan", "Feb"
    const title = d.toLocaleDateString(undefined, { month: "long", year: "numeric" }); // "January 2026"
    return { label, count, title };
  });
})();
```

**Step 3: Respects User Filters**

- Activity count only includes matches that pass the current filters:
  - Date range (fromDate, toDate)
  - Game mode (modeFilter)
  - Result type (resultFilter: win, loss, draw, all)

```typescript
const filteredMatchHistory = matchHistory.filter((match) => {
  const matchDate = new Date(match.date);
  if (fromDate && matchDate < new Date(fromDate)) return false;
  if (toDate && matchDate > new Date(toDate)) return false;
  if (modeFilter !== "all" && match.mode !== modeFilter) return false;
  if (resultFilter !== "all" && match.result !== resultFilter) return false;
  return true;
});

// Activity bars are calculated from filteredMatchHistory
const count = filteredMatchHistory.filter((m) => {
  // ...
}).length;
```

**Step 4: Render Bar Chart**

Dashboard renders bars proportional to activity:

```typescript
const maxActivityCount = Math.max(...activityBars.map((b) => b.count), 1);

{activityBars.map((bar, i) => {
  const pct = (bar.count / maxActivityCount) * 100;
  return (
    <div key={i} title={bar.title}>
      <div style={{ height: `${pct}%` }} className="bar" />
      <span>{bar.label}</span>
    </div>
  );
})}
```

**Step 5: User Sees Activity Chart**

- Bar chart displays with 3 selectable views (day, week, month)
- Each bar shows games played in that period
- Higher bar = more games played
- User can switch views to see activity at different scales

### Key Points

✅ **No separate API call** — reuses match history data  
✅ **Frontend calculation** — all grouping happens in browser  
✅ **Respects filters** — activity only counts visible matches  
✅ **3 view modes** — day (7 days), week (4 weeks), month (6 months)  
✅ **Dynamic scaling** — bars scale to max activity count in period  
✅ **Interactive** — user can change view in real-time  

### Data Flow

```
1. Dashboard Mounts
   ↓
2. Fetch GET /api/game/match-history
   ↓
3. Receive: [{date, opponent, result, ...}, ...]
   ↓
4. Frontend Filters by: date range, mode, result
   ↓
5. Group filteredMatchHistory by: day/week/month
   ↓
6. Count matches in each period
   ↓
7. Activity Bars Render
   ↓
8. User Sees Activity Chart
```

### Efficiency

**Why This Approach is Better:**
- Single API call serves multiple needs (match history + activity)
- No redundant database queries
- Activity updates when user changes filters (instant)
- Lightweight calculation (array grouping is fast)
- Reduces server load compared to separate endpoints

---

## Real-time vs Refresh Behavior

### Key Distinction: NO Real-time Updates for Dashboard

**Important:** The dashboard does NOT receive real-time WebSocket updates. Statistics and match history are only fetched when:
1. User navigates to dashboard page (initial load)
2. User refreshes the page (browser refresh)

### Why No Real-time Updates?

**Design Decision:**
- Dashboard statistics are **personal** and **historical**
- No need for sub-second accuracy
- Reduces server load (no WebSocket subscriptions per user)
- Simpler architecture (no state synchronization issues)

**When Stats Update:**
```
Game Ends → Stats Saved to DB (Immediately)
↓
User Stays on Game Over Screen (Stats NOT updated in dashboard yet)
↓
User Navigates to Dashboard (Stats Fetched Fresh from DB)
↓
Dashboard Shows Updated Stats (Reflects all games including the one just finished)
```

### Comparison with Real-time Features

**Real-time (WebSocket-based):**
- Chat messages (instant delivery)
- Friend requests (instant notification)
- Friend online/offline status (instant update)
- Game invites (instant popup)
- Match state during gameplay (real-time paddle/ball positions)

**Pull-based (HTTP REST):**
- Dashboard statistics (fetched on page load)
- Match history (fetched on page load)
- User profile (fetched when viewing profile)
- Friends list (fetched on page load, but status updates via WebSocket)

### Typical User Journey:

**Scenario: Alice Plays a Game and Checks Stats**

1. **Before Game:**
   - Alice at dashboard: Level 2, 4 wins, 2 losses
   - Dashboard shows these stats (fetched on load)

2. **During Game:**
   - Alice plays remote game against Bob
   - Dashboard NOT updated (Alice is not on dashboard page)

3. **Game Ends:**
   - Alice wins 7-5
   - Backend immediately saves:
     - Match record: Alice vs Bob, 7-5, remote
     - Alice's profile: totalWins = 5, totalXP = 500
   - Dashboard still shows OLD stats (Alice hasn't returned yet)

4. **Alice Navigates to Dashboard:**
   - Dashboard page loads
   - Frontend calls `GET /api/profile/stats`
   - Backend returns UPDATED stats: Level 2, 5 wins, 2 losses
   - Frontend calls `GET /api/game/match-history`
   - Backend returns ALL matches including the game just finished
   - Alice sees updated stats immediately

5. **Result:**
   - Stats are current and accurate
   - No delay, no stale data
   - Fresh fetch guarantees consistency

---

## Complete Game-to-Dashboard Flow

### End-to-End Example: Remote Game

**Timeline: Alice Plays Remote Game Against Bob**

```
T = 0:00 - Game Starts
├─ Alice joins match "RS-abc123"
├─ Bob joins match "RS-abc123"
└─ Game loop begins (WebSocket-driven)

T = 2:45 - Game Ends
├─ Score: Alice 7, Bob 5
├─ Backend WebSocket handler detects win condition
├─ Backend calls finalizeMatchResult() automatically
└─ Transaction begins:
    ├─ Insert Match: { player1: Alice, player2: Bob, score1: 7, score2: 5 }
    ├─ Update Alice: { totalWins: 4→5, totalXP: 400→500, level: 2 }
    ├─ Update Bob: { totalLosses: 3→4, totalXP: 300→300, level: 1 }
    └─ Transaction commits (all changes saved)

T = 2:46 - Game Over Screen Displays
├─ Frontend shows: "You Win! +100 XP"
├─ Stats in dashboard: NOT YET UPDATED (Alice still on game page)
└─ Alice sees "Return to Dashboard" button

T = 2:50 - Alice Clicks "Return to Dashboard"
├─ Router navigates to /dashboard
├─ Dashboard page component mounts
├─ useEffect triggers data fetching
├─ Frontend calls:
│   ├─ GET /api/profile/stats → Returns: { totalWins: 5, totalXP: 500, level: 2 }
│   └─ GET /api/game/match-history → Returns: [{ Alice vs Bob, 7-5, win }, ...]
└─ Stats render in UI

T = 2:51 - Alice Sees Updated Dashboard
├─ Level: 2 (unchanged)
├─ Total Wins: 5 (was 4, now 5) ✅ UPDATED
├─ Total Losses: 2 (unchanged)
├─ Total XP: 500 (was 400, now 500) ✅ UPDATED
├─ Win Rate: 71.43% (was 66.67%, now 71.43%) ✅ UPDATED
└─ Match History: Shows "Alice vs Bob, 7-5, Win, Remote, 2 mins ago" ✅ NEW MATCH
```

### Key Timing Points:

1. **T = 2:45 (Game End):**
   - Match saved to database ← **IMMEDIATE**
   - Alice's stats updated ← **IMMEDIATE**
   - Bob's stats updated ← **IMMEDIATE**

2. **T = 2:46 to 2:50 (Game Over Screen):**
   - Dashboard stats NOT updated (Alice hasn't navigated there)
   - Database contains updated stats (saved at T = 2:45)
   - Dashboard is "stale" but only because user hasn't visited it

3. **T = 2:50 (Navigation):**
   - Dashboard fetches fresh data from database
   - Stats are current (reflect all games including latest)
   - User sees immediate results

4. **T = 2:51 (Display):**
   - Dashboard shows updated stats
   - No delay, no loading spinner (data already in state)
   - User experiences "instant" update

### Why This Works:

**✅ Game results saved immediately** (not delayed or queued)
**✅ Database is single source of truth** (no caching issues)
**✅ Dashboard fetches fresh data** (guaranteed consistency)
**✅ User sees current stats** (no stale data)

### What Happens if User Refreshes Dashboard?

```
User at Dashboard (showing stats from 5 minutes ago)
↓
User presses F5 (browser refresh)
↓
Dashboard page reloads
↓
useEffect runs again (component mounts)
↓
Frontend calls GET /api/profile/stats (fresh fetch)
↓
Backend returns CURRENT stats from database
↓
Dashboard displays updated stats
```

**Result:** Stats always current on page load/refresh.

---

## Key Components

### 1. Frontend: UserStats Component

**File:** `frontend/components/game/UserStats.tsx`

**Purpose:** Display user's level, XP, wins, losses, draws, win rate

```typescript
export default function UserStats() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await axios.get("/api/profile/stats");
        setStats(res.data);
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []); // Runs ONCE on mount

  if (loading || !stats) return <div>Loading...</div>;

  // Calculate XP progress to next level
  const nextLevelXP = 100 * (stats.level + 1) * stats.level;
  const currentLevelXP = 100 * stats.level * (stats.level - 1);
  const progress = Math.round(
    ((stats.totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
  );

  return (
    <Card>
      <CardHeader>
        <Trophy />
        <CardTitle>{stats.level}</CardTitle>
        <CardDescription>Current Level</CardDescription>
      </CardHeader>

      <CardContent>
        {/* XP Progress Bar */}
        <div>
          <span>{stats.totalXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</span>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {/* Total XP and Win Rate */}
        <div>
          <div>
            <span>Total XP</span>
            <span>{stats.totalXP}</span>
          </div>
          <div>
            <span>Win Rate</span>
            <span>{stats.winRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Win/Loss/Draw Stats */}
        <div>
          <div>
            <span>Wins</span>
            <Badge variant="success">{stats.totalWins}</Badge>
          </div>
          <div>
            <span>Losses</span>
            <Badge variant="destructive">{stats.totalLosses}</Badge>
          </div>
          <div>
            <span>Draws</span>
            <Badge variant="secondary">{stats.totalDraws}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Key Points:**
- Fetches stats on mount (useEffect with empty dependency array)
- NO automatic refresh - only updates when component re-mounts
- Displays level, XP, wins, losses, draws, win rate
- Calculates progress bar to next level

### 2. Backend: Match Finalization Service

**File:** `backend/services/match-finalization.js`

**Purpose:** Save match and update player statistics atomically

```javascript
import { persistMatchRecord } from "./match-persistence.js";
import { applyProfileProgression } from "./progression-profile.js";

export async function finalizeMatchResult(payload) {
  return prisma.$transaction(async (tx) => {
    // Step 1: Persist match record (idempotent)
    const { match, reusedExisting } = await persistMatchRecord(payload, {
      prismaClient: tx,
    });

    // If match already finalized, skip progression
    if (reusedExisting) {
      return {
        match,
        reusedExisting,
        progressionApplied: false,
        playerUpdates: [],
      };
    }

    // Step 2: Apply progression to player 1
    const player1Id = toPositiveIntOrNull(payload.player1Id);
    const player2Id = toPositiveIntOrNull(payload.player2Id);
    const score1 = Number(payload.score1) || 0;
    const score2 = Number(payload.score2) || 0;
    const matchMode = payload.mode;
    const playerUpdates = [];

    if (player1Id) {
      const player1Update = await applyProfileProgression({
        prismaClient: tx,
        profileId: player1Id,
        playerScore: score1,
        opponentScore: score2,
        matchMode,
      });
      playerUpdates.push({ profileId: player1Id, ...player1Update });
    }

    // Step 3: Apply progression to player 2
    if (player2Id) {
      const player2Update = await applyProfileProgression({
        prismaClient: tx,
        profileId: player2Id,
        playerScore: score2,
        opponentScore: score1,
        matchMode,
      });
      playerUpdates.push({ profileId: player2Id, ...player2Update });
    }

    return {
      match,
      reusedExisting,
      progressionApplied: true,
      playerUpdates,
    };
  });
}
```

**Key Points:**
- Runs in database transaction (all-or-nothing)
- Idempotent (prevents double-saves using externalMatchId)
- Updates both players' statistics
- Returns success confirmation

### 3. Backend: Profile Progression Service

**File:** `backend/services/progression-profile.js`

**Purpose:** Calculate XP, update stats, unlock achievements

```javascript
import { calculateXPForMatch, calculateLevelFromXP, determineResult } from "./xp-service.js";
import { checkNew as checkNewAchievements } from "./achievement-service.js";

export async function applyProfileProgression({
  prismaClient,
  profileId,
  playerScore,
  opponentScore,
  matchMode,
}) {
  // Step 1: Determine result (win/loss/draw)
  const result = determineResult(playerScore, opponentScore);
  // determineResult returns: "win", "loss", or "draw"

  // Step 2: Calculate XP earned
  const xpGained = calculateXPForMatch(matchMode, result);
  // Example: matchMode = "REMOTE", result = "win" → xpGained = 100

  // Step 3: Fetch current profile
  const profile = await prismaClient.profile.findUnique({
    where: { id: profileId },
    include: { achievements: true },
  });

  if (!profile) {
    return { updated: false, reason: "profile-not-found" };
  }

  // Step 4: Calculate new values
  const newTotalXP = profile.totalXP + xpGained;
  const newLevel = calculateLevelFromXP(newTotalXP);
  const newTotalWins = profile.totalWins + (result === "win" ? 1 : 0);
  const newTotalLosses = profile.totalLosses + (result === "loss" ? 1 : 0);
  const newTotalDraws = profile.totalDraws + (result === "draw" ? 1 : 0);

  // Step 5: Update profile in database
  await prismaClient.profile.update({
    where: { id: profileId },
    data: {
      totalXP: newTotalXP,
      level: newLevel,
      totalWins: newTotalWins,
      totalLosses: newTotalLosses,
      totalDraws: newTotalDraws,
    },
  });

  // Step 6: Check and unlock new achievements
  const currentAchievements = profile.achievements.map(a => a.achievementKey);
  const isTournamentWin =
    result === "win" &&
    (matchMode === "LOCAL_TOURNAMENT" || matchMode === "REMOTE_TOURNAMENT");

  const newStats = {
    totalWins: newTotalWins,
    totalLosses: newTotalLosses,
    totalDraws: newTotalDraws,
    level: newLevel,
    totalXP: newTotalXP,
    tournamentWins: isTournamentWin ? 1 : 0,
  };

  const eligibleAchievements = checkNewAchievements(newStats);
  for (const achievementKey of eligibleAchievements) {
    if (currentAchievements.includes(achievementKey)) {
      continue; // Already unlocked
    }

    try {
      await prismaClient.achievement.create({
        data: {
          profileId,
          achievementKey,
        },
      });
    } catch {
      // Ignore duplicate achievement inserts from race/retry conditions.
    }
  }

  return {
    updated: true,
    result,
    xpGained,
    totalXP: newTotalXP,
    level: newLevel,
    totalWins: newTotalWins,
    totalLosses: newTotalLosses,
    totalDraws: newTotalDraws,
  };
}
```

**Key Points:**
- Calculates XP based on mode and result
- Updates all Profile statistics
- Checks and unlocks achievements
- Runs within transaction (atomic)

### 4. Backend: Stats API Endpoint

**File:** `backend/routes/api/profile/stats.js`

**Purpose:** Return user's current statistics

```javascript
export default async function (fastify, opts) {
  fastify.get(
    "/stats",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = Number(request.user.userId);

        // Fetch profile with achievements
        const profile = await prisma.profile.findUnique({
          where: { id: userId },
          select: {
            totalXP: true,
            level: true,
            totalWins: true,
            totalLosses: true,
            totalDraws: true,
            achievements: { select: { achievementKey: true, unlockedAt: true } },
          },
        });

        if (!profile) {
          return reply.code(404).send({ error: "Profile not found" });
        }

        // Calculate win rate
        const total = profile.totalWins + profile.totalLosses + profile.totalDraws;
        const winRate = total > 0 ? (profile.totalWins / total) * 100 : 0;

        return reply.code(200).send({
          totalXP: profile.totalXP,
          level: profile.level,
          totalWins: profile.totalWins,
          totalLosses: profile.totalLosses,
          totalDraws: profile.totalDraws,
          winRate: parseFloat(winRate.toFixed(2)),
          totalGames: total,
          achievements: profile.achievements,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        return reply.code(500).send({ error: "Failed to fetch stats" });
      }
    }
  );
}
```

**Key Points:**
- Authenticates user via JWT
- Fetches Profile record
- Calculates win rate on-the-fly
- Returns statistics object

### 5. Backend: Match History API Endpoint

**File:** `backend/routes/api/game/match-history.js`

**Purpose:** Return user's match history

```javascript
export default async function (fastify, opts) {
  fastify.get(
    "/match-history",
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const userId = request.user.userId;

        // Fetch all matches where user was player1 or player2
        const matches = await prisma.match.findMany({
          where: {
            OR: [
              { player1Id: userId },
              { player2Id: userId },
            ],
          },
          include: {
            player1: { select: { username: true, avatar: true } },
            player2: { select: { username: true, avatar: true } },
          },
          orderBy: { createdAt: "desc" }, // Newest first
        });

        // Transform to frontend format
        const history = matches.map((match) => {
          const isPlayer1 = match.player1Id === userId;

          const playerScore = isPlayer1 ? match.score1 : match.score2;
          const opponentScore = isPlayer1 ? match.score2 : match.score1;

          // Determine result
          let result;
          if (playerScore > opponentScore) result = "win";
          else if (playerScore < opponentScore) result = "loss";
          else result = "draw";

          // Get opponent info
          const opponentProfile = isPlayer1 ? match.player2 : match.player1;
          const opponent = opponentProfile?.username ?? "Guest";
          const opponentAvatar = opponentProfile?.avatar ?? null;

          // Map mode enum to frontend
          const MODE_LABEL = {
            LOCAL: "local",
            LOCAL_TOURNAMENT: "local-tournament",
            REMOTE: "remote",
            REMOTE_TOURNAMENT: "remote-tournament",
            AI: "ai",
          };

          return {
            id: match.id,
            opponent,
            opponentAvatar,
            playerScore,
            opponentScore,
            result,
            mode: MODE_LABEL[match.mode] ?? match.mode.toLowerCase(),
            durationSeconds: match.durationSeconds,
            date: match.createdAt,
          };
        });

        return reply.code(200).send(history);
      } catch (error) {
        console.error("Error fetching match history:", error);
        return reply.code(500).send({ error: "Failed to fetch match history" });
      }
    }
  );
}
```

**Key Points:**
- Fetches matches from both player perspectives
- Determines opponent, scores, result for each match
- Returns sorted by date (newest first)

---

## Complete Code Examples

### Example 1: Game Over → Save Match → Update Stats

```javascript
// Backend: Remote game ends (WebSocket handler)
// File: backend/plugins/ws-utils/game-matches/lifecycle.js

async function endGame(gameState) {
  const matchId = gameState.matchId;
  clearInterval(gameLoops.get(matchId)); // Stop game loop

  // Determine winner and scores
  const left = gameState.leftPlayer;
  const right = gameState.rightPlayer;
  const durationSeconds = Math.round(gameState.timer.timeElapsed / 1000);

  // Save match to database
  try {
    const { reusedExisting, progressionApplied } = await finalizeMatchResult({
      externalMatchId: matchId,
      player1Id: left.id,          // Alice (42)
      player2Id: right.id,         // Bob (99)
      score1: left.score,          // 7
      score2: right.score,         // 5
      durationSeconds,             // 180
      mode: "REMOTE",
      tournamentId: null,
    });

    console.log(
      `Match ${matchId} ${reusedExisting ? "updated" : "saved"}; ` +
      `progression ${progressionApplied ? "applied" : "skipped"}`
    );
  } catch (error) {
    console.error("Failed to save match:", error);
  }

  // Broadcast game over to clients
  broadcastState(gameState, "GAME_OVER");
}
```

### Example 2: Dashboard Fetches Stats

```typescript
// Frontend: Dashboard component fetches user stats
// File: frontend/components/game/UserStats.tsx

export default function UserStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await axios.get("/api/profile/stats");
        setStats(res.data);
        // Response: {
        //   totalXP: 500,
        //   level: 2,
        //   totalWins: 5,
        //   totalLosses: 2,
        //   totalDraws: 0,
        //   winRate: 71.43,
        //   totalGames: 7,
        //   achievements: [...]
        // }
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []); // Runs once on mount

  if (loading || !stats) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardTitle>Level {stats.level}</CardTitle>
      <div>
        <span>Total XP: {stats.totalXP}</span>
        <span>Win Rate: {stats.winRate}%</span>
      </div>
      <div>
        <Badge variant="success">{stats.totalWins} Wins</Badge>
        <Badge variant="destructive">{stats.totalLosses} Losses</Badge>
        <Badge variant="secondary">{stats.totalDraws} Draws</Badge>
      </div>
    </Card>
  );
}
```

### Example 3: Match History Display

```typescript
// Frontend: Dashboard displays match history
// File: frontend/app/(protected)/dashboard/page.tsx

export default function DashboardPage() {
  const [matchHistory, setMatchHistory] = useState<MatchEntry[]>([]);

  useEffect(() => {
    async function fetchRecentMatches() {
      try {
        const response = await axios.get("/api/game/match-history");
        setMatchHistory(response.data || []);
        // Response: [
        //   {
        //     id: 123,
        //     opponent: "Bob",
        //     playerScore: 7,
        //     opponentScore: 5,
        //     result: "win",
        //     mode: "remote",
        //     durationSeconds: 180,
        //     date: "2026-05-27T10:30:00Z"
        //   },
        //   ...
        // ]
      } catch (error) {
        console.error("Failed to load recent matches", error);
      }
    }

    fetchRecentMatches();
  }, []);

  return (
    <div>
      <h2>Recent Matches</h2>
      {matchHistory.map(match => (
        <div key={match.id} className="match-card">
          <span>{match.opponent}</span>
          <span>{match.playerScore} - {match.opponentScore}</span>
          <Badge variant={match.result === "win" ? "success" : "destructive"}>
            {match.result.toUpperCase()}
          </Badge>
          <span>{match.mode}</span>
          <span>{new Date(match.date).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
```

### Example 4: XP Calculation

```javascript
// Backend: Calculate XP for match result
// File: backend/services/xp-service.js

const XP_VALUES = {
  WIN_1V1: 100,
  WIN_TOURNAMENT: 150,
  DRAW: 25,
  LOSS: 0,
};

function calculateXPForMatch(mode, result) {
  if (result === "win") {
    if (mode === "LOCAL_TOURNAMENT" || mode === "REMOTE_TOURNAMENT") {
      return XP_VALUES.WIN_TOURNAMENT; // 150 XP
    }
    return XP_VALUES.WIN_1V1; // 100 XP
  } else if (result === "draw") {
    return XP_VALUES.DRAW; // 25 XP
  }
  return XP_VALUES.LOSS; // 0 XP
}

function determineResult(playerScore, opponentScore) {
  if (playerScore > opponentScore) return "win";
  if (playerScore < opponentScore) return "loss";
  return "draw";
}

function calculateLevelFromXP(totalXP) {
  let level = 1;
  while (true) {
    const nextLevelXP = 100 * (level + 1) * level;
    if (totalXP < nextLevelXP) {
      break;
    }
    level++;
  }
  return level;
}

// Example usage:
// Alice wins remote game: 7-5
const result = determineResult(7, 5); // "win"
const xp = calculateXPForMatch("REMOTE", result); // 100
// Alice's new totalXP: 400 + 100 = 500
const newLevel = calculateLevelFromXP(500); // 2
```

### Example 5: Database Transaction

```javascript
// Backend: Atomic match save and stats update
// File: backend/services/match-finalization.js

export async function finalizeMatchResult(payload) {
  // ALL steps run in a single transaction
  return prisma.$transaction(async (tx) => {
    // Step 1: Save match (idempotent check)
    const { match, reusedExisting } = await persistMatchRecord(payload, {
      prismaClient: tx,
    });

    if (reusedExisting) {
      // Match already saved, skip stats update
      return { match, reusedExisting, progressionApplied: false };
    }

    // Step 2: Update player 1 stats
    const player1Update = await applyProfileProgression({
      prismaClient: tx,
      profileId: payload.player1Id,
      playerScore: payload.score1,
      opponentScore: payload.score2,
      matchMode: payload.mode,
    });
    // player1Update: { xpGained: 100, totalWins: 5, totalXP: 500, level: 2 }

    // Step 3: Update player 2 stats
    const player2Update = await applyProfileProgression({
      prismaClient: tx,
      profileId: payload.player2Id,
      playerScore: payload.score2,
      opponentScore: payload.score1,
      matchMode: payload.mode,
    });
    // player2Update: { xpGained: 0, totalLosses: 4, totalXP: 300, level: 1 }

    // ALL changes commit together (or rollback if any fails)
    return {
      match,
      reusedExisting: false,
      progressionApplied: true,
      playerUpdates: [player1Update, player2Update],
    };
  });
}
```

---

## Summary

The dashboard statistics system provides a reliable, consistent way to track user progress:

✅ **Immediate Persistence** - Game results saved to database instantly when game ends  
✅ **Single Source of Truth** - Database stores all statistics (Profile table)  
✅ **Fresh on Load** - Dashboard fetches current stats from database on page load  
✅ **No Real-time Updates** - Stats only refresh when user navigates to dashboard  
✅ **Atomic Transactions** - Match save and stats update happen together (all-or-nothing)  
✅ **Idempotent Saves** - Duplicate match saves prevented using externalMatchId  
✅ **Accurate Calculations** - XP, level, win rate calculated from database values  
✅ **Complete History** - All matches stored and retrievable  

### Key Design Decisions:

**Why Immediate Save?**
- Prevents data loss if user closes tab/browser
- Ensures stats are always current when needed
- No queuing or delayed processing

**Why Fetch on Load (Not Real-time)?**
- Dashboard stats are personal and historical
- No need for sub-second updates
- Simpler architecture (no WebSocket subscriptions)
- Reduces server load

**Why Database as Source of Truth?**
- Single authoritative data source
- No caching synchronization issues
- Guaranteed consistency
- Easy to audit and debug

**Why Atomic Transactions?**
- Prevents partial updates (match saved but stats not updated)
- Ensures database integrity
- Rollback on errors

**Why Idempotent Saves?**
- Handles network retries safely
- Prevents duplicate match records
- Avoids double XP awards

### User Experience:

**From Player's Perspective:**
1. Play game → See "Game Over" screen
2. Navigate to dashboard → See updated stats immediately
3. Stats reflect ALL games including the one just finished
4. Match history shows latest game at top
5. No delays, no loading, no stale data

**Result:** Seamless, reliable, accurate statistics tracking that "just works."
