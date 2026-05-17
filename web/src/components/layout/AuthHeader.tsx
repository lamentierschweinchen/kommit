"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  deactivateDemoMode,
  DEMO_PERSONA_IDS,
  freezeDemoState,
  isDemoMode,
  unfreezeDemoState,
  useDemoFrozen,
  useDemoMode,
} from "@/lib/demo-mode";
import { useToast } from "@/components/common/ToastProvider";
import { SignInModal } from "@/components/auth/SignInModal";
import { MobileDrawer } from "./MobileDrawer";
import { USERS, avatarUrl, type User } from "@/lib/data/users";
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
  const { user, isSignedIn, signOut, switchUser } = useAuth();
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
      <nav className="flex justify-between items-center w-full px-6 h-16 md:h-20 bg-white border-b-[3px] border-black shadow-brutal z-50 sticky top-0">
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
            <UserDropdown
              user={user!}
              onSignOut={handleSignOut}
              onSwitchUser={(id) => {
                // Mirror /demo's enterAs routing — switching to a founder
                // lands on their /founder/<slug>, switching to a kommitter
                // lands on /dashboard. Without this, switching to Julian from
                // /dashboard would render Julian's wallet on the kommitter
                // dashboard (empty), which reads as "broken". Lifted from
                // the (now-removed) DemoControls in handoff 80 P0-2.
                const target = USERS[id];
                if (!target) return;
                switchUser(id);
                const next =
                  target.role === "founder" && target.ownsProject
                    ? `/founder/${target.ownsProject}`
                    : "/dashboard";
                router.push(next);
              }}
            />
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

/** Lightweight subset of the full User type — keeps UserDropdown decoupled
 *  from the rest of the auth state shape. The full `User` from data/users.ts
 *  is a superset and assigns into this without a cast. */
type DropdownUser = {
  id: string;
  displayName: string;
  avatarSeed: number;
  ownsProject?: string;
};

function UserDropdown({
  user,
  onSignOut,
  onSwitchUser,
}: {
  user: DropdownUser;
  onSignOut: () => void;
  /** Demo-mode persona switch — only invoked from the demo branch below. */
  onSwitchUser: (id: string) => void;
}) {
  // Handoff 80 P0-2: the avatar chip's dropdown is now context-aware. Demo
  // mode surfaces the persona switcher + exit-demo (folded in from the
  // deleted DemoControls). Real-auth mode keeps the original Dashboard /
  // Founder / Account / Sign out items. Same trigger, same component shell;
  // the branching lives in the `Content` body so AuthHeader doesn't have to
  // know which menu to render.
  const isDemo = useDemoMode();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "flex items-center bg-white border-[3px] border-black cursor-pointer transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]",
            // <md: 44×44 avatar-only chip (handoff 79 P1-5 — signed-in users had no header avatar on mobile)
            "w-11 h-11 justify-center shadow-brutal-sm",
            // >=md: full chip with name + chevron
            "md:w-auto md:h-auto md:justify-start md:gap-3 md:px-3 md:py-1.5 md:shadow-brutal",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl(user.avatarSeed, 80)}
            alt=""
            className="w-7 h-7 md:w-8 md:h-8 rounded-full border-[2px] border-black object-cover"
          />
          <span className="hidden md:inline font-epilogue font-black uppercase text-sm tracking-tight max-w-[140px] truncate">
            {firstName(user.displayName)}
          </span>
          <Icon name="expand_more" size="sm" className="hidden md:inline-block" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="bg-white border-[3px] border-black shadow-brutal min-w-[240px] p-2 z-[60] data-[state=open]:animate-modal-in"
        >
          {isDemo ? (
            <DemoMenuBody user={user} onSwitchUser={onSwitchUser} onSignOut={onSignOut} />
          ) : (
            <RealAuthMenuBody user={user} onSignOut={onSignOut} />
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Real-auth dropdown body — unchanged from pre-handoff-80 behavior. */
function RealAuthMenuBody({
  user,
  onSignOut,
}: {
  user: DropdownUser;
  onSignOut: () => void;
}) {
  return (
    <>
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
    </>
  );
}

/** Demo-mode dropdown body — persona switcher + exit-demo + the recording
 *  freeze-state toggle. Folded in from the deleted DemoControls floating
 *  chip (handoff 80 P0-2). The chip overlapped modal CTAs, sat in the iOS
 *  home-indicator gesture zone, and competed for visual hierarchy with
 *  content on every demo page. Living inside the avatar dropdown means
 *  zero new chrome and a thumb-friendly tap target. */
function DemoMenuBody({
  user,
  onSwitchUser,
  onSignOut,
}: {
  user: DropdownUser;
  onSwitchUser: (id: string) => void;
  onSignOut: () => void;
}) {
  const isFrozen = useDemoFrozen();
  return (
    <>
      <div className="px-3 pt-2 pb-1 font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
        Demo persona
      </div>
      {DEMO_PERSONA_IDS.map((id) => USERS[id]).filter((u): u is User => !!u).map((u) => {
        const active = user.id === u.id;
        return (
          <DropdownMenu.Item key={u.id} asChild>
            <button
              type="button"
              onClick={() => onSwitchUser(u.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 border-[2px] cursor-pointer outline-none transition-transform mb-1 last:mb-0",
                active
                  ? "bg-primary text-white border-black"
                  : "bg-white text-black border-transparent hover:bg-gray-100 hover:border-black",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl(u.avatarSeed, 60)}
                alt=""
                className="w-7 h-7 rounded-full border-[2px] border-black object-cover grayscale shrink-0"
              />
              <span className="font-epilogue font-bold tracking-tight text-sm truncate flex-1 text-left">
                {u.displayName}
              </span>
              <span
                className={cn(
                  "font-epilogue font-bold uppercase text-[9px] tracking-widest",
                  active ? "text-white/80" : "text-gray-500",
                )}
              >
                {u.role === "founder" ? "FNDR" : "KMTR"}
              </span>
            </button>
          </DropdownMenu.Item>
        );
      })}
      <DropdownMenu.Separator className="h-[2px] bg-black my-2" />
      <UserMenuLink href="/demo" icon="info" label="About this demo" />
      <DropdownMenu.Item asChild>
        <button
          type="button"
          onClick={() => {
            deactivateDemoMode();
            // Hard navigation so the AuthProvider tree re-mounts as the real
            // Privy branch — a soft router.push leaves MockAuthProvider live
            // for the rest of the SPA session.
            if (typeof window !== "undefined") window.location.assign("/");
          }}
          className="w-full flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-sm tracking-tight text-black hover:bg-gray-100 cursor-pointer outline-none"
        >
          <Icon name="logout" size="sm" />
          Exit demo
        </button>
      </DropdownMenu.Item>
      <DropdownMenu.Item asChild>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-xs tracking-tight text-gray-500 hover:bg-gray-100 cursor-pointer outline-none"
        >
          <Icon name="visibility" size="sm" />
          Sign out (anon viewer)
        </button>
      </DropdownMenu.Item>
      <DropdownMenu.Separator className="h-[2px] bg-black my-2" />
      <div className="px-3 pt-1 pb-1 font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
        Recording
      </div>
      {/* Recording-tool — Lukas's freeze-state toggle stays accessible so
          re-takes during demo videos start from the same seeded state.
          Wrapped in onSelect={preventDefault} so toggling the checkbox
          doesn't close the dropdown. */}
      <DropdownMenu.Item
        asChild
        onSelect={(e) => e.preventDefault()}
      >
        <label className="w-full flex items-center gap-3 px-3 py-2 font-epilogue font-bold uppercase text-xs tracking-tight text-gray-700 hover:bg-gray-100 cursor-pointer outline-none">
          <input
            type="checkbox"
            checked={isFrozen}
            onChange={(e) => {
              if (e.target.checked) freezeDemoState();
              else unfreezeDemoState();
            }}
            className="w-4 h-4 accent-primary"
          />
          <span className="flex-1">Freeze state</span>
          <span className="font-epilogue text-[9px] tracking-widest text-gray-500">
            {isFrozen ? "ON" : "OFF"}
          </span>
        </label>
      </DropdownMenu.Item>
    </>
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
