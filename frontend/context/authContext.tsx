"use client";
import {
	createContext,
	useState,
	useCallback,
	useMemo,
	useContext,
	useEffect,
	useLayoutEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { AuthContextValue, UserProfile } from "@/types/types";
import {
	redirectToLoginAfterSessionExpired,
	shouldTreat401AsSessionExpired,
} from "@/lib/session-expired";

const NON_AUTHENTICATED_ROUTES = [
	"/",
	"/login",
	"/signup",
	"/reset-pwd",
	"/2fa/verify",
	"/terms-of-service",
	"/privacy-policy",
];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const destinationAfterLogin = (activeMatch?: { matchId?: string }) =>
	activeMatch?.matchId ? `/game/${activeMatch.matchId}` : null;

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<UserProfile | null>(null);
	const [loadingAuth, setLoadingAuth] = useState(true);
	const pathname = usePathname();
	const router = useRouter();

	useEffect(() => {
		const handleSessionReplaced = () => {
			setUser(null);
			router.replace("/login?reason=session-replaced");
		};
		window.addEventListener("sessionReplaced", handleSessionReplaced);
		return () => window.removeEventListener("sessionReplaced", handleSessionReplaced);
	}, [router]);

	const isNonAuthenticatedPage = useMemo(() => {
		return NON_AUTHENTICATED_ROUTES.includes(pathname);
	}, [pathname]);

	useLayoutEffect(() => {
		if (typeof window === "undefined") return;

		const getFetchUrl = (input: RequestInfo | URL) => {
			if (typeof input === "string") return input;
			if (input instanceof URL) return input.toString();
			return input.url;
		};

		const redirectExpiredSession = (url: unknown, status: number) => {
			if (status !== 401) return false;
			if (isNonAuthenticatedPage) return false;
			if (!shouldTreat401AsSessionExpired(url)) return false;

			setUser(null);
			redirectToLoginAfterSessionExpired(router, pathname || "/dashboard");
			return true;
		};

		const interceptorId = axios.interceptors.response.use(
			(response) => response,
			(error) => {
				const status = error?.response?.status;
				if (status === 401) {
					redirectExpiredSession(error?.config?.url, status);
				}
				return Promise.reject(error);
			}
		);

		const originalFetch = window.fetch.bind(window);
		const guardedFetch: typeof window.fetch = async (input, init) => {
			const response = await originalFetch(input, init);
			if (response.status === 401) {
				redirectExpiredSession(getFetchUrl(input), response.status);
			}
			return response;
		};

		window.fetch = guardedFetch;

		return () => {
			axios.interceptors.response.eject(interceptorId);
			if (window.fetch === guardedFetch) {
				window.fetch = originalFetch;
			}
		};
	}, [isNonAuthenticatedPage, pathname, router]);

	const refreshUser = useCallback(async () => {
		try {
			if (isNonAuthenticatedPage)
				return;
			const response = await axios.get("/api/profile");
			const profileData = response.data;
			setUser(profileData);
			return (profileData);
		} catch (error: unknown) {
			// Only clear user when the session is actually invalid (401 on profile).
			const status = axios.isAxiosError(error) ? error.response?.status : undefined;
			if (status === 401) {
				setUser(null);
			}
			// For other errors, keep the existing user data
			// This prevents the header from disappearing on temporary network issues
		}
	}, [isNonAuthenticatedPage]);

	useEffect(() => {
		let isMounted = true;

		const fetchUser = async () => {
			try {
				if (isNonAuthenticatedPage) {
					setLoadingAuth(false);
					return;
				}

				if (!loadingAuth && !user) {
					setLoadingAuth(false);
					return;
				}

				// Only fetch if we don't have a user yet or it's a critical route change
				// This prevents re-fetching on every internal game redirect (which was causing socket loops)
				if (user && !loadingAuth) {
					// We already have a user, just ensure we celebrate it
					setLoadingAuth(false);
					return;
				}

				const response = await axios.get("/api/profile");
				const newData = response.data;
				if (isMounted) {
					setUser((prev) => {
						if (prev && prev.id === newData.id && prev.username === newData.username) {
							return prev;
						}
						return newData;
					});
				}
			} catch (error: unknown) {
				if (isMounted) {
					const status = axios.isAxiosError(error)
						? error.response?.status
						: undefined;
					if (status === 401) setUser(null);
				}
			} finally {
				if (isMounted) setLoadingAuth(false);
			}
		};

		fetchUser();

		return () => {
			isMounted = false;
		};
	}, [isNonAuthenticatedPage, loadingAuth, user]);

	const login = useCallback(
		async (email: string, password: string, takeover = false) => {
			try {
				const response = await axios.post("/api/auth/login", {
					email,
					password,
					takeover,
				});
				if (response.status === 200) {
					setUser(response.data.profile);
					// Get redirect URL from current window location
					const urlParams = new URLSearchParams(window.location.search);
					const next = urlParams.get("next") ?? "/dashboard";
					router.push(destinationAfterLogin(response.data.activeMatch) ?? next);
				} else if (response.status === 202) router.push("/2fa/verify");
			} catch (error) {
				throw error;
			}
		},
		[router]
	);

	const verify2fa = useCallback(
		async (code: string, takeover = false) => {
			try {
				const response = await axios.post("/api/auth/2fa/verify", { code, takeover });
				if (response.status === 200) {
					setUser(response.data.profile);
					// Get redirect URL from current window location
					const urlParams = new URLSearchParams(window.location.search);
					const next = urlParams.get("next") ?? "/dashboard";
					router.push(destinationAfterLogin(response.data.activeMatch) ?? next);
				}
			} catch (error) {
				throw error;
			}
		},
		[router]
	);

	const logout = useCallback(async () => {
		const response = await axios.post("/api/auth/logout");
		if (response.status === 200) setUser(null);
	}, []);

	const value = useMemo(
		() => ({
			user,
			isAuthenticated: Boolean(user),
			login,
			logout,
			verify2fa,
			refreshUser,
			loadingAuth,
		}),
		[user, login, logout, verify2fa, refreshUser, loadingAuth]
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuthContext must be used within AuthProvider");
	}
	return context;
};
