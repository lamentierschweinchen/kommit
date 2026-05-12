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
      "Capital × time, committed without extraction, with the record held publicly. A thesis from the Kommit team.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Conviction Primitive",
    description:
      "Capital × time, committed without extraction, with the record held publicly.",
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

          <Section heading="The two failures">
            <p>
              Showing up early to back a team should buy you something. Right
              now it doesn&apos;t.
            </p>
            <p>
              There are two ways to support someone&apos;s work before it has
              revenue. <strong>Signal without stake</strong> — Product Hunt
              upvotes, Twitter likes, Discord roles, follower counts. Cheap,
              gameable, and untraceable; founders learn nothing about
              who&apos;s actually serious.{" "}
              <strong>Stake without survival</strong> — equity crowdfunding,
              syndicates, angel rounds. Real money, but the rules of the game
              are extraction-shaped: the backer routinely loses their
              principal, and the platform takes a 7-9% cut at the moment a
              round happens.
            </p>
            <p>
              Neither failure mode is accidental. Each is what falls out when
              a system optimizes for the wrong thing. Signal-without-stake
              systems optimize for engagement metrics; what&apos;s measured is
              volume, and volume is cheap. Stake-without-survival systems
              optimize for transaction completion; the platform&apos;s revenue
              comes from the round closing, not from the backer being right.
              Both ship a product where the user is the byproduct of someone
              else&apos;s incentive structure.
            </p>
            <p>
              The structural mistake is older than crypto. It&apos;s older than
              venture capital. It&apos;s the consequence of mixing two things
              — <em>who showed up</em> and <em>how the platform makes money</em>{" "}
              — that should be cleanly separated.
            </p>
            <p>This is what we propose to separate.</p>
          </Section>

          <Section heading="The unit">
            <p>
              We claim a new unit of measurement should exist for early-stage
              backing:{" "}
              <strong>
                capital × time, committed without extraction, with the record
                of that commitment held publicly.
              </strong>
            </p>
            <p>
              <strong>Capital.</strong> Money the backer could have parked
              anywhere else, doing anything else. It&apos;s the &ldquo;I could
              have earned 5% in a yield account&rdquo; cost, paid voluntarily.
              That cost is what makes the signal hard to fake. It&apos;s not
              opinion volume; it&apos;s opportunity cost.
            </p>
            <p>
              <strong>× Time.</strong> Conviction that survives a week is
              different from conviction that survives a year. Survival through
              a pivot is a stronger signal than reaction to a launch.
              Multiplying by time means the signal compounds along the
              dimension that actually predicts something: did this person stay
              when the team&apos;s pitch deck changed? When the founder&apos;s
              title changed from &ldquo;CEO&rdquo; to &ldquo;we&apos;re not
              sure&rdquo;? When the market rotated? In practice: one kommit
              accrues per dollar-hour committed — a backer who parks $100 for
              100 hours earns 10,000 kommits. Hour-level granularity that
              visibly ticks for a kommitter watching their dashboard.
            </p>
            <p>
              <strong>Committed without extraction.</strong> The backer&apos;s
              principal is preserved by the architecture. Yield earned on the
              parked money funds the platform. No fee at the listing step. No
              fee at the round step. Both sides — the team being backed, the
              person doing the backing — get a fair deal. This is the part
              that feels too good and isn&apos;t: it works because audited
              yield protocols on certain blockchains are now boring enough to
              function as the operational base layer. The platform doesn&apos;t
              need to extract because the substrate already pays it.
            </p>
            <p>
              <strong>Record held publicly.</strong> Every backer&apos;s
              history is onchain, soulbound (cannot be transferred away from
              the wallet that earned it), readable by anyone with an internet
              connection. This is the part most readers don&apos;t immediately
              see the importance of. It&apos;s where the second-order effects
              compound.
            </p>
            <p>
              We call this unit a <strong>kommit</strong>. The platform
              we&apos;re building to mint them is <em>Kommit</em>. The
              primitive is bigger than the platform; the platform is bigger
              than us; this thesis is meant to outlast all of it.
            </p>
          </Section>

          <Section heading="What the unit unlocks">
            <p>
              A primitive earns its name by what other things become possible
              because it exists. The kommit unit unlocks three:
            </p>
            <p>
              <strong>Honest signal.</strong> Backers cannot wash-trade
              conviction by spamming small commitments because the input is
              patient capital sitting through real time. Bots cannot manufacture
              cohort membership because the cost is real opportunity cost paid
              in real currency. Founders, for the first time, can read a number
              and trust it. <em>This person committed money to my team for 18
              months. That is a different kind of person than someone who left
              a comment.</em>
            </p>
            <p>
              <strong>Convertible standing.</strong> Showing up early earns
              rights, not rewards. When the team raises a real round, kommitters
              with earned standing get first dibs to invest at round price. Not
              a free token, not a vesting schedule, not a discount on something
              useless. A right. Concrete, economic, downstream of demonstrated
              patience. The backer who showed up at month one is a different
              category of person from the angel who shows up at the priced
              round, and a system that confuses the two is a system that
              mispriced patience.
            </p>
            <p>
              <strong>Public legibility.</strong> Every wallet&apos;s kommit
              history is readable by humans without permission. A founder
              writing a cap-table-adjacent pitch can claim{" "}
              <em>
                &ldquo;backed by 50 kommitters with $200K committed across 18
                months&rdquo;
              </em>{" "}
              and the claim is verifiable in seconds. A hiring manager can read
              a candidate&apos;s kommit history and learn something true about
              how they think — what they backed, when, and through which
              pivots. A journalist can trace a project&apos;s traction without
              a press release. Downstream products can read kommit balances and
              gate features on them — partner discounts, allocation priority,
              beta access, recruitment funnels — without anyone asking
              permission. Each integration makes a kommit more valuable to the
              kommitter, which makes more capital flow in, which makes the
              cohort signal richer for the next founder. The flywheel turns at
              scale; pre-scale you bootstrap each loop manually.
            </p>
          </Section>

          <Section heading="A worked example">
            <p>
              Anna parks $500 on Kommit and allocates it across three teams she
              found on Twitter. Six months in, one team pivots; she stays.
              Eighteen months in, that team announces a public round. Her
              kommit balance on that team alone — capital × time at one kommit
              per dollar-hour, ticking visibly upward every second she remains
              kommitted — earns her first dibs at round price. Her standing,
              accrued by her own patience, is now public, soulbound, and
              readable by every product downstream of Kommit. She paid no fee.
              She kept her $500.
            </p>
            <p>That&apos;s the unit.</p>
          </Section>

          <Section heading="Why now">
            <p>
              Three substrate shifts make the primitive available today that
              weren&apos;t five years ago.
            </p>
            <p>
              <strong>Audited yield protocols at retail-accessible scale.</strong>{" "}
              Lending markets on certain blockchains now hold billions of
              dollars of stable capital and survive multiple market cycles
              without losing principal. They are boring enough — in the
              engineering sense, the most important sense — to function as the
              operational base layer for a non-extractive primitive. Without
              this, the architecture is aspirational; with it, the architecture
              pays for itself.
            </p>
            <p>
              <strong>Walletless onboarding.</strong> The crypto-fluency tax —
              seed phrases, hardware wallets, &ldquo;approve transaction&rdquo;s
              — has been substantially eliminated by email and passkey login. A
              retail kommitter signs in with their email, sees a kommit balance,
              never thinks about the chain. The backstop that used to keep this
              primitive crypto-only no longer holds; it&apos;s a retail product
              that happens to settle on a chain.
            </p>
            <p>
              <strong>Legal precedent on principal-protected yield.</strong> The
              architectural pattern — backers park capital, yield routes
              elsewhere, principal stays redeemable — has been tested in U.S.
              court (<em>Kent v. PoolTogether</em>, dismissed in 2023 for lack
              of standing; the court didn&apos;t reach the merits, but Judge
              Block named withdraw-anytime + no defendant-imposed fees as why
              the plaintiff had no concrete harm — both baked into Kommit) and
              reads under EU MiCA framing as a non-financial-instrument
              membership record. The legal frontier was uncertain in 2021. It
              is narrower in 2026 — not resolved.
            </p>
            <p>
              The primitive sat on the table waiting for these three to show up
              together. They did.
            </p>
          </Section>

          <Section heading="What this is not">
            <p>
              The primitive is easy to misread. It is not a launchpad —
              launchpads run rounds; the primitive sits upstream. It is not a
              token — there is no platform token, ever; kommits are records,
              not securities. It is not equity crowdfunding — no offering at
              the kommit step, equity rights conditional and disclosed. It is
              not a casino — patient capital × time is the inverse of what
              casinos optimize for. The misreadings are familiar; the unit
              isn&apos;t.
            </p>
          </Section>

          <Section heading="Where the primitive can fail">
            <p>A thesis that won&apos;t name its weak spots gets read as a sales pitch. So:</p>
            <p>
              The unit is{" "}
              <strong>proportional to patient capital by design.</strong> A
              backer with $10,000 accrues ten times the standing of a backer
              with $1,000 over the same window — intentional, since
              capital-at-risk-over-time is what we set out to measure. The
              harshest read is mitigated by access being threshold-gated rather
              than weight-gated: teams set a floor, and above the floor, the
              $50 kommitter and the $50,000 kommitter have the same first-dibs
              claim on access.
            </p>
            <p>
              The dollar-weighting still survives in two places — allocation
              size at a round (pro-rata by default) and any downstream product
              that reads continuous balances. We accept that. If you believe
              every conviction-having voice should count equally regardless of
              capital, this is not your primitive. If you believe
              capital-at-risk-over-time is the cleanest available signal of
              seriousness, this is what it looks like measured honestly.
            </p>
            <p>
              <strong>Curation is not solved.</strong> For now, an admin
              curates which projects can list. That&apos;s a single point of
              bias and a structural bottleneck. Less-centralized paths — DAO
              curation, staked-reputation, onchain reputation primitives — are
              research questions, not shipped product. We commit to walking the
              path; we do not claim to have walked it.
            </p>
            <p>
              <strong>Founder-side cold start is not solved.</strong> Getting
              the first fifteen teams of the right shape onto the platform is
              an unsolved supply problem we are working through hand-to-hand.
              The primitive&apos;s value depends on cohort quality; cohort
              quality depends on which teams listed; which teams listed depends
              on a bootstrap we have not yet made structural. This is the
              failure mode most likely to kill an early version of the
              primitive — ours, or anyone else&apos;s.
            </p>
            <p>
              We think the primitive is worth shipping anyway, because the
              alternatives fail in larger and less honest ways.
            </p>
          </Section>

          <Section heading="We are not the primitive's only possible builder">
            <p>
              We are building one implementation. It is at{" "}
              <Link href="/" className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black">
                kommit.now
              </Link>
              . The primitive does not depend on us shipping it correctly.
            </p>
            <p>
              If a better team builds a better version, the category does not
              depend on us. We hope someone does. The unit is bigger than the
              platform. Use it, fork it, refuse to credit us — the primitive
              is the point.
            </p>
            <p>
              The mistake we&apos;re trying to avoid is the one made every
              cycle: take a real human behavior — wanting to back things early —
              and ship a system that converts that behavior into extraction.
              The primitive is what it looks like when we don&apos;t.
            </p>
            <p>
              Showing up early should buy you something. The architecture
              exists now. Build it with us, build it differently, build it
              better — but build it.
            </p>
          </Section>

          {/* Footer matches the markdown's italic CC0 colophon. Brutalist
              divider so the colophon doesn't blur into the body. */}
          <footer className="mt-20 pt-8 border-t-[3px] border-black">
            <p className="text-sm md:text-base italic text-gray-700 leading-relaxed">
              Written by the Kommit team during the Solana Frontier hackathon,
              May 2026. The primitive — capital × time, committed without
              extraction, soulbound and publicly readable — is dedicated to the
              public domain via{" "}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                CC0
              </a>
              . The platform is at{" "}
              <Link href="/" className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black">
                kommit.now
              </Link>
              ; the open-source SDK is at{" "}
              <a
                href="https://www.npmjs.com/package/@kommitapp/reader"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                <code className="font-mono text-[0.95em]">@kommitapp/reader</code>
              </a>
              . Critique welcome; forking encouraged.
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
