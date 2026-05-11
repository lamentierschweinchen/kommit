"use client";

/**
 * Inline gate for routes that require auth (and optionally project ownership).
 *
 * Renders a clean "sign in to continue" empty-state in place of the page body
 * when the user is anonymous, OR a "founder-only" empty-state if a non-owner
 * authed user lands on a founder route.
 *
 * Pattern: keep the layout chrome (header / sidebar) but replace the page
 * body with this gate. URL is preserved so deep links survive sign-in.
 *
 * Audit pass-2 P0 #1 — `/dashboard`, `/account`, `/founder/*` were rendering
 * their authed shells (stat cards, change buttons, named kommitter lists) to
 * anonymous visitors. Fix: wrap each page body in <AuthGate>.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { SignInModal } from "@/components/auth/SignInModal";
import { Icon } from "@/components/common/Icon";

type AuthGateProps = {
  /** Slug of the project required for ownership; only set on founder routes. */
  requireOwnsProject?: string;
  /** Headline shown on the anonymous gate. Defaults to a route-agnostic prompt. */
  anonHeadline?: string;
  /** Supportive copy under the anonymous headline. */
  anonBody?: string;
  children: ReactNode;
};

export function AuthGate({
  requireOwnsProject,
  anonHeadline = "Sign in to continue.",
  anonBody,
  children,
}: AuthGateProps) {
  const { isSignedIn, user } = useAuth();

  if (!isSignedIn) {
    return <AnonGate headline={anonHeadline} body={anonBody} />;
  }

  // Admin bypass: Lukas (or any founders.role='admin' wallet) can pinch-hit
  // on any project dashboard, so the ownership gate is short-circuited when
  // the signed-in user carries isAdmin. Everyone else needs the exact
  // project-slug match.
  if (
    requireOwnsProject &&
    user?.ownsProject !== requireOwnsProject &&
    !user?.isAdmin
  ) {
    return <NonOwnerGate />;
  }

  return <>{children}</>;
}

function AnonGate({ headline, body }: { headline: string; body?: string }) {
  const [signInOpen, setSignInOpen] = useState(false);
  return (
    <>
      <section className="px-6 md:px-12 py-20 md:py-28 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white border-[3px] border-black shadow-brutal-purple p-10 md:p-14 text-center">
          <h1 className="font-epilogue font-black uppercase text-3xl md:text-5xl tracking-tighter leading-[0.95]">
            {headline}
          </h1>
          {body ? (
            <p className="mt-6 text-base md:text-lg font-medium text-gray-800 leading-relaxed border-l-[4px] border-primary pl-5 max-w-md mx-auto text-left">
              {body}
            </p>
          ) : null}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base px-8 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg inline-flex items-center justify-center gap-3"
            >
              Sign in
              <Icon name="arrow_forward" />
            </button>
            <Link
              href="/projects"
              className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base px-8 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform inline-flex items-center justify-center gap-3"
            >
              Browse projects
            </Link>
          </div>
        </div>
      </section>
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}

function NonOwnerGate() {
  return (
    <section className="px-6 md:px-12 py-20 md:py-28 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white border-[3px] border-black shadow-brutal p-10 md:p-14 text-center">
        <h1 className="font-epilogue font-black uppercase text-3xl md:text-5xl tracking-tighter leading-[0.95]">
          Founder-only.
        </h1>
        <p className="mt-6 text-base md:text-lg font-medium text-gray-800 leading-relaxed border-l-[4px] border-primary pl-5 max-w-md mx-auto text-left">
          This dashboard is the team&rsquo;s private view. The public page is open to everyone.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/projects"
            className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base px-8 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform inline-flex items-center justify-center gap-3"
          >
            Browse projects
            <Icon name="arrow_forward" />
          </Link>
          <Link
            href="/dashboard"
            className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base px-8 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform inline-flex items-center justify-center gap-3"
          >
            Your dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
