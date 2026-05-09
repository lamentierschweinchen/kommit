"use client";

/**
 * Redirect-back page after MoonPay-hosted checkout.
 *
 * Flow on a fully-settled charge:
 *   1. Poll /api/visa-demo/charge/{id} until
 *      `status === "completed" && relaySignature` truthy.
 *   2. Simulate the kommit position in localStorage (`simulateCommit`).
 *   3. Redirect to /dashboard.
 *
 * IMPORTANT (handoff 46 § E — Codex I1 closure):
 * This page does NOT perform the on-chain Anchor `commitToProject`
 * instruction. The fiat → USDC → relay leg IS real on-chain — the
 * settlement (MoonPay → merchant wallet) and relay (merchant →
 * kommitter wallet) signatures are both Solscan-traceable devnet
 * transactions. The kommit-position accrual itself is a v0.5 sandbox
 * simulation (`simulateCommit` writes to localStorage, mirroring the
 * persona-mode pattern used elsewhere in the demo). v1 wires the actual
 * `commitToProject()` Anchor call at this point in the flow.
 *
 * Why split `settled` from `completed`: see visa-demo-charge-store.ts
 * header. The FE was previously redirecting users to "kommit confirmed"
 * the moment a webhook arrived, BEFORE the merchant→kommitter USDC
 * relay tx had landed. A fee-payer outage or RPC failure left charges
 * marked done with no on-chain artifact. Now we gate on the relay
 * signature being recorded, and intermediate states (`settled`,
 * `relay_pending`, `relay_failed`) keep the user on a "settling on-chain"
 * UI until the relay either lands or the polling-bound timeout fires.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { visaDemo } from "@/lib/visa-demo-client";
import { activateVisaMode } from "@/lib/visa-mode";
import { activateDemoMode } from "@/lib/demo-mode";
import { simulateCommit } from "@/lib/demo-engagement";
import { USERS } from "@/lib/data/users";
import { Icon } from "@/components/common/Icon";
import { useToast } from "@/components/common/ToastProvider";
import type { ChargeStatusResponse } from "@/lib/visa-demo-types";

/**
 * The visa-demo flow lands the user on the kommitter dashboard as the
 * "lukas" persona. Pinning the persona here (a) keeps the Lukas avatar
 * + sidebar consistent with the rest of the demo experience, and (b)
 * gives simulateCommit a stable wallet key that matches what the
 * dashboard's `getCommitmentsForUser(user.wallet)` will read.
 */
const VISA_DEMO_PERSONA_ID = "lukas";

export default function VisaDemoSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000; // 60s ceiling — webhook + relay should land in seconds

type SuccessOk = Extract<ChargeStatusResponse, { ok: true }>;

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError } = useToast();

  // Charge identifiers — accept either `?chargeId=` (preferred) or `?ik=`
  // (idempotency-key fallback when MoonPay's redirect strips chargeId).
  // sessionStorage gives us a third lookup path for browsers that lose
  // both during the redirect.
  const urlChargeId = searchParams?.get("chargeId") ?? null;
  const urlIdemKey = searchParams?.get("ik") ?? null;
  const isMock = searchParams?.get("mock") === "1";

  const [status, setStatus] = useState<SuccessOk | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState<boolean>(false);

  const pollStartRef = useRef<number>(Date.now());
  const settledRef = useRef<boolean>(false);

  useEffect(() => {
    const lookupChargeId = (() => {
      if (urlChargeId) return urlChargeId;
      try {
        return window.sessionStorage.getItem("kommit:visa:lastChargeId");
      } catch {
        return null;
      }
    })();

    if (!lookupChargeId) {
      setPollError(
        urlIdemKey
          ? "Lost track of your payment session. Please return to the demo and try again."
          : "No charge to look up — please return to the demo and try again.",
      );
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await visaDemo.chargeStatus(lookupChargeId);
        if (cancelled) return;
        if (!res.ok) {
          setPollError("Couldn't read your payment status. Try refreshing.");
          return;
        }
        setStatus(res);

        // Terminal failure (MoonPay-side): show the error state and stop.
        if (res.status === "failed" || res.status === "expired") {
          setPollError(
            res.failureReason ??
              "Your payment didn't go through. Please try again.",
          );
          return;
        }

        // Fully done: the merchant→kommitter relay landed and we have
        // the relay signature. ONLY this branch runs the localStorage
        // simulation + redirects. Codex M2 closure — `completed` alone
        // is no longer sufficient (relay_failed used to coincide with
        // the prior `completed`-without-signature stuck state).
        if (
          res.status === "completed" &&
          res.relaySignature &&
          !settledRef.current
        ) {
          settledRef.current = true;
          // Pin the demo persona BEFORE the simulateCommit write so the
          // wallet key used here matches what the dashboard will read
          // (MockAuthProvider hydrates from PERSONA_KEY → user.wallet →
          // getCommitmentsForUser(user.wallet)). Previously `wallet:
          // res.idempotencyKey` wrote under a per-charge UUID that no
          // dashboard surface ever reads — the position was orphaned.
          activateVisaMode();
          activateDemoMode(VISA_DEMO_PERSONA_ID);
          if (res.amountUSDCSettled) {
            try {
              // Codex I1 honest-narrative note: this is a localStorage
              // SIMULATION, not an on-chain Anchor commit. The on-chain
              // artifacts (settlementSignature + relaySignature) are
              // both real and Solscan-traceable; the kommit-position
              // accrual is a v0.5 sandbox shortcut. v1 wires
              // commitToProject().
              simulateCommit({
                wallet: USERS[VISA_DEMO_PERSONA_ID].wallet,
                projectSlug: res.projectSlug,
                principalUSD: res.amountUSDCSettled / 1_000_000,
              });
            } catch {
              // ignore — local-storage may be disabled
            }
          }
          // Brief read-the-success-state window before bouncing.
          setTimeout(() => router.push("/dashboard"), 1800);
          return;
        }

        // Intermediate states — keep polling until a terminal state is
        // reached or the bound is hit. `pending` / `settled` /
        // `relay_pending` / `relay_failed` all flow through this branch.
        // (Even `relay_failed` keeps polling because MoonPay retries
        // duplicate webhook deliveries on its own cadence; if the relay
        // recovers, the next poll catches the `completed` transition.)
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          // Bounded — stop polling, show "taking longer than expected"
          // UI. Don't toast-error; the page surface is informative.
          setTimedOut(true);
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        setPollError(
          e instanceof Error
            ? e.message
            : "Couldn't reach our servers. Please retry.",
        );
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
    // urlChargeId / urlIdemKey are read once; effect deps intentionally
    // narrow to avoid re-firing the poll loop on every search-params tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pollError) toastError("Payment status", pollError);
  }, [pollError, toastError]);

  // Pick which UI state to render. Order matters:
  //   1. Hard error (poll error / lookup error) — final, no recovery.
  //   2. Fully-settled completed state — the success card.
  //   3. Settling-too-long (>60s) — bounded "taking longer" with retry.
  //   4. Intermediate (pending / settled / relay_pending / relay_failed) — pending UI.
  const view = (() => {
    if (pollError) return { kind: "error" as const, message: pollError };
    if (status && status.status === "completed" && status.relaySignature) {
      return { kind: "success" as const, status };
    }
    if (timedOut) return { kind: "timeout" as const, status };
    return { kind: "pending" as const, status };
  })();

  return (
    <main className="min-h-screen bg-[#FFFCF5] flex flex-col">
      <header className="px-6 md:px-12 py-6 border-b-[3px] border-black bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/app"
            className="font-epilogue font-black uppercase tracking-tighter text-xl"
          >
            kommit
          </Link>
          <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
            {isMock ? "Sandbox · simulated" : "Sandbox · MoonPay"}
          </span>
        </div>
      </header>

      <section className="flex-1 px-6 md:px-12 py-12 md:py-24 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white border-[3px] border-black shadow-brutal-purple p-8 md:p-12">
          {view.kind === "error" ? (
            <ErrorState message={view.message} />
          ) : view.kind === "success" ? (
            <SuccessState status={view.status} />
          ) : view.kind === "timeout" ? (
            <TimeoutState status={view.status} />
          ) : (
            <PendingState status={view.status} />
          )}
        </div>
      </section>

      <footer className="border-t-[3px] border-black bg-white px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-epilogue font-medium text-xs text-gray-600">
            {isMock
              ? "Simulated payment · no funds moved"
              : "Sandbox payment · devnet USDC"}
          </span>
          <Link
            href="/visa-demo"
            className="font-epilogue font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-black"
          >
            ← Back to demo
          </Link>
        </div>
      </footer>
    </main>
  );
}

function PendingState({ status }: { status: SuccessOk | null }) {
  // Surface the actual lifecycle position so the message tracks real
  // progress instead of a generic "Confirming…" that lingers after the
  // card cleared. Each branch is a beat the user can read off the screen.
  const { headline, body } = (() => {
    const s = status?.status;
    if (s === "settled") {
      return {
        headline: "Payment received",
        body: "Settling your kommit on-chain — one more step.",
      };
    }
    if (s === "relay_pending") {
      return {
        headline: "Settling on-chain…",
        body: "Routing your USDC to your kommit wallet.",
      };
    }
    if (s === "relay_failed") {
      return {
        headline: "Retrying on-chain settlement…",
        body:
          "MoonPay confirmed your payment. We're retrying the on-chain leg automatically.",
      };
    }
    // pending / unknown — webhook hasn't arrived yet.
    return {
      headline: "Confirming…",
      body: "Hang tight — we're waiting on payment confirmation.",
    };
  })();

  return (
    <div className="text-center">
      <Icon
        name="progress_activity"
        className="font-bold text-4xl animate-spin text-primary mx-auto mb-4"
      />
      <h1 className="font-epilogue font-black uppercase text-3xl tracking-tighter mb-2">
        {headline}&hellip;
      </h1>
      <p className="font-epilogue text-base text-gray-700">{body}</p>
      {status?.settlementSignature ? (
        <p className="mt-4 font-epilogue text-xs text-gray-500">
          <span className="font-bold uppercase tracking-widest">
            Settlement
          </span>{" "}
          ·{" "}
          <a
            href={`https://solscan.io/tx/${status.settlementSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary break-all"
          >
            {status.settlementSignature.slice(0, 16)}&hellip;
          </a>
        </p>
      ) : null}
    </div>
  );
}

function TimeoutState({ status }: { status: SuccessOk | null }) {
  // 60s polling bound elapsed without a `completed + relaySignature`.
  // The card likely cleared (we may already have a `settlementSignature`)
  // but the merchant→kommitter relay hasn't landed yet. Don't claim
  // success and don't claim failure — this is the honest "let an
  // operator look" surface.
  return (
    <div className="text-center">
      <Icon
        name="info"
        className="font-bold text-4xl text-primary mx-auto mb-4"
      />
      <h1 className="font-epilogue font-black uppercase text-3xl tracking-tighter mb-2">
        Taking longer than expected.
      </h1>
      <p className="font-epilogue text-base text-gray-700 mb-4">
        Your card payment has been received. The on-chain settlement is
        still in flight — your kommit will appear once it lands. Refresh
        in a moment to re-check.
      </p>
      {status?.settlementSignature ? (
        <p className="font-epilogue text-xs text-gray-500 mb-2">
          <span className="font-bold uppercase tracking-widest">
            Settlement
          </span>{" "}
          ·{" "}
          <a
            href={`https://solscan.io/tx/${status.settlementSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary break-all"
          >
            {status.settlementSignature.slice(0, 16)}&hellip;
          </a>
        </p>
      ) : null}
      {status?.relayFailureReason ? (
        <p className="font-epilogue text-xs text-gray-500 mb-4">
          Relay status: {status.relayFailureReason}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-block bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
      >
        Refresh
      </button>
    </div>
  );
}

function SuccessState({ status }: { status: SuccessOk }) {
  const settledUsd = status.amountUSDCSettled
    ? status.amountUSDCSettled / 1_000_000
    : null;
  return (
    <div className="text-center">
      <Icon
        name="check"
        className="font-bold text-5xl text-primary mx-auto mb-4"
      />
      <h1 className="font-epilogue font-black uppercase text-3xl tracking-tighter mb-2">
        Kommit confirmed.
      </h1>
      <p className="font-epilogue text-base text-gray-700 mb-6">
        Your card cleared and {settledUsd ? `~$${settledUsd.toFixed(2)}` : "your funds"}
        {" "}is now in your kommit position.
      </p>
      {status.settlementSignature ? (
        <p className="font-epilogue text-xs text-gray-500 mb-2">
          <span className="font-bold uppercase tracking-widest">
            Settlement
          </span>{" "}
          ·{" "}
          <a
            href={`https://solscan.io/tx/${status.settlementSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary break-all"
          >
            {status.settlementSignature.slice(0, 16)}&hellip;
          </a>
        </p>
      ) : null}
      {status.relaySignature ? (
        <p className="font-epilogue text-xs text-gray-500">
          <span className="font-bold uppercase tracking-widest">Relay</span>{" "}
          ·{" "}
          <a
            href={`https://solscan.io/tx/${status.relaySignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary break-all"
          >
            {status.relaySignature.slice(0, 16)}&hellip;
          </a>
        </p>
      ) : null}
      <p className="mt-6 font-epilogue text-sm text-gray-600">
        Redirecting to your dashboard&hellip;
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center">
      <Icon name="error" className="font-bold text-5xl text-black mx-auto mb-4" />
      <h1 className="font-epilogue font-black uppercase text-3xl tracking-tighter mb-2">
        Something went wrong.
      </h1>
      <p className="font-epilogue text-base text-gray-700 mb-6">{message}</p>
      <Link
        href="/visa-demo"
        className="inline-block bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
      >
        Try again
      </Link>
    </div>
  );
}
