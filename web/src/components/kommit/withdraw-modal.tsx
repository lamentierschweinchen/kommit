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
import {
  parseTokenAmount,
  formatTokenAmountFixed,
  formatPoints,
  validateAmount,
} from "@/lib/money";
import type { Project } from "@/lib/mock-data";

const USDC_DECIMALS = 6;

export function WithdrawModal({
  project,
  currentlyCommittedDollars,
  lifetimePoints,
  open,
  onOpenChange,
}: {
  project: Project;
  /** Display-side cap on withdraw — accepts a number (mock) or bigint (live u64 base units). */
  currentlyCommittedDollars: number | bigint;
  /** Lifetime score — number (mock) or bigint (live u128). */
  lifetimePoints: number | bigint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useKommitProgram();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  // Cap normalization. If currentlyCommittedDollars is a bigint, treat as
  // base units. If a number, parse `String(n)` → base units. Number values
  // at private-beta scales are exact; bigint is exact at any scale.
  const capBaseUnits: bigint = (() => {
    if (typeof currentlyCommittedDollars === "bigint") return currentlyCommittedDollars;
    try {
      return parseTokenAmount(String(currentlyCommittedDollars), USDC_DECIMALS);
    } catch {
      return 0n;
    }
  })();
  const capDisplay = formatTokenAmountFixed(capBaseUnits, USDC_DECIMALS, 2, 2);

  const validationError = validateAmount(amount, USDC_DECIMALS, capBaseUnits);

  // Determine "is full withdrawal" via bigint comparison — exact past 2^53.
  const isFull = (() => {
    if (validationError || amount.trim().length === 0) return false;
    try {
      return parseTokenAmount(amount, USDC_DECIMALS) >= capBaseUnits;
    } catch {
      return false;
    }
  })();

  const canSubmit = !busy && !validationError && !!client;

  async function handleWithdraw() {
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
      const res = await withdrawFromProject(
        client,
        new PublicKey(project.recipientWallet),
        amount.trim()
      );
      toast.success(`Withdrew $${amount.trim()} from ${project.team}`, {
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
            <span className="font-medium text-foreground tabular-nums">${capDisplay}</span>
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
                  className={`pl-7 text-lg tabular-nums ${
                    validationError ? "border-destructive focus-visible:ring-destructive/30" : ""
                  }`}
                  placeholder="0.00"
                  aria-invalid={!!validationError}
                  aria-describedby={validationError ? "withdraw-amount-error" : undefined}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setAmount(formatTokenAmountFixed(capBaseUnits, USDC_DECIMALS, 2, USDC_DECIMALS))}
              >
                Full
              </Button>
            </div>
            {validationError && (
              <p id="withdraw-amount-error" className="text-xs text-destructive">
                {validationError}
              </p>
            )}
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground space-y-1.5">
            <p>
              Your lifetime score is preserved (
              <span className="font-medium text-foreground tabular-nums">
                {formatPoints(lifetimePoints)} pts
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
            {busy ? "Withdrawing…" : `Withdraw $${amount.trim() || "0"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
