"use client";

import axios from "axios";
import { toast } from "sonner";

interface RouterLike {
	push: (path: string) => void;
}

export function isSessionExpiredError(error: unknown): boolean {
	return axios.isAxiosError(error) && error.response?.status === 401;
}

export function handleSessionExpiredRedirect(
	error: unknown,
	router: RouterLike,
	nextPath?: string,
): boolean {
	if (!isSessionExpiredError(error)) return false;

	const fallbackPath =
		typeof window !== "undefined"
			? `${window.location.pathname}${window.location.search}`
			: "/dashboard";
	const redirectTarget = nextPath || fallbackPath;

	toast.error("Session expired. Please log in again.");
	router.push(`/login?next=${encodeURIComponent(redirectTarget)}`);
	return true;
}

