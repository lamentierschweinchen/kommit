"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { USERS, avatarUrl } from "@/lib/data/users";
import {
  deactivateRecordingMode,
  useDemoMode,
  useRecordingMode,
} from "@/lib/demo-mode";
import { cn } from "@/lib/cn";

/**
 * Slim header pill shown only in recording mode. Replaces the floating
 * <DemoControls> for the camera-facing flow — visible enough that viewers
 * always know whose POV they're seeing, quiet enough not to dominate frames.
 *
 * Keyboard bindings (registered globally while mounted):
 *   `[` / `]` — previous / next persona in the cycle (anon → USERS → anon)
 *   `0`       — anon
 *   `1`-`5`   — direct jump to USERS in key order (lukas, julian, lina, maya, theo)
 *   Esc       — exit recording mode
 *
 * Switches dispatch a synthetic `storage` event after mutating localStorage
 * so MockAuthProvider's `storage` listener pattern stays the canonical
 * synchronization path. Note: MockAuthProvider currently only re-hydrates
 * persona on mount, so we also call `switchUser` directly to flip in-memory
 * state immediately.
 */
export function RecordingPersonaPill() {
  const isDemo = useDemoMode();
  const isRecording = useRecordingMode();
  const active = isDemo && isRecording;
  const { user, role, switchUser, signOut } = useAuth();

  useEffect(() => {
    if (!active) return;
    const personaIds = Object.keys(USERS); // lukas, julian, lina, maya, theo
    const cycle: Array<string | null> = [null, ...personaIds];

    const goAnon = () => signOut();
    const goPersona = (id: string) => switchUser(id);
    const cycleBy = (delta: 1 | -1) => {
      const currentId = user?.id ?? null;
      const idx = cycle.indexOf(currentId);
      const nextIdx = (idx + delta + cycle.length) % cycle.length;
      const next = cycle[nextIdx];
      if (next === null) goAnon();
      else goPersona(next);
    };

    const onKey = (e: KeyboardEvent) => {
      // Skip when typing into a field — never want a stray `[` to jump
      // personas while Lukas is editing copy off-camera.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        deactivateRecordingMode();
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        cycleBy(-1);
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        cycleBy(1);
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        goAnon();
        return;
      }
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= personaIds.length) {
        e.preventDefault();
        goPersona(personaIds[digit - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, user, switchUser, signOut]);

  if (!active) return null;

  const label = user ? user.displayName : "Anon";
  const roleLabel = role === "founder" ? "Founder" : role === "kommitter" ? "Kommitter" : "Visitor";

  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-2 px-2 py-1 border-[2px] border-black bg-white",
        "font-epilogue font-bold uppercase text-[10px] tracking-widest",
      )}
      aria-label={`Recording mode — ${label} · ${roleLabel}`}
    >
      {user ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatarUrl(user.avatarSeed, 60)}
          alt=""
          className="w-5 h-5 border-[2px] border-black object-cover grayscale"
        />
      ) : (
        <span className="w-5 h-5 border-[2px] border-black inline-flex items-center justify-center bg-white text-black text-[9px]">
          ?
        </span>
      )}
      <span className="text-black">{label}</span>
      <span className="text-gray-500">·</span>
      <span className="text-gray-500">{roleLabel}</span>
      <span className="text-gray-300 mx-1">|</span>
      <span className="text-gray-400 normal-case tracking-tight font-medium">
        [ ] switch · 0–5 jump · Esc exit
      </span>
    </div>
  );
}
