"use client";
import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useContext,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// type FriendStatus = "online" | "offline";

type UserProfile = {
  id: string;
  email: string;
  avatar?: string;
  username: string;
  fullname?: string;
  dob?: string;
  region?: string;
};

// type Friend = {
//   id: string;
//   username: string;
//   status: FriendStatus;
// };

type AuthContextValue = {
  user: UserProfile | null;
  // friends: Friend[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void | undefined>;
  verify2fa: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const response = await axios.get("/api/profile");
      const profileData = response.data;
      setUser(profileData);
    } catch (error: any) {
      // Only clear user if it's an authentication error (401/403)
      // Otherwise, preserve existing user data to avoid UI disappearing
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setUser(null);
      }
      // For other errors, keep the existing user data
      // This prevents the header from disappearing on temporary network issues
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const response = await axios.get("/api/profile");
        if (isMounted) setUser(response.data);
      } catch {
        if (isMounted) setUser(null);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await axios.post("/api/auth/login", {
          email,
          password,
        });
        if (response.status === 200) {
          setUser(response.data.profile);
          router.push("/dashboard");
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
          router.push("/dashboard");
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
    }),
    [user, login, logout, verify2fa, refreshUser]
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
