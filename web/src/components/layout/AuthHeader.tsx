"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/components/auth/AuthProvider";
import { isDemoMode, useDemoMode } from "@/lib/demo-mode";
import { useToast } from "@/components/common/ToastProvider";
import { SignInModal } from "@/components/auth/SignInModal";
import { MobileDrawer } from "./MobileDrawer";
import { avatarUrl } from "@/lib/data/users";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";

const NAV_LINKS = [
  { href: "/projects", label: "Browse projects" },
  { href: "/build", label: "For founders" },
  { href: "/about", label: "About" },
];

/** Nav links that only render for signed-in users (handoff 62 #5). */
const SIGNED_IN_NAV_LINKS = [{ href: "/dashboard", label: "Dashboard" }];

/**
 * Lane A architecture rollout: `/` is now the coming-soon waitlist; the
 * functional landing lives at `/app`. Product surfaces (dashboard, project
 * detail, projects browser, founder dashboard, etc.) pass `homeHref="/app"`
 * so the wordmark routes back to the live product home rather than the
 * marketing page. Defaulting to `/` keeps the small set of public-marketing
 * surfaces (about, build) pointing at the waitlist.
 */
export function AuthHeader({
  forcePublic,
  homeHref = "/",
}: {
  forcePublic?: boolean;
  /** Where the wordmark links to. Pass `"/app"` from product surfaces. */
  homeHref?: string;
} = {}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, isSignedIn, signOut } = useAuth();
  // Hook subscription keeps the header reactive to demo-mode toggles; the
  // actual sign-out branch reads isDemoMode() at click-time (handoff 69 B7).
  void useDemoMode();
  const { confirm } = useToast();
  const [signInOpen, setSignInOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // `forcePublic` lets callers explicitly opt into the anon header (no
  // current consumers, kept for the rare surface that wants marketing chrome
  // regardless of auth). Otherwise: signed-in users see their dropdown on
  // every route — `/about` and `/build` previously forced the anon header
  // even for signed-in users, which read as auth state vanishing on
  // navigation. Handoff 62 #2.
  const showAnonHeader = forcePublic || !isSignedIn;
  // Pass-2 P1 #5: header search dropped globally. The browse page has a
  // proper filter+sort+search toolbar; every other route had a header search
  // with no scope (search what? from /account?). One canonical search
  // affordance, one place — on /projects.

  const handleSignOut = () => {
    // Demo personas land back on /demo so the user can re-pick or jump to the
    // onchain entry; real-Privy users go to / (the marketing waitlist) which
    // is the natural anon landing. The demo-mode flag itself survives signOut
    // — only the active persona clears — so /demo correctly renders the
    // persona-pick view for an unsigned demo session.
    //
    // Handoff 69 B7: read the flag at click-time, not from the hook value,
    // and navigate BEFORE signOut so the auth-state teardown can't race the
    // route push. The hook-bound `isDemo` was occasionally false at click
    // time on production (real-Privy header re-render swap interleaving
    // with the demo mount, depending on which provider booted first), so
    // sign-outs from a demo persona landed on `/` instead of `/demo`.
    const next = isDemoMode() ? "/demo" : "/";
    router.push(next);
    signOut();
    confirm("Signed out.");
  };

  return (
    <>
      <nav className="flex justify-between items-center w-full px-6 h-20 bg-white border-b-[3px] border-black shadow-brutal z-50 sticky top-0">
        <div className="flex items-center gap-8 min-w-0">
          <Link href={homeHref} className="shrink-0 block" aria-label="kommit, home">
            <Wordmark />
          </Link>
          <div className="hidden lg:flex gap-2">
            {[...(isSignedIn ? SIGNED_IN_NAV_LINKS : []), ...NAV_LINKS].map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href === "/projects" && pathname.startsWith("/projects"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "font-epilogue font-black uppercase tracking-tight text-sm px-3 py-1 border-[3px] transition-transform",
                    isActive
                      ? "text-white bg-black border-black"
                      : "text-black border-transparent hover:bg-gray-100 hover:translate-x-[-2px] hover:translate-y-[-2px]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showAnonHeader ? (
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-6 py-2 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
              Sign in
            </button>
          ) : (
            <UserDropdown user={user!} onSignOut={handleSignOut} />
          )}

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden w-11 h-11 flex items-center justify-center border-[3px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
          >
            <Icon name="menu" />
          </button>
        </div>
      </nav>

      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onOpenSignIn={() => setSignInOpen(true)} />
    </>
  );
}

function Wordmark() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src="/assets/wordmark.png" alt="kommit" className="h-8 md:h-9 w-auto block" />
  );
}

/** Pick the most-recognizable single name fragment for the header chip. */
function firstName(displayName: string): string {
  const parts = displayName.split(/\s+/);
  // Skip honorifics like "Dr." / "Mr." — show the first non-honorific token.
  const first = parts.find((p) => !/^(Dr|Mr|Ms|Mrs|Prof)\.?$/.test(p));
  return first ?? parts[0] ?? displayName;
}

function UserDropdown({ user, onSignOut }: { user: { displayName: string; avatarSeed: number; ownsProject?: string }; onSignOut: () => void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="hidden md:flex items-center gap-3 bg-white border-[3px] border-black shadow-brutal px-3 py-1.5 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl(user.avatarSeed, 80)}
            alt=""
            className="w-8 h-8 rounded-full border-[2px] border-black object-cover"
          />
          <span className="font-epilogue font-black uppercase text-sm tracking-tight max-w-[140px] truncate">
            {firstName(user.displayName)}
          </span>
          <Icon name="expand_more" size="sm" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-white border-[3px] border-black shadow-brutal min-w-[220px] p-2 z-[60] data-[state=open]:animate-modal-in"
        >
          <UserMenuLink href="/dashboard" icon="grid_view" label="Dashboard" />
          {user.ownsProject ? (
            <UserMenuLink
              href={`/founder/${user.ownsProject}`}
              icon="business_center"
              label="Founder dashboard"
            />
          ) : null}
          <UserMenuLink href="/account" icon="settings" label="Account" />
          <DropdownMenu.Separator className="h-[2px] bg-black my-2" />
          <DropdownMenu.Item asChild>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight text-black hover:bg-gray-100 cursor-pointer outline-none"
            >
              <Icon name="logout" size="sm" />
              Sign out
            </button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UserMenuLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="w-full flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight text-black hover:bg-gray-100 cursor-pointer outline-none"
      >
        <Icon name={icon} size="sm" />
        {label}
      </Link>
    </DropdownMenu.Item>
  );
}
