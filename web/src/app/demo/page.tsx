"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useRouter, useSearchParams } from "next/navigation";
import { activateDemoMode, deactivateDemoMode, useDemoMode } from "@/lib/demo-mode";
import { clearDemoEngagement, seedDemoCohort } from "@/lib/demo-engagement";
import { findProjectPda } from "@/lib/kommit";
import { USERS, avatarUrl } from "@/lib/data/users";
import { LUKAS_COMMITMENTS } from "@/lib/data/commitments";
import { PROJECTS } from "@/lib/data/projects";
import { Icon } from "@/components/common/Icon";
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
        pda: findProjectPda(new PublicKey(p.recipientWallet!)).toBase58(),
        authorWallet: author?.wallet ?? "",
        seed: p.updates,
      };
    }),
  };
}

const PERSONA_BLURBS: Record<string, string> = {
  lukas: "Kommitter with a portfolio across Climate, Bio, and Edu projects.",
  julian: "Founder of CALDERA — geothermal-baseload heat for industry. Post updates, see your cohort.",
  lina: "Founder of MARGIN HOUSE — short-form retail-broker accountability journalism.",
  maya: "Kommitter, lighter portfolio. Useful as a 'fresh visitor' POV.",
  theo: "Kommitter with a graduated record — see what kommits look like after a project lands.",
};

/**
 * /demo — entry to the demo deploy.
 *
 * Lands on this page → click a persona → activate demo mode in localStorage
 * → CSR-navigate into the persona's view. Same domain, no SSO challenge,
 * no email-code dance. Production at kommit.now/* without /demo continues
 * to use real Privy.
 *
 * If demo mode is already active, this page becomes a "you're already
 * in" affordance with a switch / exit option.
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
  const [pickedPersona, setPickedPersona] = useState<string | null>(null);

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
    activateDemoMode(personaId ?? undefined);
    // Idempotent seed — populates Lukas's portfolio + every project's update
    // history into demo-engagement state so reactions/comments work on
    // seeded updates and the dashboard shows real data on first paint.
    seedDemoCohort(buildCohortSeed());
    // CSR navigation — fast, no SSR flash. Anon goes to /, persona goes to dashboard.
    if (personaId) {
      const u = USERS[personaId];
      if (!u) return;
      const dest = u.role === "founder" && u.ownsProject
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

  return (
    <main className="flex-1 px-6 md:px-12 py-12 md:py-16 max-w-4xl mx-auto w-full">
      <div className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-10 relative overflow-hidden">
        <div className="absolute -top-3 -right-3 inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm rotate-3">
          Demo
        </div>
        <h1 className="font-epilogue font-black uppercase text-3xl md:text-5xl tracking-tighter leading-[0.95] -rotate-[0.3deg]">
          Walk Kommit as anyone.
        </h1>
        <p className="mt-5 font-epilogue font-medium text-base md:text-lg text-gray-800 leading-snug max-w-2xl">
          Pick a persona below. You&rsquo;ll be signed in as them — kommit, withdraw, post updates,
          react, comment. Switch personas at any time via the floating control bottom-left.{" "}
          {isDemo ? (
            <span className="font-bold text-primary">Demo mode is already active.</span>
          ) : (
            <span>This is a separate world from the live product — your activity stays in your browser.</span>
          )}
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {Object.values(USERS).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => enterAs(u.id)}
              disabled={pickedPersona === u.id}
              className={cn(
                "text-left bg-white border-[3px] border-black shadow-brutal p-5 flex items-start gap-4",
                "hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform",
                "active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg",
                "disabled:opacity-60 disabled:pointer-events-none",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl(u.avatarSeed, 120)}
                alt=""
                className="w-14 h-14 border-[3px] border-black object-cover grayscale shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-epilogue font-black uppercase text-base tracking-tight">
                    {u.displayName}
                  </span>
                  <span
                    className={cn(
                      "inline-block font-epilogue font-black uppercase text-[9px] tracking-widest px-1.5 py-0.5 border-[2px] border-black",
                      u.role === "founder" ? "bg-primary text-white" : "bg-secondary text-black",
                    )}
                  >
                    {u.role === "founder" ? "Founder" : "Kommitter"}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-700 leading-relaxed">
                  {PERSONA_BLURBS[u.id] ?? "—"}
                </p>
              </div>
            </button>
          ))}
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

      <div className="mt-10 max-w-2xl text-sm font-medium text-gray-600 leading-relaxed">
        <p>
          <span className="font-epilogue font-bold uppercase tracking-widest text-[11px] text-black">How this differs from the live product.</span>{" "}
          Posts you write, reactions you click, comments you leave during the demo persist in
          your browser — they don&rsquo;t hit the live database. Funds, withdrawals, and faucet
          flows are simulated. Switching personas keeps the same shared cohort state in this
          browser, so you can post as Julian and react as Lukas in the same session.
        </p>
      </div>
    </main>
  );
}

