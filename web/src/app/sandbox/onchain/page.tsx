"use client";

/**
 * Lane B `/sandbox/onchain` — three-step judge-facing flow.
 *
 *   1. Sign in (Privy embedded wallet).
 *   2. POST /api/sandbox/airdrop → mint $100 + drop 0.05 SOL gas.
 *   3. Pick a project + kommit → real signed `commitToProject()` Anchor
 *      call, passing the sandbox SPL mint as the runtime parameter.
 *
 * Each step surfaces its on-chain artifact (Solscan link). The dashboard
 * read path picks the kommit up via the regular Anchor `commitment.all`
 * memcmp — no demo-mode flag required.
 *
 * Hard UI rule: no token symbol in copy. The mint shows up only on
 * Solscan tx detail.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/AuthProvider";
import { useKommitProgram } from "@/lib/anchor-client";
import { useToast } from "@/components/common/ToastProvider";
import { authedFetch } from "@/lib/api-client";
import { commitToProject } from "@/lib/tx";
import { mapAnchorError } from "@/lib/anchor-errors";
import { getSandboxMintOrNull } from "@/lib/sandbox-mint";
import {
  getSandboxProjects,
  isSandboxProjectsConfigured,
} from "@/lib/sandbox-projects";
import { deactivateVisaMode } from "@/lib/visa-mode";
import { Icon } from "@/components/common/Icon";
import { SolscanLink } from "@/components/sandbox/SolscanLink";
import { cn } from "@/lib/cn";

type AirdropResponse =
  | {
      ok: true;
      lamportsBefore: number;
      lamportsAfter: number;
      gasFundedLamports: number;
      tokenFundedUSD: number;
      tokenBalanceUSD: number;
      signature: string | null;
    }
  | { ok: false; error: string };

const COMMIT_PRESETS = [25, 50, 100] as const;

export default function SandboxOnChainPage() {
  const { user, isSignedIn, signIn } = useAuth();
  const client = useKommitProgram();
  const { confirm, error: toastError } = useToast();

  // The on-chain sandbox runs in USD chrome — visa-mode (EUR) is scoped
  // strictly to the /visa-demo card-mock flow. A prior visit to
  // /visa-demo/success leaves `kommit:visa = "1"` in localStorage, which
  // would otherwise bleed EUR formatting into the dashboard the user
  // lands on after their on-chain commit (handoff 58 #5).
  useEffect(() => {
    deactivateVisaMode();
  }, []);

  // Codex Pass 1 H1 closure: the picker pulls from sandbox-projects.json
  // (fresh on-chain Project PDAs whose escrows are uninitialized at deploy
  // time) instead of the static PROJECTS catalog. The legacy catalog wallets
  // resolve to PDAs whose escrow ATAs are already locked to the production
  // USDC mint — committing the sandbox SPL mint into those escrows would
  // fail Anchor's `token::mint = usdc_mint` constraint mid-tx.
  const eligibleProjects = useMemo(() => getSandboxProjects(), []);
  const sandboxConfigured = useMemo(() => isSandboxProjectsConfigured(), []);
  const [projectSlug, setProjectSlug] = useState<string>(
    eligibleProjects[0]?.slug ?? "",
  );
  const project =
    eligibleProjects.find((p) => p.slug === projectSlug) ??
    eligibleProjects[0] ??
    null;

  const [amountUSD, setAmountUSD] = useState<number>(50);

  // ------- airdrop state -------
  const [airdropping, setAirdropping] = useState(false);
  const [airdropResult, setAirdropResult] = useState<
    Extract<AirdropResponse, { ok: true }> | null
  >(null);

  const handleAirdrop = useCallback(async () => {
    if (!isSignedIn) {
      signIn();
      return;
    }
    setAirdropping(true);
    try {
      const res = await authedFetch("/api/sandbox/airdrop", { method: "POST" });
      const json = (await res.json()) as AirdropResponse;
      if (!json.ok) {
        const messages: Record<string, string> = {
          "demo-api-disabled":
            "The sandbox isn't currently active. Please come back later.",
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
          "Couldn't airdrop funds.",
          messages[json.error] ?? "Try again in a moment.",
        );
        return;
      }
      setAirdropResult(json);
      const wasNoOp = json.gasFundedLamports === 0 && json.tokenFundedUSD === 0;
      if (wasNoOp) {
        confirm(
          "Already funded.",
          `Your wallet holds $${json.tokenBalanceUSD.toFixed(2)} ready to kommit.`,
        );
      } else {
        confirm(
          "Funded.",
          `$${json.tokenFundedUSD.toFixed(0)} + gas dropped to your wallet.`,
        );
      }
    } catch (e) {
      console.warn("[sandbox/onchain] airdrop failed:", e);
      toastError("Couldn't reach the sandbox.", "Refresh and retry.");
    } finally {
      setAirdropping(false);
    }
  }, [isSignedIn, signIn, confirm, toastError]);

  // ------- kommit state -------
  const [committing, setCommitting] = useState(false);
  const [commitSignature, setCommitSignature] = useState<string | null>(null);

  const sandboxMint = useMemo(() => getSandboxMintOrNull(), []);
  const canCommit =
    isSignedIn &&
    !!client &&
    !!project &&
    !!sandboxMint &&
    !!airdropResult &&
    amountUSD > 0 &&
    amountUSD <= (airdropResult?.tokenBalanceUSD ?? 0);

  const handleCommit = useCallback(async () => {
    if (!client || !project || !sandboxMint) return;
    setCommitting(true);
    try {
      const { signature } = await commitToProject(
        client,
        project.recipientWallet,
        amountUSD.toString(),
        sandboxMint,
      );
      setCommitSignature(signature);
      confirm(
        "Kommit confirmed.",
        `Backed ${project.name} with $${amountUSD}.`,
        {
          recoveryLabel: "View dashboard",
          // Dashboard read picks this up via Anchor memcmp — no demo flag.
          onRecover: () => (window.location.href = "/dashboard"),
        },
      );
    } catch (e) {
      const mapped = mapAnchorError(e);
      console.warn("[sandbox/onchain] commit failed:", e);
      if (mapped.kind !== "user_cancel") {
        toastError(
          mapped.kind === "unknown" ? "Kommit didn't go through." : mapped.title,
          mapped.kind === "unknown"
            ? "This project's setup is incompatible. Try a different one."
            : mapped.detail,
        );
      }
    } finally {
      setCommitting(false);
    }
  }, [client, project, amountUSD, sandboxMint, confirm, toastError]);

  // ------- UI -------
  const walletAddress = user?.wallet ?? null;

  return (
    <section className="px-6 md:px-12 py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 md:mb-14">
          <Link
            href="/sandbox"
            className="font-epilogue font-bold uppercase tracking-widest text-[11px] text-gray-500 hover:text-black inline-flex items-center gap-1"
          >
            <Icon name="arrow_back" size="sm" />
            Back to sandbox
          </Link>
          <h1 className="mt-4 font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter leading-[0.95]">
            Kommit on devnet.
          </h1>
          <p className="mt-5 font-epilogue font-medium text-base md:text-lg text-gray-800 leading-snug max-w-2xl">
            Sign in, get devnet funds, then sign a real Anchor commit. Each
            step surfaces its onchain artifact.
          </p>
        </div>

        <ol className="space-y-6 md:space-y-8">
          <Step
            number={1}
            title="Sign in"
            done={isSignedIn}
            disabled={false}
          >
            {isSignedIn && walletAddress ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="font-epilogue text-sm text-gray-700">
                  Wallet:{" "}
                  <SolscanLink
                    signature={walletAddress}
                    kind="account"
                    className="font-bold text-black"
                  />
                </div>
                <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-primary">
                  ✓ Connected
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn()}
                className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
              >
                Connect wallet
              </button>
            )}
          </Step>

          <Step
            number={2}
            title="Get devnet funds"
            done={!!airdropResult}
            disabled={!isSignedIn}
          >
            {!airdropResult ? (
              <div className="flex flex-col gap-3">
                <p className="font-epilogue text-sm text-gray-700 leading-relaxed">
                  Drops $10,000 of devnet test funds + ~0.05 SOL gas to your
                  wallet. Idempotent — safe to retry.
                </p>
                <button
                  type="button"
                  onClick={handleAirdrop}
                  disabled={!isSignedIn || airdropping}
                  className="self-start bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  {airdropping ? (
                    <>
                      <Icon name="progress_activity" className="font-bold animate-spin" />
                      Funding…
                    </>
                  ) : (
                    <>
                      Get $10,000 in devnet funds
                      <Icon name="arrow_forward" className="font-bold" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FactCell
                  label="Funds available"
                  value={`$${airdropResult.tokenBalanceUSD.toFixed(2)}`}
                />
                <FactCell
                  label="Gas (SOL)"
                  value={(airdropResult.lamportsAfter / 1e9).toFixed(4)}
                />
                {airdropResult.signature ? (
                  <div className="sm:col-span-2 font-epilogue text-xs text-gray-600">
                    Mint tx ·{" "}
                    <SolscanLink
                      signature={airdropResult.signature}
                      className="font-bold text-black"
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2 font-epilogue text-xs text-gray-600">
                    Already funded — no new tx needed.
                  </div>
                )}
              </div>
            )}
          </Step>

          <Step
            number={3}
            title="Pick a project + kommit"
            done={!!commitSignature}
            disabled={!airdropResult}
          >
            {project ? (
              <div className="space-y-5">
                <ProjectPicker
                  projects={eligibleProjects}
                  selectedSlug={project.slug}
                  onSelect={setProjectSlug}
                  disabled={committing || !airdropResult}
                />
                <AmountPicker
                  value={amountUSD}
                  onChange={setAmountUSD}
                  max={airdropResult?.tokenBalanceUSD ?? 0}
                  disabled={committing || !airdropResult}
                />
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!canCommit || committing}
                  className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base md:text-lg px-6 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 self-start"
                >
                  {committing ? (
                    <>
                      <Icon name="progress_activity" className="font-bold animate-spin" />
                      Signing…
                    </>
                  ) : (
                    <>
                      Kommit ${amountUSD} to {project.name}
                      <Icon name="arrow_forward" className="font-bold" />
                    </>
                  )}
                </button>
                {commitSignature ? (
                  <div className="bg-secondary border-[3px] border-black p-4 shadow-brutal">
                    <div className="font-epilogue font-black uppercase text-xs tracking-tight">
                      ✓ On-chain commit confirmed
                    </div>
                    <div className="mt-2 font-epilogue text-sm">
                      Signature ·{" "}
                      <SolscanLink
                        signature={commitSignature}
                        className="font-bold"
                      />
                    </div>
                    <Link
                      href="/dashboard"
                      className="mt-4 inline-flex items-center gap-2 bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-2.5 border-[3px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
                    >
                      View on dashboard
                      <Icon name="arrow_forward" size="sm" />
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="font-epilogue text-sm text-gray-600">
                {sandboxConfigured
                  ? "No sandbox projects available right now."
                  : "Sandbox not configured. Operator must run scripts/setup-sandbox-projects.mjs and commit the resulting sandbox-projects.json."}
              </p>
            )}
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  done,
  disabled,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "border-[3px] border-black bg-white p-6 md:p-7",
        done ? "shadow-brutal-purple" : "shadow-brutal",
        disabled && !done && "opacity-50",
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className={cn(
            "w-9 h-9 border-[3px] border-black flex items-center justify-center font-epilogue font-black text-base",
            done ? "bg-primary text-white" : "bg-white text-black",
          )}
          aria-hidden
        >
          {done ? "✓" : number}
        </span>
        <h2 className="font-epilogue font-black uppercase text-xl md:text-2xl tracking-tighter">
          {title}
        </h2>
      </div>
      {children}
    </li>
  );
}

function FactCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border-[2px] border-black p-3">
      <div className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-epilogue font-black text-2xl tracking-tight">
        {value}
      </div>
    </div>
  );
}

function ProjectPicker({
  projects,
  selectedSlug,
  onSelect,
  disabled,
}: {
  projects: { slug: string; name: string; pitch: string }[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
        Project
      </label>
      <ul className="space-y-2">
        {projects.map((p) => {
          const isActive = p.slug === selectedSlug;
          return (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => onSelect(p.slug)}
                disabled={disabled}
                className={cn(
                  "w-full text-left px-4 py-3 border-[3px] border-black flex items-center gap-3 transition-transform",
                  isActive
                    ? "bg-primary text-white shadow-brutal"
                    : "bg-white text-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px]",
                  "disabled:opacity-50 disabled:pointer-events-none",
                )}
              >
                <span
                  className="shrink-0 w-5 h-5 border-[2px] border-black bg-white flex items-center justify-center"
                  aria-hidden
                >
                  {isActive ? <span className="block w-2.5 h-2.5 bg-primary" /> : null}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-epilogue font-black uppercase tracking-tight text-base">
                    {p.name}
                  </span>
                  <span
                    className={cn(
                      "block font-medium text-xs leading-relaxed truncate",
                      isActive ? "text-white/80" : "text-gray-700",
                    )}
                  >
                    {p.pitch}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AmountPicker({
  value,
  onChange,
  max,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  max: number;
  disabled: boolean;
}) {
  const overBalance = value > max;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Amount
        </label>
        <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Available <span className="text-black">${max.toFixed(2)}</span>
        </span>
      </div>
      <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
        <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">
          $
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, Math.floor(max))}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          disabled={disabled}
          className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full disabled:opacity-50"
        />
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {COMMIT_PRESETS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            disabled={disabled || a > max}
            className={cn(
              "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform",
              "disabled:opacity-50 disabled:pointer-events-none",
              value === a ? "bg-primary text-white" : "bg-white text-black",
            )}
          >
            ${a}
          </button>
        ))}
      </div>
      {overBalance ? (
        <p className="mt-2 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Over your available balance.
        </p>
      ) : null}
    </div>
  );
}

