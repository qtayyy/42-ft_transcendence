class gameManager
{
	constructor()
	{
		this.activeGames = new Map(); // stores matchId -> game instance
	}

	createGame(matchId, p1, p2)
	{
		const newGame = new Game(matchId, p1, p2);
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

export const gameManager = new gameManager();