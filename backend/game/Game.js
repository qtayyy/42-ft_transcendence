import { PrismaClient } from "/app/generated/prisma/index.js"
const prisma = new PrismaClient();

// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 350;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_SPEED = 10;
const BALL_SIZE = 12;
const FPS = 60;
const TICK_MS = 1000 / FPS;

// Timer-Based Match System (2-minute matches)
const MATCH_DURATION_MS = 120000; // 2 minutes in milliseconds

// Power-Up Configuration
const POWERUP_SIZE = 20;
const POWERUP_SPAWN_INTERVAL_MS = 10000; // Spawn every 10 seconds
const POWERUP_DURATION_MS = 5000; // Effect duration


class Game {
	constructor(matchId, mode, tournamentId = null) {
		this.matchId = matchId;
		this.mode = mode; // local or remote
		this.tournamentId = tournamentId;
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
		this.gameState = this.createInitialState();
		// Game loop control
		this.running = false
		this.loopHandle = null;

		// Timer-based match tracking
		this.startTime = null; // When the game started
		this.timeRemaining = MATCH_DURATION_MS; // Time left in ms

		// Power-Up State
		this.lastSpawnTime = 0;
		this.nextSpawnId = 1;
	}

	createInitialState() // Initialise Paddle and Ball
	{
		return ({
			status: 'waiting', // waiting, playing, finished
			constant: {
				canvasWidth: CANVAS_WIDTH,
				canvasHeight: CANVAS_HEIGHT,
				paddleWidth: PADDLE_WIDTH,
				paddleHeight: PADDLE_HEIGHT,
				paddleSpeed: PADDLE_SPEED,
				ballSize: BALL_SIZE,
				FPS: FPS,
				TICK_MS: TICK_MS,
				matchDuration: MATCH_DURATION_MS,
				powerUpSize: POWERUP_SIZE
			},
			// Timer tracking
			timer: {
				timeRemaining: MATCH_DURATION_MS,
				timeElapsed: 0
			},
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
			},
			winner: null,
			result: null,
			powerUps: [], // Array of { id, x, y, type }
			activeEffect: null // { type, expiresAt }
		});
	}

	// Called when a Websocket Connects
	// Returns the 'role' of the player ('host', 'p1', 'p2', or 'spectator')
	join(socket, userId) {
		if (this.mode === 'local') {
			// In Local mode, the first user (Host) controls the whole game
			if (!this.players.p1.socket) {
				this.players.p1 = {
					socket: socket,
					id: userId
				};
				console.log(`Local Game Hosted by (ID: ${userId})`);
				return (`host`);
			}
		}
		else if (this.mode === 'remote') {
			if (!this.players.p1.socket) {
				this.players.p1 = {
					socket: socket,
					id: userId
				};
				console.log(`Remote P1 joined (ID: ${userId})`);
				return ('p1');
			}
			else if (!this.players.p2.socket) {
				this.players.p2 = {
					socket: socket,
					id: userId
				};
				console.log(`Remote P2 joined (ID: ${userId})`);
				this.startGameLoop();
				return ('p2');
			}
		}
		return ('spectator');
	}

	// // Add Player to game
	// addPlayer(socket, playerSlot, userId)
	// {
	// 	if (playerSlot == 1) {
	// 		this.players.p1 = {
	// 			socket: socket,
	// 			id: userId
	// 		};
	// 	}
	// 	else if (playerSlot == 2)
	// 	{
	// 		this.players.p2 = {
	// 			socket: socket,
	// 			id: userId
	// 		}
	// 	}
	// 	console.log(`Player ${playerSlot} (ID: ${userId}) joined match ${this.matchId}`);
	// }

	// Handle Paddle Movement Input
	// 'role' comes from the join() return value
	// 'data' is the JSON object sent by client
	handleInput(role, data) {
		let targetPaddle = null;
		if (this.mode === 'local' && role === 'host') {
			if (data.player === 1)
				targetPaddle = "p1";
			if (data.player === 2)
				targetPaddle = "p2";
		}
		else if (this.mode === 'remote') {
			if (role === 'p1')
				targetPaddle = "p1";
			if (role === 'p2')
				targetPaddle = "p2";
		}

		if (targetPaddle) {
			this.gameState.paddles[targetPaddle].moving = data.direction;
		}
	}

	// Main game loop function
	startGameLoop() {
		if (this.running)
			return;
		console.log(`Starting Game Loop for Match ${this.matchId}`);
		this.running = true;
		this.gameState.status = 'playing';

		// Initialize timer
		this.startTime = Date.now();

		this.loopHandle = setInterval(() => {
			this._updateTimer(); // Update timer first
			this._updatePaddles();
			this._spawnPowerUp(); // Try spawning
			this._updateBall();
			this._checkCollisionsAndScore();
			this._updateEffect(); // Check active effect expiry
			this._checkWinCondition();
			this._broadcastState();
		}, TICK_MS);
	}

	// Update the match timer
	_updateTimer() {
		if (!this.startTime) return;

		const now = Date.now();
		const elapsed = now - this.startTime;
		const remaining = Math.max(0, MATCH_DURATION_MS - elapsed);

		// Update game state timer
		this.gameState.timer.timeElapsed = elapsed;
		this.gameState.timer.timeRemaining = remaining;
		this.timeRemaining = remaining;
	}

	_updatePaddles() {
		const players = ["p1", "p2"];

		players.forEach((k) => {
			let paddle = this.gameState.paddles[k];

			if (!paddle.moving)
				return;
			if (paddle.moving === "UP")
				paddle.y = Math.max(0, paddle.y - PADDLE_SPEED);
			if (paddle.moving === "DOWN")
				paddle.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, paddle.y + PADDLE_SPEED);
		});
	}


	_updateBall() {
		let ball = this.gameState.ball;
		ball.x += ball.dx;
		ball.y += ball.dy;
	}

	_resetBall(toRight = true) {
		this._clearEffect(); // Reset any active effects on goal
		this.gameState.constant.ballSize = BALL_SIZE; // Ensure size reset

		this.gameState.ball.x = (CANVAS_WIDTH - BALL_SIZE) / 2;
		this.gameState.ball.y = (CANVAS_HEIGHT - BALL_SIZE) / 2;
		this.gameState.ball.dx = toRight ? 4 : -4;

		// Randomise the angle
		if (Math.random() > 0.5)
			this.gameState.ball.dy = 3;
		else
			this.gameState.ball.dy = -3;
	}

	_checkCollisionsAndScore() {
		const ball = this.gameState.ball;
		const p1 = this.gameState.paddles.p1;
		const p2 = this.gameState.paddles.p2;

		// Wall collision : Top / Bottom
		if (ball.y <= 0) {
			ball.y = 0;
			ball.dy = Math.abs(ball.dy);
		}
		else if (ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
			ball.y = CANVAS_HEIGHT - BALL_SIZE;
			ball.dy = -Math.abs(ball.dy);
		}

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

			// Prevent horizontal loop: If trajectory is too flat, add significant random vertical force
			if (Math.abs(ball.dy) < 1.0) {
				// Ensure at least 1.5 velocity in a random direction
				const direction = Math.random() > 0.5 ? 1 : -1;
				ball.dy = direction * (1.5 + Math.random());
			}
		}

		// Paddle 2 Collision
		if (
			ball.x + BALL_SIZE >= p2.x && // RIGHT ball hit LEFT paddle
			ball.x <= p2.x + PADDLE_WIDTH &&// LEFT ball hit RIGHT paddle
			ball.y + BALL_SIZE >= p2.y && // BOTTOM ball hit TOP paddle
			ball.y <= p2.y + PADDLE_HEIGHT // TOP ball hit BOTTOM paddle 
		) {
			ball.dx = Math.abs(ball.dx) * -1; // Force to LEFT
			const offset = (ball.y + BALL_SIZE / 2) - (p2.y + PADDLE_HEIGHT / 2);
			ball.dy = offset * 0.1;

			// Prevent horizontal loop
			if (Math.abs(ball.dy) < 1.0) {
				// Ensure at least 1.5 velocity in a random direction
				const direction = Math.random() > 0.5 ? 1 : -1;
				ball.dy = direction * (1.5 + Math.random());
			}
		}

		// Scoring Logic 
		if (ball.x <= 0) {
			this.gameState.score.p2 += 1;
			this._resetBall(true);
		} else if (ball.x >= CANVAS_WIDTH) {
			this.gameState.score.p1 += 1;
			this._resetBall(false);
		}

		// Power-Up Collision Check
		for (let i = 0; i < this.gameState.powerUps.length; i++) {
			const pu = this.gameState.powerUps[i];
			const dist = Math.sqrt(
				Math.pow((ball.x + BALL_SIZE / 2) - pu.x, 2) +
				Math.pow((ball.y + BALL_SIZE / 2) - pu.y, 2)
			);

			// Simple circular collision check
			if (dist < (BALL_SIZE / 2 + POWERUP_SIZE / 2)) {
				this._applyEffect(pu.type);
				this.gameState.powerUps.splice(i, 1); // Remove item
				break; // One item per frame
			}
		}
	}

	_spawnPowerUp() {
		const now = Date.now();
		if (now - this.lastSpawnTime > POWERUP_SPAWN_INTERVAL_MS && this.gameState.powerUps.length < 2) {
			this.lastSpawnTime = now;
			const validTypes = ['SPEED_UP', 'SPEED_DOWN', 'SIZE_UP', 'SIZE_DOWN'];
			const type = validTypes[Math.floor(Math.random() * validTypes.length)];

			// Random position away from edges
			const margin = 100;
			const x = margin + Math.random() * (CANVAS_WIDTH - 2 * margin);
			const y = margin + Math.random() * (CANVAS_HEIGHT - 2 * margin);

			this.gameState.powerUps.push({
				id: (this.nextSpawnId++).toString(),
				x,
				y,
				type
			});
		}
	}

	_applyEffect(type) {
		this._clearEffect(); // Remove existing first

		const effect = {
			type: type,
			expiresAt: Date.now() + POWERUP_DURATION_MS
		};
		this.gameState.activeEffect = effect;

		switch (type) {
			case 'SPEED_UP':
				// Increase speed by 50%
				this.gameState.ball.dx *= 1.5;
				this.gameState.ball.dy *= 1.5;
				break;
			case 'SPEED_DOWN':
				// Decrease speed by 50%
				this.gameState.ball.dx *= 0.5;
				this.gameState.ball.dy *= 0.5;
				break;
			case 'SIZE_UP':
				// Double size
				this.gameState.constant.ballSize *= 2;
				break;
			case 'SIZE_DOWN':
				// Half size
				this.gameState.constant.ballSize *= 0.5;
				break;
		}
	}

	_clearEffect() {
		if (!this.gameState.activeEffect) return;

		const type = this.gameState.activeEffect.type;
		// Revert changes logic
		// For speed, we just let physics take over or reset to "normal" speed? 
		// Actually, just resetting 'dx' might be abrupt. 
		// Better: apply the inverse if it wasn't a goal reset.
		// But _resetBall handles goal resets.
		// Here we handle timeouts.
		switch (type) {
			case 'SPEED_UP':
				this.gameState.ball.dx /= 1.5;
				this.gameState.ball.dy /= 1.5;
				break;
			case 'SPEED_DOWN':
				this.gameState.ball.dx /= 0.5;
				this.gameState.ball.dy /= 0.5;
				break;
			case 'SIZE_UP':
				this.gameState.constant.ballSize /= 2;
				break;
			case 'SIZE_DOWN':
				this.gameState.constant.ballSize /= 0.5;
				break;
		}
		this.gameState.activeEffect = null;
	}

	_updateEffect() {
		if (this.gameState.activeEffect && Date.now() > this.gameState.activeEffect.expiresAt) {
			this._clearEffect();
		}
	}

	_broadcast(messageObject) {
		const payload = JSON.stringify(messageObject);

		if (this.players.p1.socket && this.players.p1.socket.readyState === 1) {
			this.players.p1.socket.send(payload);
		}

		if (this.players.p2.socket && this.players.p2.socket.readyState === 1) {
			this.players.p2.socket.send(payload);
		}
	}

	_broadcastState() {
		this._broadcast(this.gameState);
	}

	async saveMatch() {
		try {
			// For local games, player2 might not have an ID (Guest)
			// Allow saving games with only p1 if mode is local
			const p1Id = this.players.p1.id;
			const p2Id = this.players.p2 ? this.players.p2.id : null;

			if (!p1Id) {
				console.warn("Cannot save match: Missing Host ID");
				return;
			}

			await prisma.match.create({
				data: {
					player1Id: p1Id,
					player2Id: p2Id,
					score1: this.gameState.score.p1,
					score2: this.gameState.score.p2,
					mode: this.mode === 'local' ? 'LOCAL' : 'REMOTE',
					tournamentId: this.tournamentId || null
				}
			});
			console.log("Match saved successfully!");
		}
		catch (error) {
			console.error("Failed to save match:", error);
		}
	}

	// Check if timer has expired (new win condition)
	_checkWinCondition() {
		// Timer-based win condition: Check if time is up
		if (this.timeRemaining <= 0) {
			this._stopGame();
		}
	}

	_stopGame() {
		if (this.running === false)
			return;
		this.running = false;
		clearInterval(this.loopHandle);
		this.saveMatch();

		// Determine winner based on scores (or draw)
		const p1Score = this.gameState.score.p1;
		const p2Score = this.gameState.score.p2;
		let winner = null;
		let result = 'draw';

		if (p1Score > p2Score) {
			winner = 1;
			result = 'win';
		}
		else if (p2Score > p1Score) {
			winner = 2;
			result = 'win';
		}
		// else: it's a draw (winner stays null)

		this.gameState.status = 'finished';
		this.gameState.winner = winner;
		this.gameState.result = result;

		this._broadcast({
			type: 'GAME_OVER',
			winner: winner, // null for draw
			result: result, // 'win' or 'draw'
			score: this.gameState.score
		});

		if (winner)
			console.log(`Game ${this.matchId} ended. Winner: Player ${winner}`);
		else
			console.log(`Game ${this.matchId} ended in a DRAW`);
	}
}

export default Game;
