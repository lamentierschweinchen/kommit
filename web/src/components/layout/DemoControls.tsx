"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { USERS, avatarUrl, type User } from "@/lib/data/users";
import {
  useDemoMode,
  deactivateDemoMode,
  useDemoFrozen,
  freezeDemoState,
  unfreezeDemoState,
} from "@/lib/demo-mode";
import { cn } from "@/lib/cn";

/**
 * Floating persona-switcher for the demo deploy. Renders ONLY when demo
 * mode is active (env flag locally, or localStorage flag on production
 * after a visitor enters via /demo). Self-gating via useDemoMode keeps the
 * widget out of the real-auth tree without the layout having to branch.
 */
export function DemoControls() {
  const isDemo = useDemoMode();
  const isFrozen = useDemoFrozen();
  const { user, role, switchUser, signOut, signIn } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!isDemo) return null;

  // Mirror /demo's `enterAs` routing — switch to a founder and you land on
  // their founder dashboard; switch to a kommitter and you land on /dashboard.
  // Without this, switching to Julian from /dashboard would render Julian's
  // wallet on the kommitter dashboard (empty), which reads as "broken".
  const naturalSurfaceFor = (u: User): string =>
    u.role === "founder" && u.ownsProject ? `/founder/${u.ownsProject}` : "/dashboard";

  // Handoff 78 P0-2: chip sat at `bottom-4 left-4 z-[90]` and overlapped
  // modal CTAs / toasts / form fields / the iOS home-indicator zone. Now
  // at z-30 so the Radix Dialog overlay (z-40) covers it when a modal is
  // open; lifted to `bottom-24` on `<lg` so it clears the sticky kommit
  // bar on /projects/[slug] (which is `bottom-0 lg:hidden`, ~85px tall).
  return (
    <div className="fixed bottom-24 lg:bottom-4 left-4 z-30 print:hidden pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "bg-black text-white border-[3px] border-black pl-2 pr-3 py-2 shadow-brutal-green",
          "font-epilogue font-black uppercase text-[10px] tracking-widest",
          "hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform",
          "flex items-center gap-2",
        )}
        aria-expanded={open}
        aria-label={`Demo mode — ${user?.displayName ?? "Anon"} · ${role}`}
      >
        {user ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl(user.avatarSeed, 60)}
            alt=""
            className="w-6 h-6 border-[2px] border-secondary object-cover grayscale"
          />
        ) : (
          <span className="w-6 h-6 border-[2px] border-secondary inline-flex items-center justify-center bg-white text-black text-[10px]">
            ?
          </span>
        )}
        <span>
          DEMO · {user ? user.displayName.split(" ")[0] : "Anon"}
        </span>
        <span className="text-secondary">
          ({role === "founder" ? "Founder" : role === "kommitter" ? "Kommitter" : "Out"})
        </span>
      </button>

      {open ? (
        <div className="mt-2 w-72 bg-white border-[3px] border-black shadow-brutal p-3 space-y-2">
          <div className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500 mb-1">
            Switch persona
          </div>
          {Object.values(USERS).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                switchUser(u.id);
                setOpen(false);
                router.push(naturalSurfaceFor(u));
              }}
              className={cn(
                "w-full text-left flex items-center gap-3 px-2 py-2 border-[2px] border-black",
                "font-epilogue font-bold uppercase text-xs tracking-tight",
                user?.id === u.id
                  ? "bg-primary text-white"
                  : "bg-white text-black hover:bg-gray-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl(u.avatarSeed, 60)}
                alt=""
                className="w-7 h-7 border-[2px] border-black object-cover grayscale shrink-0"
              />
              <span className="flex-1 truncate normal-case tracking-tight">{u.displayName}</span>
              <span className="text-[9px] tracking-widest opacity-80">
                {u.role === "founder" ? "FNDR" : "KMTR"}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              signOut();
              setOpen(false);
              router.push("/");
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 border-[2px] border-black bg-white text-black hover:bg-gray-100 font-epilogue font-bold uppercase text-xs tracking-tight"
          >
            Sign out (anon)
          </button>
          <button
            type="button"
            onClick={() => {
              signIn("lukas");
              setOpen(false);
              router.push("/dashboard");
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 border-[2px] border-black bg-secondary text-black font-epilogue font-bold uppercase text-xs tracking-tight"
          >
            Reset to Lukas
          </button>
          <div className="pt-2 mt-2 border-t-[2px] border-black space-y-2">
            <div className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              Recording
            </div>
            <label className="flex items-center gap-2 px-2 py-1.5 border-[2px] border-black bg-white cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={isFrozen}
                onChange={(e) => {
                  if (e.target.checked) freezeDemoState();
                  else unfreezeDemoState();
                }}
                className="w-4 h-4 accent-primary"
              />
              <span className="font-epilogue font-bold uppercase text-xs tracking-tight">
                Freeze state
              </span>
              <span className="ml-auto font-epilogue text-[9px] tracking-widest text-gray-500">
                {isFrozen ? "ON" : "OFF"}
              </span>
            </label>
          </div>
          <div className="pt-2 mt-2 border-t-[2px] border-black space-y-1">
            <Link
              href="/demo"
              className="block text-center font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500 hover:text-black"
              onClick={() => setOpen(false)}
            >
              About this demo
            </Link>
            <button
              type="button"
              onClick={() => {
                deactivateDemoMode();
                setOpen(false);
                window.location.assign("/");
              }}
              className="w-full font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500 hover:text-black"
            >
              Exit demo →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
