import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";
import { getActivityForProject, getProjectBySlug } from "@/lib/queries";
import { MOCK_PROJECTS } from "@/lib/mock-data";

export async function generateStaticParams() {
  // Static params still come from the seed list — slug → project mapping
  // is private-beta-stable. Indexer-driven discovery (post-IPFS metadata)
  // would dynamically expand this.
  return MOCK_PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
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
  const [project, activity] = await Promise.all([
    getProjectBySlug(slug),
    getActivityForProject(slug),
  ]);
  if (!project) notFound();
  return <ProjectDetailClient project={project} activity={activity} />;
}
