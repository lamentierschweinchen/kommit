"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/Modal";
import { Icon } from "@/components/common/Icon";
import type { Project } from "@/lib/data/projects";

/**
 * Two-path chooser surfaced when a kommitter hits "Kommit more" in
 * visa-mode contexts. Lets them either kommit from their on-chain
 * balance (existing simulateCommit flow) or add fresh funds via card
 * (visa-demo flow). Without this, the dashboard's "Kommit more" button
 * silently hopped to /visa-demo any time visa-mode was active — even for
 * the demo persona that has plenty of balance available.
 */
export function CommitChooserModal({
  open,
  onOpenChange,
  project,
  onChooseBalance,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
  /** Fired when the user picks "Kommit from balance" — caller opens the
   *  standard <CommitModal>. */
  onChooseBalance: () => void;
}) {
  const router = useRouter();
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Kommit to ${project.name}`}>
      <p className="mt-3 text-sm font-medium text-gray-700 leading-relaxed">
        Pick how you want to add to your kommit.
      </p>
      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            onChooseBalance();
          }}
          className="w-full flex items-center gap-4 bg-white text-black border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform p-4 text-left"
        >
          <span className="shrink-0 w-10 h-10 bg-primary text-white border-[2px] border-black flex items-center justify-center">
            <Icon name="account_balance_wallet" size="sm" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-epilogue font-black uppercase text-base tracking-tight">
              Kommit from balance
            </span>
            <span className="block mt-0.5 text-sm font-medium text-gray-600">
              Use the funds already in your wallet.
            </span>
          </span>
          <Icon name="arrow_forward" size="sm" className="shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            router.push(`/visa-demo?project=${project.slug}`);
          }}
          className="w-full flex items-center gap-4 bg-white text-black border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform p-4 text-left"
        >
          <span className="shrink-0 w-10 h-10 bg-secondary text-black border-[2px] border-black flex items-center justify-center">
            <Icon name="payments" size="sm" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-epilogue font-black uppercase text-base tracking-tight">
              Add via card
            </span>
            <span className="block mt-0.5 text-sm font-medium text-gray-600">
              Top up first, then kommit. Settles onchain.
            </span>
          </span>
          <Icon name="arrow_outward" size="sm" className="shrink-0" />
        </button>
      </div>
    </Modal>
  );
}
