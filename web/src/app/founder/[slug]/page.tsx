import { notFound } from "next/navigation";
import { FounderClient } from "./founder-client";
import { getAllProjects, getProjectBySlug } from "@/lib/mock-data";

export async function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Founder — Kommit" };
  return { title: `${project.team} — Founder — Kommit` };
}

export default async function FounderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  return <FounderClient project={project} />;
}
