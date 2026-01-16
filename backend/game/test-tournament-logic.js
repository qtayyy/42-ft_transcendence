
import TournamentManager from './TournamentManager.js';

console.log("Starting Tournament Logic Verification...");

const players = [
	{ id: 1, name: 'P1' },
	{ id: 2, name: 'P2' },
	{ id: 3, name: 'P3' }
];

const tm = new TournamentManager('test-tourney', players);

console.log(`Format: ${tm.format}`);
if (tm.format === 'round-robin') {
	tm.matches = tm.generateRoundRobinPairings();
}
console.log(`Total Rounds: ${tm.totalRounds}`);
console.log(`Initial Matches: ${tm.matches.length}`);

// Round 1
console.log("--- Round 1 ---");
const r1Matches = tm.matches.filter(m => m.round === 1);
r1Matches.forEach(m => console.log(`  ${m.matchId}: ${m.player1.name} vs ${m.player2 ? m.player2.name : 'Bye'}`));

const r1Real = r1Matches.find(m => m.player2 !== null);
if (!r1Real) throw new Error("No real match in Round 1");

console.log(`Completing Match ${r1Real.matchId}...`);
tm.updateMatchResult(r1Real.matchId, { p1: 10, p2: 5 }, 'win');

console.log(`Current Round after R1 matches: ${tm.currentRound}`);

if (tm.currentRound !== 2) {
	console.error("FAILED: Did not advance to Round 2");
	process.exit(1);
}

// Round 2
console.log("--- Round 2 ---");
const r2Matches = tm.matches.filter(m => m.round === 2);
r2Matches.forEach(m => console.log(`  ${m.matchId}: ${m.player1.name} vs ${m.player2 ? m.player2.name : 'Bye'}`));

const r2Real = r2Matches.find(m => m.player2 !== null);
console.log(`Completing Match ${r2Real.matchId}...`);
tm.updateMatchResult(r2Real.matchId, { p1: 10, p2: 5 }, 'win');

console.log(`Current Round after R2 matches: ${tm.currentRound}`);

if (tm.currentRound !== 3) {
	console.error("FAILED: Did not advance to Round 3");
	process.exit(1);
}

console.log("VERIFICATION SUCCESSFUL: Logic works as expected.");
