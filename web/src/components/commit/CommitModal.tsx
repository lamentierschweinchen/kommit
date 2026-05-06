"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { avatarUrl } from "@/lib/data/users";
import { formatUSD } from "@/lib/kommit-math";
import { cn } from "@/lib/cn";
import type { Project } from "@/lib/data/projects";

const QUICK_AMOUNTS = [50, 100, 500];
const MAX_AMOUNT = 5000;

export function CommitModal({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
}) {
  const [raw, setRaw] = useState("100.00");
  const { confirm } = useToast();

  useEffect(() => {
    if (open) setRaw("100.00");
  }, [open]);

  const numeric = parseFloat(raw) || 0;

  const handleSubmit = () => {
    onOpenChange(false);
    setTimeout(() => confirm("Kommit confirmed."), 220);
  };

  const founder = project.founders[0];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Kommit to ${project.name}`}
    >
      <div className="mt-3 inline-flex items-center gap-2.5 bg-gray-100 px-3 py-1.5 border-[2px] border-black shadow-brutal-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(founder.avatarSeed, 60)}
          alt=""
          className="w-6 h-6 border-[2px] border-black object-cover grayscale"
        />
        <span className="font-epilogue font-black uppercase text-xs tracking-tight">
          By {founder.name}
        </span>
      </div>

      <div className="mt-6">
        <label className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
          Amount
        </label>
        <div className="flex items-stretch border-[3px] border-black bg-white shadow-brutal focus-within:translate-x-[-2px] focus-within:translate-y-[-2px] focus-within:shadow-[6px_6px_0px_0px_rgba(153,69,255,1)] transition-all">
          <span className="px-4 flex items-center font-epilogue font-black text-3xl text-gray-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            className="flex-1 px-2 py-3 font-epilogue font-black text-3xl bg-transparent outline-none min-w-0 tracking-tight w-full"
            aria-label="Kommit amount"
          />
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {QUICK_AMOUNTS.map((a) => {
            const isActive = numeric === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setRaw(String(a))}
                className={cn(
                  "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform",
                  isActive ? "bg-primary text-white" : "bg-white text-black",
                )}
              >
                ${a}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setRaw(String(MAX_AMOUNT))}
            className={cn(
              "font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform",
              numeric === MAX_AMOUNT ? "bg-primary text-white" : "bg-black text-white",
            )}
          >
            Max
          </button>
        </div>
      </div>

      <div className="mt-5 bg-gray-100 border-[3px] border-black p-4 space-y-2">
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          What this does
        </div>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          The team sees a real backer. Your kommits build the longer you stay.
        </p>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          First access when they raise. Yours, even after you withdraw.
        </p>
      </div>

      <div className="mt-4 bg-secondary border-[3px] border-black p-4 shadow-brutal">
        <p className="font-epilogue font-black uppercase text-xs leading-relaxed tracking-tight">
          Withdraw anytime · No fees · Kommits stay yours
        </p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={numeric <= 0}
          className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-lg py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          Kommit {formatUSD(numeric || 0)}
          <span className="material-symbols-outlined font-bold">arrow_forward</span>
        </button>
      </div>
    </Modal>
  );
}
