"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { SignInModal } from "@/components/auth/SignInModal";
import { MobileDrawer } from "./MobileDrawer";
import { RecordingPersonaPill } from "./RecordingPersonaPill";
import { avatarUrl } from "@/lib/data/users";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";

const PUBLIC_ROUTES = ["/", "/app", "/about", "/build", "/build/submitted"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r);
}

const NAV_LINKS = [
  { href: "/projects", label: "Browse projects" },
  { href: "/build", label: "For founders" },
  { href: "/about", label: "About" },
];

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
  const { confirm } = useToast();
  const [signInOpen, setSignInOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isPublic = forcePublic || isPublicRoute(pathname);
  const showAnonHeader = isPublic || !isSignedIn;
  // Pass-2 P1 #5: header search dropped globally. The browse page has a
  // proper filter+sort+search toolbar; every other route had a header search
  // with no scope (search what? from /account?). One canonical search
  // affordance, one place — on /projects.

  const handleSignOut = () => {
    signOut();
    router.push("/");
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
            {NAV_LINKS.map((link) => {
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
          <RecordingPersonaPill />
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
