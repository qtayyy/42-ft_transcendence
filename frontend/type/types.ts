import React from "react";

export interface FriendRequest {
  id: number;
  requesterId: number;
  addresseeId: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  requester: {
    id: number;
    username: string;
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
}

export interface UserProfile {
  id: string;
  email: string;
  avatar?: string;
  username: string;
  fullname?: string;
  dob?: string;
  region?: string;
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
}

export interface GameRoomValue {
  roomId: string;
  hostId: number;
  invitedPlayers: Friend[];
  joinedPlayers: Friend[];
  maxPlayers: number;
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
  ballSize: number;
  matchDuration: number;
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
}
