"use client";

import Link from "next/link";

export default function VisaDemoCancelPage() {
  return (
    <main className="min-h-screen bg-[#FFFCF5] flex flex-col">
      <header className="px-6 md:px-12 py-6 border-b-[3px] border-black bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/"
            className="font-epilogue font-black uppercase tracking-tighter text-xl"
          >
            kommit
          </Link>
          <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
            Sandbox · canceled
          </span>
        </div>
      </header>

      <section className="flex-1 px-6 md:px-12 py-12 md:py-24 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white border-[3px] border-black shadow-brutal-purple p-8 md:p-12 text-center">
          <h1 className="font-epilogue font-black uppercase text-3xl tracking-tighter mb-2">
            No payment taken.
          </h1>
          <p className="font-epilogue text-base text-gray-700 mb-6">
            You canceled before the card cleared. Nothing moved on-chain. Pick
            an amount and try again whenever you&rsquo;re ready.
          </p>
          <Link
            href="/visa-demo"
            className="inline-block bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
          >
            Back to demo
          </Link>
        </div>
      </section>

      <footer className="border-t-[3px] border-black bg-white px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-epilogue font-medium text-xs text-gray-600">
            Sandbox payment · no funds moved
          </span>
          <Link
            href="/"
            className="font-epilogue font-bold uppercase tracking-widest text-[10px] text-gray-500 hover:text-black"
          >
            ← Back to live product
          </Link>
        </div>
      </footer>
    </main>
  );
}
