import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { HeroRotatingWord } from "@/components/landing/HeroRotatingWord";
import { ProjectCard } from "@/components/project/ProjectCard";
import { StatePill } from "@/components/common/Tape";
import { PROJECTS } from "@/lib/data/projects";

export default function LandingPage() {
  const featured = PROJECTS.slice(0, 3);

  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-7xl mx-auto w-full">
        {/* HERO — audit #3 + Pass 2 mobile-walk fix 4a: H1 bottoms out at text-3xl
            so single-word rotations like BREAKTHROUGH fit at 320px. Rotating slot can
            still wrap to 2 lines on multi-word values (BILLION DOLLAR IDEA, etc.) */}
        <section className="mt-12 md:mt-16 relative">
          <div className="absolute inset-0 bg-primary translate-x-4 translate-y-4 border-[3px] border-black -z-10" />
          <div className="bg-white border-[3px] border-black p-8 md:p-12 flex flex-col lg:flex-row gap-10 items-center">
            <div className="flex-1 min-w-0 space-y-8 relative z-10 w-full">
              {/* Audit #16: this hero pill is informational — pill, not tape */}
              <StatePill color="secondary">The conviction primitive</StatePill>
              <h1 className="font-epilogue font-black uppercase leading-[1.05] tracking-tighter text-3xl sm:text-5xl md:text-6xl lg:text-7xl min-h-[160px] sm:min-h-[210px] md:min-h-[260px] lg:min-h-[300px]">
                Back the next
                <br />
                <HeroRotatingWord />
              </h1>
              <p className="text-xl md:text-2xl font-medium text-gray-800 max-w-xl leading-relaxed border-l-[4px] border-primary pl-6 italic">
                Turn conviction into currency. Back early-stage projects without locking your&nbsp;money.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                <Link
                  href="/projects"
                  className="bg-secondary text-black font-epilogue font-black uppercase tracking-wide text-base md:text-lg px-8 py-4 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg flex items-center justify-center gap-3"
                >
                  Browse projects
                  <span className="material-symbols-outlined font-bold">arrow_forward</span>
                </Link>
                <Link
                  href="#how-it-works"
                  className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base md:text-lg px-8 py-4 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center"
                >
                  How it works
                </Link>
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full max-w-md relative shrink-0">
              {/* Audit #16: drop the 100% YOURS / 0% LOCKED tape labels — subhead carries the meaning */}
              <div className="aspect-square bg-gray-100 border-[3px] border-black shadow-brutal-lg relative overflow-hidden flex items-center justify-center">
                <div
                  className="absolute w-[150%] h-[150%] opacity-20 -rotate-12 animate-[spin_60s_linear_infinite]"
                  style={{
                    backgroundImage: "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
                    backgroundSize: "24px 24px",
                  }}
                  aria-hidden
                />
                <div className="relative z-10 grid grid-cols-2 gap-4 w-3/4 h-3/4">
                  <div className="bg-primary border-[3px] border-black shadow-brutal animate-pulse" />
                  <div className="bg-secondary border-[3px] border-black shadow-brutal rounded-full" />
                  <div className="bg-black border-[3px] border-black shadow-brutal-purple rounded-tl-[50px] rounded-br-[50px]" />
                  <div className="bg-white border-[3px] border-black shadow-brutal flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-5xl filled"
                      aria-hidden
                    >
                      deployed_code
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="mt-32 pt-12 border-t-[8px] border-black">
          <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <HowItWorksCard
              num="01"
              title="Pick a team"
              body="Find one that deserves it. Read the pitch, scan the updates, meet the people."
            />
            <HowItWorksCard
              num="02"
              title="Kommit"
              body="Your money stays yours. The team sees a real backer. Withdraw anytime, no fees."
            />
            <HowItWorksCard
              num="03"
              title="Earn kommits"
              body="Kommits build the longer you stay. First access when the team raises. Yours forever."
            />
          </div>
        </section>

        {/* WHAT KOMMITS UNLOCK */}
        <section className="mt-32 pt-12 border-t-[8px] border-black">
          <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-12">
            What kommits unlock
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <UnlockCard
              tag="A funding round"
              tagColor="bg-primary text-white"
              tagShadow="shadow-brutal-sm"
              title="Kommitters earn priority access at graduation."
              body="When the team launches a real round, you're first in line."
            />
            <UnlockCard
              tag="Product perks"
              tagColor="bg-secondary text-black"
              tagShadow="shadow-brutal-sm"
              title="Lifetime access. Beta seats. Gated content."
              body="Projects honor your kommits however they choose."
            />
            <UnlockCard
              tag="Composable rewards"
              tagColor="bg-black text-white"
              tagShadow="shadow-[2px_2px_0px_0px_rgba(20,241,149,1)]"
              title="Your kommits travel."
              body="Other platforms can recognize you and reward your patient support."
            />
            <UnlockCard
              tag="Proof you were there"
              tagColor="bg-white text-black"
              tagShadow="shadow-brutal-sm"
              title="A portable, verifiable record."
              body="Your kommit history shows the teams you backed and when."
            />
          </div>
        </section>

        {/* FEATURED PROJECTS */}
        <section className="mt-32 pt-12 border-t-[8px] border-black">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
              Featured projects
            </h2>
            <Link
              href="/projects"
              className="font-epilogue font-black uppercase tracking-tight text-sm border-b-[3px] border-black hover:bg-secondary px-2 transition-colors"
            >
              All projects →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {featured.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </section>

        {/* FOR FOUNDERS BAND */}
        <section className="mt-32 pt-12 border-t-[8px] border-black">
          <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-12">
            Building something?
          </h2>
          <div className="bg-black text-white border-[3px] border-black shadow-brutal-purple p-8 md:p-12 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 items-center relative">
            <div className="space-y-5">
              <h3 className="font-epilogue font-black uppercase text-3xl md:text-4xl lg:text-5xl tracking-tighter leading-[1.05]">
                Backers who back up the truck.
              </h3>
              <p className="text-base md:text-lg font-medium text-gray-300 leading-relaxed border-l-[4px] border-secondary pl-5">
                Kommitters back you with real money and time. They stay through pivots. Real
                validation, real signal.
              </p>
            </div>
            <div className="flex justify-start lg:justify-end">
              <Link
                href="/build"
                className="bg-secondary text-black font-epilogue font-black uppercase tracking-wide text-base md:text-lg px-8 py-4 border-[3px] border-black shadow-brutal-white hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-white-lg flex items-center justify-center gap-3"
              >
                Apply
                <span className="material-symbols-outlined font-bold">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-32 pt-12 border-t-[8px] border-black">
          <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-12">
            FAQ
          </h2>
          <div className="space-y-4 max-w-4xl">
            <FAQItem
              question="What's the problem you're solving?"
              defaultOpen
            >
              <p>
                Equity crowdfunding loses backers their money at painful rates. A real Wefunder
                investor&apos;s&nbsp;review:
              </p>
              <blockquote className="bg-gray-100 border-[3px] border-black shadow-brutal p-5 md:p-6 relative my-2">
                <div className="absolute -top-2 -right-2 w-12 h-4 bg-primary -rotate-6 border-[2px] border-black" />
                <p className="font-epilogue font-black uppercase text-xl md:text-2xl leading-snug tracking-tighter italic">
                  &ldquo;21 of 21 startups I backed failed.&rdquo;
                </p>
                <footer className="mt-3 font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
                  — Wefunder investor
                </footer>
              </blockquote>
              <p>
                Crowdfunding platforms collect cash, founders disappear, refunds don&apos;t happen.
                Kommit is the inverse: your money never leaves your control. Teams see a verifiable
                signal of conviction; you keep your money; you can pull out&nbsp;anytime.
              </p>
            </FAQItem>
            <FAQItem question="Is there a Kommit token?">
              No. Kommit doesn&apos;t issue tokens. The kommits you earn are non-transferable proof
              of your support, accumulating as you stay.
            </FAQItem>
            <FAQItem question="Will I make money on this?">
              You forgo interest on your money. If a project graduates, kommitters earn priority on
              whatever comes next — a token, equity, product perks, access. No guaranteed return.
            </FAQItem>
            <FAQItem question="What if a project I back pivots?">
              Pivots are made public. You see the change, decide whether to stay or withdraw.
            </FAQItem>
            <FAQItem question="How do I sign up?">
              Email or Google. We create an account for you in the background. Your money stays yours.
            </FAQItem>
            <FAQItem question="Where does my money actually go?">
              Into an audited financial market that earns interest. Your money stays yours — withdraw
              anytime. The interest funds the platform sustainably, which means no fees on you or
              the teams you back.
            </FAQItem>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function HowItWorksCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-8 relative hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg transition-transform">
      <div className="font-epilogue font-black text-7xl md:text-8xl text-gray-200 absolute top-2 right-4 leading-none select-none">
        {num}
      </div>
      <h3 className="font-epilogue font-black uppercase text-2xl tracking-tight mt-2 relative z-10">
        {title}
      </h3>
      <p className="mt-4 text-base font-medium text-gray-800 leading-relaxed relative z-10">{body}</p>
    </article>
  );
}

function UnlockCard({
  tag,
  tagColor,
  tagShadow,
  title,
  body,
}: {
  tag: string;
  tagColor: string;
  tagShadow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-8 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg transition-transform">
      <div
        className={`inline-block font-epilogue font-black uppercase text-[11px] tracking-widest px-3 py-1 border-[2px] border-black ${tagColor} ${tagShadow}`}
      >
        {tag}
      </div>
      <h3 className="mt-5 font-epilogue font-black uppercase text-2xl md:text-3xl leading-tight tracking-tighter">
        {title}
      </h3>
      <p className="mt-4 text-base font-medium text-gray-800 leading-relaxed">{body}</p>
    </article>
  );
}

function FAQItem({
  question,
  children,
  defaultOpen,
}: {
  question: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="bg-white border-[3px] border-black shadow-brutal group"
    >
      <summary className="flex items-center justify-between gap-6 p-6 cursor-pointer hover:bg-gray-100 transition-colors">
        <span className="font-epilogue font-black uppercase text-lg md:text-xl tracking-tight">
          {question}
        </span>
        <span className="faq-icon material-symbols-outlined transition-transform text-2xl">add</span>
      </summary>
      <div className="px-6 pb-6 text-base font-medium text-gray-800 leading-relaxed border-t-[3px] border-black pt-5 space-y-5">
        {children}
      </div>
    </details>
  );
}
