"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { findProjectPda } from "@/lib/kommit";
import { activateVisaMode, deactivateVisaMode, formatEURDirect, useVisaMode } from "@/lib/visa-mode";
import { activateDemoMode } from "@/lib/demo-mode";
import { visaDemo } from "@/lib/visa-demo-client";
import { PROJECTS } from "@/lib/data/projects";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";

const AMOUNT_PRESETS = [25, 50, 100, 250] as const;
const SANDBOX_HINT = "Sandbox · use 4242 4242 4242 4242";

const FEATURED_SLUGS = ["caldera", "lighthouse-labs", "aurora", "frame-studio", "beacon-sci"];

export default function VisaDemoPage() {
  return (
    <Suspense fallback={null}>
      <VisaDemoEntry />
    </Suspense>
  );
}

function VisaDemoEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError } = useToast();
  const isVisa = useVisaMode();

  // Card fields — controlled inputs with light formatting (groups of 4 for
  // the card number; auto-slash on expiry). Sandbox accepts the well-known
  // 4242... pattern; we don't validate beyond "looks like a card."
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [cardName, setCardName] = useState("");

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

  const project = eligibleProjects.find((p) => p.slug === projectSlug) ?? eligibleProjects[0];

  const validCard =
    cardNumber.replace(/\D/g, "").length >= 12 &&
    /^\d{2}\/\d{2}$/.test(exp) &&
    cvc.replace(/\D/g, "").length >= 3 &&
    cardName.trim().length > 0;

  const valid = validCard && amountEUR > 0 && !!project;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting || !project) return;
    setSubmitting(true);

    let projectPda: string;
    try {
      projectPda = findProjectPda(new PublicKey(project.recipientWallet!)).toBase58();
    } catch {
      setSubmitting(false);
      toastError("Couldn't reach this project right now.", "Try a different one.");
      return;
    }

    const res = await visaDemo.onramp({
      card: { number: cardNumber, exp, cvc, name: cardName.trim() },
      amountEUR,
      projectPda,
      projectSlug: project.slug,
    });

    if (!res.ok) {
      setSubmitting(false);
      const messages: Record<string, string> = {
        "card-rejected": "Card declined. Try a different test card.",
        "onramp-failed": "Couldn't process your card. Please retry.",
        "commit-failed": "Something went wrong on our end. Please retry.",
        "rate-limit": "Too many attempts. Wait a moment and retry.",
      };
      toastError("Card declined.", messages[res.error] ?? "Try a different test card?");
      return;
    }

    // Success — flip the chrome into Visa mode (hides crypto vocab site-
    // wide), activate demo mode under the hood so the dashboard renders
    // the seeded position, and redirect.
    activateVisaMode(res.cardLast4);
    activateDemoMode();
    router.push("/dashboard");
  };

  // If we land here AGAIN after activation, the dashboard is the right
  // surface — bounce the user instead of letting them re-enter card info.
  useEffect(() => {
    if (isVisa) {
      // Don't auto-redirect; let the user see the entry as a "you're already
      // in" affordance. They can Exit and come back.
    }
  }, [isVisa]);

  return (
    <main className="min-h-screen bg-[#FFFCF5] flex flex-col">
      <header className="px-6 md:px-12 py-6 border-b-[3px] border-black bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Link href="/" className="font-epilogue font-black uppercase tracking-tighter text-xl">
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
              Enter your card, pick a team, and back them. The infrastructure
              gets out of your way — only the conviction shows.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-start"
          >
            {/* CARD */}
            <CardPanel
              cardNumber={cardNumber}
              exp={exp}
              cvc={cvc}
              cardName={cardName}
              onCardNumberChange={(v) => setCardNumber(formatCardNumber(v))}
              onExpChange={(v) => setExp(formatExp(v))}
              onCvcChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))}
              onNameChange={setCardName}
              disabled={submitting}
            />

            {/* AMOUNT + PROJECT + CTA */}
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

              <div>
                <button
                  type="submit"
                  disabled={!valid || submitting}
                  className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-lg md:text-xl px-8 py-5 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? (
                    <>
                      <Icon name="progress_activity" className="font-bold animate-spin" />
                      Processing your card…
                    </>
                  ) : (
                    <>
                      Kommit {formatEURDirect(amountEUR)} to {project?.name ?? "—"}
                      <Icon name="arrow_forward" className="font-bold" />
                    </>
                  )}
                </button>
                <p className="mt-3 font-epilogue font-medium text-xs text-gray-600 leading-relaxed text-center">
                  Sandbox transaction. Your card is not charged. Withdraw any time and the
                  funds return to the same card.
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
            Submission preview · sandbox only · no real funds move
          </span>
          <Link
            href="/"
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

function CardPanel({
  cardNumber,
  exp,
  cvc,
  cardName,
  onCardNumberChange,
  onExpChange,
  onCvcChange,
  onNameChange,
  disabled,
}: {
  cardNumber: string;
  exp: string;
  cvc: string;
  cardName: string;
  onCardNumberChange: (v: string) => void;
  onExpChange: (v: string) => void;
  onCvcChange: (v: string) => void;
  onNameChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Stylized card preview — implicit card flow, no Visa logo or mark. */}
      <div className="relative bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-7 aspect-[1.586/1] max-w-md">
        <div className="absolute top-4 right-4 inline-block bg-black text-white font-epilogue font-black uppercase text-[9px] tracking-widest px-2 py-1">
          Sandbox
        </div>
        <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
          Card on file
        </div>
        <div className="mt-7 md:mt-10 font-mono font-bold text-xl md:text-2xl tracking-[0.18em] text-black">
          {cardNumber || "•••• •••• •••• ••••"}
        </div>
        <div className="absolute bottom-5 left-7 right-7 flex justify-between items-end">
          <div>
            <div className="font-epilogue font-bold uppercase text-[8px] text-gray-500 tracking-widest">
              Cardholder
            </div>
            <div className="font-epilogue font-black uppercase text-sm tracking-tight">
              {cardName.toUpperCase() || "YOUR NAME"}
            </div>
          </div>
          <div>
            <div className="font-epilogue font-bold uppercase text-[8px] text-gray-500 tracking-widest">
              Exp
            </div>
            <div className="font-epilogue font-black uppercase text-sm tracking-tight">
              {exp || "MM/YY"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-md">
        <Field label="Card number">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            value={cardNumber}
            onChange={(e) => onCardNumberChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-white border-[3px] border-black px-4 py-3 font-mono text-base tracking-widest focus:outline-none focus:shadow-brutal disabled:opacity-50"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={exp}
              onChange={(e) => onExpChange(e.target.value)}
              disabled={disabled}
              className="w-full bg-white border-[3px] border-black px-4 py-3 font-mono text-base tracking-wider focus:outline-none focus:shadow-brutal disabled:opacity-50"
            />
          </Field>
          <Field label="CVC">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              value={cvc}
              onChange={(e) => onCvcChange(e.target.value)}
              disabled={disabled}
              className="w-full bg-white border-[3px] border-black px-4 py-3 font-mono text-base tracking-wider focus:outline-none focus:shadow-brutal disabled:opacity-50"
            />
          </Field>
        </div>
        <Field label="Cardholder name">
          <input
            type="text"
            autoComplete="cc-name"
            placeholder="As it appears on the card"
            value={cardName}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={disabled}
            className="w-full bg-white border-[3px] border-black px-4 py-3 font-medium text-base focus:outline-none focus:shadow-brutal disabled:opacity-50"
          />
        </Field>
      </div>
    </div>
  );
}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

// ---- Input formatters ------------------------------------------------------

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
}

function formatExp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
