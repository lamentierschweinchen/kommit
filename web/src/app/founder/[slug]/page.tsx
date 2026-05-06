import { notFound } from "next/navigation";
import { FounderDashboardClient } from "./FounderDashboardClient";
import { getProject } from "@/lib/data/projects";

export default async function FounderDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return <FounderDashboardClient project={project} />;
}
