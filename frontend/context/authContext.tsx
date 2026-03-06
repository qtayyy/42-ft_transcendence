"use client";
import {
	createContext,
	useState,
	useCallback,
	useMemo,
	useContext,
	useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { AuthContextValue, UserProfile } from "@/types/types";

const NON_AUTHENTICATED_ROUTES = [
	"/",
	"/login",
	"/signup",
	"/reset-password",
	"/reset-pwd",
	"/2fa/verify",
];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState<UserProfile | null>(null);
	const [loadingAuth, setLoadingAuth] = useState(true);
	const pathname = usePathname();
	const router = useRouter();

	const isNonAuthenticatedPage = useMemo(() => {
		return NON_AUTHENTICATED_ROUTES.includes(pathname);
	}, [pathname]);

	const refreshUser = useCallback(async () => {
		try {
			if (isNonAuthenticatedPage)
				return;
			const response = await axios.get("/api/profile");
			const profileData = response.data;
			setUser(profileData);
			return (profileData);
		} catch (error: any) {
			// Only clear user if it's an authentication error (401/403)
			// Otherwise, preserve existing user data to avoid UI disappearing
			if (error?.response?.status === 401 || error?.response?.status === 403) {
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
			} catch {
				if (isMounted) setUser(null);
			} finally {
				if (isMounted) setLoadingAuth(false);
			}
		};

		fetchUser();

		// Global Axios Interceptor for 401 Unauthorized (Session Management)
		const interceptorId = axios.interceptors.response.use(
			(response) => response,
			(error) => {
				if (error.response && error.response.status === 401) {
					// Ignore 401s on non-authenticated routes (like login/signup failures)
					// or 2fa verification endpoints
					const url = error.config.url;
					const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/2fa/verify');

					if (!isNonAuthenticatedPage && !isAuthEndpoint) {
						setUser(null);
						toast.error("Your session has expired. Please log in again.");
						router.push(`/login?next=${encodeURIComponent(pathname)}`);
						// Return an unresolved Promise to swallow the error globally.
						// This prevents downstream components (like tournament fetchers) 
						// from throwing unhandled Promise rejections while the redirect is happening.
						return new Promise(() => { });
					}
				}
				return Promise.reject(error);
			}
		);

		return () => {
			isMounted = false;
			axios.interceptors.response.eject(interceptorId);
		};
	}, [isNonAuthenticatedPage, router, pathname]);

	const login = useCallback(
		async (email: string, password: string) => {
			try {
				const response = await axios.post("/api/auth/login", {
					email,
					password,
				});
				if (response.status === 200) {
					setUser(response.data.profile);
					// Get redirect URL from current window location
					const urlParams = new URLSearchParams(window.location.search);
					const next = urlParams.get("next") ?? "/dashboard";
					router.push(next);
				} else if (response.status === 202) router.push("/2fa/verify");
			} catch (error) {
				throw error;
			}
		},
		[router]
	);

	const verify2fa = useCallback(
		async (code: string) => {
			try {
				const response = await axios.post("/api/auth/2fa/verify", { code });
				if (response.status === 200) {
					setUser(response.data.profile);
					// Get redirect URL from current window location
					const urlParams = new URLSearchParams(window.location.search);
					const next = urlParams.get("next") ?? "/dashboard";
					router.push(next);
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
