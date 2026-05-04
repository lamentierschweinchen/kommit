/**
 * Browse-grid project card per design.md form-serves-function:
 * Reading order: project name (display) → pitch line → "by [team]" with team
 * avatar as a byline → trust stats. NO yield stat on discovery cards
 * (design.md: yield is "a forecast the platform can't substantiate cleanly
 * until the mechanism is locked"; lives on project detail + founder dashboard).
 */

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import type { Project } from "@/lib/mock-data";

const fmt = (n: number) => n.toLocaleString("en-US");

export function ProjectCard({ project }: { project: Project }) {
  const initials = project.team
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
    >
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl md:text-3xl font-medium tracking-tight leading-tight group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.pivoted && (
              <Badge variant="outline" className="shrink-0 text-xs">
                Pivoted
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.pitch}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2.5">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <span className="text-muted-foreground">by </span>
              <span className="font-medium">{project.team}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="grid grid-cols-3 gap-3 text-sm tabular-nums border-t pt-4">
          <div>
            <div className="text-xs text-muted-foreground">Committed</div>
            <div className="font-medium">${fmt(project.committed)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Supporters</div>
            <div className="font-medium">{project.supporters}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active since</div>
            <div className="font-medium">{project.since}</div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
