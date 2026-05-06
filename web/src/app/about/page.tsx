import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-32">
        {/* Decluttered per Lukas review 2026-05-06: dropped both floating tapes
            and the H1 + conviction-pill rotations. Single intentional rotation
            stays on the resolution box at the close. */}
        <section className="max-w-4xl mx-auto pt-20 md:pt-28 pb-16 md:pb-20">
          <div className="space-y-8 md:space-y-10">
            <h1 className="font-epilogue font-black uppercase text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-[0.95]">
              Kommit turns{" "}
              <span className="inline-block bg-black text-white px-3 py-1 mt-2 border-[3px] border-black shadow-brutal-purple">
                conviction
              </span>{" "}
              into currency.
            </h1>
            <p className="font-epilogue font-bold text-2xl md:text-3xl tracking-tight leading-tight text-gray-800 border-l-[6px] border-primary pl-5 max-w-2xl">
              Support early-stage ideas, teams, and projects.
            </p>
          </div>
        </section>

        <section className="max-w-2xl mx-auto py-10 md:py-14">
          <p className="text-xl md:text-2xl font-medium leading-relaxed text-gray-900">
            You back a project with real money. Your money stays yours; withdraw anytime. The longer
            you stay, the more kommits you earn —{" "}
            <span className="font-black text-primary">conviction, made&nbsp;measurable</span>.
          </p>
        </section>

        <section className="max-w-2xl mx-auto py-10 md:py-14">
          <div className="bg-gray-100 border-[3px] border-black shadow-brutal p-7 md:p-9 relative">
            <div className="absolute -top-4 left-8 bg-white border-[3px] border-black px-3 py-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-epilogue font-black uppercase text-[11px] tracking-widest">
              What kommits get you
            </div>
            <p className="text-lg md:text-xl font-medium leading-relaxed text-gray-900 mt-3">
              Early-access perks, beta seats, kommitter discounts. A preferred rate if the team
              launches a product. First dibs at the round if they raise. And a record that travels
              with you across every project you back.
            </p>
          </div>
        </section>

        <section className="max-w-2xl mx-auto py-10 md:py-14">
          <p className="font-epilogue font-bold text-xl md:text-2xl leading-snug text-gray-500 italic">
            To be early, you used to need to be rich, lucky, or willing to lose your&nbsp;money.
          </p>
        </section>

        <section className="max-w-4xl mx-auto pt-10 md:pt-16">
          <div className="bg-secondary border-[3px] border-black shadow-brutal-lg p-8 md:p-12">
            <div className="font-epilogue font-black uppercase text-[11px] tracking-widest mb-4">
              The fourth way
            </div>
            <p className="font-epilogue font-black uppercase text-3xl md:text-4xl lg:text-5xl tracking-tighter leading-[1.05]">
              Kommit is the fourth way: back early, keep your money, and get rewarded when the
              project reaches the next&nbsp;stage.
            </p>
          </div>
        </section>

        <section className="max-w-2xl mx-auto pt-20 md:pt-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/projects"
              className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base px-6 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg flex items-center justify-center gap-3"
            >
              Browse projects
              <span className="material-symbols-outlined font-bold">arrow_forward</span>
            </Link>
            <Link
              href="/build"
              className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base px-6 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg flex items-center justify-center gap-3"
            >
              Build something
              <span className="material-symbols-outlined font-bold">arrow_outward</span>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
