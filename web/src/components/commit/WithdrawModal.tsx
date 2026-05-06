"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { formatUSD } from "@/lib/kommit-math";
import { cn } from "@/lib/cn";

const PERCENT_PRESETS = [0.25, 0.5, 0.75, 1];

/**
 * Audit fix #13: replace [Max only] row with [25%] [50%] [75%] [Max] preset chips.
 * The custom-amount input stays — type any value.
 */
export function WithdrawModal({
  open,
  onOpenChange,
  projectName,
  committedUSD,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectName: string;
  committedUSD: number;
}) {
  const [raw, setRaw] = useState(String(Math.round(committedUSD * 0.25)));
  const { confirm } = useToast();

  useEffect(() => {
    if (open) setRaw(String(Math.round(committedUSD * 0.25)));
  }, [open, committedUSD]);

  const numeric = parseFloat(raw) || 0;
  const overMax = numeric > committedUSD;

  const handleSubmit = () => {
    if (overMax || numeric <= 0) return;
    onOpenChange(false);
    setTimeout(() => confirm("Withdraw confirmed."), 220);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Withdraw from ${projectName}`}
      shadow="default"
    >
      <div className="mt-6 bg-gray-100 border-[3px] border-black p-4">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          Currently committed
        </div>
        <div className="mt-1 font-epilogue font-black text-4xl md:text-5xl tracking-tighter">
          {formatUSD(committedUSD)}
        </div>
      </div>

      <div className="mt-6">
        <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Withdraw amount
        </label>
        <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
          <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full"
            aria-label="Withdraw amount"
          />
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {PERCENT_PRESETS.map((p) => {
            const value = Math.round(committedUSD * p);
            const isMax = p === 1;
            const isActive = numeric === value;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setRaw(String(value))}
                className={cn(
                  "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform",
                  isActive
                    ? "bg-primary text-white"
                    : isMax
                      ? "bg-black text-white"
                      : "bg-white text-black",
                )}
              >
                {isMax ? "Max" : `${Math.round(p * 100)}%`}
              </button>
            );
          })}
        </div>
        {overMax ? (
          <p className="mt-3 font-epilogue font-bold uppercase text-[11px] text-primary tracking-widest">
            Over your committed amount.
          </p>
        ) : null}
      </div>

      <div className="mt-5 bg-secondary border-[3px] border-black p-4 shadow-brutal">
        <p className="font-epilogue font-black uppercase text-xs leading-relaxed tracking-tight">
          Your lifetime kommits stay · Withdraw without penalty
        </p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={overMax || numeric <= 0}
          className="w-full bg-black text-white font-epilogue font-black uppercase tracking-tight text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(20,241,149,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          <span className="material-symbols-outlined font-bold rotate-180">arrow_forward</span>
          Withdraw {formatUSD(numeric)}
        </button>
      </div>
    </Modal>
  );
}
