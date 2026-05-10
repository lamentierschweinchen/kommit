import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/common/Icon";

export const metadata: Metadata = {
  title: "Sandbox · Kommit",
  description:
    "Two ways to exercise the kommit primitive on devnet — fund onchain or fund with a card-mock checkout.",
  robots: { index: false, follow: false },
};

export default function SandboxLandingPage() {
  return (
    <section className="px-6 md:px-12 py-12 md:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-3xl mb-12 md:mb-16">
          <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm mb-5">
            Sandbox
          </span>
          <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter leading-[0.95]">
            Two ways to try the kommit primitive.
          </h1>
          <p className="mt-6 font-epilogue font-medium text-lg md:text-xl text-gray-800 leading-snug border-l-[4px] border-primary pl-5">
            Both paths exercise the same onchain commit logic. One drops you
            real devnet artifacts and signs an Anchor instruction; the other
            simulates the card-checkout UX so you can feel the funding side.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <FundingCard
            kicker="Path A · Onchain"
            heading="Fund onchain (devnet)"
            blurb="Real signed transactions, Solscan-traceable, no card needed."
            helper="$10,000 of devnet test funds + gas dropped to your wallet, then sign a real Anchor commit."
            cta="Try the onchain flow"
            href="/sandbox/onchain"
            accent="primary"
          />
          <FundingCard
            kicker="Path B · Card mock"
            heading="Fund with card (mock)"
            blurb="Try the card-payment flow with a simulated checkout."
            helper="Mock checkout, simulated balance bump — same kommit primitive."
            cta="Try the card flow"
            href="/visa-demo"
            accent="secondary"
          />
        </div>

        <div className="mt-16 pt-8 border-t-[2px] border-black">
          <p className="font-epilogue font-medium text-sm text-gray-700 leading-relaxed max-w-3xl">
            Both surfaces operate on Solana devnet. Test funds are minted on
            demand to your wallet — nothing here moves real money. After a
            successful commit, head to your{" "}
            <Link
              href="/dashboard"
              className="font-bold text-primary underline decoration-2 underline-offset-2 hover:bg-primary hover:text-white"
            >
              dashboard
            </Link>{" "}
            to see your kommits.
          </p>
        </div>
      </div>
    </section>
  );
}

function FundingCard({
  kicker,
  heading,
  blurb,
  helper,
  cta,
  href,
  accent,
}: {
  kicker: string;
  heading: string;
  blurb: string;
  helper: string;
  cta: string;
  href: string;
  accent: "primary" | "secondary";
}) {
  const ctaClass =
    accent === "primary"
      ? "bg-primary text-white"
      : "bg-secondary text-black";
  const shadowClass =
    accent === "primary" ? "shadow-brutal-purple" : "shadow-brutal";
  return (
    <div
      className={`bg-white border-[3px] border-black p-7 md:p-9 flex flex-col ${shadowClass}`}
    >
      <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mb-3">
        {kicker}
      </span>
      <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter leading-tight">
        {heading}
      </h2>
      <p className="mt-3 font-epilogue font-medium text-base text-gray-800 leading-snug">
        {blurb}
      </p>
      <p className="mt-4 font-epilogue text-sm text-gray-600 leading-relaxed">
        {helper}
      </p>
      <Link
        href={href}
        className={`mt-7 inline-flex items-center justify-center gap-2 ${ctaClass} font-epilogue font-black uppercase tracking-tight text-base px-6 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform self-start`}
      >
        {cta}
        <Icon name="arrow_forward" className="font-bold" />
      </Link>
    </div>
  );
}
