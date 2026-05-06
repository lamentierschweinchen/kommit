"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import { BrutalInput } from "@/components/common/BrutalInput";
import { useToast } from "@/components/common/ToastProvider";

/**
 * Generic stub modal for "Change email" / "Change name" / "Add method" / "Connect external wallet".
 * One field, "submit" → confirmation toast.
 */
export function StubModal({
  open,
  onOpenChange,
  title,
  fieldLabel,
  fieldType = "text",
  submitLabel,
  successCopy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  fieldLabel: string;
  fieldType?: string;
  submitLabel: string;
  successCopy: string;
}) {
  const [value, setValue] = useState("");
  const { confirm } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onOpenChange(false);
    setValue("");
    setTimeout(() => confirm(successCopy), 220);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} shadow="default">
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="block font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest mb-2">
            {fieldLabel}
          </span>
          <BrutalInput
            type={fieldType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitLabel}
          <span className="material-symbols-outlined font-bold">arrow_forward</span>
        </button>
      </form>
    </Modal>
  );
}
