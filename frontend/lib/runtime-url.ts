"use client";

/**
 * Runtime URL helpers for local development and the Oracle VM deployment.
 * See docs/notes/oracle_free_tier_deployment_architecture.md for the full flow.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

type GameWebSocketOptions = {
	isAI?: boolean;
	aiDifficulty?: "easy" | "medium" | "hard";
};

export function getBrowserOrigin() {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	return "https://localhost:8443";
}

export function getGoogleAuthUrl() {
	return `${getBrowserOrigin()}/api/auth/google/login`;
}

export function getWebSocketBaseUrl() {
	const explicitUrl = process.env.NEXT_PUBLIC_WS_URL;
	if (explicitUrl) {
		return trimTrailingSlash(explicitUrl);
	}

	if (typeof window !== "undefined") {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${protocol}//${window.location.host}/ws`;
	}

	return "wss://localhost:8443/ws";
}

export function getGameWebSocketUrl(matchId: string, options?: GameWebSocketOptions) {
	const query = new URLSearchParams({ matchId });

	if (options?.isAI) {
		query.set("isAI", "1");
		if (options.aiDifficulty) {
			query.set("aiDifficulty", options.aiDifficulty);
		}
	}

	return `${getWebSocketBaseUrl()}/game?${query.toString()}`;
}
