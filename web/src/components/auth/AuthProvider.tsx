"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { USERS, type User, type Role } from "@/lib/data/users";

type AuthState = {
  user: User | null;
  role: Role;
  isSignedIn: boolean;
  signIn: (asUserId?: string) => void;
  signOut: () => void;
  switchRole: (role: Role) => void;
  switchUser: (userId: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

const DEFAULT_USER_ID = "lukas";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(DEFAULT_USER_ID);
  const [activeRole, setActiveRole] = useState<Role>("kommitter");

  // Hydrate from `?as=` query param on mount, so reviewers can deep-link auth state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const as = params.get("as");
    if (as === "anon") {
      setUserId(null);
      return;
    }
    if (as && USERS[as]) {
      setUserId(as);
      const u = USERS[as];
      setActiveRole(u.role === "founder" ? "founder" : "kommitter");
    }
  }, []);

  const user = useMemo<User | null>(() => (userId ? USERS[userId] ?? null : null), [userId]);

  const signIn = useCallback((asUserId: string = DEFAULT_USER_ID) => {
    setUserId(asUserId);
    const u = USERS[asUserId];
    if (u) setActiveRole(u.role === "founder" ? "founder" : "kommitter");
  }, []);

  const signOut = useCallback(() => {
    setUserId(null);
    setActiveRole("anon");
  }, []);

  const switchRole = useCallback((role: Role) => setActiveRole(role), []);

  const switchUser = useCallback((id: string) => {
    if (USERS[id]) {
      setUserId(id);
      setActiveRole(USERS[id].role === "founder" ? "founder" : "kommitter");
    }
  }, []);

  const value: AuthState = useMemo(
    () => ({
      user,
      role: user ? activeRole : "anon",
      isSignedIn: !!user,
      signIn,
      signOut,
      switchRole,
      switchUser,
    }),
    [user, activeRole, signIn, signOut, switchRole, switchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
