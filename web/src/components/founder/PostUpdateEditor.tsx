"use client";

import { useState, type FormEvent } from "react";
import { BrutalTextarea } from "@/components/common/BrutalInput";
import { useToast } from "@/components/common/ToastProvider";
import * as Checkbox from "@radix-ui/react-checkbox";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/common/Icon";
import { authedFetch } from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { RemoteUpdate } from "@/lib/api-types";

const MAX_UPDATE_LENGTH = 2000;

export function PostUpdateEditor({
  projectPda,
  onPosted,
}: {
  projectPda: string;
  onPosted: (u: RemoteUpdate) => void;
}) {
  const [body, setBody] = useState("");
  const [isPivot, setIsPivot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, error } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    const firstLine = body.split("\n")[0].slice(0, 120);
    const restLines = body.split("\n").slice(1).join("\n").trim();
    const title = firstLine || body.slice(0, 80);
    const messageBody = restLines || body;

    setSubmitting(true);
    try {
      const res = await authedFetch("/api/founder/updates", {
        method: "POST",
        body: JSON.stringify({
          project_pda: projectPda,
          title,
          body: messageBody,
          is_pivot: isPivot,
        }),
        mockWallet: user?.wallet ?? null,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const detail =
          payload?.error === "not-project-founder"
            ? "Only the project's recipient wallet can post updates."
            : payload?.detail ?? payload?.error ?? `HTTP ${res.status}`;
        error("Couldn't post update", String(detail));
        return;
      }
      const json = (await res.json()) as { update: RemoteUpdate };
      onPosted(json.update);
      setBody("");
      setIsPivot(false);
      confirm("Update posted.");
    } catch (e) {
      error("Network error", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
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
              <Icon name="check" size="md" />
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
          disabled={!body.trim() || submitting}
          className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-7 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? "Posting…" : "Post"}
          <Icon name="arrow_forward" className="font-bold" />
        </button>
      </div>
    </form>
  );
}
