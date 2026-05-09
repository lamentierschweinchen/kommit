"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { findProjectPda } from "@/lib/kommit";
import {
  deactivateVisaMode,
  formatEURDirect,
  useVisaMode,
} from "@/lib/visa-mode";
import { visaDemo } from "@/lib/visa-demo-client";
import { PROJECTS } from "@/lib/data/projects";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";

const AMOUNT_PRESETS = [25, 50, 100, 250] as const;
const SANDBOX_HINT = "Sandbox · MoonPay-hosted card checkout";

const FEATURED_SLUGS = [
  "caldera",
  "lighthouse-labs",
  "aurora",
  "frame-studio",
  "beacon-sci",
];

export default function VisaDemoPage() {
  return (
    <Suspense fallback={null}>
      <VisaDemoEntry />
    </Suspense>
  );
}

function VisaDemoEntry() {
  const searchParams = useSearchParams();
  const { error: toastError } = useToast();
  const isVisa = useVisaMode();

  const [amountEUR, setAmountEUR] = useState<number>(50);
  const initialProject = searchParams?.get("project");
  const [projectSlug, setProjectSlug] = useState<string>(
    initialProject && FEATURED_SLUGS.includes(initialProject)
      ? initialProject
      : FEATURED_SLUGS[0],
  );
  const [submitting, setSubmitting] = useState(false);

  const eligibleProjects = useMemo(
    () =>
      FEATURED_SLUGS.map((s) => PROJECTS.find((p) => p.slug === s)).filter(
        (p): p is NonNullable<typeof p> => !!p && !!p.recipientWallet,
      ),
    [],
  );

  const project =
    eligibleProjects.find((p) => p.slug === projectSlug) ?? eligibleProjects[0];

  const valid = amountEUR > 0 && !!project;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting || !project) return;
    setSubmitting(true);

    let projectPda: string;
    try {
      projectPda = findProjectPda(
        new PublicKey(project.recipientWallet!),
      ).toBase58();
    } catch {
      setSubmitting(false);
      toastError(
        "Couldn't reach this project right now.",
        "Try a different one.",
      );
      return;
    }

    // Codex H1: fresh idempotency key per user-initiated submit. Suppresses
    // duplicate MoonPay charges on double-click / retry within the in-flight
    // request lifetime; doubles as the cross-redirect identifier embedded
    // in successRedirectUrl.
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const res = await visaDemo.onramp({
      amountEUR,
      projectPda,
      projectSlug: project.slug,
      idempotencyKey,
    });

    if (!res.ok) {
      setSubmitting(false);
      const messages: Record<string, string> = {
        "charge-failed":
          "Couldn't start your payment. Please retry in a moment.",
        "rate-limit": "Too many attempts. Wait a moment and retry.",
        "idempotency-conflict":
          "That request looks like a duplicate. Refresh the page and try again.",
        "demo-api-disabled":
          "The demo isn't currently active. Please come back later.",
        "moonpay-not-configured":
          "Payments are temporarily unavailable. Please try again later.",
      };
      toastError("Couldn't start payment.", messages[res.error] ?? "Retry?");
      return;
    }

    // Stash the idempotency key so the success page can find this charge
    // even if the URL parameter is stripped by an intermediate redirect.
    try {
      window.sessionStorage.setItem("kommit:visa:lastChargeId", res.chargeId);
      window.sessionStorage.setItem("kommit:visa:lastIdemKey", idempotencyKey);
    } catch {
      // sessionStorage may be disabled — non-fatal, success page falls
      // back to URL params.
    }

    // Redirect to MoonPay-hosted checkout. The user enters their card
    // there and is redirected back to /visa-demo/success on completion.
    window.location.assign(res.hostedUrl);
  };

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
            {SANDBOX_HINT}
          </span>
        </div>
      </header>

      <section className="flex-1 px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-12 md:mb-16">
            <span className="inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm mb-5">
              Sandbox preview
            </span>
            <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter leading-[0.95]">
              Kommit on card rails.
            </h1>
            <p className="mt-6 font-epilogue font-medium text-lg md:text-xl text-gray-800 leading-snug border-l-[4px] border-primary pl-5">
              Pick a team, pick an amount, then pay with your card on MoonPay&rsquo;s
              hosted checkout. Your kommit lands the moment the payment settles.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12 items-start"
          >
            <div className="space-y-7">
              <AmountField
                amountEUR={amountEUR}
                onChange={setAmountEUR}
                disabled={submitting}
              />

              <ProjectField
                projects={eligibleProjects}
                selected={projectSlug}
                onChange={setProjectSlug}
                disabled={submitting}
              />
            </div>

            <div className="space-y-7">
              <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-7">
                <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                  Order summary
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <span className="font-epilogue font-medium text-base text-gray-700">
                    Kommit amount
                  </span>
                  <span className="font-epilogue font-black text-3xl tracking-tight">
                    {formatEURDirect(amountEUR)}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <span className="font-epilogue font-medium text-base text-gray-700">
                    Backing
                  </span>
                  <span className="font-epilogue font-black text-base text-right">
                    {project?.name ?? "—"}
                  </span>
                </div>
                <div className="mt-5 pt-5 border-t-[2px] border-black/10 font-epilogue text-xs text-gray-600 leading-relaxed">
                  Card details are entered on MoonPay&rsquo;s hosted checkout
                  page. We never see them.
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!valid || submitting}
                  className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-lg md:text-xl px-8 py-5 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? (
                    <>
                      <Icon
                        name="progress_activity"
                        className="font-bold animate-spin"
                      />
                      Redirecting to checkout&hellip;
                    </>
                  ) : (
                    <>
                      Pay {formatEURDirect(amountEUR)} with card
                      <Icon name="arrow_forward" className="font-bold" />
                    </>
                  )}
                </button>
                <p className="mt-3 font-epilogue font-medium text-xs text-gray-600 leading-relaxed text-center">
                  Sandbox payments use MoonPay Commerce. Withdrawals stay
                  on-chain to your kommit wallet — fiat off-ramp arrives in v1.
                </p>
              </div>
            </div>
          </form>

          {isVisa ? (
            <div className="mt-16 pt-8 border-t-[2px] border-black flex justify-between items-center flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="font-epilogue font-bold uppercase tracking-widest text-xs text-gray-700 hover:text-black inline-flex items-center gap-1"
              >
                <Icon name="arrow_forward" size="sm" />
                You&rsquo;re in the demo — view your kommits
              </Link>
              <button
                type="button"
                onClick={() => {
                  deactivateVisaMode();
                  window.location.assign("/");
                }}
                className="font-epilogue font-bold uppercase tracking-widest text-xs text-gray-500 hover:text-black"
              >
                Exit demo →
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="border-t-[3px] border-black bg-white px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-epilogue font-medium text-xs text-gray-600">
            Submission preview · MoonPay sandbox · devnet USDC
          </span>
          <Link
            href="/app"
            className="font-epilogue font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-black"
          >
            ← Back to live product
          </Link>
        </div>
      </footer>
    </main>
  );
}

// ---- Sub-components --------------------------------------------------------

function AmountField({
  amountEUR,
  onChange,
  disabled,
}: {
  amountEUR: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
        Amount
      </label>
      <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
        <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">
          €
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={10_000}
          value={amountEUR}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          disabled={disabled}
          className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full disabled:opacity-50"
        />
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {AMOUNT_PRESETS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            disabled={disabled}
            className={cn(
              "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none",
              amountEUR === a ? "bg-primary text-white" : "bg-white text-black",
            )}
          >
            €{a}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectField({
  projects,
  selected,
  onChange,
  disabled,
}: {
  projects: { slug: string; name: string; pitch: string }[];
  selected: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
        Pick a project
      </label>
      <ul className="space-y-2">
        {projects.map((p) => {
          const isActive = p.slug === selected;
          return (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => onChange(p.slug)}
                disabled={disabled}
                className={cn(
                  "w-full text-left px-4 py-3 border-[3px] border-black flex items-center gap-3",
                  "transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px]",
                  isActive
                    ? "bg-primary text-white shadow-brutal"
                    : "bg-white text-black shadow-brutal-sm",
                  "disabled:opacity-50 disabled:pointer-events-none",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 w-5 h-5 border-[2px] border-black flex items-center justify-center",
                    isActive ? "bg-white" : "bg-white",
                  )}
                  aria-hidden
                >
                  {isActive ? (
                    <span className="block w-2.5 h-2.5 bg-primary" />
                  ) : null}
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
