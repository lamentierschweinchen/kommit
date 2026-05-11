"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { YourCohortSection } from "@/components/founder/CohortSection";
import { Icon } from "@/components/common/Icon";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
import { formatUSD } from "@/lib/kommit-math";
import { shortDate } from "@/lib/date-utils";
import { walletDisplayName } from "@/lib/data/users";
import {
  DEMO_BACKER_NOTES_STORAGE_KEY,
  listBackerNotes,
  type BackerNote,
} from "@/lib/demo-engagement";
import type { Project } from "@/lib/data/projects";

export function FounderCohortClient({ project }: { project: Project }) {
  const projectPda = useMemo(() => {
    if (!project.recipientWallet) return null;
    try {
      return findProjectPda(new PublicKey(project.recipientWallet)).toBase58();
    } catch {
      return null;
    }
  }, [project.recipientWallet]);

  return (
    <>
      <AuthHeader homeHref="/app" />
      <div className="flex flex-1 relative">
        <Sidebar
          variant="founder"
          founderSlug={project.slug}
          founderKommittersCount={project.kommittersCount}
        />
        <main className="flex-1 lg:ml-64 pb-24 max-w-[calc(80rem-16rem)] w-full">
          <AuthGate
            requireOwnsProject={project.slug}
            anonHeadline="Sign in to manage your project."
            anonBody="The cohort panel — kommitter list, geographic distribution, retention — is the team's private view."
          >
            <div className="px-6 md:px-12">
              <section className="mt-12 md:mt-16">
                <Link
                  href={`/founder/${project.slug}`}
                  className="inline-flex items-center gap-1 font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500 hover:text-black mb-4"
                >
                  <Icon name="arrow_back" size="xs" />
                  Back to overview
                </Link>
                <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                  {project.name} cohort
                </h1>
                <p className="mt-5 max-w-2xl text-base font-medium text-gray-700 leading-relaxed">
                  The full kommitter breakdown — headline stats, geographic
                  distribution, growth curve, kommit-size shape, and the
                  per-kommitter list.
                </p>
              </section>

              <YourCohortSection project={project} projectPda={projectPda} />

              <BackerNotesSection projectSlug={project.slug} />
            </div>
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
  );
}

/**
 * Kommit notes — what kommitters wrote when they joined. Moved from the
 * founder overview page (handoff 69 B15) so it lives alongside the cohort
 * list, where it actually belongs.
 */
function BackerNotesSection({ projectSlug }: { projectSlug: string }) {
  const [notes, setNotes] = useState<BackerNote[]>([]);

  useEffect(() => {
    const refresh = () => setNotes(listBackerNotes(projectSlug));
    refresh();
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_BACKER_NOTES_STORAGE_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [projectSlug]);

  if (notes.length === 0) return null;

  return (
    <section
      id="kommit-notes"
      className="mt-20 pt-10 border-t-[8px] border-black"
    >
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          Kommit notes
        </h2>
      </div>
      <p className="mb-8 font-epilogue font-medium text-sm text-gray-600 max-w-xl">
        What your kommitters wrote when they joined. Use these to spot
        recurring asks, lurking skeptics, and the lines worth quoting in your
        next update.
      </p>
      <ul className="space-y-3">
        {notes.map((n, i) => (
          <li
            key={`${n.atISO}-${i}`}
            className="bg-white border-[3px] border-black shadow-brutal p-5"
          >
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="font-epilogue font-black uppercase text-sm tracking-tight">
                {n.authorName || walletDisplayName(n.wallet)}
              </span>
              <span className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                kommitted {formatUSD(n.principalUSD)}
              </span>
              <span className="font-epilogue font-bold uppercase text-[10px] text-gray-400 tracking-widest">
                · {shortDate(n.atISO.slice(0, 10))}
              </span>
            </div>
            <p className="text-base font-medium text-gray-800 leading-relaxed">
              &ldquo;{n.note}&rdquo;
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
