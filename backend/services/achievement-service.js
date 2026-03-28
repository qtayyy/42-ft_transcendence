const ACHIEVEMENTS = {
  FIRST_WIN: {
    key: "FIRST_WIN",
    name: "First Blood",
    description: "Win your first match",
    icon: "🎮",
    check: (stats) => stats.totalWins >= 1,
  },
  LEVEL_5: {
    key: "LEVEL_5",
    name: "Rising Star",
    description: "Reach level 5",
    icon: "⭐",
    check: (stats) => stats.level >= 5,
  },
  LEVEL_10: {
    key: "LEVEL_10",
    name: "Legendary Player",
    description: "Reach level 10",
    icon: "👑",
    check: (stats) => stats.level >= 10,
  },
  TOTAL_WINS_10: {
    key: "TOTAL_WINS_10",
    name: "Collector",
    description: "Accumulate 10 wins",
    icon: "🏆",
    check: (stats) => stats.totalWins >= 10,
  },
  TOTAL_WINS_50: {
    key: "TOTAL_WINS_50",
    name: "Champion",
    description: "Accumulate 50 wins",
    icon: "👑🏆",
    check: (stats) => stats.totalWins >= 50,
  },
  DRAW_MATCH: {
    key: "DRAW_MATCH",
    name: "Stalemate",
    description: "Play a draw match",
    icon: "⚖️",
    check: (stats) => stats.totalDraws >= 1,
  },
  TOURNAMENT_WIN: {
    key: "TOURNAMENT_WIN",
    name: "Tournament Victor",
    description: "Win a tournament",
    icon: "🏅",
    check: (stats) => stats.tournamentWins >= 1,
  },
};

function getAll() {
  return Object.values(ACHIEVEMENTS).map((a) => ({
    key: a.key,
    name: a.name,
    description: a.description,
    icon: a.icon,
  }));
}

function checkNew(stats) {
  return Object.values(ACHIEVEMENTS)
    .filter((a) => a.check(stats))
    .map((a) => a.key);
}

function getByKey(key) {
  return ACHIEVEMENTS[key];
}

export { getAll, checkNew, getByKey };
