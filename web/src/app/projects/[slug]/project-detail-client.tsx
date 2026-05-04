"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TeamHeader } from "@/components/kommit/team-header";
import { CommitModal } from "@/components/kommit/commit-modal";
import { WithdrawModal } from "@/components/kommit/withdraw-modal";
import { YieldRoutedDisplay } from "@/components/kommit/yield-routed-display";
import { PointsDisplay } from "@/components/kommit/points-display";
import { getActivityForProject, type Project } from "@/lib/mock-data";

const fmt = (n: number) => n.toLocaleString("en-US");

// Mock — until indexer lands, the user's commitment for a given project comes
// from program.account.commitment.fetch(commitmentPda) using deriveCommitmentPda().
// Hard-code a representative commitment for the demo.
const MOCK_USER_COMMITMENT_DOLLARS = 50;
const MOCK_USER_LIFETIME_POINTS = 47891;
const MOCK_USER_ACTIVE_POINTS = 12430;

export function ProjectDetailClient({ project }: { project: Project }) {
  const [commitOpen, setCommitOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const activity = getActivityForProject();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <TeamHeader project={project} />

      <div className="mt-10 md:mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Pitch
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-foreground/90">
              {project.longPitch}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Founders
            </h2>
            <ul className="space-y-3">
              {project.founders.map((f) => (
                <li key={f.name} className="flex items-start gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">
                      {f.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {f.role} · {f.bio}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Updates
            </h2>
            {project.updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              <ul className="space-y-6">
                {project.updates.map((u, i) => (
                  <li key={i} className="border-l-2 pl-4 py-1 border-foreground/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{u.date}</span>
                      {u.pivot && <Badge variant="outline" className="text-xs">Pivot</Badge>}
                    </div>
                    <h3 className="mt-1 font-medium">{u.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{u.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Recent supporters
            </h2>
            <ul className="space-y-2 text-sm font-mono">
              {activity.map((a, i) => (
                <li key={i} className="flex items-baseline gap-4">
                  <span className="text-muted-foreground w-20 shrink-0">{a.when}</span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20">
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total committed</span>
                  <span className="font-medium tabular-nums">${fmt(project.committed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Supporters</span>
                  <span className="font-medium tabular-nums">{project.supporters}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active since</span>
                  <span className="font-medium">{project.since}</span>
                </div>
              </div>

              <Separator />

              <YieldRoutedDisplay amountUsd={project.weeklyYield} team={project.team} />

              <Separator />

              <div>
                <div className="text-sm text-muted-foreground mb-1">Your commitment</div>
                <div className="text-2xl font-medium tabular-nums">
                  ${fmt(MOCK_USER_COMMITMENT_DOLLARS)}{" "}
                  <span className="text-sm text-muted-foreground font-normal">active</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <PointsDisplay value={MOCK_USER_ACTIVE_POINTS} label="active" size="sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button onClick={() => setCommitOpen(true)} size="lg">
                  Commit
                </Button>
                <Button variant="outline" onClick={() => setWithdrawOpen(true)} size="lg">
                  Withdraw
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Withdraw anytime. Both sign in your wallet.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <CommitModal project={project} open={commitOpen} onOpenChange={setCommitOpen} />
      <WithdrawModal
        project={project}
        currentlyCommittedDollars={MOCK_USER_COMMITMENT_DOLLARS}
        lifetimePoints={MOCK_USER_LIFETIME_POINTS}
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
      />
    </div>
  );
}
