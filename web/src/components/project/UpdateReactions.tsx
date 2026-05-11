"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { authedFetch } from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { SignInModal } from "@/components/auth/SignInModal";
import { REACTION_TOKENS, type ReactionToken } from "@/lib/api-types";

const TOKEN_LABEL: Record<ReactionToken, string> = {
  "+1": "+1",
  fire: "FIRE",
  heart: "LOVE",
  hmm: "HMM?",
};

/**
 * Visuals — brutalist, hand-cut, deliberately not system emoji. v0.5
 * placeholders: chunky inline SVG / oversized glyph. Designer pass refines
 * later, but already breaks the "AI emoji row" pattern.
 */
function TokenGlyph({ token, active }: { token: ReactionToken; active: boolean }) {
  const stroke = active ? "white" : "black";
  switch (token) {
    case "+1":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
          <polygon
            points="12,3 21,20 3,20"
            fill={active ? "white" : "black"}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "fire":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
          <path
            d="M12 3 C 14 7, 9 9, 11 13 C 6 11, 5 17, 8 20 C 5 20, 4 14, 8 10 C 10 13, 9 8, 12 3 Z M 14 12 C 17 14, 18 19, 14 21 C 17 18, 14 16, 14 12 Z"
            fill={active ? "white" : "black"}
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
          <path
            d="M12 21 L 3 12 C 0 8, 5 3, 9 6 L 12 9 L 15 6 C 19 3, 24 8, 21 12 Z"
            fill={active ? "white" : "black"}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "hmm":
      return (
        <span
          className={cn(
            "font-epilogue font-black text-lg leading-none -rotate-6",
            active ? "text-white" : "text-black",
          )}
          aria-hidden
        >
          ?!
        </span>
      );
  }
}

export function UpdateReactions({
  updateId,
  initialCounts,
  initialMine,
  canReact,
  disabledReason,
  staticHint,
}: {
  updateId: string;
  initialCounts: Record<string, number>;
  /** Tokens the current user has already reacted with (best-effort; v0.5 we
   *  don't ship the per-user query — caller hydrates this from localStorage
   *  or leaves it empty so the UI is "click to add"). */
  initialMine: Set<ReactionToken>;
  canReact: boolean;
  disabledReason?: string;
  /** Static catalog hint (handoff 65 B1). When the update is rendered via
   *  `SeedUpdateRow` and isn't yet in Supabase, this lets the real-Privy
   *  reactions route lazy-upsert the parent update before the reaction
   *  insert. Demo mode ignores it (demoFetch matches on path, not query). */
  staticHint?: { slug: string; atISO: string };
}) {
  const { user, isSignedIn } = useAuth();
  const { error } = useToast();
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [mine, setMine] = useState<Set<ReactionToken>>(initialMine);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [signInOpen, setSignInOpen] = useState(false);

  async function toggle(token: ReactionToken) {
    if (pending.has(token)) return;
    // H1 — anon clicks fire SignIn instead of a no-op tooltip. Signed-in
    // non-kommitters fall through to canReact gating + the existing tooltip
    // ("Kommit to react.").
    if (!isSignedIn) {
      setSignInOpen(true);
      return;
    }
    if (!canReact) return;
    const wasActive = mine.has(token);
    const nextMine = new Set(mine);
    if (wasActive) nextMine.delete(token);
    else nextMine.add(token);
    setMine(nextMine);
    setCounts((c) => ({
      ...c,
      [token]: Math.max(0, (c[token] ?? 0) + (wasActive ? -1 : 1)),
    }));
    setPending((p) => new Set(p).add(token));
    persistMine(updateId, nextMine);

    try {
      const hintQS = staticHint
        ? `?slug=${encodeURIComponent(staticHint.slug)}&atISO=${encodeURIComponent(staticHint.atISO)}`
        : "";
      const res = await authedFetch(`/api/updates/${updateId}/reactions${hintQS}`, {
        method: wasActive ? "DELETE" : "POST",
        body: JSON.stringify({ emoji: token }),
        mockWallet: user?.wallet ?? null,
      });
      if (!res.ok) {
        // Roll back.
        const rollback = new Set(mine);
        if (wasActive) rollback.add(token);
        else rollback.delete(token);
        setMine(rollback);
        setCounts((c) => ({
          ...c,
          [token]: Math.max(0, (c[token] ?? 0) + (wasActive ? 1 : -1)),
        }));
        persistMine(updateId, rollback);
        const payload = await res.json().catch(() => ({}));
        const msg =
          payload?.error === "not-a-kommitter-of-this-project"
            ? "Only kommitters of this project can react."
            : payload?.detail ?? payload?.error ?? `HTTP ${res.status}`;
        error("Reaction failed", String(msg));
      }
    } catch (e) {
      error("Network error", e instanceof Error ? e.message : String(e));
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(token);
        return next;
      });
    }
  }

  // Signed-in non-kommitter → disabled with tooltip. Anon → fully clickable
  // (the click opens SignIn). The visual state mirrors disabled when canReact
  // is false even for anon, so the cue is "needs auth+kommit" not "missing
  // permission" — the click then opens SignIn for anon, no-op for non-kmtr.
  const visuallyDisabled = !canReact;
  const blocksClick = isSignedIn && !canReact;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {REACTION_TOKENS.map((token) => {
          const active = mine.has(token);
          const count = counts[token] ?? 0;
          return (
            <button
              key={token}
              type="button"
              disabled={blocksClick}
              title={visuallyDisabled ? disabledReason : undefined}
              onClick={() => toggle(token)}
              className={cn(
                "relative inline-flex items-center gap-2 px-3 py-2 border-[3px] border-black font-epilogue font-black uppercase text-[11px] tracking-widest transition-transform select-none",
                active
                  ? "bg-black text-white shadow-brutal-sm"
                  : "bg-white text-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px]",
                visuallyDisabled && "opacity-50",
                blocksClick && "cursor-not-allowed",
              )}
            >
              <TokenGlyph token={token} active={active} />
              <span>{TOKEN_LABEL[token]}</span>
              <span
                className={cn(
                  "ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1 border-[2px] border-black font-epilogue font-black text-[10px] tracking-tight",
                  active ? "bg-white text-black" : "bg-secondary text-black",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}

const STORAGE_PREFIX = "kommit:reactions:";

function persistMine(updateId: string, mine: Set<ReactionToken>) {
  if (typeof window === "undefined") return;
  try {
    const key = STORAGE_PREFIX + updateId;
    if (mine.size === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(Array.from(mine)));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

export function loadMine(updateId: string): Set<ReactionToken> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + updateId);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    const out = new Set<ReactionToken>();
    for (const t of parsed) {
      if ((REACTION_TOKENS as readonly string[]).includes(t)) {
        out.add(t as ReactionToken);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}
