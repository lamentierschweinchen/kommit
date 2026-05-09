"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/common/Icon";

/**
 * Waitlist signup form for the coming-soon `/` landing.
 *
 * Single form with a role toggle (`Back projects` / `Build a project`),
 * email input, submit. POST to /api/waitlist; success replaces the form
 * with a thank-you. Errors render inline.
 *
 * Lane A: this is the only piece on `/` that talks to the backend. The
 * route lives at app/web/src/app/api/waitlist/route.ts; schema is in
 * migrations/supabase/0005_waitlist.sql.
 */

type Role = "backer" | "builder";
type Status = "idle" | "submitting" | "success" | "error";

// Mirror of the API regex — keeps client + server honest about what counts
// as valid before a network round-trip.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function WaitlistForm() {
  const [role, setRole] = useState<Role>("backer");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (status === "submitting") return;

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setErrorMsg("That doesn't look like an email — double-check?");
      return;
    }

    setStatus("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });

      if (res.ok) {
        setStatus("success");
        return;
      }

      // Map the structured error codes to user-readable messages.
      let code: string | null = null;
      try {
        const body = (await res.json()) as { error?: string };
        code = body?.error ?? null;
      } catch {
        // Non-JSON error body — fall through to generic message.
      }

      setStatus("error");
      if (res.status === 429 || code === "rate-limit") {
        setErrorMsg("Whoa — slow down. Try again in a minute.");
      } else if (res.status === 400 || code === "invalid-input") {
        setErrorMsg("That email didn't pass our check. Try again?");
      } else if (code === "config") {
        setErrorMsg(
          "Waitlist isn't wired up yet. Try again later — we'll have it on shortly.",
        );
      } else {
        setErrorMsg("Couldn't save that. Try again in a moment.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network hiccup. Try again?");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 bg-secondary border-[3px] border-black flex items-center justify-center shadow-brutal-sm">
            <Icon name="check" className="font-bold" />
          </div>
          <div>
            <h3 className="font-epilogue font-black uppercase text-2xl tracking-tighter">
              You&apos;re on the list.
            </h3>
            <p className="mt-2 text-base font-medium text-gray-700 leading-relaxed">
              We&apos;ll email you the moment kommits start ticking. No drip
              campaign, no deck downloads — just the launch ping.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Role toggle — two big segmented buttons, brutalist tokens */}
      <fieldset>
        <legend className="font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500 mb-2">
          I&apos;m here to
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <RoleOption
            value="backer"
            label="Back projects"
            current={role}
            onSelect={setRole}
          />
          <RoleOption
            value="builder"
            label="Build a project"
            current={role}
            onSelect={setRole}
          />
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="waitlist-email"
          className="block font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-500 mb-2"
        >
          Email
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") {
              setStatus("idle");
              setErrorMsg(null);
            }
          }}
          placeholder="you@somewhere.com"
          className="w-full bg-white border-[3px] border-black px-4 py-3 font-epilogue font-medium text-base placeholder:text-gray-400 focus:outline-none focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-brutal transition-transform"
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className={cn(
          "w-full bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base md:text-lg px-8 py-4 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
          "hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0",
          "flex items-center justify-center gap-3",
        )}
      >
        {status === "submitting" ? "Adding you…" : "Join the waitlist"}
        {status === "submitting" ? null : (
          <Icon name="arrow_forward" className="font-bold" />
        )}
      </button>

      {status === "error" && errorMsg ? (
        <p
          role="alert"
          className="font-epilogue font-bold uppercase text-xs tracking-widest text-primary"
        >
          {errorMsg}
        </p>
      ) : null}
    </form>
  );
}

function RoleOption({
  value,
  label,
  current,
  onSelect,
}: {
  value: Role;
  label: string;
  current: Role;
  onSelect: (r: Role) => void;
}) {
  const active = current === value;
  return (
    <label
      className={cn(
        "cursor-pointer block border-[3px] border-black px-4 py-3 transition-transform select-none text-center",
        active
          ? "bg-black text-white shadow-brutal-purple"
          : "bg-white text-black hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal",
      )}
    >
      <input
        type="radio"
        name="waitlist-role"
        value={value}
        checked={active}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span className="font-epilogue font-black uppercase text-sm tracking-tight">
        {label}
      </span>
    </label>
  );
}
