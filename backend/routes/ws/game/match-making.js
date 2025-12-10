import { PrismaClient } from '@prisma/client';

function generateUniqueMatchId() {
    return 'match_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

// Simple in-memory queue for matchmaking
const waitingPlayers = [];

// Helper to calculate win/loss ratio
function getWinLossRatio(player) {
    if (!player.wins && !player.losses) return 0.5; // default ratio
    return player.wins / (player.wins + player.losses);
}

// Add player to matchmaking queue
function addToMatchmaking(player) {
    waitingPlayers.push(player);
    tryMatchPlayers();
}

// Try to match players with similar win/loss ratios
function tryMatchPlayers() {
    if (waitingPlayers.length < 2) return;

    // Sort players by win/loss ratio
    waitingPlayers.sort((a, b) => getWinLossRatio(a) - getWinLossRatio(b));

    for (let i = 0; i < waitingPlayers.length - 1; i++) {
        const player1 = waitingPlayers[i];
        const player2 = waitingPlayers[i + 1];

        // If their win/loss ratios are close enough, match them
        if (Math.abs(getWinLossRatio(player1) - getWinLossRatio(player2)) <= 0.1) {
            // Remove matched players from queue
            waitingPlayers.splice(i, 2);

            // Create match
            createMatch(player1, player2);

            // Try to match next players
            tryMatchPlayers();
            break;
        }
    }
}

const prisma = new PrismaClient();

async function saveMatchToDatabase(match) {
    try {
        await prisma.match.create({
            data: {
                id: match.id,
                status: match.status,
                createdAt: match.createdAt,
                players: {
                    connect: match.players.map(player => ({ id: player.id }))
                }
            }
        });
    } catch (error) {
        console.error('Error saving match to database:', error);
    }
}

function createMatch(player1, player2) {
    const matchId = generateUniqueMatchId();
    const match = {
        id: matchId,
        players: [player1, player2],
        status: 'pending',
        createdAt: new Date(),
    };
    saveMatchToDatabase(match);
    return match;
}

export default addToMatchmaking;