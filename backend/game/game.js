import { prisma } from '../../app.js';

const	CANVAS_WIDTH = 800;
const	CANVAS_HEIGHT = 350;
const	PADDLE_WIDTH = 12;
const	PADDLE_HEIGHT = 80;
const	PADDLE_SPEED = 10;
const	BALL_SIZE = 12;
const	FPS = 60;
const	TICK_MS = 1000 / FPS;
const	WINNING_SCORE = 7;


class game
{
	constructor(matchId)
	{
		this.matchId = matchId;
		// Store connected sockets (Player 1 and Player 2)
		this.players = {
			p1: {
				socket: null,
				id: null
			},
			p2: {
				socket: null,
				id: null
			}
		};
		this.status = 'WAITING'; // WAITING, PLAYING, FINISHED
		this.gameState = this.createInitialState(); 
		// Game loop control
		this.running = false
		this.loopHandle = null;
	}

	createInitialState() // Initialise Paddle andb Ball
	{
		return ({
			ball: {
				x: CANVAS_WIDTH / 2,
				y: CANVAS_HEIGHT / 2,
				dx: 4,
				dy: 3
			},
			paddles: {
				p1: {
					x: 0,
					y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2, 
					moving: null,
				},
				p2: {
					x: CANVAS_WIDTH - PADDLE_WIDTH,
					y: (CANVAS_HEIGHT - PADDLE_HEIGHT) / 2,
					moving: null,
				}
			},
			score:
			{
				p1: 0,
				p2: 0
			}
		});
	}

	// Add Player to game
	addPlayer(socket, playerSlot, userId)
	{
		if (playerSlot == 1) {
			this.players.p1 = {
				socket: socket,
				id: userId
			};
		}
		else if (playerSlot == 2)
		{
			this.players.p2 = {
				socket: socket,
				id: userId
			}
		}
		console.log(`Player ${playerSlot} (ID: ${userId}) joined match ${this.matchId}`);
	}

	// Handle Paddle Movement Input
	handleInput(playerSlot, direction)
	{
		const playerKey = (playerSlot === 1) ? "p1" : "p2";
		// Update the moving status in the state
		this.gameState.paddles[playerKey].moving = direction;
	}

	// Main game loop function
	startGameLoop()
	{
		if (this.running)
			return;

		this.running = true;
		this.loopHandle = setInterval(() => {
			this._updatePaddles();
			this._updateBall();
			this._checkCollisionsAndScore();
			this._checkWinCondition();
			this._broadcastState();
		}, TICK_MS);
	}

	_updatePaddles()
	{
		const players = ["p1", "p2"];

		players.forEach((k) => {
			let paddle = this.gameState.paddles[k];
			
			if (!paddle.moving)
				return ;
			if (paddle.moving === "UP")
				paddle.y = Math.max(0, paddle.y - PADDLE_SPEED);
			if (paddle.moving === "DOWN")
				paddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, paddle.y + PADDLE_SPEED);
		});
	}
	

	_updateBall()
	{
		let ball = this.gameState.ball;
		ball.x += ball.dx;
		ball.y += ball.dy;
	}

	_resetBall(toRight = true)
	{
		this.gameState.ball.x = (CANVAS_WIDTH - BALL_SIZE) / 2;
		this.gameState.ball.y = (CANVAS_HEIGHT - BALL_SIZE) / 2;
		this.gameState.ball.dx = toRight ? 4 : -4;

		// Randomise the angle
		if (Math.random() > 0.5)
			this.gameState.ball.dy = 3;
		else
			this.gameState.ball.dy = -3;
	}

	_checkCollisionsAndScore()
	{
		const ball = this.gameState.ball;
		const p1 = this.gameState.paddles.p1;
		const p2 = this.gameState.paddles.p2;

		// Wall collision : Top / Bottom
		if (ball.y <= 0 || ball.y + BALL_SIZE >= CANVAS_HEIGHT)
			ball.y *= -1;

		// Paddle 1 Collision
		/*
			Hit the Center: offset is 0. The ball goes straight.
			Hit the Top: offset is negative. The ball flies up.
			Hit the Bottom: offset is positive. The ball flies down.
		*/
		if (
			ball.x <= p1.x + PADDLE_WIDTH && // LEFT ball touch RIGHT paddle
			ball.x + BALL_SIZE >= p1.x && // RIGHT ball touch LEFT paddle
			ball.y + BALL_SIZE >= p1.y && // BOTTOM ball touch TOP paddle
			ball.y <= p1.y + PADDLE_HEIGHT // TOP ball touch BOTTOM paddle
		) {
			ball.dx = Math.abs(ball.dx); // Force the direction to right
			// Add some "Spin" based on where it hit the paddle
			// Find the center of the ball and the center of the paddle
			const offset = ball.y + BALL_SIZE / 2 - (p1.y + PADDLE_HEIGHT / 2);
			// Adjust vertical speed based on that distance
			ball.dy = offset * 0.1;
		}

		// Paddle 2 Collision
		if (
			ball.x + BALL_SIZE >= p2.x && // RIGHT ball hit LEFT paddle
			ball.x <= p2.x + PADDLE_WIDTH &&// LEFT ball hit RIGHT paddle
			ball.y + BALL_SIZE >= p2.y && // BOTTOM ball hit TOP paddle
			ball.y <= p2.y + PADDLE_HEIGHT // TOP ball hit BOTTOM paddle 
		) {
			ball.dx = Math.abs(ball.dx) * -1; // Force to LEFT
			const offset = (ball.y + BALL_SIZE / 2) - (p1.y + PADDLE_HEIGHT / 2);
			ball.dy = offset * 0.1;
		}

		// Scoring Logic 
		if (ball.x <= 0)
		{
			this.gameState.score.p2 += 1;
			this._resetBall(true);
		} else if (ball.x >= CANVAS_WIDTH)
		{
			this.gameState.score.p1 += 1;
			this._resetBall(false);
		}
	}

	_broadcast(messageObject)
	{
		const payload = JSON.stringify(messageObject);

		if (this.players.p1.socket) {
			this.players.p1.socket.send(payload);
		}

		if (this.players.p2.socket) {
			this.players.p2.socket.send(payload);
		}
	}

	_broadcastState()
	{
		this._broadcast(this.gameState);
	}

	async saveMatch()
	{
		try {
			if (!this.players.p1.id || !this.players.p2.id) {
				console.warn("Cannot save match: Missing player IDs");
				return ;
			}

			await prisma.match.create({
				data: {
					player1Id: this.players.p1.id,
					player2Id: this.players.p2.id,
					score1: this.gameState.score.p1,
					score2: this.gameState.score.p2
				}
			});
			console.log("Match saved successfully!");
		}
		catch (error) {
			console.error("Failed to save match:", error);
		}
	}

	_checkWinCondition()
	{
		const p1Score = this.gameState.score.p1;
		const p2Score = this.gameState.score.p2;

		if (p1Score >= WINNING_SCORE || p2Score >= WINNING_SCORE) {
			this._stopGame();
		}
	}

	_stopGame()
	{
		if (this.running === false)
			return ;
		this.running = false;
		clearInterval(this.loopHandle);
		this.saveMatch();
		const winner = this.gameState.score.p1 >= WINNING_SCORE ? 1 : 2;
		this._broadcast({
			type: 'GAME_OVER',
			winner: winner
		});

		console.log(`Game ${this.matchId} ended. Winner: Player ${winner}`);
	}
}

export default game;