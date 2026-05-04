import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/kommit/project-card";
import { getAllProjects } from "@/lib/queries";

export const metadata = {
  title: "Projects — Kommit",
  description: "Teams accepting commitments on Kommit.",
};

export default async function ProjectsPage() {
  const projects = await getAllProjects();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">
          Teams accepting commitments
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Each is a current combination of team and idea. Back the combo; retain through pivots; let
          the chain remember.
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-lg space-y-3">
          <p className="text-muted-foreground">No projects yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to landing</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
