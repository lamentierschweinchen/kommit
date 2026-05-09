"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { visaDemo } from "@/lib/visa-demo-client";
import { activateVisaMode } from "@/lib/visa-mode";
import { activateDemoMode } from "@/lib/demo-mode";
import { simulateCommit } from "@/lib/demo-engagement";
import { Icon } from "@/components/common/Icon";
import { useToast } from "@/components/common/ToastProvider";
import type { ChargeStatusResponse } from "@/lib/visa-demo-types";

export default function VisaDemoSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000; // 60s ceiling — webhook is supposed to land in seconds

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

  const [status, setStatus] =
    useState<ChargeStatusResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

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

        if (res.status === "pending") {
          if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
            setPollError(
              "Payment didn't confirm in time. Refresh in a moment or contact support if your card was charged.",
            );
            return;
          }
          setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        if (res.status === "completed" && !settledRef.current) {
          settledRef.current = true;
          // Real-mode commit happens via existing on-chain
          // commitToProject when the user navigates to the dashboard.
          // For the v0.5 demo we still seed the localStorage position so
          // the dashboard renders the new commit immediately — this is
          // the same pattern the stub uses, and matches the
          // demo-engagement simulation.
          if (res.amountUSDCSettled) {
            try {
              simulateCommit({
                wallet: res.idempotencyKey, // stable enough for stub state
                projectSlug: res.projectSlug,
                principalUSD: res.amountUSDCSettled / 1_000_000,
              });
            } catch {
              // ignore — local-storage may be disabled
            }
          }
          activateVisaMode();
          activateDemoMode();
          // Bounce to the dashboard after a brief read-the-success-state
          // window so the user sees the confirmation.
          setTimeout(() => router.push("/dashboard"), 1800);
          return;
        }

        if (res.status === "failed" || res.status === "expired") {
          setPollError(
            res.failureReason ??
              "Your payment didn't go through. Please try again.",
          );
        }
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

  return (
    <main className="min-h-screen bg-[#FFFCF5] flex flex-col">
      <header className="px-6 md:px-12 py-6 border-b-[3px] border-black bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/"
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
          {pollError ? (
            <ErrorState message={pollError} />
          ) : status && status.ok && status.status === "completed" ? (
            <SuccessState status={status} />
          ) : (
            <PendingState />
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

function PendingState() {
  return (
    <div className="text-center">
      <Icon
        name="progress_activity"
        className="font-bold text-4xl animate-spin text-primary mx-auto mb-4"
      />
      <h1 className="font-epilogue font-black uppercase text-3xl tracking-tighter mb-2">
        Confirming&hellip;
      </h1>
      <p className="font-epilogue text-base text-gray-700">
        Hang tight — we&rsquo;re settling your kommit on-chain.
      </p>
    </div>
  );
}

function SuccessState({
  status,
}: {
  status: Extract<ChargeStatusResponse, { ok: true }>;
}) {
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
