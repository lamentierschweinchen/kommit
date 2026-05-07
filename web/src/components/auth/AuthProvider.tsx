"use client";

/**
 * Auth provider — switches between two implementations at module load.
 *
 *   NEXT_PUBLIC_MOCK_AUTH=1   → MockAuthProvider (USERS-keyed, ?as= query,
 *                               DemoControls switchUser actually mutates state)
 *   else (default)            → RealAuthProvider (Privy embedded Solana wallet)
 *
 * Both implementations expose the same `AuthState` API (`{ user, role,
 * isSignedIn, signIn, signOut, switchRole, switchUser }`) so consumers
 * compile unchanged.
 *
 * Mock mode exists to let reviewers QA the authed surfaces (dashboard,
 * account, founder console) without burning real email accounts. It must
 * never ship to production: the gate is set in `.env.local` for local dev
 * and is intentionally absent on Vercel. Per Codex H2, the DemoControls
 * widget is also gated by `NODE_ENV !== "production"` at the layout mount
 * site so even an accidental flip can't expose persona switching to real
 * users.
 *
 * Privy hooks (real path) only work inside <PrivyProvider>; that wrapper
 * still mounts in mock mode but goes unused. SSR-safe via `"use client"`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { USERS, type Role, type User } from "@/lib/data/users";

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

const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "1";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Compile-time constant — Next inlines `process.env.NEXT_PUBLIC_*` at
  // build, so React's rules-of-hooks aren't violated within a single build.
  return MOCK_AUTH ? (
    <MockAuthProvider>{children}</MockAuthProvider>
  ) : (
    <RealAuthProvider>{children}</RealAuthProvider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Real provider — Privy embedded Solana wallet.
// ---------------------------------------------------------------------------

function truncateWallet(addr: string): string {
  if (addr.length < 8) return addr;
  return `${addr.slice(0, 3)}…${addr.slice(-3)}`;
}

/** Deterministic avatar seed from wallet address (pravatar accepts img=1..70). */
function avatarSeedFromAddress(addr: string): number {
  let acc = 0;
  for (let i = 0; i < addr.length; i++) acc = (acc * 31 + addr.charCodeAt(i)) >>> 0;
  return (acc % 70) + 1;
}

function RealAuthProvider({ children }: { children: ReactNode }) {
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
    };
  }, [isSignedIn, privyUser, wallet, activeRole]);

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
  // No-op in real mode. DemoControls is gated behind NODE_ENV !== "production".
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

// ---------------------------------------------------------------------------
// Mock provider — USERS-keyed, ?as= query, DemoControls fully wired.
// ---------------------------------------------------------------------------

const DEFAULT_MOCK_USER_ID = "lukas";

function MockAuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(DEFAULT_MOCK_USER_ID);
  const [activeRole, setActiveRole] = useState<Role>("kommitter");

  // Hydrate from `?as=` on mount so reviewers can deep-link directly into a
  // persona. Only meaningful in mock mode; the real provider ignores it.
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

  const signIn = useCallback((asUserId: string = DEFAULT_MOCK_USER_ID) => {
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
