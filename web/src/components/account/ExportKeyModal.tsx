"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { Tape } from "@/components/common/Tape";

const MOCK_KEY =
  "5f3c8a2e9b1d4e6f7a8c9b0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0fabcde";

/**
 * Audit fix #11: destructive-as-black.
 * Cancel = primary purple (the SAFE action).
 * Show key = solid black with green-shadow accent (the careful one).
 *
 * Two states: warning (state 1) → reveal (state 2).
 */
export function ExportKeyModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const { confirm } = useToast();

  useEffect(() => {
    if (!open) setRevealed(false);
  }, [open]);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_KEY);
      confirm("Copied.");
    } catch {
      // Quietly ignore — clipboard requires user gesture in some contexts
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={revealed ? "Your private key" : "Export private key"}
      shadow="default"
      tapes={
        // Single black tape for destructive — audit #16 carve-out
        <Tape color="black" size="md" rotation={12} className="absolute -top-3 -right-3" />
      }
    >
      {!revealed ? (
        <>
          <div className="mt-5 bg-primary border-[3px] border-black w-14 h-14 flex items-center justify-center shadow-brutal-sm">
            <span className="material-symbols-outlined text-white text-3xl filled" aria-hidden>
              key
            </span>
          </div>

          <p className="mt-5 text-base md:text-lg font-medium text-gray-900 leading-relaxed border-l-[4px] border-primary pl-4">
            You&rsquo;re about to see your private key. Make sure no one&rsquo;s watching.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            {/* Cancel = primary (safe action) */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center"
            >
              Cancel
            </button>
            {/* Show key = black with green shadow (careful destructive) */}
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="bg-black text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(20,241,149,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[8px_8px_0px_0px_rgba(20,241,149,1)] flex items-center justify-center gap-2"
            >
              Show key
              <span className="material-symbols-outlined text-base">visibility</span>
            </button>
          </div>

          <p className="mt-5 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest text-center">
            State 1 of 2 · Pre-reveal warning
          </p>
        </>
      ) : (
        <>
          <p className="mt-5 text-sm font-medium text-gray-700 leading-relaxed">
            The master key to your wallet. Anyone with it can move your money — save it somewhere
            only you can access.
          </p>
          <div className="mt-5 bg-gray-100 border-[3px] border-black p-5 break-all font-mono text-sm">
            {MOCK_KEY}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={copyKey}
              className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
              Copy
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center"
            >
              Done
            </button>
          </div>
          <p className="mt-5 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest text-center">
            State 2 of 2 · Reveal
          </p>
        </>
      )}
    </Modal>
  );
}
