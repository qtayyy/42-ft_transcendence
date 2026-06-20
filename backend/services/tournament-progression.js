import { awardAchievement } from "./achievement-service.js";

/**
 * Award the championship achievement only for a completed remote tournament.
 * Local tournaments are excluded because one device controls their results.
 */
export async function awardRemoteTournamentChampion(tournament, options = {}) {
  if (
    !tournament ||
    tournament.progressionEligible !== true ||
    typeof tournament.tournamentId !== "string" ||
    !tournament.tournamentId.startsWith("RT-") ||
    !tournament.isComplete()
  ) {
    return { awarded: false, reason: "ineligible-tournament" };
  }

  const champion = tournament.getChampion();
  const championId = Number(champion?.playerId);
  if (
    !champion ||
    champion.isTemp ||
    !Number.isInteger(championId) ||
    championId <= 0
  ) {
    return { awarded: false, reason: "no-registered-champion" };
  }

  const awarded = await awardAchievement(
    championId,
    "TOURNAMENT_WIN",
    options.prismaClient,
  );
  return { awarded, championId };
}
