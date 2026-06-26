import { REMOTE_START_COUNTDOWN_MS } from "./constants.js";

/**
 * Initializes the shared pre-match countdown on a fresh remote game state.
 * The players are marked unpaused so readiness is no longer player-controlled.
 */
export function initializeRemoteStartCountdown(
  gameState,
  countdownMs = REMOTE_START_COUNTDOWN_MS,
) {
  const startsAt = Date.now() + countdownMs;

  gameState.startCountdownEndsAt = startsAt;
  gameState.leftPlayer.gamePaused = false;
  gameState.rightPlayer.gamePaused = false;

  return startsAt;
}

/**
 * Schedules the authoritative transition from pre-match countdown to live play.
 * The timer lives on the server so both players begin from the same start time.
 */
export function scheduleRemoteStartCountdown({
  fastify,
  gameState,
  broadcastState,
  startGameLoop,
  countdownMs = REMOTE_START_COUNTDOWN_MS,
}) {
  if (!gameState || gameState.gameStarted || gameState.gameOver) return;

  if (!gameState.startCountdownEndsAt) {
    initializeRemoteStartCountdown(gameState, countdownMs);
  }

  if (gameState.startCountdownTimeout) {
    clearTimeout(gameState.startCountdownTimeout);
  }

  const delayMs = Math.max(0, gameState.startCountdownEndsAt - Date.now());
  gameState.startCountdownTimeout = setTimeout(() => {
    gameState.startCountdownTimeout = null;

    const currentState = fastify.gameStates.get(gameState.matchId);
    if (
      currentState !== gameState ||
      gameState.gameOver ||
      gameState.paused ||
      gameState.gameStarted
    ) {
      return;
    }

    gameState.startCountdownEndsAt = null;
    gameState.leftPlayer.gamePaused = false;
    gameState.rightPlayer.gamePaused = false;
    gameState.gameStarted = true;

    startGameLoop(gameState);
    broadcastState(gameState, fastify);
  }, delayMs);
}
