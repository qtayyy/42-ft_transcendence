import React from "react";

export interface Friend {
  id: number;
  username: string;
  // response?: "pending" | "accepted" | "rejected"
}

export interface Invites {
  roomId: string;
  hostId: number;
  hostUsername: string;
}

export interface SocketContextValue {
  sendSocketMessage: (payload: Record<string, unknown>) => void;
  isReady: boolean;
  // onlineFriends: Friend[];
  // gameInvites: Friend[];
  // playerResponses: Friend[];
  // setGameInvites: React.Dispatch<React.SetStateAction<Friend[]>>

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
  // selectedFriends: Friend[];
  // setSelectedFriends: React.Dispatch<React.SetStateAction<Friend[]>>;
  gameRoom: GameRoomValue | null;
  setGameRoom: React.Dispatch<React.SetStateAction<GameRoomValue | null>>;
}

export interface GameRoomValue {
  roomId: string;
  hostId: number;
  invitedPlayers: Friend[];
  joinedPlayers: Friend[];
  maxPlayers: number;
}
