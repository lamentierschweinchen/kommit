import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";
import { getAllProjects, getProjectBySlug } from "@/lib/mock-data";

export async function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Project not found — Kommit" };
  return {
    title: `${project.name} — Kommit`,
    description: project.pitch,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  return <ProjectDetailClient project={project} />;
}
