"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import { GoogleGlyph } from "@/components/common/GoogleGlyph";

/**
 * Pass 2: each method button delegates to Privy. Privy's `login({ loginMethods })`
 * pre-selects a method so the user doesn't see the chooser when they already
 * picked one in our modal.
 *
 * On successful authentication, Privy fires the `useLogin` `onComplete` callback;
 * we close the modal, route to /dashboard, and fire the welcome toast there.
 */
export function SignInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { confirm, error } = useToast();
  const { login } = useLogin({
    onComplete: ({ isNewUser }) => {
      onOpenChange(false);
      router.push("/dashboard");
      setTimeout(
        () =>
          confirm(
            isNewUser ? "Account created." : "Welcome back.",
            isNewUser ? "Welcome to Kommit." : undefined,
          ),
        220,
      );
    },
    onError: (err) => {
      // Privy's "exited_auth_flow" fires when the user closes the modal — not an error.
      if (err === "exited_auth_flow") return;
      error("Sign-in didn't work.", "Try again, or use a different method.", {
        recoveryLabel: "Try again",
        onRecover: () => login(),
      });
    },
  });

  // If a session was already authed when this modal opened (rare — e.g. user
  // hits Sign in while still authenticated), close it immediately.
  useEffect(() => {
    if (open && authenticated) onOpenChange(false);
  }, [open, authenticated, onOpenChange]);

  const startLogin = (method: "email" | "google" | "passkey") => {
    login({ loginMethods: [method] });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Sign in to back a team">
      <div className="mt-8 space-y-4">
        <button
          type="button"
          onClick={() => startLogin("email")}
          className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3"
        >
          <Icon name="mail" />
          Continue with Email
        </button>
        <button
          type="button"
          onClick={() => startLogin("google")}
          className="w-full bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-gray-100 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3"
        >
          <GoogleGlyph className="w-5 h-5" />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => startLogin("passkey")}
          className="w-full bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-gray-100 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3"
        >
          <Icon name="fingerprint" />
          Continue with Passkey
        </button>
      </div>

      <div className="mt-8 pt-6 border-t-[3px] border-black">
        <p className="text-sm text-gray-500 leading-relaxed">
          We&rsquo;ll create a Solana wallet for you. Your money stays yours.
        </p>
      </div>
    </Modal>
  );
}

