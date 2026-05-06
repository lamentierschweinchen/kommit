"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { USERS } from "@/lib/data/users";
import { cn } from "@/lib/cn";

/**
 * Floating dev-only widget. Lets reviewers swap demo personas without UI digging.
 * `?as=lukas|julian|lina|anon` query-string also works (handled in AuthProvider).
 */
export function DemoControls() {
  const { user, role, switchUser, signOut, signIn } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[90] print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "bg-black text-white border-[3px] border-black px-3 py-2 shadow-brutal-green",
          "font-epilogue font-black uppercase text-[10px] tracking-widest",
          "hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform",
        )}
        aria-expanded={open}
      >
        DEMO · {user ? user.displayName.split(" ")[0] : "Anon"}{" "}
        <span className="text-secondary">
          ({role === "founder" ? "Founder" : role === "kommitter" ? "Kommitter" : "Out"})
        </span>
      </button>

      {open ? (
        <div className="mt-2 w-64 bg-white border-[3px] border-black shadow-brutal p-3 space-y-2">
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
                "w-full text-left flex items-center justify-between gap-2 px-3 py-2 border-[2px] border-black",
                "font-epilogue font-bold uppercase text-xs tracking-tight",
                user?.id === u.id ? "bg-primary text-white" : "bg-white text-black hover:bg-gray-100",
              )}
            >
              <span>{u.displayName}</span>
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
        </div>
      ) : null}
    </div>
  );
}
