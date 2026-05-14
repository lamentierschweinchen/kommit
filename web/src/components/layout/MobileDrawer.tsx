"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { avatarUrl } from "@/lib/data/users";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";

type Item = { href: string; label: string; icon: IconName };

const PUBLIC_ITEMS: Item[] = [
  { href: "/projects", label: "Browse projects", icon: "explore" },
  { href: "/build", label: "For founders", icon: "business_center" },
  { href: "/about", label: "About", icon: "info" },
];

const KOMMITTER_ITEMS: Item[] = [
  { href: "/dashboard", label: "Your kommits", icon: "workspace_premium" },
  { href: "/projects", label: "Browse projects", icon: "explore" },
  { href: "/account", label: "Account", icon: "settings" },
];

const FOUNDER_ITEMS = (slug: string): Item[] => [
  { href: `/founder/${slug}`, label: "Overview", icon: "grid_view" },
  { href: `/founder/${slug}#post-update`, label: "Post update", icon: "edit_note" },
  { href: `/founder/${slug}#kommitters`, label: "Kommitters", icon: "groups" },
  { href: `/projects/${slug}`, label: "Public page", icon: "open_in_new" },
  { href: "/account", label: "Account", icon: "settings" },
];

export function MobileDrawer({
  open,
  onOpenChange,
  onOpenSignIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenSignIn: () => void;
}) {
  const { user, role, isSignedIn, signOut, switchRole } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { confirm } = useToast();

  const items: Item[] = !isSignedIn
    ? PUBLIC_ITEMS
    : role === "founder" && user?.ownsProject
      ? FOUNDER_ITEMS(user.ownsProject)
      : KOMMITTER_ITEMS;

  const close = () => onOpenChange(false);

  const handleSignOut = () => {
    signOut();
    close();
    router.push("/");
    confirm("Signed out.");
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Handoff 79 P2-10: matches Modal.tsx z-scale (overlay z-70, content z-80) */}
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 data-[state=open]:animate-scrim-in" />
        <Dialog.Content
          className={cn(
            "fixed top-0 right-0 bottom-0 z-[80] w-[88vw] max-w-sm bg-white",
            "border-l-[3px] border-black shadow-brutal-lg",
            "flex flex-col",
            "data-[state=open]:animate-drawer-in",
          )}
        >
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>

          <div className="flex justify-between items-center h-16 md:h-20 px-5 border-b-[3px] border-black shrink-0">
            <span className="font-epilogue font-black uppercase tracking-tight text-base">Menu</span>
            <Dialog.Close
              aria-label="Close"
              className="w-11 h-11 flex items-center justify-center border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
            >
              <Icon name="close" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isSignedIn && user ? (
              <div className="p-4 border-[3px] border-black shadow-brutal bg-gray-100 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarUrl(user.avatarSeed, 120)}
                  alt=""
                  className="w-12 h-12 rounded-full border-[3px] border-black object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-epilogue font-black text-black text-base leading-tight truncate">
                    {user.displayName}
                  </div>
                  <div
                    className={cn(
                      "font-epilogue font-bold text-[10px] uppercase tracking-widest mt-1",
                      role === "founder" ? "text-secondary" : "text-primary",
                    )}
                  >
                    {role === "founder" ? `Founder · ${user.ownsProject ?? ""}` : "Kommitter"}
                  </div>
                </div>
              </div>
            ) : null}

            <nav className="flex flex-col gap-2 font-epilogue font-bold uppercase text-sm tracking-tight">
              {items.map((item, i) => {
                const isActive = pathname === item.href || pathname === item.href.split("#")[0];
                return (
                  <Link
                    key={`${item.href}-${i}`}
                    href={item.href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 border-[3px] border-black p-3 transition-all",
                      isActive
                        ? "bg-primary text-white shadow-brutal"
                        : "bg-white text-black hover:bg-secondary hover:shadow-brutal",
                    )}
                  >
                    <Icon name={item.icon} size="md" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {isSignedIn && user?.ownsProject ? (
              <button
                type="button"
                onClick={() => {
                  if (role === "founder") {
                    switchRole("kommitter");
                    router.push("/dashboard");
                  } else {
                    switchRole("founder");
                    router.push(`/founder/${user.ownsProject}`);
                  }
                  close();
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-3 border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform font-epilogue font-bold uppercase text-[10px] tracking-widest"
              >
                <span className="flex items-center gap-1.5">
                  <Icon name="swap_horiz" size="xs" />
                  {role === "founder" ? "Switch to kommitter" : "Switch to founder"}
                </span>
                <Icon name="arrow_outward" size="xs" />
              </button>
            ) : null}
          </div>

          <div className="border-t-[3px] border-black p-5 shrink-0">
            {isSignedIn ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 border-[3px] border-black bg-white shadow-brutal hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform font-epilogue font-bold uppercase text-sm tracking-tight"
              >
                <Icon name="logout" size="sm" />
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenSignIn();
                }}
                className="w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
              >
                Sign in
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
