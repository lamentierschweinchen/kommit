"use client";

import { useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useDemoMode } from "@/lib/demo-mode";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon, type IconName } from "@/components/common/Icon";
import { GoogleGlyph } from "@/components/common/GoogleGlyph";
import { useToast } from "@/components/common/ToastProvider";

/**
 * Sign-in methods row for /account.
 *
 * Real-auth path: pulls `usePrivy().user.linkedAccounts`, renders one pill
 * per linked method, and a "+ Connect" button for each Privy-configured
 * login method that the user hasn't linked yet. We only surface the three
 * methods the Privy config in `providers.tsx` actually supports
 * (`loginMethods: ["email", "google", "passkey"]`) so we never advertise a
 * sign-in path that 404s on the Privy side.
 *
 * Demo path: persona-scoped mock pills. No Connect buttons (demo personas
 * can't link new methods).
 */

type Method = "email" | "google" | "passkey";

const METHOD_LABEL: Record<Method, string> = {
  email: "Email",
  google: "Google",
  passkey: "Touch ID",
};

const METHOD_ICON: Record<Method, IconName | null> = {
  email: "mail",
  google: null, // GoogleGlyph
  passkey: "fingerprint",
};

// Persona-scoped mock — what each demo user has linked. New personas added
// to USERS will fall back to ["email"].
const DEMO_METHODS: Record<string, Method[]> = {
  lukas: ["email", "passkey"],
  julian: ["email", "passkey"],
  sara: ["email"],
};

export function SignInMethods() {
  const isDemo = useDemoMode();
  const { user } = useAuth();
  const { confirm } = useToast();
  const privy = usePrivy();

  const linked: Method[] = useMemo(() => {
    if (isDemo) {
      const id = user?.id ?? "";
      return DEMO_METHODS[id] ?? (user?.email ? ["email"] : []);
    }
    const accounts = privy.user?.linkedAccounts ?? [];
    const out: Method[] = [];
    if (accounts.some((a) => a.type === "email")) out.push("email");
    if (accounts.some((a) => a.type === "google_oauth")) out.push("google");
    if (accounts.some((a) => a.type === "passkey")) out.push("passkey");
    return out;
  }, [isDemo, user, privy.user]);

  const linkedEmail = !isDemo
    ? privy.user?.linkedAccounts.find((a) => a.type === "email")?.address
    : user?.email;

  // Methods configured in providers.tsx that the user hasn't linked yet.
  // Only shown in real-auth — demo personas can't link.
  const unlinked: Method[] = useMemo(() => {
    if (isDemo) return [];
    return (["email", "google", "passkey"] as Method[]).filter(
      (m) => !linked.includes(m),
    );
  }, [isDemo, linked]);

  const handleLink = (m: Method) => {
    if (isDemo) {
      confirm("Demo mode — sign-in methods are read-only.");
      return;
    }
    if (m === "email") privy.linkEmail();
    else if (m === "google") privy.linkGoogle();
    else if (m === "passkey") privy.linkPasskey();
  };

  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-6">
      <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
        Sign-in methods
      </div>

      {linked.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {linked.map((m) => (
            <StatusPill
              key={m}
              method={m}
              detail={m === "email" ? linkedEmail : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-gray-700">
          No sign-in methods linked yet.
        </p>
      )}

      {unlinked.length > 0 ? (
        <div className="mt-5 pt-5 border-t-[2px] border-gray-200">
          <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest mb-3">
            Add another way to sign in
          </div>
          <div className="flex flex-wrap gap-2">
            {unlinked.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleLink(m)}
                className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-transform active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-2"
              >
                {METHOD_ICON[m] ? (
                  <Icon name={METHOD_ICON[m]!} size="sm" />
                ) : (
                  <GoogleGlyph />
                )}
                Connect {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusPill({ method, detail }: { method: Method; detail?: string }) {
  return (
    <span className="inline-flex items-center gap-2 bg-secondary border-[2px] border-black px-3 py-1.5 font-epilogue font-black uppercase text-xs tracking-tight">
      {METHOD_ICON[method] ? (
        <Icon name={METHOD_ICON[method]!} size="sm" />
      ) : (
        <GoogleGlyph />
      )}
      {METHOD_LABEL[method]}
      {detail ? (
        <span
          className="font-medium normal-case tracking-normal text-[11px] text-gray-700 ml-1 truncate max-w-[200px]"
          title={detail}
        >
          · {detail}
        </span>
      ) : null}
      <Icon name="check" size="sm" className="ml-0.5 bg-black text-secondary w-5 h-5 p-0.5" />
    </span>
  );
}
