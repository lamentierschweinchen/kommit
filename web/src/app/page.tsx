import Link from "next/link";
import { WaitlistForm } from "@/components/landing/WaitlistForm";
import { MissionSection } from "@/components/landing/MissionSection";
import { Footer } from "@/components/layout/Footer";

/**
 * Coming-soon `/` (Lane A landing).
 *
 * The functional product moved to `/app`; this page replaces the prior
 * landing as a public marketing surface. Hero + waitlist form + mission
 * excerpt + small "already a kommitter? sign in" handoff to /app.
 *
 * No `<AuthHeader>` — marketing pages have their own minimal chrome to
 * avoid Sign In CTA fighting with the waitlist CTA. Existing kommitters
 * use the small footer link to reach `/app`.
 */
export default function ComingSoonPage() {
  return (
    <>
      <header className="px-6 md:px-12 py-6 border-b-[3px] border-black bg-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/wordmark.png"
            alt="kommit"
            className="h-8 md:h-9 w-auto block"
          />
          <span className="inline-flex items-center gap-2 bg-secondary border-[2px] border-black px-3 py-1 shadow-brutal-sm">
            <span
              className="w-2 h-2 rounded-full bg-black animate-pulse"
              aria-hidden
            />
            <span className="font-epilogue font-black uppercase text-[10px] tracking-widest">
              Coming soon
            </span>
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-12 pb-24 max-w-7xl mx-auto w-full">
        {/* HERO — wordmark + tagline + waitlist form */}
        <section className="mt-12 md:mt-16 relative">
          <div className="absolute inset-0 bg-primary translate-x-4 translate-y-4 border-[3px] border-black -z-10" />
          <div className="bg-white border-[3px] border-black p-8 md:p-12 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-start">
            <div className="space-y-6 min-w-0">
              <div className="inline-block font-epilogue font-bold uppercase text-[11px] tracking-widest px-3 py-1 border-[2px] border-black bg-secondary shadow-brutal-sm">
                The conviction primitive
              </div>
              <h1 className="font-epilogue font-black uppercase leading-[1.05] tracking-tighter text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
                Capital × time,
                <br />
                committed without
                <br />
                extraction.
              </h1>
              <p className="text-lg md:text-xl font-medium text-gray-800 max-w-xl leading-relaxed border-l-[4px] border-primary pl-6 italic">
                Back early-stage teams without locking your money. Earn
                standing by staying.
              </p>
              <p className="text-base font-medium text-gray-700 max-w-xl leading-relaxed">
                One kommit accrues per dollar-hour committed. Your money
                stays yours. Yield funds the platform — no fee on you, no fee
                on founders.
              </p>
              <Link
                href="/manifesto"
                className="inline-flex items-center gap-2 font-epilogue font-black uppercase tracking-tight text-xs md:text-sm border-b-[3px] border-black hover:bg-secondary px-2 py-1 transition-colors"
              >
                Read the manifesto
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div className="w-full">
              <div className="bg-gray-100 border-[3px] border-black shadow-brutal p-5 md:p-6">
                <h2 className="font-epilogue font-black uppercase text-xl tracking-tighter mb-1">
                  Get the launch ping
                </h2>
                <p className="text-sm font-medium text-gray-700 mb-5 leading-relaxed">
                  We&apos;ll email when kommits start ticking. One message,
                  no drip.
                </p>
                <WaitlistForm />
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — three-step diagram */}
        <section
          id="how-it-works"
          className="mt-32 pt-12 border-t-[8px] border-black"
        >
          <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <HowCard
              num="01"
              title="Pick a team"
              body="Find one that deserves it. Read the pitch, scan the updates, meet the people."
            />
            <HowCard
              num="02"
              title="Kommit"
              body="Your money stays yours. The team sees a real backer. Withdraw anytime."
            />
            <HowCard
              num="03"
              title="Earn kommits"
              body="Kommits build the longer you stay. Your standing earns rights — first dibs, perks, privileged access. Soulbound, public, yours."
            />
          </div>
        </section>

        {/* MISSION / MANIFESTO EXCERPT */}
        <MissionSection />

        {/* SUBTLE SIGN-IN HANDOFF — small, footer-area, doesn't compete with the CTA */}
        <section className="mt-32 pt-12 border-t-[8px] border-black">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="font-epilogue font-bold uppercase text-xs tracking-widest text-gray-500">
              Already a kommitter?
            </p>
            <Link
              href="/app"
              className="font-epilogue font-bold uppercase tracking-widest text-xs border-b-[2px] border-black hover:bg-secondary px-2 transition-colors"
            >
              Sign in →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function HowCard({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-8 relative hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg transition-transform">
      <div className="font-epilogue font-black text-7xl md:text-8xl text-gray-200 absolute top-2 right-4 leading-none select-none">
        {num}
      </div>
      <h3 className="font-epilogue font-black uppercase text-2xl tracking-tight mt-2 relative z-10">
        {title}
      </h3>
      <p className="mt-4 text-base font-medium text-gray-800 leading-relaxed relative z-10">
        {body}
      </p>
    </article>
  );
}
