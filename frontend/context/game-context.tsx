"use client";

import { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Friend, GameContextValue, GameRoomValue, Invites, GameStateValue } from "@/types/types";
import axios from "axios";

const GameContext = createContext<GameContextValue | null>(null);
const GameDispatchContext = createContext<any>(null);

export const GameProvider = ({ children }) => {
	const { user } = useAuth();
	const [onlineFriends, setOnlineFriends] = useState<Friend[]>([]);
	const [invitesReceived, setInvitesReceived] = useState<Invites[]>([]);
	const [gameRoom, setGameRoom] = useState<GameRoomValue | null>(null);
	const [gameRoomLoaded, setGameRoomLoaded] = useState(false);
	const [gameState, setGameState] = useState<GameStateValue | null>(null);
	const [showNavGuard, setShowNavGuard] = useState(false);
	const [pendingPath, setPendingPath] = useState<string | null>(null);

	useEffect(() => {
		if (!user) return;

		async function load() {
			try {
				const res = await axios.get("/api/friends/online");
				setOnlineFriends(res.data);
			} catch (err) {
				throw err;
			}
		}
		load();
	}, [user]);

	const gameStateRef = useRef<GameStateValue | null>(null);
	const gameRoomRef = useRef<GameRoomValue | null>(null);

	// Sync Refs with high-frequency state (no re-render triggered by Ref update itself)
	gameStateRef.current = gameState;
	gameRoomRef.current = gameRoom;

	// Stable setters and non-reactive value accessors
	const dispatch = useMemo(
		() => ({
			setOnlineFriends,
			setInvitesReceived,
			setGameRoomLoaded,
			setGameRoom,
			setGameState,
			setShowNavGuard,
			setPendingPath,
			getLatestGameState: () => gameStateRef.current,
			getLatestGameRoom: () => gameRoomRef.current,
		}),
		[] // These are always stable
	);

	const value = useMemo(
		() => ({
			onlineFriends,
			invitesReceived,
			gameRoomLoaded,
			gameRoom,
			gameState,
			showNavGuard,
			pendingPath,
			...dispatch
		}),
		[
			onlineFriends,
			invitesReceived,
			gameRoomLoaded,
			gameRoom,
			gameState,
			showNavGuard,
			pendingPath,
			dispatch
		]
	);

	return (
		<GameDispatchContext.Provider value={dispatch}>
			<GameContext.Provider value={value}>
				{children}
			</GameContext.Provider>
		</GameDispatchContext.Provider>
	);
};

export const useGameContext = () => {
	const context = useContext(GameContext);
	if (!context)
		throw new Error("useGameContext must be used within GameProvider");
	return context;
};

export const useGameDispatch = () => {
	const context = useContext(GameDispatchContext);
	if (!context)
		throw new Error("useGameDispatch must be used within GameProvider");
	return context;
};
