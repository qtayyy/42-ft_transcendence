"use client";

import axios from "axios";
import { toast } from "sonner";

interface RouterLike {
	push: (path: string) => void;
}

const SESSION_EXPIRED_TOAST_WINDOW_MS = 1500;

let lastSessionExpiredToastAt = 0;

export function isSessionExpiredError(error: unknown): boolean {
	return axios.isAxiosError(error) && error.response?.status === 401;
}

export function isSessionExpiredResponse(response: Pick<Response, "status">): boolean {
	return response.status === 401;
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
): boolean {
	if (!isSessionExpiredResponse(response)) return false;

	redirectToLoginAfterSessionExpired(router, nextPath);
	return true;
}
