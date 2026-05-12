import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Icon } from "@/components/common/Icon";

export default function NotFound() {
  return (
    <>
      <AuthHeader forcePublic />
      <main className="flex-1 px-6 md:px-12 flex items-center justify-center overflow-x-clip">
        {/* Audit fix #9: widen to max-w-3xl, push 404 to text-[16rem] on desktop */}
        <section className="max-w-3xl w-full mx-auto py-20 md:py-32">
          {/* Pass-2 P2 fix: tape decorations now anchor to the inner brutal
              card, not the outer section. Was clipping at viewport-top on
              shorter heights when the section's top edge hit the viewport. */}
          {/* Handoff 78 P0-6: the -rotate-[0.5deg] + shadow-brutal-lg combo
              pushes the card's right edge ~26px past the viewport on 375.
              Clip the parent main so the rotation/shadow doesn't trigger a
              horizontal page scroll (and drag the sticky nav with it). */}
          <div className="bg-white border-[3px] border-black shadow-brutal-lg p-12 md:p-20 -rotate-[0.5deg] relative">
            <div className="absolute -top-3 left-12 w-24 h-7 bg-primary -rotate-3 border-[2px] border-black hidden md:block" aria-hidden />
            <div className="absolute -bottom-3 -right-4 w-10 h-24 bg-secondary rotate-6 border-[2px] border-black hidden md:block" aria-hidden />
            <h1 className="font-epilogue font-black uppercase text-[10rem] md:text-[16rem] leading-[0.85] tracking-tighter">
              404.
            </h1>
            <p className="mt-8 font-epilogue font-bold text-xl md:text-2xl leading-snug text-gray-800 border-l-[4px] border-primary pl-5 max-w-md">
              The page you&rsquo;re looking for isn&rsquo;t here.
            </p>
            <div className="mt-10">
              <Link
                href="/projects"
                className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base md:text-lg px-8 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg inline-flex items-center gap-3"
              >
                Browse projects
                <Icon name="arrow_forward" className="font-bold" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
