"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { USERS, avatarUrl } from "@/lib/data/users";
import {
  useDemoMode,
  deactivateDemoMode,
  useDemoFrozen,
  freezeDemoState,
  unfreezeDemoState,
  useRecordingMode,
  activateRecordingMode,
} from "@/lib/demo-mode";
import { useVisaMode } from "@/lib/visa-mode";
import { cn } from "@/lib/cn";

/**
 * Floating persona-switcher for the demo deploy. Renders ONLY when demo
 * mode is active (env flag locally, or localStorage flag on production
 * after a visitor enters via /demo). Self-gating via useDemoMode keeps the
 * widget out of the real-auth tree without the layout having to branch.
 */
export function DemoControls() {
  const isDemo = useDemoMode();
  const isVisa = useVisaMode();
  const isRecording = useRecordingMode();
  const isFrozen = useDemoFrozen();
  const { user, role, switchUser, signOut, signIn } = useAuth();
  const [open, setOpen] = useState(false);

  // Hide entirely in visa mode — the persona-switcher chrome would leak
  // crypto vocabulary ("DEMO · Lukas · Kommitter") into the recorded flow.
  // Also hide in recording mode — the slim <RecordingPersonaPill> in the
  // header replaces this UI for the camera-facing flow.
  if (!isDemo || isVisa || isRecording) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] print:hidden">
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
            <button
              type="button"
              onClick={() => {
                activateRecordingMode();
                setOpen(false);
              }}
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 border-[2px] border-black bg-white text-black hover:bg-gray-100 font-epilogue font-bold uppercase text-xs tracking-tight"
            >
              Enter recording mode
              <span className="ml-auto font-epilogue text-[9px] tracking-widest text-gray-500">
                Esc to exit
              </span>
            </button>
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
