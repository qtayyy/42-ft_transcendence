"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type MusicTrack = "homepage" | "inGame";

interface MusicContextValue {
	enabled: boolean;
	activeTrack: MusicTrack | null;
	toggleMusic: () => void;
	setMusicEnabled: (enabled: boolean) => void;
	setGameplayMusicActive: (active: boolean) => void;
}

const HOMEPAGE_TRACK_SRC = "/assets/music/Homepage_pong.mp3";
const IN_GAME_TRACK_SRC = "/assets/music/In_game.mp3";
const MUSIC_ENABLED_STORAGE_KEY = "ft-transcendence-music-enabled";
const HOMEPAGE_VOLUME = 0.35;
const IN_GAME_VOLUME = 0.45;

const MusicContext = createContext<MusicContextValue | null>(null);

/**
 * Reads the saved music preference after hydration, defaulting to enabled for
 * first-time users.
 */
function readSavedMusicEnabled() {
	try {
		return localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== "false";
	} catch {
		return true;
	}
}

/**
 * Keeps background music away from the live Pong runtime route.
 */
function isRuntimeMatchRoute(pathname: string) {
	const match = pathname.match(/^\/game\/([^/]+)$/);
	if (!match) return false;

	const routeId = match[1];
	return routeId !== "new" && routeId !== "remote" && routeId !== "local";
}

/**
 * Stores and orchestrates app-wide music playback for menus and Pong matches.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const [enabled, setEnabled] = useState(true);
	const [preferenceLoaded, setPreferenceLoaded] = useState(false);
	const [gameplayMusicActive, setGameplayMusicActive] = useState(false);
	const homepageAudioRef = useRef<HTMLAudioElement | null>(null);
	const inGameAudioRef = useRef<HTMLAudioElement | null>(null);
	const currentTrackRef = useRef<MusicTrack | null>(null);
	const enabledRef = useRef(enabled);
	const trackWhenEnabledRef = useRef<MusicTrack | null>(null);

	const runtimeMatchRoute = isRuntimeMatchRoute(pathname);
	const trackWhenEnabled: MusicTrack | null =
		gameplayMusicActive && runtimeMatchRoute
			? "inGame"
			: runtimeMatchRoute
				? null
				: "homepage";
	const activeTrack = preferenceLoaded && enabled ? trackWhenEnabled : null;

	useEffect(() => {
		const preferenceLoadTimer = window.setTimeout(() => {
			const savedEnabled = readSavedMusicEnabled();
			enabledRef.current = savedEnabled;
			setEnabled(savedEnabled);
			setPreferenceLoaded(true);
		}, 0);

		return () => window.clearTimeout(preferenceLoadTimer);
	}, []);

	useEffect(() => {
		const homepageAudio = new Audio(HOMEPAGE_TRACK_SRC);
		homepageAudio.loop = true;
		homepageAudio.preload = "auto";
		homepageAudio.volume = HOMEPAGE_VOLUME;

		const inGameAudio = new Audio(IN_GAME_TRACK_SRC);
		inGameAudio.loop = true;
		inGameAudio.preload = "auto";
		inGameAudio.volume = IN_GAME_VOLUME;

		homepageAudioRef.current = homepageAudio;
		inGameAudioRef.current = inGameAudio;

		return () => {
			homepageAudio.pause();
			inGameAudio.pause();
			homepageAudioRef.current = null;
			inGameAudioRef.current = null;
		};
	}, []);

	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	useEffect(() => {
		trackWhenEnabledRef.current = trackWhenEnabled;
	}, [trackWhenEnabled]);

	const getAudioForTrack = useCallback((track: MusicTrack) => {
		return track === "homepage" ? homepageAudioRef.current : inGameAudioRef.current;
	}, []);

	const pauseAllTracks = useCallback(() => {
		homepageAudioRef.current?.pause();
		inGameAudioRef.current?.pause();
	}, []);

	const startTrack = useCallback(
		(track: MusicTrack) => {
			const audio = getAudioForTrack(track);
			if (!audio) return;

			const otherAudio =
				track === "homepage" ? inGameAudioRef.current : homepageAudioRef.current;
			otherAudio?.pause();

			if (currentTrackRef.current !== track) {
				audio.currentTime = 0;
				currentTrackRef.current = track;
			}

			if (!audio.paused) return;
			void audio.play().catch(() => {
				// Browsers often require a user gesture before audio can start.
			});
		},
		[getAudioForTrack]
	);

	const setMusicEnabled = useCallback(
		(nextEnabled: boolean) => {
			enabledRef.current = nextEnabled;
			setEnabled(nextEnabled);
			setPreferenceLoaded(true);

			try {
				localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, String(nextEnabled));
			} catch {
				// Preference persistence is best-effort only.
			}

			if (!nextEnabled) {
				pauseAllTracks();
				return;
			}

			const nextTrack = trackWhenEnabledRef.current;
			if (nextTrack) {
				startTrack(nextTrack);
			}
		},
		[pauseAllTracks, startTrack]
	);

	const toggleMusic = useCallback(() => {
		setMusicEnabled(!enabledRef.current);
	}, [setMusicEnabled]);

	useEffect(() => {
		if (!activeTrack) {
			pauseAllTracks();
			return;
		}

		startTrack(activeTrack);
	}, [activeTrack, pauseAllTracks, startTrack]);

	useEffect(() => {
		const retryPlaybackAfterGesture = () => {
			if (!enabledRef.current) return;

			const nextTrack = trackWhenEnabledRef.current;
			if (nextTrack) {
				startTrack(nextTrack);
			}
		};

		window.addEventListener("pointerdown", retryPlaybackAfterGesture);
		window.addEventListener("keydown", retryPlaybackAfterGesture);

		return () => {
			window.removeEventListener("pointerdown", retryPlaybackAfterGesture);
			window.removeEventListener("keydown", retryPlaybackAfterGesture);
		};
	}, [startTrack]);

	const value = useMemo(
		() => ({
			enabled,
			activeTrack,
			toggleMusic,
			setMusicEnabled,
			setGameplayMusicActive,
		}),
		[activeTrack, enabled, setMusicEnabled, toggleMusic]
	);

	return (
		<MusicContext.Provider value={value}>{children}</MusicContext.Provider>
	);
}

/**
 * Provides access to the shared music controls.
 */
export function useMusic() {
	const context = useContext(MusicContext);
	if (!context) {
		throw new Error("useMusic must be used within MusicProvider");
	}

	return context;
}
