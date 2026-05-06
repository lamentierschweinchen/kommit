/**
 * Project-detail header per design.md wireframe.
 * Reading order: project name (display) → pitch → "by [team]" with avatar →
 * optional pivot line.
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/mock-data";

export function TeamHeader({ project }: { project: Project }) {
  const initials = project.team
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight">
          {project.name}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">{project.pitch}</p>
      </div>
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="text-sm">
          <span className="text-muted-foreground">by </span>
          <span className="font-medium">{project.team}</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <Badge variant="secondary">{project.sector}</Badge>
        <Badge variant="secondary">{project.stage}</Badge>
      </div>
      {project.pivoted && (
        <div className="text-sm text-muted-foreground border-l-2 border-foreground/40 pl-3 py-1">
          <span className="font-medium text-foreground">Pivoted</span> from {project.pivoted.from}{" "}
          on {project.pivoted.date}
        </div>
      )}
    </header>
  );
}
