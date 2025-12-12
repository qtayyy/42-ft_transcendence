import { Game } from './Game.js';

class GameManager
{
	constructor()
	{
		this.activeGames = new Map(); // stores matchId -> game instance
	}

	createGame(matchId)
	{
		const newGame = new Game(matchId, mode);
		this.activeGames.set(matchId, newGame);
		return (newGame);
	}

	getGame(matchId)
	{
		return (this.activeGames.get(matchId));
	}

	removeGame(matchId)
	{
		this.activeGames.delete(matchId);
	}
}

// Export a single instance to be used across the app
export const gameManager = new GameManager();