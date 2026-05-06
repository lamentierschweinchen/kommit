"use client";

/**
 * Real auth — backed by Privy's embedded Solana wallet.
 *
 * The exported API surface (`{ user, role, isSignedIn, signIn, signOut,
 * switchRole, switchUser }`) is identical to the Pass 1 mock so consumer
 * components compile unchanged. Internals delegate to Privy:
 *
 *   - `signIn()`   → `usePrivy().login()` (opens Privy modal, ignores any arg)
 *   - `signOut()`  → `usePrivy().logout()`
 *   - `user`       → derived from `usePrivy().user` + `useWallets()[0]`
 *   - `role`       → local state. Default `"kommitter"`. Founder mode is admin-
 *                    allow-listed and not wired this pass; per handoff 32.
 *   - `switchUser` → no-op in real mode. Demo widget is the only caller and
 *                    it's gated behind `NODE_ENV !== "production"`.
 *
 * SSR-safe: hooks are client-only via `"use client"`. AuthProvider must sit
 * inside `<Providers>` (PrivyProvider). See app/layout.tsx.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import type { Role, User } from "@/lib/data/users";

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

function truncateWallet(addr: string): string {
  if (addr.length < 8) return addr;
  return `${addr.slice(0, 3)}…${addr.slice(-3)}`;
}

/**
 * Deterministic avatar seed from a wallet address. Pravatar.cc accepts
 * `?img=N` for N in 1-70; we map the address to that range so the same wallet
 * always renders the same avatar across sessions.
 */
function avatarSeedFromAddress(addr: string): number {
  let acc = 0;
  for (let i = 0; i < addr.length; i++) acc = (acc * 31 + addr.charCodeAt(i)) >>> 0;
  return (acc % 70) + 1;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: privyUser, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [activeRole, setActiveRole] = useState<Role>("kommitter");

  const wallet = wallets[0];
  const isSignedIn = authenticated && !!wallet;

  const user: User | null = useMemo(() => {
    if (!isSignedIn || !privyUser || !wallet) return null;
    const address = wallet.address;
    const email = privyUser.email?.address;
    const displayName = email ? email.split("@")[0] : truncateWallet(address);
    return {
      id: address,
      displayName,
      role: activeRole,
      avatarSeed: avatarSeedFromAddress(address),
      email: email ?? "",
      wallet: address,
      // ownsProject left undefined — founder allow-list lookup ships in a later
      // slice once the user_profiles table is wired.
    };
  }, [isSignedIn, privyUser, wallet, activeRole]);

  // signIn ignores the asUserId argument (legacy mock-only param). Real flow
  // uses Privy's modal, which handles method selection itself.
  const signIn = useCallback(
    (_asUserId?: string) => {
      void _asUserId;
      login();
    },
    [login],
  );

  const signOut = useCallback(() => {
    logout();
  }, [logout]);

  const switchRole = useCallback((role: Role) => setActiveRole(role), []);

  // No-op in real mode. Only DemoControls calls this, and DemoControls is
  // gated behind NODE_ENV !== "production".
  const switchUser = useCallback((_userId: string) => {
    void _userId;
  }, []);

  const value: AuthState = useMemo(
    () => ({
      user,
      role: user ? activeRole : "anon",
      isSignedIn,
      signIn,
      signOut,
      switchRole,
      switchUser,
    }),
    [user, activeRole, isSignedIn, signIn, signOut, switchRole, switchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
