"use client";
import {
  createContext,
  useState,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// type FriendStatus = "online" | "offline";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
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
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const router = useRouter();

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await axios.post("/api/auth/login", {
          email,
          password,
        });
        if (response.status === 200) {
          setUser(response.data.user);
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
          setUser(response.data.user);
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
    }),
    [user, login, logout, verify2fa]
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
