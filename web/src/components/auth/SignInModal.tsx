"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import { GoogleGlyph } from "@/components/common/GoogleGlyph";
import { useDemoMode } from "@/lib/demo-mode";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Pass 2: each method button delegates to Privy. Privy's `login({ loginMethods })`
 * pre-selects a method so the user doesn't see the chooser when they already
 * picked one in our modal.
 *
 * On successful authentication, Privy fires the `useLogin` `onComplete` callback;
 * we close the modal, route to /dashboard, and fire the welcome toast there.
 *
 * Lane B routing exception: `/sandbox/*` routes have their own multi-step
 * post-signin flow (sign in → fund → kommit). Pushing to /dashboard there
 * skips step 2 of the judge experience and drops the user on a surface
 * where the only funding affordance is the card-mock. Stay put when
 * pathname is sandbox-scoped.
 */

const STAY_PUT_PREFIXES = ["/sandbox"] as const;
export function SignInModal({
  open,
  onOpenChange,
  title = "Sign in",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Optional contextual title. Defaults to the route-agnostic "Sign in" so
   * a stranger hitting the modal from /projects or /account doesn't get
   * "Sign in to back a team" when they aren't on a project page.
   * Pass a contextual title from triggers that have project context, e.g.
   * `<SignInModal title="Sign in to back CALDERA" />`.
   */
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const stayOnPage = STAY_PUT_PREFIXES.some((p) => pathname?.startsWith(p));
  const isDemo = useDemoMode();
  const { signIn: demoSignIn } = useAuth();
  const { authenticated } = usePrivy();
  const { confirm, error } = useToast();
  const { login } = useLogin({
    onComplete: ({ isNewUser }) => {
      onOpenChange(false);
      // Sandbox flow owns its own post-signin sequencing (Lane B steps 2+3).
      // Outside sandbox, /dashboard is the canonical landing.
      if (!stayOnPage) {
        router.push("/dashboard");
      }
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

  if (isDemo) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={title}>
        <p className="mt-6 text-base font-medium text-gray-800 leading-relaxed border-l-[4px] border-primary pl-4">
          You&rsquo;re in the demo. Pick a persona to walk the protected pages —
          on the live product these buttons go through Privy email / Google /
          passkey instead.
        </p>
        <div className="mt-7 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => {
              demoSignIn("lukas");
              onOpenChange(false);
              if (!stayOnPage) router.push("/dashboard");
            }}
            className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-3"
          >
            Sign in as Lukas (kommitter)
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              router.push("/demo");
            }}
            className="w-full bg-white text-black font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-3"
          >
            Pick a different persona
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
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

