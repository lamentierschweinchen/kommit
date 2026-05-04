"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CommitterList } from "@/components/kommit/committer-list";
import type { Project, Supporter, YieldReceipt } from "@/lib/mock-data";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FounderClient({
  project,
  supporters,
  receipts,
}: {
  project: Project;
  supporters: Supporter[];
  receipts: YieldReceipt[];
}) {
  const [updateText, setUpdateText] = useState("");
  const [pivot, setPivot] = useState(false);

  // Mock — real values from program.account.project.fetch + harvest event log.
  // The total-received shape is in `project.cumulative_yield_routed` once we
  // pipe that through queries.ts; v1.5.
  const monthReceived = 42.18;
  const totalReceived = 187.34;

  function handlePost() {
    toast("Update posted", {
      description: pivot
        ? "Tagged as pivot. Persistence wires when the indexer lands."
        : "Persistence wires when the indexer lands.",
    });
    setUpdateText("");
    setPivot(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-12">
      <header>
        <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
          Founder dashboard
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight">
          {project.team}{" "}
          <span className="text-muted-foreground">— {project.name}</span>
        </h1>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        <StatCard label="Received this month" value={`$${fmt(monthReceived)}`} />
        <StatCard label="Total received" value={`$${fmt(totalReceived)}`} />
        <StatCard label="Supporters" value={String(project.supporters)} />
        <StatCard
          label="Total committed"
          value={`$${project.committed.toLocaleString("en-US")}`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Post an update
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            <textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              rows={5}
              placeholder="What did you ship this week? What did you learn?"
              className="w-full bg-transparent outline-none resize-none placeholder:text-muted-foreground text-base leading-relaxed"
            />
            <Separator />
            <div className="flex items-center justify-between gap-4">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={pivot}
                  onChange={(e) => setPivot(e.target.checked)}
                  className="accent-primary"
                />
                Tag as pivot
              </Label>
              <Button onClick={handlePost} disabled={updateText.trim().length === 0}>
                Post update
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Posts are stored off-chain (Supabase) — engineer&rsquo;s track. UI ships now; persistence
          wires when the indexer lands.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Supporters
        </h2>
        <CommitterList supporters={supporters} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Yield receipts
        </h2>
        {receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
            No receipts yet. The first weekly harvest produces the first receipt.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-6">Tx</div>
            </div>
            <ul>
              {receipts.map((r, i) => (
                <li
                  key={i}
                  className={`grid grid-cols-12 px-4 py-3 text-sm tabular-nums ${
                    i < receipts.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="col-span-3 text-muted-foreground">{r.date}</div>
                  <div className="col-span-3">${fmt(r.amount)}</div>
                  <div className="col-span-6 font-mono text-xs text-muted-foreground truncate">
                    {r.tx}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="mt-2 text-2xl md:text-3xl font-medium tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
