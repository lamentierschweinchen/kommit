import Link from "next/link";
import { Icon } from "@/components/common/Icon";

/**
 * Mission excerpt for the coming-soon `/` landing — a tight pull from the
 * cohort manifesto (cohort_manifesto.md). The full manifesto is hosted at
 * /manifesto on kommit.now; this section is its handshake on the marketing
 * page.
 */

const FULL_HREF = "/manifesto";

export function MissionSection() {
  return (
    <section className="mt-32 pt-12 border-t-[8px] border-black">
      <h2 className="font-epilogue font-black uppercase text-3xl md:text-4xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-12">
        The conviction primitive
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 items-start">
        <div className="space-y-6 max-w-3xl">
          <p className="text-lg md:text-xl font-medium text-gray-800 leading-relaxed border-l-[4px] border-primary pl-6 italic">
            Showing up early to back a team should buy you something. Right now
            it doesn&apos;t.
          </p>
          <p className="text-base md:text-lg font-medium text-gray-800 leading-relaxed">
            There are two ways to support someone&apos;s work before it has
            revenue. <strong>Signal without stake</strong> — Product Hunt
            upvotes, Twitter likes, follower counts. Cheap, gameable.{" "}
            <strong>Stake without survival</strong> — equity crowdfunding,
            syndicates, angel rounds. Real money, but the rules of the game
            are extraction-shaped: the backer routinely loses their principal,
            and the platform takes a 7-9% cut at the moment a round happens.
          </p>
          <p className="text-base md:text-lg font-medium text-gray-800 leading-relaxed">
            We claim a new unit of measurement should exist:{" "}
            <strong>capital × time, committed without extraction, with the
            record of that commitment held publicly.</strong> One kommit per
            dollar-hour. Your money never leaves your control. Yield earned on
            parked capital funds the platform — no fee on you, no fee on
            founders.
          </p>
          <p className="text-base md:text-lg font-medium text-gray-800 leading-relaxed">
            We call this unit a kommit. The platform we&apos;re building to
            mint them is Kommit. The primitive is bigger than the platform;
            the platform is bigger than us; this thesis is meant to outlast
            all of it.
          </p>
          <Link
            href={FULL_HREF}
            className="inline-flex items-center gap-2 font-epilogue font-black uppercase tracking-tight text-sm border-b-[3px] border-black hover:bg-secondary px-2 transition-colors"
          >
            Read our manifesto
            <Icon name="arrow_forward" />
          </Link>
        </div>

        {/* Side panel: three-step diagram, brutalist */}
        <div className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-8 space-y-5">
          <div className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
            How a kommit accrues
          </div>
          <Step n="01" body="Back ambitious teams with money you keep." />
          <Step n="02" body="Stay through the pivots that reveal who's serious." />
          <Step n="03" body="Earn standing — soulbound, public, redeemable." />
        </div>
      </div>
    </section>
  );
}

function Step({ n, body }: { n: string; body: string }) {
  return (
    <div className="flex items-start gap-4 border-t-[2px] border-black pt-4 first:border-t-0 first:pt-0">
      <div className="font-epilogue font-black text-3xl md:text-4xl text-primary leading-none shrink-0 tracking-tighter">
        {n}
      </div>
      <p className="text-sm md:text-base font-medium text-gray-800 leading-relaxed">
        {body}
      </p>
    </div>
  );
}
