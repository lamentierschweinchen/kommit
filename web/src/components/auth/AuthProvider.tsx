"use client";

/**
 * Auth provider — switches between two implementations based on demo mode.
 *
 *   demo mode (env NEXT_PUBLIC_KOMMIT_DEMO=1 or localStorage:kommit:demo=1)
 *                              → MockAuthProvider (USERS-keyed, ?as= query,
 *                                DemoControls switchUser actually mutates state)
 *   else (production default)  → RealAuthProvider (Privy embedded Solana wallet)
 *
 * Both implementations expose the same `AuthState` API (`{ user, role,
 * isSignedIn, signIn, signOut, switchRole, switchUser }`) so consumers
 * compile unchanged.
 *
 * The demo gate is the single canonical signal — any place that branches on
 * "is mock auth active" should read `useDemoMode()` (React) or
 * `isDemoMode()` (non-React). Same-site coexistence on kommit.now: real
 * Privy users never set the localStorage flag, so they always see Real;
 * demo visitors hit /demo to activate, then the rest of the app renders
 * MockAuthProvider for them. Production builds without the flag set never
 * surface persona-switcher UI.
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
import { getStoredPersonaId, setStoredPersonaId, useDemoMode } from "@/lib/demo-mode";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Runtime gate — env var is build-time inlined; localStorage is read
  // client-side after mount. SSR + first-paint always run RealAuthProvider
  // for non-env demo activations (a brief flash before localStorage flips
  // the tree on the production demo path; acceptable for the demo flow).
  const isDemo = useDemoMode();
  return isDemo ? (
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
  // Read persona from localStorage synchronously in the useState initializer
  // so the FIRST render is correct (handoff 58 #2). The previous shape —
  // initialise to lukas, then re-set in a useEffect — left every fresh mount
  // (e.g. when DemoControls switches persona and routes to /founder/<slug>,
  // re-mounting the AuthProvider tree under a new layout) flashing the
  // default persona before the effect fired. Result: "Lukas appeared first"
  // even after clicking Julian. Reading from storage in the initializer
  // races nothing — by the time MockAuthProvider mounts, the demo flag is
  // already set, which means localStorage is reachable and the persona key
  // has been written.
  //
  // The MockAuthProvider only ever mounts under `<Providers ssr:false>`
  // (see ProvidersMount), so this initializer never runs on the server —
  // there's no hydration mismatch to guard against.
  const initialPersonaId = (() => {
    if (typeof window === "undefined") return DEFAULT_MOCK_USER_ID;
    // ?as=<id> in the URL beats stored persona for deep-link entries.
    try {
      const params = new URLSearchParams(window.location.search);
      const as = params.get("as");
      if (as === "anon") return null;
      if (as && USERS[as]) return as;
    } catch {
      /* fallthrough */
    }
    const stored = getStoredPersonaId();
    if (stored && USERS[stored]) return stored;
    return DEFAULT_MOCK_USER_ID;
  })();
  const initialRole: Role = initialPersonaId
    ? USERS[initialPersonaId]?.role === "founder"
      ? "founder"
      : "kommitter"
    : "anon";

  const [userId, setUserId] = useState<string | null>(initialPersonaId);
  const [activeRole, setActiveRole] = useState<Role>(initialRole);

  // Persist the resolved persona on first mount so a deep-link entry
  // (`?as=julian`) carries through subsequent navigations. Storage is
  // already correct for the localStorage-only path, so this is a no-op
  // in the common case.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const as = params.get("as");
      if (as === "anon") {
        setStoredPersonaId(null);
      } else if (as && USERS[as]) {
        setStoredPersonaId(as);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const user = useMemo<User | null>(() => (userId ? USERS[userId] ?? null : null), [userId]);

  const signIn = useCallback((asUserId: string = DEFAULT_MOCK_USER_ID) => {
    setUserId(asUserId);
    const u = USERS[asUserId];
    if (u) setActiveRole(u.role === "founder" ? "founder" : "kommitter");
    setStoredPersonaId(asUserId);
  }, []);

  const signOut = useCallback(() => {
    setUserId(null);
    setActiveRole("anon");
    setStoredPersonaId(null);
  }, []);

  const switchRole = useCallback((role: Role) => setActiveRole(role), []);

  const switchUser = useCallback((id: string) => {
    if (USERS[id]) {
      setUserId(id);
      setActiveRole(USERS[id].role === "founder" ? "founder" : "kommitter");
      setStoredPersonaId(id);
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
