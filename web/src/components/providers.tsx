"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { Connection } from "@solana/web3.js";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
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

// Privy's Solana standard-wallet hooks (signTransaction, signAndSendTransaction)
// look up an RPC client keyed by chain. With no `solana.rpcs` config the
// internal lookup defaults to `solana:mainnet` and throws "No RPC
// configuration found for chain solana:mainnet" on the first signature
// attempt. Wire devnet here so withdraw / commit don't blow up.
const RPC_WS_URL =
  process.env.NEXT_PUBLIC_HELIUS_WS_URL ??
  RPC_URL.replace(/^https?:\/\//, (m) => (m === "https://" ? "wss://" : "ws://"));

export const SOLANA_CHAIN = "solana:devnet" as const;

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

  const appId = PRIVY_APP_ID || "placeholder-app-id";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "light",
          walletChainType: "solana-only",
        },
        // v0.1 ships embedded-wallet only. External wallet connectors
        // (toSolanaWalletConnectors) are deliberately NOT wired — they probe
        // window for injected providers and log a `[DEBUG] Detected injected
        // providers: Array(N)` to the console, polluting prod telemetry.
        // Re-add when external-wallet sign-in becomes a v1+ requirement.
        loginMethods: ["email", "google", "passkey"],
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
        },
        solana: {
          rpcs: {
            [SOLANA_CHAIN]: {
              rpc: createSolanaRpc(RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(RPC_WS_URL),
            },
          },
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
