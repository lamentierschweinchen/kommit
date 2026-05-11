import { notFound } from "next/navigation";
import { FounderCohortClient } from "./FounderCohortClient";
import { getProject } from "@/lib/data/projects";

export default async function FounderCohortPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  return <FounderCohortClient project={project} />;
}
