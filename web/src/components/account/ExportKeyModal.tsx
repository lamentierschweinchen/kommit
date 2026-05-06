"use client";

import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { Tape } from "@/components/common/Tape";
import { useExportWallet, useWallets } from "@privy-io/react-auth/solana";

/**
 * Export private key — wired to Privy's secure export UI.
 *
 * Pass 1 used a mock key string for the demo; that string was flagged by
 * Codex's gitleaks scan (handoff 33 finding H1) as private-key-shaped. Pass 2
 * replaces the entire reveal flow with Privy's `exportWallet` call, which
 * opens Privy's own audited modal showing the user's actual private key.
 *
 * Audit fix #11 still holds:
 * - Cancel = primary purple (the SAFE action)
 * - Show key = solid black with green-shadow accent (the careful one)
 * - Single black tape rotated top-right (audit #16 carve-out for destructive)
 */
export function ExportKeyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { exportWallet } = useExportWallet();
  const { wallets } = useWallets();
  const { error: toastError } = useToast();

  const handleShowKey = async () => {
    const wallet = wallets[0];
    if (!wallet) {
      toastError(
        "No wallet ready yet.",
        "Wait a moment for your Solana wallet to finish loading, then try again.",
      );
      return;
    }
    try {
      await exportWallet({ address: wallet.address });
    } catch (e) {
      // Privy's user-cancel is silent; only surface real errors.
      const message = e instanceof Error ? e.message : "Try again.";
      if (message.toLowerCase().includes("cancel")) return;
      toastError("Couldn't open export.", message);
    } finally {
      onOpenChange(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Export private key"
      shadow="default"
      tapes={
        <Tape color="black" size="md" rotation={12} className="absolute -top-3 -right-3" />
      }
    >
      <div className="mt-5 bg-primary border-[3px] border-black w-14 h-14 flex items-center justify-center shadow-brutal-sm">
        <span className="material-symbols-outlined text-white text-3xl filled" aria-hidden>
          key
        </span>
      </div>

      <p className="mt-5 text-base md:text-lg font-medium text-gray-900 leading-relaxed border-l-[4px] border-primary pl-4">
        You&rsquo;re about to see your private key. Make sure no one&rsquo;s watching.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleShowKey}
          className="bg-black text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(20,241,149,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[8px_8px_0px_0px_rgba(20,241,149,1)] flex items-center justify-center gap-2"
        >
          Show key
          <span className="material-symbols-outlined text-base">visibility</span>
        </button>
      </div>

      <p className="mt-5 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest text-center">
        Privy opens a secure window to show your key
      </p>
    </Modal>
  );
}
