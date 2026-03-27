const XP_VALUES = {
  WIN_1V1: 100,
  WIN_TOURNAMENT: 150,
  DRAW: 25,
  LOSS: 0,
};

function calculateXPForMatch(mode, result) {
  if (result === "win") {
    if (mode === "LOCAL_TOURNAMENT" || mode === "REMOTE_TOURNAMENT") {
      return XP_VALUES.WIN_TOURNAMENT;
    }
    return XP_VALUES.WIN_1V1;
  } else if (result === "draw") {
    return XP_VALUES.DRAW;
  }
  return XP_VALUES.LOSS;
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

function determineResult(playerScore, opponentScore) {
  if (playerScore > opponentScore) return "win";
  if (playerScore < opponentScore) return "loss";
  return "draw";
}

export { calculateXPForMatch, calculateLevelFromXP, determineResult };
