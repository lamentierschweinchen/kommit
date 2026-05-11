"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { useKommitProgram } from "@/lib/anchor-client";
import { commitToProject } from "@/lib/tx";
import { mapAnchorError } from "@/lib/anchor-errors";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD } from "@/lib/kommit-math";
import { parseTokenAmount, validateAmount } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/data/projects";
import { Icon } from "@/components/common/Icon";
import { useDemoMode } from "@/lib/demo-mode";
import { getDemoBalance, saveBackerNote, simulateCommit } from "@/lib/demo-engagement";
import { useAuth } from "@/components/auth/AuthProvider";
import { KOMMIT_TX_EVENT } from "@/components/project/KommittersList";
import { getSandboxMintOrNull } from "@/lib/sandbox-mint";
import { getSandboxProjects } from "@/lib/sandbox-projects";
import { useSandboxBalance } from "@/lib/hooks/useSandboxBalance";

// USDC has 6 decimals on Solana. Mirror of `tx.ts:USDC_DECIMALS`; kept local
// so this UI module doesn't reach into the tx layer just for the constant.
const USDC_DECIMALS = 6;
const USDC_DECIMALS_DIVISOR = 10n ** BigInt(USDC_DECIMALS);

// Codex L1: comparisons run on exact bigint base units; the dollar literals
// here exist only to mint the matching base-unit constants below.
const QUICK_AMOUNTS = [50, 100, 500] as const;
const QUICK_AMOUNTS_BASE = QUICK_AMOUNTS.map(
  (n) => BigInt(n) * USDC_DECIMALS_DIVISOR,
);
const MAX_AMOUNT = 5000;
const MAX_AMOUNT_BASE = BigInt(MAX_AMOUNT) * USDC_DECIMALS_DIVISOR;

const NOTE_MAX = 280;

export function CommitModal({
  open,
  onOpenChange,
  project,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
  /** Fires after a successful on-chain settle so callers can refresh reads. */
  onSuccess?: () => void;
}) {
  const [raw, setRaw] = useState("100.00");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { confirm, error: toastError } = useToast();
  const client = useKommitProgram();
  const isDemo = useDemoMode();
  const { user } = useAuth();
  const router = useRouter();

  // On-chain demo path (real Privy): when sandbox is configured for this
  // project's slug, swap the recipient wallet + commit mint so the tx hits
  // the sandbox-locked escrow with the sandbox SPL token. Without this swap,
  // a real-Privy commit would target the production-USDC-locked escrow with
  // a sandbox-token deposit and fail Anchor's `token::mint` constraint.
  const sandboxMint = useMemo(() => (isDemo ? null : getSandboxMintOrNull()), [
    isDemo,
  ]);
  const sandboxProject = useMemo(() => {
    if (isDemo) return null;
    if (!sandboxMint) return null;
    return getSandboxProjects().find((p) => p.slug === project.slug) ?? null;
  }, [isDemo, project.slug, sandboxMint]);

  // Available balance — demo personas carry a localStorage-backed simulated
  // balance; real-Privy reads the sandbox SPL ATA. Both surface as the same
  // "Available" line above the amount input.
  const sandboxBalance = useSandboxBalance(
    !isDemo && open ? user?.wallet ?? null : null,
  );
  const [demoBalance, setDemoBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    if (isDemo && user?.wallet) {
      setDemoBalance(getDemoBalance(user.wallet));
    } else {
      setDemoBalance(null);
    }
  }, [open, isDemo, user?.wallet]);
  const availableUSD = isDemo ? demoBalance : sandboxBalance;

  useEffect(() => {
    if (open) {
      setRaw("100.00");
      setNote("");
    }
  }, [open]);

  // Exact base-unit parse — disable + preset-active checks compare bigints
  // (Codex L1). 0n covers both the empty/zero case and the malformed-input
  // case (validateAmount surfaces the specific error string for display).
  let parsedBaseUnits: bigint = 0n;
  try {
    if (raw.trim().length > 0) parsedBaseUnits = parseTokenAmount(raw, USDC_DECIMALS);
  } catch {
    parsedBaseUnits = 0n;
  }
  const validationError = raw.trim().length > 0 ? validateAmount(raw, USDC_DECIMALS, MAX_AMOUNT_BASE) : null;

  // Display value — parseFloat is OK for the human-readable button label;
  // it never feeds into TX construction or boundary checks.
  const displayUSD = parseFloat(raw) || 0;

  // The sandbox path doesn't need the static catalog wallet to be set —
  // sandbox-projects.json carries its own recipientWallet, derived by
  // setup-sandbox-projects.mjs. Treat the project as on-chain-eligible when
  // either source is wired.
  const isOnChain = !!project.recipientWallet || !!sandboxProject;
  const walletReady = isDemo ? !!user?.wallet : !!client;
  const overBalance =
    availableUSD !== null && displayUSD > availableUSD;
  const submitDisabled =
    !isOnChain ||
    !walletReady ||
    parsedBaseUnits === 0n ||
    !!validationError ||
    overBalance ||
    submitting;

  const submitHelp = !isOnChain
    ? "This project isn't open for kommitments yet."
    : !walletReady
      ? "Sign in to kommit."
      : validationError && raw.trim().length > 0
        ? validationError
        : overBalance
          ? `Over your available balance of ${formatUSD(availableUSD ?? 0)}.`
          : null;

  const handleSubmit = async () => {
    // Demo mode — short-circuit to localStorage simulation, no network or
    // signing call. Mirrors the engagement-loop demo intercept; keeps the
    // commit/withdraw flow intact for visitors who don't have a real wallet.
    if (isDemo) {
      if (!user?.wallet || displayUSD <= 0) return;
      setSubmitting(true);
      // Brief simulated latency so the UI doesn't feel instant + uncanny.
      await new Promise((r) => setTimeout(r, 350));
      simulateCommit({
        wallet: user.wallet,
        projectSlug: project.slug,
        principalUSD: displayUSD,
        note: note.trim() || undefined,
        authorName: user.displayName,
      });
      onOpenChange(false);
      setSubmitting(false);
      setTimeout(
        () =>
          confirm("Kommit confirmed.", `Backed ${project.name} with ${formatUSD(displayUSD)}.`, {
            recoveryLabel: "View dashboard",
            onRecover: () => router.push("/dashboard"),
          }),
        220,
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(KOMMIT_TX_EVENT));
      }
      onSuccess?.();
      return;
    }

    if (!client) return;
    // Real-Privy mode — pick the sandbox recipient + mint when configured,
    // else fall through to the production catalog wallet + USDC default.
    const recipient: PublicKey | null = sandboxProject
      ? sandboxProject.recipientWallet
      : project.recipientWallet
        ? new PublicKey(project.recipientWallet)
        : null;
    if (!recipient) return;
    setSubmitting(true);
    try {
      await commitToProject(
        client,
        recipient,
        raw,
        sandboxMint ?? undefined,
      );
      // v0.5 stub: persist any backer note to localStorage tagged with the
      // wallet — v1 rewires this to the real comments backend.
      const trimmedNote = note.trim();
      if (trimmedNote && user?.wallet) {
        saveBackerNote({
          projectSlug: project.slug,
          wallet: user.wallet,
          authorName: user.displayName,
          principalUSD: displayUSD,
          note: trimmedNote.slice(0, NOTE_MAX),
        });
      }
      // Clear any stale withdrawn-overlay for this (wallet, slug) — the
      // user just re-kommitted, so the on-chain position is the truth from
      // here on. Otherwise queries.ts would surface the old frozen
      // snapshot alongside the new position.
      if (user?.wallet) {
        const { clearWithdrawn } = await import("@/lib/withdrawn-overlay");
        clearWithdrawn(user.wallet, project.slug);
      }
      onOpenChange(false);
      setSubmitting(false);
      setTimeout(
        () =>
          confirm("Kommit confirmed.", `Backed ${project.name} with ${formatUSD(displayUSD)}.`, {
            recoveryLabel: "View dashboard",
            onRecover: () => router.push("/dashboard"),
          }),
        220,
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(KOMMIT_TX_EVENT));
      }
      onSuccess?.();
    } catch (e) {
      // C2: never sign-out or hard-navigate on tx error. Stay on the page,
      // surface the toast, let the user retry. The modal stays open so the
      // user can correct + resubmit.
      setSubmitting(false);
      const mapped = mapAnchorError(e);
      // eslint-disable-next-line no-console
      console.warn("commit failed:", e);
      if (mapped.kind === "user_cancel") return;
      toastError(
        mapped.kind === "unknown" ? "Kommit didn't go through." : mapped.title,
        mapped.kind === "unknown" ? "Try again." : mapped.detail,
        {
          recoveryLabel: "Try again",
          onRecover: () => void handleSubmit(),
        },
      );
    }
  };

  const founder = project.founders[0];

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Kommit to ${project.name}`}>
      <div className="mt-3 inline-flex items-center gap-2.5 bg-gray-100 px-3 py-1.5 border-[2px] border-black shadow-brutal-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(founder.avatarSeed, 60)}
          alt=""
          className="w-6 h-6 border-[2px] border-black object-cover grayscale"
        />
        <span className="font-epilogue font-black uppercase text-xs tracking-tight">
          By {founder.name}
        </span>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <label className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
            Amount
          </label>
          {availableUSD !== null ? (
            <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
              Available <span className="text-black">{formatUSD(availableUSD)}</span>
            </span>
          ) : null}
        </div>
        <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
          <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full"
            aria-label="Kommit amount"
            disabled={submitting}
          />
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {QUICK_AMOUNTS.map((a, i) => {
            const isActive = parsedBaseUnits === QUICK_AMOUNTS_BASE[i];
            return (
              <button
                key={a}
                type="button"
                onClick={() => setRaw(String(a))}
                disabled={submitting}
                className={cn(
                  "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
                  isActive ? "bg-primary text-white" : "bg-white text-black",
                )}
              >
                ${a}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setRaw(String(MAX_AMOUNT))}
            disabled={submitting}
            className={cn(
              "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
              parsedBaseUnits === MAX_AMOUNT_BASE ? "bg-primary text-white" : "bg-black text-white",
            )}
          >
            Max
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <label
            htmlFor="kommit-note"
            className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest"
          >
            Leave a note for the team (optional)
          </label>
          <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest tabular-nums">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
        <textarea
          id="kommit-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          placeholder="Why you're backing them. Stays public on their page."
          rows={2}
          maxLength={NOTE_MAX}
          disabled={submitting}
          className="w-full px-3 py-2.5 font-epilogue font-medium text-sm bg-white border-[3px] border-black shadow-brutal focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] outline-none transition-all resize-none placeholder:text-gray-400 disabled:opacity-60"
        />
      </div>

      <div className="mt-5 bg-gray-100 border-[3px] border-black p-4 space-y-2">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          What this does
        </div>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          The team sees a real backer. Your kommits build the longer you stay.
        </p>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          First access when they raise. Yours, even after you withdraw.
        </p>
      </div>

      <div className="mt-4 bg-secondary border-[3px] border-black p-4 shadow-brutal">
        <p className="font-epilogue font-black uppercase text-xs leading-relaxed tracking-tight">
          Withdraw anytime · No fees · Kommits stay yours
        </p>
      </div>

      <div className="mt-4 border-[3px] border-black bg-white p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Where your money goes
        </div>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          Deposited into audited yield protocols.{" "}
          <a
            href="https://github.com/lamentierschweinchen/kommit/blob/main/RISK.md"
            target="_blank"
            rel="noreferrer noopener"
            className="font-bold text-primary underline decoration-2 underline-offset-2 hover:bg-primary hover:text-white"
          >
            Read how we handle funds and risks
          </a>
          .
        </p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? (
            <>
              Signing…
              <Icon name="progress_activity" className="font-bold animate-spin" />
            </>
          ) : (
            <>
              Kommit {formatUSD(displayUSD)}
              <Icon name="arrow_forward" className="font-bold" />
            </>
          )}
        </button>
        {submitHelp ? (
          <p className="mt-3 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest text-center">
            {submitHelp}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
