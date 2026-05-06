"use client";

import { useState, type FormEvent } from "react";
import { BrutalTextarea } from "@/components/common/BrutalInput";
import { useToast } from "@/components/common/ToastProvider";
import * as Checkbox from "@radix-ui/react-checkbox";
import { cn } from "@/lib/cn";

export type PendingUpdate = {
  atISO: string;
  title: string;
  body: string;
  isPivot: boolean;
};

/** Per Codex M6 — explicit length cap before this becomes a real on-chain
 * write. Roughly two short paragraphs; matches what `admin_update_project_metadata`
 * will accept once Pass 3+ wires the founder→admin queue. */
const MAX_UPDATE_LENGTH = 2000;

export function PostUpdateEditor({
  onPosted,
}: {
  onPosted: (u: PendingUpdate) => void;
}) {
  const [body, setBody] = useState("");
  const [isPivot, setIsPivot] = useState(false);
  const { confirm } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const firstLine = body.split("\n")[0].slice(0, 120);
    const restLines = body.split("\n").slice(1).join("\n").trim();
    const update: PendingUpdate = {
      atISO: new Date().toISOString().slice(0, 10),
      title: firstLine || body.slice(0, 80),
      body: restLines || body,
      isPivot,
    };
    onPosted(update);
    setBody("");
    setIsPivot(false);
    confirm("Update posted.");
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      <BrutalTextarea
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_UPDATE_LENGTH))}
        placeholder="What's new?"
        maxLength={MAX_UPDATE_LENGTH}
      />
      <div className="mt-2 font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest text-right">
        {body.length} / {MAX_UPDATE_LENGTH}
      </div>
      <div className="mt-5 flex items-center justify-between flex-wrap gap-4">
        <label className="inline-flex items-center gap-3 cursor-pointer relative">
          <Checkbox.Root
            checked={isPivot}
            onCheckedChange={(v) => setIsPivot(v === true)}
            className={cn(
              "w-6 h-6 border-[3px] border-black flex items-center justify-center shrink-0 transition-colors",
              isPivot ? "bg-secondary" : "bg-white",
            )}
            aria-label="Tag as pivot"
          >
            <Checkbox.Indicator>
              <span className="material-symbols-outlined text-lg filled">check</span>
            </Checkbox.Indicator>
          </Checkbox.Root>
          <span className="font-epilogue font-bold uppercase text-xs tracking-widest">
            Tag as pivot
          </span>
          <span className="font-epilogue font-medium text-xs text-gray-500 normal-case tracking-normal hidden sm:inline">
            — banner on the public page · alerts existing kommitters
          </span>
        </label>
        <button
          type="submit"
          disabled={!body.trim()}
          className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-7 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          Post
          <span className="material-symbols-outlined font-bold">arrow_forward</span>
        </button>
      </div>
    </form>
  );
}
