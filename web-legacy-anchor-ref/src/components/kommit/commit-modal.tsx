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
import { commitToProject } from "@/lib/tx";
import {
  parseTokenAmount,
  formatTokenAmountFixed,
  validateAmount,
} from "@/lib/money";
import type { Project } from "@/lib/mock-data";

const KAMINO_USDC_APY = 0.052;
const USDC_DECIMALS = 6;

export function CommitModal({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useKommitProgram();
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  // Validate via the same parser tx.ts uses — surfaces the precise error.
  const validationError = validateAmount(amount, USDC_DECIMALS);

  // Weekly yield projection — derived from validated bigint base units, then
  // converted to a display number for the APY math. Bounded precision loss
  // at the display boundary; tx construction never hits this path.
  const weeklyYieldDisplay = (() => {
    if (validationError) return "0.00";
    try {
      const baseUnits = parseTokenAmount(amount, USDC_DECIMALS);
      const dollars = parseFloat(formatTokenAmountFixed(baseUnits, USDC_DECIMALS, 6, 6));
      const weekly = (dollars * KAMINO_USDC_APY) / 52;
      return weekly.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return "0.00";
    }
  })();

  const canSubmit = !busy && !validationError && !!client;

  async function handleCommit() {
    if (!client) {
      toast.error("Wallet not connected");
      return;
    }
    if (validationError) {
      toast.error("Invalid amount", { description: validationError });
      return;
    }
    setBusy(true);
    try {
      const res = await commitToProject(
        client,
        new PublicKey(project.recipientWallet),
        amount.trim()
      );
      toast.success(`Committed $${amount.trim()} to ${project.team}`, {
        description: res.signature.slice(0, 16) + "…",
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Commit failed", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit to {project.team}</DialogTitle>
          <DialogDescription>{project.name} — {project.pitch}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className={`pl-7 text-lg tabular-nums ${
                  validationError ? "border-destructive focus-visible:ring-destructive/30" : ""
                }`}
                placeholder="100"
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "commit-amount-error" : undefined}
              />
            </div>
            {validationError ? (
              <p id="commit-amount-error" className="text-xs text-destructive">
                {validationError}
              </p>
            ) : (
              <div className="text-xs text-muted-foreground">
                Yield routed to {project.team}: ~${weeklyYieldDisplay}/week at current Kamino USDC
                APY {(KAMINO_USDC_APY * 100).toFixed(1)}%.
              </div>
            )}
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>
              You can withdraw your principal anytime. No fees. Yield stops on withdrawal; points
              stay.
            </p>
            <p className="text-xs">Signs in your wallet.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={!canSubmit}>
            {busy ? "Committing…" : `Commit $${amount.trim() || "0"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
