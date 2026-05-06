"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useKommitProgram } from "@/lib/anchor-client";
import { withdrawFromProject } from "@/lib/tx";
import type { Project } from "@/lib/mock-data";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function WithdrawModal({
  project,
  currentlyCommittedDollars,
  lifetimePoints,
  open,
  onOpenChange,
}: {
  project: Project;
  currentlyCommittedDollars: number;
  lifetimePoints: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useKommitProgram();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const numeric = Number(amount) || 0;
  const isFull = numeric >= currentlyCommittedDollars;
  const canSubmit = !busy && numeric > 0 && numeric <= currentlyCommittedDollars && !!client;

  async function handleWithdraw() {
    if (!client) {
      toast.error("Wallet not connected");
      return;
    }
    setBusy(true);
    try {
      const res = await withdrawFromProject(
        client,
        new PublicKey(project.recipientWallet),
        numeric
      );
      toast.success(`Withdrew $${fmt(numeric)} from ${project.team}`, {
        description: res.signature.slice(0, 16) + "…",
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Withdraw failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw from {project.team}</DialogTitle>
          <DialogDescription>
            Currently committed:{" "}
            <span className="font-medium text-foreground tabular-nums">
              ${fmt(currentlyCommittedDollars)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  className="pl-7 text-lg tabular-nums"
                  placeholder="0.00"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setAmount(String(currentlyCommittedDollars))}
              >
                Full
              </Button>
            </div>
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>
              Your lifetime score is preserved (
              <span className="font-medium text-foreground tabular-nums">
                {lifetimePoints.toLocaleString("en-US")} pts
              </span>
              ). Active points {isFull ? "reset to 0" : "scale with the remaining commitment"}.
            </p>
            <p className="text-xs">Signs in your wallet.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleWithdraw} disabled={!canSubmit}>
            {busy ? "Withdrawing…" : `Withdraw $${amount || "0"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
