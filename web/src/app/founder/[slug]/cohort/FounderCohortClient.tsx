"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { AuthGate } from "@/components/auth/AuthGate";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { YourCohortSection } from "@/components/founder/CohortSection";
import { Icon } from "@/components/common/Icon";
import { findProjectPda } from "@/lib/kommit";
import { PublicKey } from "@solana/web3.js";
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
            </div>
          </AuthGate>
        </main>
      </div>
      <Footer withSidebarOffset />
    </>
  );
}
