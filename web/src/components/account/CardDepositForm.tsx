"use client";

/**
 * Card-as-deposit form (handoff 64).
 *
 * The submission narrative the demo tells judges: "Kommit accepts fiat-style
 * deposits today." The visible UX is a card visual + USD amount entry +
 * "Deposit $X" CTA. The implementation underneath is a server-side
 * sandbox-SPL mint via /api/sandbox/card-deposit — there is no real card
 * processor, no KYC, nothing leaves devnet.
 *
 * Card visual + amount input + presets, adapted for the modal-narrow
 * column. The card visual is what sells the narrative; the actual
 * settlement is via the existing sandbox-SPL mint authority.
 *
 * Cap: $1,000/deposit, enforced on input AND on submit AND on the server.
 * No lifetime cap — user can deposit repeatedly. Server-side has a
 * 60s/wallet rate limit to catch button-mash; if it fires, the form
 * surfaces a clear "wait a moment" error.
 */

import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";
import { authedFetch } from "@/lib/api-client";

/** Per-deposit cap. Mirrored server-side in /api/sandbox/card-deposit. */
const MAX_USD = 1000;

const PRESETS = [50, 100, 250, 500] as const;

type ServerError =
  | "auth"
  | "rpc"
  | "rate-limit"
  | "demo-api-disabled"
  | "wrong-cluster"
  | "mint-not-configured"
  | "fee-payer-not-configured"
  | "invalid-amount";

type CardDepositResponse =
  | { ok: true; amountUsd: number; txSignature: string }
  | { ok: false; error: ServerError };

const ERROR_COPY: Record<ServerError, string> = {
  auth: "Sign in to top up.",
  rpc: "Couldn't reach devnet right now. Try again in a moment.",
  "rate-limit": "Slow down — wait a few seconds and retry.",
  "demo-api-disabled": "Sandbox isn't active right now.",
  "wrong-cluster": "Sandbox misconfigured (wrong cluster).",
  "mint-not-configured": "Sandbox mint isn't set up.",
  "fee-payer-not-configured": "Sandbox fee payer isn't configured.",
  "invalid-amount": "Enter an amount between $1 and $1,000.",
};

export type CardDepositFormProps = {
  /** Fired on successful mint confirmation. Args: amount + tx signature.
   *  The parent owns the close-modal + dashboard-refresh + toast wiring. */
  onSuccess: (args: { amountUsd: number; txSignature: string }) => void;
};

export function CardDepositForm({ onSuccess }: CardDepositFormProps) {
  const [amount, setAmount] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dollars = Math.max(0, Math.min(MAX_USD, Math.floor(amount || 0)));
  const valid = dollars >= 1 && dollars <= MAX_USD;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await authedFetch("/api/sandbox/card-deposit", {
        method: "POST",
        body: JSON.stringify({ amountUsd: dollars }),
      });
      const json = (await res.json()) as CardDepositResponse;
      if (!json.ok) {
        setErrorMsg(ERROR_COPY[json.error] ?? "Deposit failed. Try again.");
        setSubmitting(false);
        return;
      }
      onSuccess({ amountUsd: json.amountUsd, txSignature: json.txSignature });
      // Don't reset submitting — the parent will close the modal.
    } catch (e) {
      console.warn("[CardDepositForm] submit failed:", e);
      setErrorMsg("Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5">
      <CardVisual amountUsd={dollars} />

      <div>
        <label
          htmlFor="card-deposit-amount"
          className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2"
        >
          Amount
        </label>
        <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
          <span className="px-3 flex items-center font-epilogue font-black text-3xl text-gray-400">
            $
          </span>
          <input
            id="card-deposit-amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_USD}
            value={amount}
            onChange={(e) => {
              // Cap on input — the server enforces it again, but this
              // keeps the visual amount honest while typing.
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) {
                setAmount(0);
                return;
              }
              setAmount(Math.min(MAX_USD, Math.max(0, Math.floor(raw))));
            }}
            disabled={submitting}
            className="flex-1 px-1 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full disabled:opacity-50"
            aria-describedby="card-deposit-help"
          />
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {PRESETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              disabled={submitting}
              className={cn(
                "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
                amount === a ? "bg-primary text-white" : "bg-white text-black",
              )}
            >
              ${a}
            </button>
          ))}
        </div>
        <p
          id="card-deposit-help"
          className="mt-3 font-medium text-xs text-gray-600 leading-relaxed"
        >
          Test mode — settles on devnet. Mainnet card processing comes with
          v1 launch. Max ${MAX_USD.toLocaleString()} per deposit.
        </p>
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="bg-white border-[3px] border-black p-3 flex items-start gap-2 text-sm font-medium text-black"
        >
          <Icon name="error" size="sm" className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!valid || submitting}
        className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        {submitting ? (
          <>
            <Icon
              name="progress_activity"
              size="sm"
              className="font-bold animate-spin"
            />
            Settling onchain&hellip;
          </>
        ) : (
          <>
            Deposit ${dollars.toLocaleString()}
            <Icon name="arrow_forward" size="sm" className="font-bold" />
          </>
        )}
      </button>
    </form>
  );
}

/**
 * Brutalist mini card visual — sells the "card top-up" narrative without
 * pretending to be a real card form (no PAN field, no CVC, etc.). The
 * amount displays live as the user types, the "DEMO" overlay keeps it
 * honest, and the brand strip on the bottom right hints at the
 * fiat-rails story without claiming a specific network.
 */
function CardVisual({ amountUsd }: { amountUsd: number }) {
  return (
    <div
      aria-hidden
      className="relative bg-primary text-white border-[3px] border-black shadow-brutal p-5 overflow-hidden"
    >
      {/* DEMO overlay — diagonal stripe, top-right */}
      <span className="absolute top-3 right-[-32px] rotate-45 bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-10 py-1 border-y-[2px] border-black">
        Demo
      </span>

      <div className="flex items-center justify-between">
        <div className="font-epilogue font-black uppercase tracking-widest text-[10px] text-white/70">
          Kommit · Top up
        </div>
      </div>

      {/* Chip rectangle */}
      <div className="mt-3 w-10 h-7 bg-secondary border-[2px] border-black" />

      {/* Card-number dots */}
      <div className="mt-4 flex items-center gap-3 font-mono text-base tracking-widest">
        <span aria-hidden>••••</span>
        <span aria-hidden>••••</span>
        <span aria-hidden>••••</span>
        <span className="font-epilogue font-black tracking-tight">
          {String(Math.max(0, amountUsd)).padStart(4, "0").slice(-4)}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="font-epilogue font-bold uppercase text-[9px] tracking-widest text-white/60">
            Amount
          </div>
          <div className="font-epilogue font-black text-2xl tracking-tight tabular-nums">
            ${amountUsd.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="font-epilogue font-bold uppercase text-[9px] tracking-widest text-white/60">
            Settles
          </div>
          <div className="font-epilogue font-black text-sm tracking-tight">
            Onchain
          </div>
        </div>
      </div>
    </div>
  );
}
