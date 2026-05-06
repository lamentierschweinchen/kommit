"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { Connection } from "@solana/web3.js";
import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

type SolanaConnectionCtx = { connection: Connection; rpcUrl: string };

const SolanaConnectionContext = createContext<SolanaConnectionCtx | null>(null);

export function useSolanaConnection(): SolanaConnectionCtx {
  const ctx = useContext(SolanaConnectionContext);
  if (!ctx) throw new Error("useSolanaConnection must be used inside <Providers>");
  return ctx;
}

function SolanaConnectionProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({ connection: new Connection(RPC_URL, "confirmed"), rpcUrl: RPC_URL }),
    [],
  );
  return (
    <SolanaConnectionContext.Provider value={value}>
      {children}
    </SolanaConnectionContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const solanaConnectors = useMemo(() => toSolanaWalletConnectors(), []);
  const appId = PRIVY_APP_ID || "placeholder-app-id";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "light",
          walletChainType: "solana-only",
        },
        loginMethods: ["email", "google", "passkey"],
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <SolanaConnectionProvider>
        {mounted && !PRIVY_APP_ID && (
          <div className="bg-amber-100 text-amber-900 text-xs px-4 py-1.5 text-center font-epilogue font-bold uppercase tracking-widest">
            NEXT_PUBLIC_PRIVY_APP_ID not set — sign-in attempts will fail. Browse + read-only flows
            work.
          </div>
        )}
        {children}
      </SolanaConnectionProvider>
    </PrivyProvider>
  );
}
