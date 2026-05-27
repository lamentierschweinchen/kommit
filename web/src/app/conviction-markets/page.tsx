import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";

/**
 * /ov — Kommit / Conviction Markets framework artifact, hosted on kommit.now.
 *
 * Long-form intellectual contribution to the Conviction Markets thesis. Two SVG
 * diagrams embedded inline. Same typography pattern as /manifesto: brutalist
 * chrome, essay body, generous leading.
 *
 * `noindex,nofollow` — direct-link artifact, not a public marketing surface.
 * Shared by URL; no search-engine surface area.
 */

export const metadata: Metadata = {
  title: "Kommit ↔ Conviction Markets — a framework",
  description:
    "Field notes from a working pre-funding conviction signal, a proposed decomposition for the Conviction Markets architecture, and the design questions that surface when the primitive is built.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Kommit ↔ Conviction Markets — a framework",
    description:
      "Two instruments, two scales, one primitive. A framework mapping a working implementation onto the Conviction Markets architecture.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kommit ↔ Conviction Markets — a framework",
    description:
      "Two instruments, two scales, one primitive. A framework mapping a working implementation onto the Conviction Markets architecture.",
  },
};

export default function ConvictionMarketsPage() {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 bg-[#FFFCF5] px-6 md:px-12 py-12 md:py-20">
        <article className="max-w-[72ch] mx-auto">
          {/* Title block. Slightly more compressed than /manifesto. */}
          <header className="mb-12 md:mb-16">
            <p className="font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500 mb-3">
              A contribution to Conviction Markets
            </p>
            <h1 className="font-epilogue font-black uppercase text-3xl sm:text-4xl md:text-5xl tracking-tighter leading-[0.95] break-words">
              Kommit ↔ Conviction Markets
            </h1>
            <p className="mt-6 text-base md:text-lg italic text-gray-700 leading-relaxed">
              Field notes from a working pre-funding conviction signal, a
              proposed decomposition for the open module calls, and the design
              questions that surface when the primitive is built at the smallest
              viable scale.
            </p>
            <p className="mt-3 font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500">
              Read time · ~15 minutes
            </p>
          </header>

          <Section heading="Preface">
            <p>
              This maps Kommit, a working pre-funding conviction signal, onto
              the Conviction Markets architecture. It names where the fit is
              exact and where it isn&apos;t, and proposes what version of the
              primitive becomes possible at institutional scale.
            </p>
            <p>
              The aim is to make the design space underneath the thesis more
              legible by walking one working implementation through it and
              naming what gets exposed.
            </p>
          </Section>

          <Section heading="What gets contributed here">
            <p>Three things, in order:</p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>A two-instrument decomposition</strong> for the
                Participation Token open call. Splits the reputation-signal
                function from the ownership-share function into two instruments
                with different properties. Resolves the soulbound-vs-transferable
                tension the paper holds open, and shows the single-unit version
                as a derived view.
              </li>
              <li>
                <strong>A two-scale interpretation</strong> of the primitive:
                retail-scale (yield funds the platform, what&apos;s shipped
                today) and institutional-scale (yield funds the team as runway,
                what the CM frame actually requires). Same architecture,
                different yield routing, different unit economics, different
                product.
              </li>
              <li>
                <strong>The Verifier layer as the structural bridge</strong>{" "}
                between the two scales. The current Kommit ships without
                verification, which is fine at retail but brittle at
                institutional. Adding milestone-gated release is what converts
                retail-shaped Kommit into a CM-compatible module.
              </li>
            </ol>
            <p>
              Each section closes with the open design question it surfaces.
              None of this is mechanism-design speculation. All of it is what
              shows up when you actually build the smallest viable version.
            </p>
          </Section>

          <Section heading="Kommit, in two paragraphs">
            <p>
              Kommit is a working pre-funding conviction signal on Solana.
              Backers park USDC on a per-project escrow; principal stays in
              their wallet (withdraw at will, on-chain receipt of refund). Yield
              generated by the parked capital (via Kamino, audited, billions in
              TVL) currently funds the operating layer. Backers accrue a
              soulbound record of capital × time on the wallet that earned it.
              No platform token, no transfer, no secondary market, no extraction
              at the listing or round steps. v0.5 is live on devnet with the
              engagement loop (founder updates, reactions, comments), a real
              founder onboarding stack, mobile-polished UI. SDK shipped to npm
              so any product can read kommit balances without permission.
            </p>
            <p>
              In CM vocabulary this is closest to the{" "}
              <strong>Sponsor → Contributor</strong> route, with{" "}
              <strong>Curator</strong> as permissionless-in-design (admin-curated
              in v0.5 as a quality gate, not a structural commitment) and{" "}
              <strong>Verifier</strong> absent. The conviction signal sits between
              an upvote (signal without stake) and equity crowdfunding (stake
              without survival of principal). It was built solo in a week, which
              sets the right expectation for what follows: a working primitive at
              the smallest viable scale, useful as a stress-test for the thesis
              rather than a finished module.
            </p>
          </Section>

          <Section heading="Mapping onto the four-stage architecture">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <table className="w-full text-sm md:text-base border-collapse">
                <thead>
                  <tr className="border-b-[3px] border-black">
                    <th className="text-left font-epilogue font-black uppercase tracking-tight text-xs py-3 pr-4 w-[18%]">
                      Stage
                    </th>
                    <th className="text-left font-epilogue font-black uppercase tracking-tight text-xs py-3 pr-4 w-[34%]">
                      Kommit&apos;s state
                    </th>
                    <th className="text-left font-epilogue font-black uppercase tracking-tight text-xs py-3 w-[48%]">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="text-gray-900">
                  <tr className="border-b-[1.5px] border-black/30 align-top">
                    <td className="py-3 pr-4 font-bold">Curator</td>
                    <td className="py-3 pr-4">
                      Permissionless in design; admin-curated in v0.5.
                    </td>
                    <td className="py-3">
                      The admin curation is a quality gate, not a structural
                      commitment. The paper&apos;s &ldquo;open, permissionless,
                      forkable&rdquo; property is the long-arc target.
                    </td>
                  </tr>
                  <tr className="border-b-[1.5px] border-black/30 align-top">
                    <td className="py-3 pr-4 font-bold">Sponsor</td>
                    <td className="py-3 pr-4">
                      Working: capital escrow, conviction weight = capital ×
                      time.
                    </td>
                    <td className="py-3">
                      The clearest one-to-one fit and a direct working answer to
                      the paper&apos;s <em>Performance over Time-Vesting</em>{" "}
                      property.
                    </td>
                  </tr>
                  <tr className="border-b-[1.5px] border-black/30 align-top">
                    <td className="py-3 pr-4 font-bold">Contributor</td>
                    <td className="py-3 pr-4">
                      Working but narrow: single curated project wallet
                      receives yield.
                    </td>
                    <td className="py-3">
                      Multi-contributor problem-stacks (the CM target) need
                      structural extension. See decomposition below.
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-3 pr-4 font-bold">Verifier</td>
                    <td className="py-3 pr-4">Absent.</td>
                    <td className="py-3">
                      Yield streams continuously rather than against attested
                      milestones. Most significant gap and the most interesting
                      design surface.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              The paper&apos;s instrument — the Participation Token, weighted by
              timing × capital × delivery, transferable — has no current Kommit
              analog. Kommit produces non-transferable reputation; CM produces
              transferable ownership.{" "}
              <strong>
                These aren&apos;t competing designs for the same role. They
                address different sides of the equation, and the cleanest
                contribution is to name that and propose the decomposition.
              </strong>
            </p>
          </Section>

          <Section heading="The two-instrument decomposition">
            <p>
              CM&apos;s paper bundles two distinct functions into the
              Participation Token: <em>reputation signal</em> (who showed up,
              how much they staked, how long they stayed) and{" "}
              <em>ownership claim</em> (what fraction of downstream value flows
              to them). The two functions have opposing requirements.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Reputation signal wants:</strong> non-transferable
                (cannot wash-trade), persistent (soulbound across time), legible
                (publicly readable, composable across products). This is what
                Kommit&apos;s soulbound kommit is.
              </li>
              <li>
                <strong>Ownership claim wants:</strong> transferable (can be
                exchanged for liquidity or upside), convertible (must turn into
                something at graduation: equity, revenue share, tokens),
                market-priceable. This is what the Participation Token wants to
                be.
              </li>
            </ul>
            <p>
              Trying to make a single instrument do both produces compromises:
              either transferability undermines the Sybil resistance of the
              signal, or non-transferability blocks the value-capture mechanic
              the contributor side needs. The paper acknowledges this in the
              productive-vs-speculative open question without resolving it.
            </p>
            <p>
              <strong>The decomposition: two instruments, one primitive.</strong>
            </p>
            <p>
              <strong>Instrument 1 — Soulbound conviction record.</strong>{" "}
              Capital × time on the backer side, work × delivery on the
              contributor side. Non-transferable, persistent, publicly readable.
              Earned by participation, never tradeable, serves the reputation
              function. This is what Kommit already produces for the backer; the
              contributor-side analog (work × delivery, attested by Verifier) is
              what would need to be added.
            </p>
            <p>
              <strong>Instrument 2 — Convertible participation share.</strong>{" "}
              Transferable, weighted by the same input dimensions (timing ×
              capital × delivery) but with the ownership semantics CM wants.
              Earned by participation, convertible at graduation, serves the
              ownership function. The participation share is what closes the
              contributor-side incentive gap Kommit currently has.
            </p>
            <p>
              A backer earns both instruments. A contributor (builder) earns
              only the participation share. A Verifier (when the layer exists)
              earns participation share weighted by attestations made and stake
              at risk on those attestations.
            </p>

            {/* Figure 1 — decomposition matrix */}
            <figure className="my-10 md:my-12">
              <div className="border-[3px] border-black bg-white p-4 md:p-6 shadow-brutal-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cm-framework-decomposition.svg"
                  alt="The conviction primitive, decomposed. Two instruments — Soulbound Conviction Record and Convertible Participation Share — with three actor rows (Backer, Builder, Verifier) showing which instruments each earns."
                  className="w-full h-auto"
                />
              </div>
              <figcaption className="mt-3 text-xs text-gray-500 font-epilogue font-bold uppercase tracking-widest">
                Figure 1 · The two-instrument decomposition
              </figcaption>
            </figure>

            <p>
              <strong>The single-unit interpretation.</strong> If two
              instruments feel like added complexity, the participation share
              can be made the canonical unit, and the soulbound reputation
              derived as a view over accumulated participation shares — a wallet
              with shares across 50 projects has, by virtue of the count, the
              unspent fraction, and the time held, a credible reputation signal.
              The two-instrument design is the explicit version; the
              derived-view design is the implicit version. Either works. The
              explicit version is easier to reason about and easier to compose
              with downstream products.
            </p>
            <p>
              <strong>Design questions this surfaces:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <em>Convertibility direction.</em> When the participation share
                converts at graduation, what does it convert into? Equity (clean
                for traditional-VC graduations), revenue share (clean for
                protocol-shaped graduations), tokens (introduces the speculative
                dynamics the paper is trying to avoid). A real CM module
                probably has to support all three, with the default chosen at
                the Curator step.
              </li>
              <li>
                <em>Weighting per role.</em> Backer weight = capital × time.
                Contributor weight = ? The paper says &ldquo;delivery.&rdquo;
                The operational question is who measures delivery, on what
                cadence, with what gameability surface. (Verifier layer below.)
              </li>
              <li>
                <em>The conditional-property counter-proposal.</em> The obvious
                objection is a single Participation Token with conditional
                properties — soulbound for the backer-stake portion,
                transferable for the builder-delivery portion. It&apos;s
                defensible but produces harder-to-compose primitives downstream
                and forces consumers to handle the conditional logic. Two
                instruments with clean properties scale better. One instrument
                with conditional properties is fragile.
              </li>
            </ul>
          </Section>

          <Section heading="Two scales of the same primitive">
            <p>
              The current Kommit and the OV-relevant Kommit are not the same
              product, even though they share architecture. Calling them Layer 1
              and Layer 2 makes the relationship visible.
            </p>
            <h3 className="font-epilogue font-bold uppercase tracking-tight text-lg md:text-xl mt-8 mb-3">
              Layer 1 — Retail-scale conviction signal
            </h3>
            <p>
              What&apos;s shipped today. Yield generated on parked capital funds
              the platform&apos;s operating layer. Backers commit retail amounts
              ($50 to $5K), accrue kommits over time, claim first-dibs rights at
              round price when a backed project graduates. The reputation
              function is the product; the ownership function isn&apos;t present
              (no participation share yet); the contributor side gets a
              yield-funded platform but doesn&apos;t receive working capital
              directly.
            </p>
            <p>
              This layer is honest about what it is: a non-extractive
              pre-funding signal at retail scale. Hello World. Useful as a
              reputation surface for backers and as a PMF signal for founders.
              Not a CM module yet.
            </p>
            <h3 className="font-epilogue font-bold uppercase tracking-tight text-lg md:text-xl mt-8 mb-3">
              Layer 2 — Institutional-scale capital streaming
            </h3>
            <p>
              What becomes possible when sponsor capital crosses a unit-economics
              threshold. Same escrow architecture, but yield routes to the
              contributor wallet as working runway instead of to the platform.
              The same conviction record accrues on the backer side. Backers —
              now institutional: VC dry powder, family offices, treasury
              management — keep principal whole, yield streams to the team as
              ongoing income, the participation share earns alongside.
            </p>
            <p>
              The threshold matters: $5K × 4% APY = $200/year, which
              doesn&apos;t fund anything; $5M × 4% APY = $200K/year, which is a
              founder&apos;s salary or two contractor hires. The
              streaming-runway model is a different product than the retail
              signal product, made possible by the same architecture once
              allocation size crosses into institutional territory.
            </p>
            <p>
              <strong>
                Three things stack at Layer 2 that aren&apos;t present at Layer
                1:
              </strong>
            </p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>Yield-as-runway becomes meaningful.</strong> Teams get
                real working capital from yield on locked-but-not-spent sponsor
                capital. No dilution, no priced round, no token launch required
                to fund the early build phase.
              </li>
              <li>
                <strong>Capital efficiency for the institutional sponsor.</strong>{" "}
                Principal stays on the sponsor&apos;s balance sheet for the
                duration of the conviction window. The sponsor never wrote a
                check locked in the team; they wrote a check locked in audited
                yield infrastructure, generating runway as a side effect. When
                the window closes or the team graduates, principal returns. The
                sponsor has bought a full exploratory period of signal,
                relationship, and observation without putting principal at risk.
              </li>
              <li>
                <strong>
                  Graduation routes back into traditional capital allocation.
                </strong>{" "}
                At the priced round (or its equivalent), institutional sponsors
                who streamed yield convert to equity buyers holding inside data
                a cold pitch can&apos;t provide: who stayed, who delivered, what
                the cohort signal looks like, what the founder&apos;s track
                record across the whole period actually is. The CM module
                doesn&apos;t replace VC. It&apos;s the funnel that produces deals
                VC currently can&apos;t see clearly.
              </li>
            </ol>
            <p>
              The mechanism underneath all three answers a question the thesis
              leaves open: how do contributors benefit from solving a problem
              collaboratively? They earn a revenue stream. Yield on the capital
              allocated to their problem streams to them as they build —
              non-dilutive income, paid out of money that stays whole for the
              sponsor. That is the part Kommit can speak to from having built it.
            </p>

            {/* Figure 2 — two scales architecture */}
            <figure className="my-10 md:my-12">
              <div className="border-[3px] border-black bg-white p-4 md:p-6 shadow-brutal-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cm-framework-two-scales.svg"
                  alt="Two scales, one primitive. Layer 1 (Retail) streams yield to the platform. Layer 2 (Institutional) streams yield to the team. The Verifier layer is the structural bridge between them, with graduation converting the participation share at the bottom."
                  className="w-full h-auto"
                />
              </div>
              <figcaption className="mt-3 text-xs text-gray-500 font-epilogue font-bold uppercase tracking-widest">
                Figure 2 · Two scales, one primitive · Verifier as bridge
              </figcaption>
            </figure>
          </Section>

          <Section heading="The Verifier layer as the structural bridge">
            <p>
              Layer 1 streams yield continuously to a single project wallet.
              Layer 2 needs to stream yield (and earn participation shares)
              against attested milestones, across potentially multiple
              contributors, on a problem-stack. The transformation from Layer 1
              to Layer 2 is the addition of the Verifier layer.
            </p>
            <p>Three sub-questions this opens:</p>
            <p>
              <strong>1. What gets attested.</strong> Milestones are the obvious
              unit, but milestones presuppose a problem-shaped pool with a
              structured roadmap. CM&apos;s frame (&ldquo;place capital on a
              problem&rdquo;) suggests milestones defined per-problem at the
              Curator stage, with the Verifier attesting against the curated
              definition. Current Kommit doesn&apos;t have a Curator-defined
              milestone surface. That&apos;s structural addition #1.
            </p>
            <p>
              <strong>2. Who verifies.</strong> The paper says &ldquo;naturally
              agentic over time.&rdquo; The transition from human-panel
              attestation to agentic attestation is the deepest open question.
              An agentic verifier inherits the gameability the protocol is
              trying to solve (an LLM can be jailbroken; a curated panel can be
              bribed; both can be Sybil-attacked at scale). Worth being explicit
              that this is a research thread, not a settled answer. The
              provenance of testimony — treating an attestation as a traceable
              chain of who vouched for what, and at what stake — is the relevant
              lens here, and it is underexplored in the agentic-verification
              context.
            </p>
            <p>
              <strong>3. Stake against attestation.</strong> A Verifier with
              skin in the game (stake locked behind their attestations) is the
              cleanest game-theory move and is part of CM&apos;s framing. The
              mechanics for slashing on wrong attestations, the dispute window,
              the appeal layer — all open. Worth modeling.
            </p>
            <p>
              The Verifier addition is what enables the participation-share
              weighting on the contributor side (no delivery measure without
              verification), which is what unlocks the contributor-side
              ownership instrument, which is what makes the protocol a CM module
              rather than a backer-only reputation surface.
            </p>
          </Section>

          <Section heading="Open design questions, in order of leverage">
            <p>Synthesizing from the surface above:</p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                <strong>
                  Single instrument with conditional properties, or two
                  instruments with clean properties?
                </strong>{" "}
                (Decomposition section.)
              </li>
              <li>
                <strong>
                  What does the participation share convert into at graduation,
                  and where is the default set?
                </strong>{" "}
                (Convertibility direction.)
              </li>
              <li>
                <strong>
                  How does the Verifier transition from human panel to agentic
                  without inheriting the gameability the protocol is solving?
                </strong>{" "}
                (Verifier sub-question 2.)
              </li>
              <li>
                <strong>
                  What does a multi-contributor problem-stack pool look like
                  architecturally?
                </strong>{" "}
                Single escrow with proportional routing, or per-contributor
                sub-escrows under a coordinating curator?
              </li>
              <li>
                <strong>
                  At what capital threshold does Layer 1 transition into Layer
                  2?
                </strong>{" "}
                Continuous (yield routing toggles as allocation crosses a
                unit-economics threshold) or discrete (different curation track
                at the start)?
              </li>
              <li>
                <strong>Curator/Sponsor incentive conflict</strong> when the
                same actor plays both roles. The paper names this without
                resolving. The cleanest answer is probably structural (a
                Curator&apos;s bond is forfeited if their pool fails to attract
                Sponsors, but they can still Sponsor their own pool with a
                separate signal). Real design space.
              </li>
            </ol>
          </Section>

          <Section heading="The Hello World question">
            <p>
              Kommit is almost the smallest viable Conviction Market — single
              project, single curator, single sponsor pool, no Verifier yet.
              Three additions make it the actual Hello World for the full
              primitive:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>The Verifier layer</strong> (milestone gates,
                attestation mechanic) — unlocks contributor-side weighting.
              </li>
              <li>
                <strong>The participation share instrument</strong>{" "}
                (transferable, weighted by timing × capital × delivery) —
                unlocks contributor-side ownership.
              </li>
              <li>
                <strong>The multi-contributor problem-stack shape</strong> —
                unlocks problem-shaped rather than project-shaped capital
                placement.
              </li>
            </ol>
            <p>
              With all three, Kommit is a deployable Hello World for the full
              primitive. Without them, it demonstrates the Sponsor mechanic in
              isolation.
            </p>
          </Section>

          <Section heading="Kommit's contribution to Conviction Markets">
            <p>Four things, gathered:</p>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                A revenue stream for contributors: yield on the capital
                allocated to their problem streams to them as they build. A
                concrete answer to how contributors benefit from collaborative
                problem-solving, non-dilutively, without the sponsor losing
                principal.
              </li>
              <li>
                Decompose the Participation Token into two instruments
                (soulbound reputation + convertible participation share) to
                resolve the soulbound-vs-transferable tension cleanly, with the
                single-unit version available as a derived view if that&apos;s
                preferred.
              </li>
              <li>
                Name the two-scale interpretation (retail Layer 1, institutional
                Layer 2) so the discrepancy between yield-to-platform and
                yield-to-team is a feature of the primitive rather than a
                contradiction.
              </li>
              <li>
                Identify the Verifier layer as the bridge that unlocks
                contributor-side participation, naming what gets attested, who
                verifies, and what stake structure supports it.
              </li>
              <li>
                Surface six open design questions in order of leverage, marking
                where Kommit-as-built has signal and where mechanism-design work
                begins.
              </li>
            </ol>
            <p>
              The framework above is what a working implementation can credibly
              contribute to the thesis. The six questions are where the
              mechanism-design work begins.
            </p>
          </Section>

          {/* Footer matches the manifesto's italic colophon pattern. */}
          <footer className="mt-20 pt-8 border-t-[3px] border-black">
            <p className="text-sm md:text-base italic text-gray-700 leading-relaxed">
              A contribution to the{" "}
              <a
                href="https://convictionmarkets.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                Conviction Markets
              </a>{" "}
              thesis. Companion to the public{" "}
              <Link
                href="/manifesto"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                Kommit manifesto
              </Link>
              . The platform is at{" "}
              <Link
                href="/"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                kommit.now
              </Link>
              . SDK on npm at{" "}
              <a
                href="https://www.npmjs.com/package/@kommitapp/reader"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-primary decoration-2 underline-offset-2 hover:text-black"
              >
                <code className="font-mono text-[0.95em]">@kommitapp/reader</code>
              </a>
              . Critique welcome.
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
 * vertical rhythm. Identical pattern to /manifesto for visual consistency.
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
