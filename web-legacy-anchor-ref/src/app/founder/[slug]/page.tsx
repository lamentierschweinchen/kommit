import { notFound } from "next/navigation";
import { FounderClient } from "./founder-client";
import {
  getProjectBySlug,
  getSupportersForProject,
  getYieldReceiptsForProject,
} from "@/lib/queries";
import { MOCK_PROJECTS } from "@/lib/mock-data";

export async function generateStaticParams() {
  return MOCK_PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) return { title: "Founder — Kommit" };
  return { title: `${project.team} — Founder — Kommit` };
}

export default async function FounderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, supporters, receipts] = await Promise.all([
    getProjectBySlug(slug),
    getSupportersForProject(slug),
    getYieldReceiptsForProject(slug),
  ]);
  if (!project) notFound();
  return <FounderClient project={project} supporters={supporters} receipts={receipts} />;
}
