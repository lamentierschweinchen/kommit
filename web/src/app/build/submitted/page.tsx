import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Icon } from "@/components/common/Icon";

export default function BuildSubmittedPage() {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-2xl mx-auto w-full flex items-center">
        <section className="w-full pt-20 md:pt-28 relative">
          <div className="bg-white border-[3px] border-black shadow-brutal-lg p-10 md:p-14 -rotate-[0.3deg] relative">
            <div className="absolute -top-3 -right-3 w-20 h-6 bg-secondary rotate-12 border-[2px] border-black" />
            <h1 className="font-epilogue font-black uppercase text-5xl md:text-7xl tracking-tighter leading-[0.95]">
              Got it.
            </h1>
            <p className="mt-6 font-epilogue font-bold text-lg md:text-xl text-gray-800 leading-snug border-l-[4px] border-primary pl-5">
              We read everything. Response within a week.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/projects"
                className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-2"
              >
                Browse projects
                <Icon name="arrow_forward" className="font-bold" />
              </Link>
              <Link
                href="/about"
                className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center"
              >
                About Kommit
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
