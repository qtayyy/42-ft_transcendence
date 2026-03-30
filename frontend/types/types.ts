import React from "react";
import type { GameState } from "@/types/game";

export interface FriendRequest {
	id: number;
	requesterId: number;
	addresseeId: number;
	status: "PENDING" | "ACCEPTED" | "DECLINED";
	createdAt: string;
	requester: {
		id: number;
		username: string;
		avatar?: string;
	};
};

export interface Friend {
	id: number;
	username: string;
}

export interface Invites {
	roomId: string;
	hostId: number;
	hostUsername: string;
}

export interface SocketContextValue {
	sendSocketMessage: (payload: Record<string, unknown>) => void;
	isReady: boolean;
	forceCleanup: () => void;
	reconnectSocket: () => void;
}

export interface UserProfile {
	id: string;
	email: string;
	avatar?: string;
	username: string;
	fullname?: string;
	dob?: string;
	region?: string;
	bio?: string;
};

export interface AuthContextValue {
	user: UserProfile | null;
	isAuthenticated: boolean;
	loadingAuth: boolean;
	login: (email: string, password: string) => Promise<void | undefined>;
	verify2fa: (otp: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<UserProfile>;
};

export interface GameContextValue {
	onlineFriends: Friend[];
	setOnlineFriends: React.Dispatch<React.SetStateAction<Friend[]>>;
	invitesReceived: Invites[];
	setInvitesReceived: React.Dispatch<React.SetStateAction<Invites[]>>;
	gameRoomLoaded: boolean,
	setGameRoomLoaded: React.Dispatch<React.SetStateAction<boolean>>;
	gameRoom: GameRoomValue | null;
	setGameRoom: React.Dispatch<React.SetStateAction<GameRoomValue | null>>;
	gameState: GameStateValue | null;
	setGameState: React.Dispatch<React.SetStateAction<GameStateValue | null>>;
	setRemoteRenderGameState: React.Dispatch<React.SetStateAction<GameState | null>>;
	getLatestRemoteRenderGameState: () => GameState | null;
	subscribeToRemoteRenderGameState: (listener: () => void) => () => void;
	showNavGuard: boolean;
	setShowNavGuard: (show: boolean) => void;
	pendingPath: string | null;
	setPendingPath: (path: string | null) => void;
}

export interface GameRoomValue {
	roomId: string;
	hostId: number;
	invitedPlayers: Friend[];
	joinedPlayers: Friend[];
	maxPlayers: number;
	isTournament?: boolean;
	tournamentStarted?: boolean;
}

export interface Player {
	id: number;
	username: string;
	gamePaused: boolean;
	score: number;
	paddleX: number;
	paddleY: number;
	paddleHeight?: number;
	moving: string;
}

export interface Ball {
	posX: number,
	posY: number,
	dx: number,
	dy: number
}

export type RemotePowerUpType = 'SPEED_UP' | 'SPEED_DOWN' | 'SIZE_UP' | 'SIZE_DOWN';

export interface RemotePowerUp {
	id: string;
	x: number;
	y: number;
	type: RemotePowerUpType;
}

export interface RemoteActiveEffect {
	type: RemotePowerUpType;
	expiresAt: number;
}

export interface RemoteGameTimer {
	startTime?: number;
	timeElapsed: number;
	timeRemaining: number;
}

export interface RemoteGameConstants {
	canvasWidth: number;
	canvasHeight: number;
	paddleWidth: number;
	paddleHeight: number;
	paddleSpeed?: number;
	ballSize: number;
	matchDuration: number;
}

export interface RemoteGameplayTickPlayerState {
	paddleY: number;
}

export interface RemoteGameplayTickPayload {
	matchId: number | string;
	gameStarted: boolean;
	paused: boolean;
	ball: Ball;
	leftPlayer: RemoteGameplayTickPlayerState;
	rightPlayer: RemoteGameplayTickPlayerState;
	timer?: Pick<RemoteGameTimer, "timeElapsed" | "timeRemaining"> | null;
}

export interface GameStateValue {
	tournamentId?: number | string;
	matchId: number | string;
	ball: Ball;
	leftPlayer: Player;
	rightPlayer: Player;
	me?: string;
	isRemote?: boolean;
	isTournamentMatch?: boolean;
	roomId?: string;
	spectatorMode?: boolean;
	// New fields for timer and power-ups
	timer?: RemoteGameTimer | null;
	powerUps?: RemotePowerUp[];
	activeEffect?: RemoteActiveEffect | null;
	constant?: RemoteGameConstants;
	gameStarted?: boolean;
	gameOver?: boolean;
	paused?: boolean;
	pausedBy?: string;
	pausedByName?: string;
	pausedAt?: number;
	resumeReady?: { LEFT: boolean; RIGHT: boolean } | null;
	disconnectCountdown?: {
		disconnectedPlayer: string;
		gracePeriodEndsAt: number;
		countdown: number;
	} | null;
}
