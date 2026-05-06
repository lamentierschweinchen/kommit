"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";

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
          <span className="material-symbols-outlined filled">mail</span>
          Continue with Email
        </button>
        <button
          type="button"
          onClick={() => startLogin("google")}
          className="w-full bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-gray-100 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3"
        >
          <GoogleGlyph />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => startLogin("passkey")}
          className="w-full bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:bg-gray-100 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3"
        >
          <span className="material-symbols-outlined filled">fingerprint</span>
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

function GoogleGlyph() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
