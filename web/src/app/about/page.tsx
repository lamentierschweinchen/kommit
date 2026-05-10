import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Icon } from "@/components/common/Icon";

/**
 * /about — one-screen manifesto.
 *
 * The page is a four-line comparison: 01-02-03 are the old ways to be early
 * (rich, lucky, willing to lose money), all crossed out. 04 is the answer
 * (Kommit), lit up green, with the entire explanation inside it — including
 * the four perks that define what "Get rewarded" means and the CTAs.
 *
 * No separate hero subhead, no separate green card, no eyebrow chips, no
 * pulled-out callout. The numbered chain runs from 01 through 04 exactly
 * once on the page; the perks are sub-elements of 04 and intentionally
 * carry no numerals so they don't double-count the chain.
 */
export default function AboutPage() {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-32">
        <div className="max-w-5xl mx-auto">
          {/* Hero one-liner — small, top, single line. Sets the page's
              signature and gets out of the way. The headline of the page is
              the numbered list below, not this. */}
          <section className="pt-16 md:pt-24">
            <h1 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tight leading-tight">
              Kommit turns{" "}
              <span className="inline-block bg-black text-white px-2 py-0.5 border-[3px] border-black shadow-brutal-purple-sm">
                conviction
              </span>{" "}
              into currency.
            </h1>
          </section>

          {/* The numbered list — the entire visual product of the page.
              Three struck-out old ways, then 04 alive. Same row shape across
              all four; the difference between "old" and "new" is carried by
              strikethrough vs. green fill, not by separate sections. */}
          <section className="mt-20 md:mt-28">
            <p className="font-epilogue font-bold uppercase tracking-widest text-sm md:text-base text-gray-600 mb-10 md:mb-14">
              To be early, you used to need to:
            </p>

            <ul className="space-y-7 md:space-y-9">
              <StruckOption num="01">Be rich.</StruckOption>
              <StruckOption num="02">Be lucky.</StruckOption>
              <StruckOption num="03">Be willing to lose your money.</StruckOption>
            </ul>

            {/* Row 04 — the answer. Same horizontal alignment as 01/02/03
                (numeral column + content column), but no strikethrough and
                fills with the brand green. The Kommit line is the heading;
                the supporting line is the body; the four perk chips define
                "Get rewarded"; the CTAs close the block. Everything that
                used to live across three different sections lives here. */}
            <div className="mt-10 md:mt-12">
              <div className="bg-secondary border-[3px] border-black shadow-brutal-lg p-6 md:p-10">
                <div className="flex items-baseline gap-5 md:gap-7">
                  <span
                    aria-hidden
                    className="font-epilogue font-black text-4xl md:text-6xl text-black/30 leading-none select-none flex-shrink-0 w-14 md:w-24"
                  >
                    04
                  </span>
                  <p className="font-epilogue font-black uppercase text-2xl md:text-4xl lg:text-5xl tracking-tighter leading-tight">
                    Kommit.
                  </p>
                </div>

                <p className="mt-5 md:mt-6 ml-[4.75rem] md:ml-[7.75rem] font-epilogue font-bold uppercase text-lg md:text-2xl tracking-tight leading-snug">
                  Back early. Keep your money. Get rewarded.
                </p>

                {/* Four perk chips — evidence of "Get rewarded." Smaller
                    than tile-scale on purpose: subordinate to 04, not a
                    peer section. No numerals (the chain belongs to 01-04
                    only). Single row on desktop, 2x2 on tablet, stacked
                    on mobile. */}
                <ul className="mt-8 md:mt-10 ml-0 md:ml-[7.75rem] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <Perk title="Early access" body="Beta seats, perks, discounts." />
                  <Perk title="Preferred rate" body="Insider price if they launch." />
                  <Perk title="First dibs" body="First call when they raise." />
                  <Perk title="Portable record" body="A history that travels with you." />
                </ul>

                <div className="mt-8 md:mt-10 ml-0 md:ml-[7.75rem] flex flex-col sm:flex-row gap-3 md:gap-4">
                  <Link
                    href="/projects"
                    className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base px-6 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg inline-flex items-center justify-center gap-3"
                  >
                    Browse projects
                    <Icon name="arrow_forward" className="font-bold" />
                  </Link>
                  <Link
                    href="/build"
                    className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base px-6 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg inline-flex items-center justify-center gap-3"
                  >
                    Build something
                    <Icon name="arrow_outward" className="font-bold" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

/**
 * StruckOption — one of the three "old ways" rows. Big numeral on the left,
 * then the option text with a thick brand-purple horizontal bar painted
 * across it. Semantic <s> for screen readers; the browser's default thin
 * line-through is suppressed because the brand stroke is doing the work.
 *
 * The bar uses background-image + box-decoration-break:clone so the stroke
 * carries through every wrapped line on narrow viewports — a single
 * absolute-positioned bar would only cross the middle line and break at
 * 375px when the text wraps.
 */
function StruckOption({
  num,
  children,
}: {
  num: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-5 md:gap-7">
      <span
        aria-hidden
        className="font-epilogue font-black text-4xl md:text-6xl text-gray-300 leading-none select-none flex-shrink-0 w-14 md:w-24"
      >
        {num}
      </span>
      <s className="font-epilogue font-black uppercase text-2xl md:text-4xl lg:text-5xl tracking-tighter leading-tight [text-decoration:none]">
        <span className="[-webkit-box-decoration-break:clone] [box-decoration-break:clone] [background-image:linear-gradient(to_bottom,transparent_calc(50%-2.5px),#9945FF_calc(50%-2.5px),#9945FF_calc(50%+2.5px),transparent_calc(50%+2.5px))] md:[background-image:linear-gradient(to_bottom,transparent_calc(50%-3.5px),#9945FF_calc(50%-3.5px),#9945FF_calc(50%+3.5px),transparent_calc(50%+3.5px))]">
          {children}
        </span>
      </s>
    </li>
  );
}

/**
 * Perk — small chip shown under the 04 row. Defines what "Get rewarded"
 * means without competing visually with the 04 reveal. Deliberately
 * smaller and simpler than a NumberTile: no numeral, no offset shadow,
 * just a flat bordered box with a label and a one-line body.
 */
function Perk({ title, body }: { title: string; body: string }) {
  return (
    <li className="bg-white border-[3px] border-black p-4 md:p-5">
      <h3 className="font-epilogue font-black uppercase text-sm md:text-base tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 text-sm md:text-[0.95rem] font-medium leading-snug text-gray-900">
        {body}
      </p>
    </li>
  );
}
