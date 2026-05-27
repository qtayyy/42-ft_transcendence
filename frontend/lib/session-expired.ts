"use client";

import axios from "axios";
import { toast } from "sonner";

interface RouterLike {
	push: (path: string) => void;
}

const SESSION_EXPIRED_TOAST_WINDOW_MS = 1500;

let lastSessionExpiredToastAt = 0;

/** 401 on these routes is an expected auth-flow failure, not a dead session. */
const AUTH_FLOW_401_EXEMPT_PATHS = [
	"/api/auth/login",
	"/api/auth/2fa/verify",
	"/api/auth/2fa/enable/verify",
] as const;

function normalizeRequestUrl(url: unknown): string {
	return typeof url === "string" ? url : "";
}

export function isAuthFlowRequest(url: unknown): boolean {
	const value = normalizeRequestUrl(url);
	return AUTH_FLOW_401_EXEMPT_PATHS.some((path) => value.includes(path));
}

/** True when a 401 should clear the session and send the user to login. */
export function shouldTreat401AsSessionExpired(url: unknown): boolean {
	return !isAuthFlowRequest(url);
}

export function isSessionExpiredError(error: unknown): boolean {
	if (!axios.isAxiosError(error) || error.response?.status !== 401) {
		return false;
	}
	return shouldTreat401AsSessionExpired(error.config?.url);
}

export function isSessionExpiredResponse(
	response: Pick<Response, "status">,
	url?: unknown,
): boolean {
	if (response.status !== 401) return false;
	if (url === undefined) return true;
	return shouldTreat401AsSessionExpired(url);
}

export function redirectToLoginAfterSessionExpired(
	router: RouterLike,
	nextPath?: string,
): void {
	const fallbackPath =
		typeof window !== "undefined"
			? `${window.location.pathname}${window.location.search}`
			: "/dashboard";
	const redirectTarget = nextPath || fallbackPath;
	const now = Date.now();

	if (now - lastSessionExpiredToastAt > SESSION_EXPIRED_TOAST_WINDOW_MS) {
		toast.error("Session expired. Please log in again.");
		lastSessionExpiredToastAt = now;
	}

	router.push(`/login?next=${encodeURIComponent(redirectTarget)}`);
}

export function handleSessionExpiredRedirect(
	error: unknown,
	router: RouterLike,
	nextPath?: string,
): boolean {
	if (!isSessionExpiredError(error)) return false;

	redirectToLoginAfterSessionExpired(router, nextPath);
	return true;
}

export function handleSessionExpiredResponse(
	response: Pick<Response, "status">,
	router: RouterLike,
	nextPath?: string,
	url?: unknown,
): boolean {
	if (!isSessionExpiredResponse(response, url)) return false;

	redirectToLoginAfterSessionExpired(router, nextPath);
	return true;
}
