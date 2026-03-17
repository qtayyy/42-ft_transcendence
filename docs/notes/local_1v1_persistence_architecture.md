# A. Feature Overview

This change makes the backend the primary owner of Local 1v1 persistence while keeping the frontend `handleGameOver()` save request as a temporary fallback. Both save paths now share the runtime `matchId` as a durable idempotency key so one logical match resolves to one database row.

# B. System Architecture & Context

Local 1v1 uses the legacy WebSocket route at `/ws/game`, the in-memory runtime in [`backend/game/LegacyGameRuntime.js`](/home/pc/42-ft_transcendence/backend/game/LegacyGameRuntime.js), and the authenticated HTTP fallback at [`backend/routes/api/game/save-match.js`](/home/pc/42-ft_transcendence/backend/routes/api/game/save-match.js). The persistence contract now flows through the shared helper in [`backend/services/match-persistence.js`](/home/pc/42-ft_transcendence/backend/services/match-persistence.js), which normalizes player IDs, mode, duration, and `externalMatchId` before writing through Prisma.

# C. Workflow & Data Flow

1. The protected local game page opens `/ws/game?matchId=...`.
2. `/ws/game` now authenticates the handshake and resolves player 1 from `request.user.userId`.
3. When the in-memory game ends, `Game.saveMatch()` writes through the shared persistence helper using the runtime `matchId` as `externalMatchId`.
4. The frontend fallback still posts to `/api/game/save-match` with the same runtime `matchId`.
5. The helper performs an idempotent lookup/upsert by `externalMatchId`, so the fallback updates or reuses the existing row instead of inserting a duplicate.

# D. Design Decisions & Trade-offs

- A nullable unique `Match.externalMatchId` was chosen over heuristic dedupe because it is explicit, durable, and easy to reason about in logs and future migrations.
- The frontend fallback remains in place to reduce rollout risk, but it no longer owns persistence correctness.
- Local protected saves force player 1 to the authenticated profile ID. This is stricter than trusting client payloads and prevents `"guest"` or stale IDs from leaking into persisted rows.
- Tournament persistence was intentionally left mostly unchanged so this fix stays scoped to Local 1v1 behavior.

# E. Edge Cases & Error Handling

- If player 2 is a guest or temporary entry, `player2Id` normalizes to `null` and the row still saves.
- If the same save payload is replayed, the row is updated in place instead of duplicated.
- If the backend receives an invalid player 1 ID, persistence fails fast rather than silently creating corrupted match history.
- If callers omit `externalMatchId`, the helper still supports a plain create path for legacy compatibility.

# F. Learning Corner

Snippet 1: shared idempotent persistence helper

```js
const match = await prisma.match.upsert({
  where: { externalMatchId: normalizedExternalMatchId },
  update: data,
  create: {
    ...data,
    externalMatchId: normalizedExternalMatchId,
  },
});
```

Why it matters:
This is the core dedupe mechanism. Backend WebSocket saves and frontend fallback saves both converge here, so repeated submissions target the same row.

Snippet 2: authenticated local player 1 resolution

```js
const userId = Number(request.user?.userId);

if (!Number.isInteger(userId) || userId <= 0) {
  connection.send(JSON.stringify({ error: "authenticated user required" }));
  connection.close();
  return;
}
```

Why it matters:
The legacy local socket used to fall back to `"guest"`, which broke persistence because `Match.player1Id` must be a real profile ID. The route now enforces that contract at connection time.

Snippet 3: frontend fallback keyed by runtime match id

```ts
const externalMatchId = matchData.matchId;

await axios.post("/api/game/save-match", {
  matchId: externalMatchId,
  ...
});
```

Why it matters:
The frontend does not need to know whether the backend already saved the match. It just sends the logical match identity, and the backend safely decides whether to insert or reuse the row.
