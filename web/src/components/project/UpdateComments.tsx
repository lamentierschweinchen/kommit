"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { DEMO_ENGAGEMENT_SEEDED_KEY } from "@/lib/demo-engagement";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import { SignInModal } from "@/components/auth/SignInModal";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/date-utils";
import { walletDisplayName } from "@/lib/data/users";
import type { RemoteComment } from "@/lib/api-types";

const MAX_COMMENT_LEN = 2000;

export function UpdateComments({
  updateId,
  isFounder,
  canComment,
  disabledReason,
  staticHint,
}: {
  updateId: string;
  /** Founder soft-mod button is placeholder-only — wire visible, alert "v1". */
  isFounder?: boolean;
  canComment: boolean;
  disabledReason?: string;
  /** Static catalog hint (handoff 65 B1). When the update is a `SeedUpdateRow`
   *  whose row isn't yet in Supabase, this lets the real-Privy comment route
   *  lazy-upsert the parent update before inserting the comment. Demo mode
   *  ignores it (demoFetch matches on path, not query). */
  staticHint?: { slug: string; atISO: string };
}) {
  const { user, isSignedIn } = useAuth();
  const { error, confirm } = useToast();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<RemoteComment[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  // Eager-load the comment count on mount so the toggle label reads
  // "View 6 comments" on first paint instead of the default "Add a
  // comment" (which hid seeded comments — pivot updates had 6 visible
  // engagement signals that judges scrolling past would miss).
  // `loaded` still prevents re-fetch after the first run, so subsequent
  // open/close toggles don't re-hit the API.
  const hintQS = staticHint
    ? `?slug=${encodeURIComponent(staticHint.slug)}&atISO=${encodeURIComponent(staticHint.atISO)}`
    : "";

  useEffect(() => {
    if (loaded || loading) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/updates/${updateId}/comments`)
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

  // Handoff 65 B3: in demo mode, UpdateComments commonly mounts before the
  // demo cohort seed has written its pivot/graduation comments to
  // localStorage. The eager fetch above races the seed and locks `loaded`
  // to an empty result. Re-fetch when the seed marker flips so the 6
  // seeded comments on the Quire pivot become visible on first paint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DEMO_ENGAGEMENT_SEEDED_KEY) return;
      let cancelled = false;
      authedFetch(`/api/updates/${updateId}/comments`)
        .then((r) => r.json())
        .then((j: { comments?: RemoteComment[] }) => {
          if (!cancelled) setComments(j.comments ?? []);
        })
        .catch(() => {
          /* non-fatal — eager fetch already populated state */
        });
      return () => {
        cancelled = true;
      };
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [updateId]);

  async function submit() {
    if (submitting || !body.trim()) return;
    if (!isSignedIn) {
      setSignInOpen(true);
      return;
    }
    if (!canComment) return;
    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/updates/${updateId}/comments${hintQS}`, {
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
                  <span className="font-black text-black">{walletDisplayName(c.author_wallet)}</span>
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
              placeholder={
                !isSignedIn
                  ? "Sign in to comment."
                  : canComment
                    ? "Add a comment…"
                    : disabledReason ?? "Kommit to comment."
              }
              onFocus={() => {
                if (!isSignedIn) setSignInOpen(true);
              }}
              disabled={isSignedIn && (!canComment || submitting)}
              className={cn(
                "w-full bg-white border-[3px] border-black p-3 font-medium text-sm leading-relaxed focus:outline-none focus:shadow-brutal",
                isSignedIn && !canComment && "bg-gray-100 cursor-not-allowed opacity-70",
              )}
            />
            <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
              <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
                {body.length} / {MAX_COMMENT_LEN}
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={
                  isSignedIn ? !canComment || submitting || !body.trim() : false
                }
                className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-xs px-4 py-2 border-[3px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform disabled:opacity-50 disabled:pointer-events-none"
              >
                {!isSignedIn
                  ? "Sign in to comment"
                  : submitting
                    ? "Posting…"
                    : "Post comment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}
