"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/date-utils";
import type { RemoteComment } from "@/lib/api-types";

const MAX_COMMENT_LEN = 2000;

export function UpdateComments({
  updateId,
  isFounder,
  canComment,
  disabledReason,
}: {
  updateId: string;
  /** Founder soft-mod button is placeholder-only — wire visible, alert "v1". */
  isFounder?: boolean;
  canComment: boolean;
  disabledReason?: string;
}) {
  const { user } = useAuth();
  const { error, confirm } = useToast();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<RemoteComment[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || loaded || loading) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/updates/${updateId}/comments`)
      .then((r) => r.json())
      .then((j: { comments?: RemoteComment[] }) => {
        if (cancelled) return;
        setComments(j.comments ?? []);
        setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) error("Couldn't load comments", e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, loaded, loading, updateId, error]);

  async function submit() {
    if (!canComment || submitting || !body.trim()) return;
    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/updates/${updateId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
        mockWallet: user?.wallet ?? null,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const msg =
          payload?.error === "not-a-kommitter-of-this-project"
            ? "Only kommitters of this project can comment."
            : payload?.detail ?? payload?.error ?? `HTTP ${res.status}`;
        error("Comment failed", String(msg));
        return;
      }
      const json = (await res.json()) as { comment: RemoteComment };
      setComments((cur) => [...cur, json.comment]);
      setBody("");
    } catch (e) {
      error("Network error", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const count = comments.length;
  const label = open
    ? `Hide comments${count ? ` (${count})` : ""}`
    : count
      ? `View ${count} comment${count === 1 ? "" : "s"}`
      : "Add a comment";

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-700 hover:text-black"
      >
        <Icon name="expand_more" size="sm" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        {label}
      </button>

      {open ? (
        <div className="mt-3 border-t-[2px] border-black pt-3 space-y-3">
          {loading ? (
            <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
              Loading…
            </div>
          ) : null}
          {!loading && comments.length === 0 ? (
            <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
              No comments yet.
            </div>
          ) : null}
          <ul className="space-y-3">
            {comments.map((c) => (
              <li
                key={c.id}
                className="bg-gray-50 border-[2px] border-black p-3"
              >
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-epilogue font-bold uppercase tracking-widest text-gray-500">
                  <span className="font-black text-black">{shortWallet(c.author_wallet)}</span>
                  <span>·</span>
                  <span>{relativeTime(c.posted_at.slice(0, 10))}</span>
                  {isFounder ? (
                    <button
                      type="button"
                      onClick={() => confirm("Hide-comment moderation ships in v1.")}
                      className="ml-auto inline-flex items-center gap-1 hover:text-black"
                    >
                      <Icon name="visibility" size="xs" />
                      Hide
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line break-words">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>

          <div className="pt-2">
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_COMMENT_LEN))}
              placeholder={canComment ? "Add a comment…" : disabledReason ?? "Kommit to comment."}
              disabled={!canComment || submitting}
              className={cn(
                "w-full bg-white border-[3px] border-black p-3 font-medium text-sm leading-relaxed focus:outline-none focus:shadow-brutal",
                !canComment && "bg-gray-100 cursor-not-allowed opacity-70",
              )}
            />
            <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
              <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                {body.length} / {MAX_COMMENT_LEN}
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={!canComment || submitting || !body.trim()}
                className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? "Posting…" : "Post comment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shortWallet(addr: string): string {
  if (!addr) return "—";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
