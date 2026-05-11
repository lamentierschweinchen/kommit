"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useRouter, useSearchParams } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import {
  activateDemoMode,
  deactivateDemoMode,
  useDemoMode,
} from "@/lib/demo-mode";
import { deactivateVisaMode } from "@/lib/visa-mode";
import { clearDemoEngagement, seedDemoCohort } from "@/lib/demo-engagement";
import { authedFetch } from "@/lib/api-client";
import { findProjectPda } from "@/lib/kommit";
import { USERS, avatarUrl } from "@/lib/data/users";
import { LUKAS_COMMITMENTS } from "@/lib/data/commitments";
import { PROJECTS } from "@/lib/data/projects";
import { SEED_ENGAGEMENT, SEED_BACKER_NOTES } from "@/lib/data/seed-engagement";
import { Icon } from "@/components/common/Icon";
import { useToast } from "@/components/common/ToastProvider";
import { cn } from "@/lib/cn";

/**
 * Build the seed payload for the demo cohort. Pulls from the static seed
 * (`data/projects.ts` + `data/commitments.ts`) so swapping either source
 * naturally flows through to the demo without per-project plumbing.
 */
function buildCohortSeed() {
  const lukas = USERS.lukas;
  return {
    lukasWallet: lukas.wallet,
    lukasCommitments: LUKAS_COMMITMENTS,
    projectUpdates: PROJECTS.filter((p) => !!p.recipientWallet).map((p) => {
      const author = Object.values(USERS).find((u) => u.ownsProject === p.slug);
      return {
        slug: p.slug,
        pda: findProjectPda(new PublicKey(p.recipientWallet!)).toBase58(),
        authorWallet: author?.wallet ?? "",
        seed: p.updates,
      };
    }),
    engagement: SEED_ENGAGEMENT,
    backerNotes: SEED_BACKER_NOTES,
  };
}

const PERSONA_BLURBS: Record<string, string> = {
  lukas: "Kommitter with a portfolio across Climate, Bio, and Edu projects.",
  julian: "Founder of CALDERA — geothermal-baseload heat for industry. Post updates, see your cohort.",
  sara: "New visitor — clean dashboard, no commitments yet. The first-time user POV.",
};

type AirdropResponse =
  | {
      ok: true;
      tokenFundedUSD: number;
      tokenBalanceUSD: number;
      gasFundedLamports: number;
      lamportsAfter: number;
      signature: string | null;
    }
  | { ok: false; error: string };

/**
 * /demo — entry to the demo deploy.
 *
 * Two peer paths:
 *   1. **On-chain demo** (canonical) — Privy sign-in → auto-airdrop $10K
 *      sandbox SPL + 0.05 SOL gas → /dashboard with funded wallet.
 *   2. **Try our demo** — pick one of three populated personas
 *      (mock-auth, no signup) → CSR-navigate into a populated dashboard.
 *
 * Plus a tertiary "Browse as a stranger" link for signed-out exploration.
 */
export default function DemoEntryPage() {
  return (
    <Suspense fallback={null}>
      <DemoEntry />
    </Suspense>
  );
}

function DemoEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = useDemoMode();
  const { error: toastError } = useToast();
  const { authenticated } = usePrivy();
  const [pickedPersona, setPickedPersona] = useState<string | null>(null);
  const [funding, setFunding] = useState<"idle" | "auth" | "airdrop">("idle");

  const fundAndGo = useCallback(async () => {
    setFunding("airdrop");
    try {
      const res = await authedFetch("/api/sandbox/airdrop", { method: "POST" });
      const json = (await res.json()) as AirdropResponse;
      if (!json.ok) {
        const messages: Record<string, string> = {
          "demo-api-disabled":
            "The onchain demo isn't currently active. Please come back later.",
          "fee-payer-not-configured":
            "Sandbox can't sponsor gas right now. Try again in a moment.",
          "mint-not-configured":
            "Sandbox mint isn't set up. Operator needs to run the setup script.",
          "wrong-cluster":
            "Sandbox is misconfigured (RPC isn't devnet). Operator needs to fix the env.",
          "rate-limit": "Please wait a moment before requesting more.",
          rpc: "Couldn't reach the network. Try again in a moment.",
          auth: "Sign in to receive devnet funds.",
        };
        toastError(
          "Couldn't fund your wallet.",
          messages[json.error] ?? "Try again in a moment.",
        );
        setFunding("idle");
        return;
      }
      router.push("/dashboard");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[demo/onchain] airdrop failed:", e);
      toastError("Couldn't reach the sandbox.", "Refresh and retry.");
      setFunding("idle");
    }
  }, [router, toastError]);

  // Privy login is route-agnostic — we drive it from /demo with our own
  // onComplete so the post-signin step is the airdrop, not the default
  // SignInModal /dashboard hop. The default modal would skip the airdrop
  // and drop the user on /dashboard with a $0 balance.
  const { login } = useLogin({
    onComplete: () => {
      // Defensive: clear any leftover persona/EUR state from a prior session
      // before we route into the on-chain dashboard.
      deactivateDemoMode();
      deactivateVisaMode();
      void fundAndGo();
    },
    onError: (err) => {
      if (err === "exited_auth_flow") {
        setFunding("idle");
        return;
      }
      toastError(
        "Sign-in didn't work.",
        "Try again, or use a different method.",
      );
      setFunding("idle");
    },
  });

  const startOnChain = useCallback(() => {
    deactivateDemoMode();
    deactivateVisaMode();
    if (authenticated) {
      void fundAndGo();
      return;
    }
    setFunding("auth");
    login();
  }, [authenticated, login, fundAndGo]);

  // ?as=<id> deep-links into a persona without a click. Skipped if demo is
  // already active — fall through to the swap UI instead.
  useEffect(() => {
    const as = searchParams?.get("as");
    if (!as) return;
    if (as === "anon" || USERS[as]) {
      enterAs(as === "anon" ? null : as);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterAs = (personaId: string | null) => {
    if (typeof window === "undefined") return;
    setPickedPersona(personaId);
    // Persona-demo always runs in USD chrome; visa-mode is scoped strictly
    // to the /visa-demo card-mock flow. Without this clear, a prior
    // /visa-demo/success visit (which sets `kommit:visa = "1"`) leaves the
    // EUR chrome bleeding into the persona-demo dashboard the next time
    // someone enters via /demo. Handoff 58 #5.
    deactivateVisaMode();
    activateDemoMode(personaId ?? undefined);
    seedDemoCohort(buildCohortSeed());
    if (personaId) {
      const u = USERS[personaId];
      if (!u) return;
      const dest =
        u.role === "founder" && u.ownsProject
          ? `/founder/${u.ownsProject}`
          : "/dashboard";
      router.push(dest);
    } else {
      router.push("/");
    }
  };

  const exitDemo = () => {
    deactivateDemoMode();
    clearDemoEngagement();
    router.push("/");
  };

  const onChainBusy = funding !== "idle";
  const onChainCta =
    funding === "airdrop"
      ? "Funding your wallet…"
      : funding === "auth"
        ? "Signing in…"
        : "Start the onchain demo";

  return (
    <main className="flex-1 px-6 md:px-12 py-12 md:py-16 max-w-4xl mx-auto w-full">
      <div className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-10 relative">
        <div className="absolute -top-3 -right-3 inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm rotate-3">
          Demo
        </div>
        <h1 className="font-epilogue font-black uppercase text-3xl md:text-5xl tracking-tighter leading-[0.95] -rotate-[0.3deg]">
          Try Kommit.
        </h1>
        <p className="mt-5 font-epilogue font-medium text-base md:text-lg text-gray-800 leading-snug max-w-2xl">
          Two ways in. Sign in for the real thing on devnet, or walk a populated
          persona without the signup.{" "}
          {isDemo ? (
            <span className="font-bold text-primary">
              Persona demo is already active.
            </span>
          ) : null}
        </p>

        {/* Path 1 — On-chain demo (canonical). Visual weight = primary fill. */}
        <button
          type="button"
          onClick={startOnChain}
          disabled={onChainBusy}
          className={cn(
            "mt-10 w-full text-left bg-primary text-white border-[3px] border-black shadow-brutal-purple p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5",
            "hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform",
            "active:translate-x-[2px] active:translate-y-[2px]",
            "disabled:opacity-80 disabled:pointer-events-none",
          )}
        >
          <div className="shrink-0 w-14 h-14 bg-white text-primary border-[3px] border-black flex items-center justify-center">
            <Icon name="deployed_code" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-epilogue font-black uppercase text-xl md:text-2xl tracking-tight">
                Onchain demo
              </span>
              <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[9px] tracking-widest px-1.5 py-0.5 border-[2px] border-black">
                Recommended
              </span>
            </div>
            <p className="text-sm md:text-base font-medium text-white/90 leading-relaxed">
              Sign in via Privy → $10,000 of devnet funds + gas → real signed
              Anchor commits, Solscan-traceable.
            </p>
          </div>
          <div className="shrink-0 inline-flex items-center gap-2 bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal-sm">
            {funding === "airdrop" ? (
              <Icon name="progress_activity" className="font-bold animate-spin" />
            ) : null}
            {onChainCta}
            {funding === "idle" ? (
              <Icon name="arrow_forward" size="sm" />
            ) : null}
          </div>
        </button>

        {/* Path 2 — Persona walkthrough (secondary). Same border weight, no fill. */}
        <div className="mt-6 bg-white border-[3px] border-black shadow-brutal p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="font-epilogue font-black uppercase text-lg md:text-xl tracking-tight">
              Try our demo
            </span>
            <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
              Three personas · no signup
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-700 leading-relaxed max-w-2xl">
            Pick a persona. You&rsquo;ll be signed in as them — kommit, withdraw,
            post updates, react, comment. Switch personas at any time via the
            floating control bottom-left. Your activity stays in your browser.
          </p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {Object.values(USERS).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => enterAs(u.id)}
                disabled={pickedPersona === u.id}
                className={cn(
                  "text-left bg-white border-[3px] border-black shadow-brutal-sm p-4 flex items-start gap-3",
                  "hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform",
                  "active:translate-x-[1px] active:translate-y-[1px]",
                  "disabled:opacity-60 disabled:pointer-events-none",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl(u.avatarSeed, 120)}
                  alt=""
                  className="w-10 h-10 border-[3px] border-black object-cover grayscale shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-epilogue font-black uppercase text-sm tracking-tight truncate">
                      {u.displayName}
                    </span>
                    <span
                      className={cn(
                        "inline-block font-epilogue font-black uppercase text-[8px] tracking-widest px-1 py-0.5 border-[1.5px] border-black shrink-0",
                        u.role === "founder"
                          ? "bg-primary text-white"
                          : "bg-secondary text-black",
                      )}
                    >
                      {u.role === "founder" ? "Founder" : "Kommitter"}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-700 leading-snug line-clamp-3">
                    {PERSONA_BLURBS[u.id] ?? "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-6 border-t-[2px] border-black">
          <button
            type="button"
            onClick={() => enterAs(null)}
            className="font-epilogue font-bold uppercase text-xs tracking-widest text-gray-500 hover:text-black inline-flex items-center gap-1"
          >
            <Icon name="arrow_outward" size="sm" />
            Browse as a stranger (signed out)
          </button>
          {isDemo ? (
            <button
              type="button"
              onClick={exitDemo}
              className="font-epilogue font-bold uppercase text-xs tracking-widest text-gray-500 hover:text-black inline-flex items-center gap-1"
            >
              Exit demo · clear local state
            </button>
          ) : (
            <Link
              href="/"
              className="font-epilogue font-bold uppercase text-xs tracking-widest text-gray-500 hover:text-black inline-flex items-center gap-1"
            >
              ← Back to live product
            </Link>
          )}
        </div>
      </div>

      <div className="mt-10 max-w-2xl text-sm font-medium text-gray-600 leading-relaxed space-y-3">
        <p>
          <span className="font-epilogue font-bold uppercase tracking-widest text-[11px] text-black">
            Onchain demo.
          </span>{" "}
          Real Privy sign-in, real Solana devnet wallet, real Anchor instructions
          on the kommit program. The $10K is a sandbox SPL token minted on
          demand — distinct from Circle&rsquo;s rate-limited devnet USDC faucet
          so judges never run out.
        </p>
        <p>
          <span className="font-epilogue font-bold uppercase tracking-widest text-[11px] text-black">
            Try our demo.
          </span>{" "}
          Posts you write, reactions you click, comments you leave during the
          persona demo persist in your browser only. Funds, withdrawals, and
          faucet flows are simulated. Switching personas keeps the same shared
          cohort state in this browser.
        </p>
      </div>
    </main>
  );
}
