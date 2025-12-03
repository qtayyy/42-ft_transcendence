"use client";
import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useContext,
  useEffect,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import axios from "axios";
import { AuthContextValue, UserProfile } from "@/type/types";

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
  const searchParams = useSearchParams();
  
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
        const response = await axios.get("/api/profile");
        if (isMounted) setUser(response.data);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoadingAuth(false);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [isNonAuthenticatedPage]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await axios.post("/api/auth/login", {
          email,
          password,
        });
        if (response.status === 200) {
          setUser(response.data.profile);
          const next = searchParams.get("next") ?? "/dashboard";
          router.push(next);
        } else if (response.status === 202) router.push("/2fa/verify");
      } catch (error) {
        throw error;
      }
    },
    [router, searchParams]
  );

  const verify2fa = useCallback(
    async (code: string) => {
      try {
        const response = await axios.post("/api/auth/2fa/verify", { code });
        if (response.status === 200) {
          setUser(response.data.profile);
          const next = searchParams.get("next") ?? "/dashboard";
          router.push(next);
        }
      } catch (error) {
        throw error;
      }
    },
    [router, searchParams]
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
