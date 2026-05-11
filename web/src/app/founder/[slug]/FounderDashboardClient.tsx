"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { PostUpdateEditor } from "@/components/founder/PostUpdateEditor";
import { CompressedCohortStrip } from "@/components/founder/CohortSection";
import { formatUSD } from "@/lib/kommit-math";
import { shortDate, longDate } from "@/lib/date-utils";
import { walletDisplayName } from "@/lib/data/users";
import type { Project } from "@/lib/data/projects";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
import type { RemoteUpdate } from "@/lib/api-types";
import {
  DEMO_BACKER_NOTES_STORAGE_KEY,
  listBackerNotes,
  type BackerNote,
} from "@/lib/demo-engagement";

export function FounderDashboardClient({ project }: { project: Project }) {
  const [postedUpdates, setPostedUpdates] = useState<RemoteUpdate[]>([]);

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
            anonBody="The founder console — kommitters, post-update editor, cohort numbers — is the team's private view."
          >
            <div className="px-6 md:px-12">
              <section id="overview" className="mt-12 md:mt-16">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
                    {project.sector}
                  </span>
                  <Link
                    href={`/projects/${project.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest hover:text-black"
                  >
                    View public page <Icon name="arrow_outward" size="xs" />
                  </Link>
                </div>
                <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                  {project.name}
                </h1>
                <p className="mt-5 max-w-xl text-base font-medium text-gray-700 leading-relaxed">
                  {project.pitch}
                </p>
              </section>

              <CompressedCohortStrip project={project} />

              <section
                id="post-update"
                className="mt-20 pt-10 border-t-[8px] border-black"
              >
                <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
                  Post an update
                </h2>
                {projectPda ? (
                  <PostUpdateEditor
                    projectPda={projectPda}
                    onPosted={(u) =>
                      setPostedUpdates((cur) => [u, ...cur])
                    }
                  />
                ) : (
                  <div className="bg-white border-[3px] border-black shadow-brutal p-6 max-w-3xl">
                    <p className="font-epilogue font-bold uppercase text-sm tracking-tight">
                      This project isn&rsquo;t open for kommitments yet —
                      posting is disabled until the onchain account exists.
                    </p>
                  </div>
                )}

                {postedUpdates.length > 0 ? (
                  <div className="mt-8 max-w-3xl">
                    <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-3">
                      Just posted
                    </div>
                    <ul className="space-y-3">
                      {postedUpdates.map((u) => (
                        <li
                          key={u.id}
                          className={cn(
                            "bg-white border-[3px] border-black p-4",
                            u.is_pivot ? "shadow-brutal-purple" : "shadow-brutal",
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                              {longDate(u.posted_at.slice(0, 10))}
                            </span>
                            {u.is_pivot ? (
                              <span className="bg-primary text-white px-2 py-0.5 border-[2px] border-black uppercase text-[9px] font-epilogue font-black tracking-widest">
                                Pivot
                              </span>
                            ) : null}
                          </div>
                          <div className="font-epilogue font-black uppercase text-base tracking-tight">
                            {u.title}
                          </div>
                          {u.body && u.body !== u.title ? (
                            <p className="mt-1 text-sm font-medium text-gray-700">
                              {u.body}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <BackerNotesSection projectSlug={project.slug} />

              <ComingV1Section />
            </div>
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
  );
}

/**
 * "Backer notes" — listings of kommitters who attached a note to their
 * commit. Pulls from the demo-engagement store (matches `BackerNotes`
 * on the public project detail page). Hidden when there's nothing to
 * show so a fresh project doesn't grow an empty section.
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
      id="backer-notes"
      className="mt-20 pt-10 border-t-[8px] border-black"
    >
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          Backer notes
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

function ComingV1Section() {
  const tiles: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "mail",
      title: "Send a private update",
      body: "Backers-only post, separate from the public timeline. Use it for unannounced ships, internal numbers, or hard asks.",
    },
    {
      icon: "workspace_premium",
      title: "Reward top kommitters",
      body: "Allocate priority access slots manually before a raise — beta seats, founder calls, early swag.",
    },
    {
      icon: "payments",
      title: "Open a raise to your cohort",
      body: "Token sale, equity round, or SAFE — opened first to your kommitters, ranked by kommits.",
    },
    {
      icon: "groups",
      title: "Run a cohort poll",
      body: "Decision input straight from your backers. Pricing, feature direction, naming — whatever benefits from a vote.",
    },
  ];
  return (
    <section
      id="coming-v1"
      className="mt-20 pt-10 border-t-[8px] border-black"
    >
      <div className="flex items-end justify-between flex-wrap gap-4 mb-2">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          On the runway
        </h2>
      </div>
      <p className="mb-8 font-epilogue font-medium text-sm text-gray-600 max-w-xl">
        What you&rsquo;ll be able to do with your kommitters as Kommit ships
        v1. Not live yet — these are the surfaces on the runway.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {tiles.map((t, i) => (
          <article
            key={i}
            className="bg-white border-[3px] border-black p-5 md:p-6 relative opacity-90"
          >
            <div className="absolute top-4 right-4 inline-block bg-secondary text-black font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black shadow-brutal-sm">
              Coming v1
            </div>
            <Icon name={t.icon} size="lg" className="text-gray-700" />
            <div className="mt-3 font-epilogue font-black uppercase text-lg tracking-tight">
              {t.title}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-700 leading-relaxed pr-20">
              {t.body}
            </p>
            <button
              type="button"
              disabled
              className="mt-5 bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-gray-300 flex items-center gap-2 cursor-not-allowed opacity-50"
            >
              Not yet
              <Icon name="arrow_forward" size="xs" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
