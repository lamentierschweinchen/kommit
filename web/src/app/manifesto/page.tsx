import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";

/**
 * /manifesto — the cohort manifesto, hosted on kommit.now.
 *
 * The CC0 source of record is `cohort_manifesto.md` at the repo root. This
 * page is a JSX rendering of that file with reading-comfortable typography:
 * max-width ~70ch, generous leading, plain prose for body. Brutalist tokens
 * stay at the chrome level (header / footer / pull-quote rule); the body
 * itself reads like an essay, not a product surface.
 *
 * Update both this page AND the markdown if the canonical text changes —
 * the markdown is the authoritative version (CC0); this is the hosted view.
 */

export const metadata: Metadata = {
  title: "The Conviction Primitive — Kommit",
  description:
    "A short thesis on why a new unit of measurement belongs in early-stage capital. Released under CC0.",
  openGraph: {
    title: "The Conviction Primitive",
    description:
      "Three groups want the same thing in early-stage backing. None of them has a tool to get it. A thesis from the Kommit team.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Conviction Primitive",
    description:
      "Three groups want the same thing in early-stage backing. None of them has a tool to get it.",
  },
};

export default function ManifestoPage() {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 bg-[#FFFCF5] px-6 md:px-12 py-12 md:py-20">
        <article className="max-w-[68ch] mx-auto">
          {/* Title block — display type for the headline, italic prose for
              the CC0 subhead. Read time signals essay length up front so
              readers self-select past the door. */}
          <header className="mb-12 md:mb-16">
            <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter leading-[0.95]">
              The Conviction Primitive
            </h1>
            <p className="mt-6 text-base md:text-lg italic text-gray-700 leading-relaxed">
              A short thesis on why a new unit of measurement belongs in
              early-stage capital.
            </p>
            <p className="mt-3 font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500">
              Read time · ~7 minutes
            </p>
          </header>

          <Section heading="The alignment">
            <p>
              Three groups want the same thing. None of them has a tool to get
              it.
            </p>
            <p>
              Backers want to get in early on teams they believe in. The best
              opportunities are usually locked away by accreditation, by
              network, by timing, or by simple luck. Once a backer puts money
              down, they want to know the team is in it for the long run, not
              for a quick exit.
            </p>
            <p>
              Founders want a real signal on whether their direction, their
              ideas, and their product are working. Not upvotes. Not follower
              counts. Evidence from people who put money down and stayed when
              things got hard.
            </p>
            <p>
              Investors want real data on whether the market actually wants the
              product, and they want founders who can do more than sell a deck.
            </p>
            <p>
              These three wants line up. The question a backer is asking
              (&ldquo;is this team serious?&rdquo;) is the mirror of the
              question the founder is asking (&ldquo;are these backers
              serious?&rdquo;). Both have the same answer, sitting in the same
              place. The investor reading that same data months later gets the
              answer to a third question: is this round real?
            </p>
            <p>
              No existing tool produces that data. Each group has been served
              separately, badly, by platforms that mostly optimize for closing
              transactions instead of for the alignment that would have served
              all three.
            </p>
            <p>
              The conviction primitive is what one tool looks like when
              it&apos;s built to serve all three at once.
            </p>
          </Section>

          <Section heading="The unit">
            <p>
              Early-stage backing needs a unit of measurement. The right one is{" "}
              <strong>
                capital × time, committed without anyone taking a cut, with a
                public record.
              </strong>
            </p>
            <p>
              Capital, because the backer could have put that money anywhere
              else. They picked your team. That choice has a real cost: the 5%
              they could have earned in a yield account, the things they could
              have bought, the other founder they could have backed instead.
              That cost is what makes the signal hard to fake. It&apos;s
              opportunity cost, not opinion volume.
            </p>
            <p>
              Time, because conviction that survives a week is different from
              conviction that survives a year. Staying through a pivot says
              more than showing up for a launch. The unit measures that
              survival. Did this person hold when the team&apos;s plan changed?
              When the title slide went from &ldquo;CEO&rdquo; to
              &ldquo;co-CEO&rdquo;? When the market turned? One kommit accrues
              for every dollar-hour committed. Park $100 for 100 hours and
              you&apos;ve earned 10,000 kommits.
            </p>
            <p>
              No cut, because the principal stays whole. Yield on the parked
              money funds the platform. There&apos;s no fee for the founder, no
              fee for the backer, and no fee at the round. The economics work
              because audited lending protocols on Solana are mature enough to
              act as the operating layer underneath. The platform doesn&apos;t
              have to charge a fee. The substrate already pays it.
            </p>
            <p>
              Public record, because every backer&apos;s history sits on-chain,
              soulbound to the wallet that earned it. Anyone with a browser can
              read it. That public record is where the three groups all get
              what they came for, and where the effects compound.
            </p>
            <p>
              We call this unit a <strong>kommit</strong>. The platform that
              mints them is <em>Kommit</em>. The unit is bigger than the
              platform. The platform is bigger than us.
            </p>
          </Section>

          <Section heading="What it unlocks">
            <p>
              Founders get an honest signal. The unit doesn&apos;t reward spam,
              because the input is real money sitting still through real time.
              Bots can&apos;t manufacture cohort membership, because the cost
              is real opportunity cost paid in real currency. A founder reading
              their dashboard can trust what it says. Someone who committed
              $500 to the team for eighteen months is a different category of
              person than someone who left a Twitter comment. The question
              &ldquo;is anyone actually serious about this?&rdquo; finally has
              an answer that&apos;s a number.
            </p>
            <p>
              For backers, patience earns a right, not a reward. When the team
              raises a real round, the kommitters with the most accumulated
              standing get first dibs to invest at round price. That&apos;s the
              right: it&apos;s economic, it&apos;s specific, and it&apos;s
              downstream of patience the kommitter actually demonstrated. The
              backer who committed at month one isn&apos;t the same kind of
              investor as the angel who shows up at the priced round. A system
              that treats them the same is a system that hasn&apos;t priced
              patience.
            </p>
            <p>
              For investors and everyone else downstream, the unit produces a
              public record they can actually read. Anyone can pull a
              wallet&apos;s kommit history without asking permission. An
              investor doing diligence on a round can see who stayed, when,
              through which pivots, with how much money on the line. A hiring
              manager can read what a candidate has backed and learn something
              real about how they think. A journalist can trace traction
              without needing a press release. Other products can use kommit
              balances to gate features (partner discounts, allocation
              priority, beta access, hiring filters) without having to ask us
              first. Each integration makes a kommit more useful to the person
              holding it, which pulls in more capital, which makes the signal
              richer for the next founder. At scale, the flywheel turns on its
              own. Before scale, you push it manually.
            </p>
          </Section>

          <Section heading="A worked example">
            <p>
              Anna puts $500 on Kommit and splits it across three teams she
              found on Twitter. Six months in, one of the teams pivots. She
              stays. The founder, watching his dashboard, sees that most of his
              cohort stayed through the pivot. That tells him something
              specific about whether the new direction is landing where it has
              to land.
            </p>
            <p>
              Eighteen months in, the team raises a public round. An investor
              doing diligence reads the cohort history. They can see who
              stayed, when, through which pivots, with how much money on the
              line. Anna&apos;s kommit balance on that team has been ticking up
              by one kommit per dollar-hour for those eighteen months. It earns
              her first dibs to invest at round price.
            </p>
            <p>
              Anna paid no fee. She got her $500 back when she withdrew. The
              founder raised against real traction instead of a pitch deck. The
              investor wrote the check on a signal they could trust.
            </p>
            <p>One unit. Three groups. The same evidence.</p>
          </Section>

          <Section heading="Why this hasn't been built before">
            <p>
              The existing tools serve one group at a time, at best.
            </p>
            <p>
              <strong>Signal without stake</strong> (Product Hunt, Twitter,
              Discord, Reddit) gives founders a number that doesn&apos;t mean
              much. It&apos;s cheap, gameable, and impossible to trace.
            </p>
            <p>
              <strong>Stake without survival</strong> (Wefunder, Republic,
              Crowdcube) gives backers a way to put money down, but with 7-9%
              fees and a real chance of losing the principal. The
              platform&apos;s revenue comes from closing the round, not from
              the backer picking right.
            </p>
            <p>
              <strong>Stake without signal</strong> (token launches) rewards
              being early only because someone else got there later and bought
              your bag. The structure rewards information asymmetry, not
              loyalty.
            </p>
            <p>
              No existing tool serves all three groups. The primitive was
              sitting on the table, waiting for someone to pick it up.
            </p>
          </Section>

          <Section heading="Why now">
            <p>
              Three things changed in the last few years that make this
              possible now.
            </p>
            <p>
              Lending protocols on Solana hold billions of dollars in stable
              capital and have survived multiple market cycles without losing
              principal. They&apos;re boring in the way that good
              infrastructure is boring. That&apos;s what we needed: a base
              layer the platform can sit on without charging the user. Without
              those protocols, the architecture is a wish list. With them, the
              math works.
            </p>
            <p>
              Walletless sign-in is real. A backer logs in with their email or
              a passkey. They don&apos;t see a seed phrase, they don&apos;t see
              a wallet, they don&apos;t have to learn anything about crypto.
              The thing that used to keep all of this crypto-native is gone.
              Kommit is a retail product that happens to settle on a chain.
            </p>
            <p>
              The legal landscape got narrower, which is enough to operate. The
              pattern Kommit uses (park money, yield routes elsewhere,
              principal stays redeemable) has been tested in U.S. court.{" "}
              <em>Kent v. PoolTogether</em> was dismissed in 2023 on standing,
              not on the merits. The judge specifically named withdraw-anytime
              and no platform-imposed fees as why the plaintiff had no concrete
              harm. Both of those are how Kommit works. Under EU MiCA, the
              kommit reads as a non-financial membership record. The ground was
              uncertain in 2021. It isn&apos;t uncertain in 2026, even if it
              isn&apos;t fully resolved.
            </p>
            <p>
              There&apos;s a quieter shift underneath all three. Blockchain
              technology is infrastructure, not a product. It gets interesting
              when it disappears behind something useful, the same way TCP/IP
              gets interesting only because nobody has to think about it when
              they send an email. The chain is the substrate. The product is
              what people actually use. This whole thing only works because
              somebody finally decided to use the substrate for something other
              than another tokenization play.
            </p>
          </Section>

          <Section heading="What this is not">
            <p>The unit is easy to misread.</p>
            <p>
              It is not a launchpad. Launchpads run rounds. Kommit sits
              upstream of that. The handoff happens when a team graduates.
            </p>
            <p>
              It is not a token. There is no platform token. There never will
              be. Kommits are records, not securities, and they can&apos;t be
              transferred.
            </p>
            <p>
              It is not equity crowdfunding. There is no offering at the kommit
              step. Equity rights are conditional and disclosed up front.
            </p>
            <p>
              It is not a casino. Patient capital across long timescales is the
              inverse of what a casino is built to reward.
            </p>
            <p>The misreadings are familiar. The unit isn&apos;t.</p>
          </Section>

          <Section heading="Where it can fail">
            <p>
              A thesis that won&apos;t name its weaknesses reads as a sales
              pitch. So here are ours.
            </p>
            <p>
              The unit weights capital. A backer with $10,000 accrues ten times
              the standing of a backer with $1,000 over the same window.
              That&apos;s intentional, because the thing we set out to measure
              is capital-at-risk-over-time. The harshest version of this
              critique is mitigated by how access is granted. Teams set a
              floor. Above the floor, the $50 kommitter and the $50,000
              kommitter have the same first-dibs claim. The weighting still
              survives in two places: allocation size at the round itself
              (pro-rata by default) and any downstream product that reads
              continuous balances. We accept that. If you think every voice
              should count the same regardless of capital, this isn&apos;t your
              unit. If you think capital-at-risk-over-time is the cleanest
              available signal of seriousness, this is what it looks like when
              you measure that honestly.
            </p>
            <p>
              Curation is not solved. Today, a Kommit operator decides which
              projects can list. That&apos;s one person&apos;s bias and a
              structural bottleneck on growth. The less-centralized
              alternatives (DAO curation, staked-reputation, on-chain
              reputation primitives) are research, not shipped product.
              We&apos;re committed to walking the path. We don&apos;t claim to
              have walked it.
            </p>
            <p>
              The founder-side cold start is not solved. Getting the first
              fifteen good teams onto Kommit is a supply problem we&apos;re
              working through one team at a time. The unit&apos;s value depends
              on cohort quality. Cohort quality depends on which teams list.
              Which teams list depends on a bootstrap we haven&apos;t yet made
              structural. This is the failure mode most likely to kill an early
              version of the primitive, whether ours or anyone else&apos;s.
            </p>
            <p>
              We&apos;re shipping it anyway. The alternatives don&apos;t serve
              any of the three groups together, and we&apos;d rather try.
            </p>
          </Section>

          <Section heading="We are not the only possible builder">
            <p>
              We&apos;re building one version of this. It lives at{" "}
              <Link
                href="/"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                kommit.now
              </Link>
              . If we ship it badly, the primitive doesn&apos;t go away.
            </p>
            <p>
              If somebody else builds a better version, that&apos;s a good
              outcome. We hope they do. The unit is bigger than the platform.
              Use it, fork it, build something else on top of it, don&apos;t
              credit us. The primitive is the point.
            </p>
            <p>
              The mistake every cycle gets wrong is the same one. Take a real
              human behavior, like three groups wanting to find each other
              early, and ship a system that converts the alignment into
              extraction. The primitive is what it looks like when we
              don&apos;t.
            </p>
            <p>
              Patience should be measurable. Conviction should be portable.
              None of the three groups should pay for the privilege of caring
              early.
            </p>
            <p>
              The architecture exists. Build it with us, build it differently,
              build it better. Just build it.
            </p>
          </Section>

          {/* Footer matches the markdown's italic CC0 colophon. Brutalist
              divider so the colophon doesn't blur into the body. */}
          <footer className="mt-20 pt-8 border-t-[3px] border-black">
            <p className="text-sm md:text-base italic text-gray-700 leading-relaxed">
              Written by the Kommit team during the Solana Frontier hackathon,
              May 2026. The primitive (capital × time, committed without
              extraction, held publicly) is in the public domain via{" "}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                CC0
              </a>
              . The platform is at{" "}
              <Link
                href="/"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                kommit.now
              </Link>
              . The open-source SDK is at{" "}
              <a
                href="https://www.npmjs.com/package/@kommitapp/reader"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                <code className="font-mono text-[0.95em]">@kommitapp/reader</code>
              </a>
              . Critique welcome. Forking encouraged.
            </p>
          </footer>
        </article>
      </main>
      <Footer />
    </>
  );
}

/**
 * Section wrapper — H2 with breathing room, body paragraphs in a tight
 * vertical rhythm. Each `<p>` inside `children` inherits the prose class.
 */
function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 md:mt-16">
      <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tight border-b-[3px] border-black pb-2 mb-6">
        {heading}
      </h2>
      <div className="space-y-5 text-base md:text-lg leading-relaxed text-gray-900">
        {children}
      </div>
    </section>
  );
}
