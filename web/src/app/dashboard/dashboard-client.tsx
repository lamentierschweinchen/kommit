"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/kommit/project-card";
import { WithdrawModal } from "@/components/kommit/withdraw-modal";
import { PointsDisplay } from "@/components/kommit/points-display";
import {
  getAllProjects,
  getCommitmentsForUser,
  getProjectBySlug,
  type Project,
} from "@/lib/mock-data";

const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const fmt = (n: number) => n.toLocaleString("en-US");

const MOCK_LIFETIME_POINTS = 47891;
const MOCK_LIFETIME_DOLLARS = 1250;
const MOCK_LIFETIME_TEAMS = 7;

export function DashboardClient() {
  const { ready, authenticated, login } = usePrivy();
  const [withdrawProject, setWithdrawProject] = useState<Project | null>(null);
  const [withdrawCommittedDollars, setWithdrawCommittedDollars] = useState(0);

  // PRIVY_CONFIGURED stays falsy in dev without env keys — render the dashboard
  // against mock data so design review can proceed without a Privy app ID.
  if (PRIVY_CONFIGURED && ready && !authenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-20 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Sign in to see your dashboard</h1>
        <p className="mt-3 text-muted-foreground">
          Your commitments, points, and yield routed all live behind your wallet.
        </p>
        <div className="mt-6">
          <Button onClick={() => login()}>Sign in</Button>
        </div>
      </div>
    );
  }

  const commitments = getCommitmentsForUser();
  const activeTotal = commitments.reduce((s, c) => s + c.amount, 0);
  const activePoints = commitments.reduce((s, c) => s + c.activePoints, 0);
  const teamCount = commitments.length;
  const discoverProjects = getAllProjects()
    .filter((p) => !commitments.some((c) => c.projectSlug === p.slug))
    .slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-12">
      <header>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Your commitments</h1>
        <p className="mt-2 text-muted-foreground">
          {commitments.length === 0
            ? "Nothing yet — browse projects to start."
            : `${teamCount} active team${teamCount === 1 ? "" : "s"}.`}
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Active
            </div>
            <div className="mt-2 text-4xl md:text-5xl font-medium tabular-nums">
              ${fmt(activeTotal)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              across {teamCount} team{teamCount === 1 ? "" : "s"}
            </div>
            <div className="mt-3">
              <PointsDisplay value={activePoints} label="active" size="sm" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Lifetime
            </div>
            <div className="mt-2 text-4xl md:text-5xl font-medium tabular-nums">
              ${fmt(MOCK_LIFETIME_DOLLARS)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              across {MOCK_LIFETIME_TEAMS} teams
            </div>
            <div className="mt-3">
              <PointsDisplay value={MOCK_LIFETIME_POINTS} label="lifetime" size="sm" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
          Active commitments
        </h2>
        {commitments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No commitments yet — browse projects to start.
              </p>
              <Button asChild className="mt-4">
                <Link href="/projects">Browse projects</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {commitments.map((c) => {
              const project = getProjectBySlug(c.projectSlug);
              if (!project) return null;
              const initials = c.team
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <li key={c.projectSlug}>
                  <Card>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
                      <Avatar className="size-12">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/projects/${c.projectSlug}`}
                          className="text-lg font-medium hover:text-primary transition-colors"
                        >
                          {c.team}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          ${fmt(c.amount)} committed · since {c.since} ·{" "}
                          <PointsDisplay value={c.activePoints} label="active" size="sm" />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          ${c.weeklyYield.toFixed(2)} yield routed this week
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setWithdrawProject(project);
                          setWithdrawCommittedDollars(c.amount);
                        }}
                      >
                        Withdraw
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {discoverProjects.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Teams you might support next
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {discoverProjects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </section>
      )}

      {withdrawProject && (
        <WithdrawModal
          project={withdrawProject}
          currentlyCommittedDollars={withdrawCommittedDollars}
          lifetimePoints={MOCK_LIFETIME_POINTS}
          open={!!withdrawProject}
          onOpenChange={(open) => {
            if (!open) setWithdrawProject(null);
          }}
        />
      )}
    </div>
  );
}

