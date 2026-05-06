"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { avatarUrl } from "@/lib/data/users";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: string; badge?: string | number };

export function Sidebar({
  variant,
  founderSlug,
  founderKommittersCount,
}: {
  variant: "kommitter" | "founder";
  founderSlug?: string;
  founderKommittersCount?: number;
}) {
  const { user, switchRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  const items: Item[] =
    variant === "founder" && founderSlug
      ? [
          { href: `/founder/${founderSlug}`, label: "Overview", icon: "grid_view" },
          { href: `/founder/${founderSlug}#post-update`, label: "Post update", icon: "edit_note" },
          {
            href: `/founder/${founderSlug}#kommitters`,
            label: "Kommitters",
            icon: "groups",
            badge: founderKommittersCount,
          },
          { href: `/projects/${founderSlug}`, label: "Public page", icon: "open_in_new" },
          { href: "/account", label: "Account", icon: "settings" },
        ]
      : [
          { href: "/dashboard", label: "Overview", icon: "grid_view" },
          { href: "/projects", label: "New kommit", icon: "add_circle" },
          { href: "/dashboard", label: "Withdraw", icon: "payments" },
          { href: "/dashboard", label: "Your kommits", icon: "workspace_premium" },
          { href: "/account", label: "Account", icon: "settings" },
        ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-20 h-[calc(100vh-5rem)] p-4 bg-white w-64 border-r-[3px] border-black z-40 overflow-y-auto">
      {user ? (
        <div className="mb-3 p-4 border-[3px] border-black shadow-brutal bg-gray-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-[3px] border-black overflow-hidden bg-primary shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl(user.avatarSeed, 120)} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="font-epilogue font-black text-black text-base leading-tight truncate">
              {user.displayName}
            </div>
            <div
              className={cn(
                "font-epilogue font-bold text-[10px] uppercase tracking-widest mt-1",
                variant === "founder" ? "text-secondary" : "text-primary",
              )}
            >
              {variant === "founder" && founderSlug
                ? `Founder · ${founderSlug.toUpperCase()}`
                : "Kommitter"}
            </div>
          </div>
        </div>
      ) : null}

      {user?.ownsProject ? (
        <button
          type="button"
          onClick={() => {
            if (variant === "founder") {
              switchRole("kommitter");
              router.push("/dashboard");
            } else {
              switchRole("founder");
              router.push(`/founder/${user.ownsProject}`);
            }
          }}
          className="mb-8 flex items-center justify-between gap-2 px-3 py-2 border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform font-epilogue font-bold uppercase text-[10px] tracking-widest"
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">swap_horiz</span>
            {variant === "founder" ? "Switch to kommitter" : "Switch to founder"}
          </span>
          <span className="material-symbols-outlined text-sm">arrow_outward</span>
        </button>
      ) : (
        <div className="mb-8" />
      )}

      <nav className="flex-1 flex flex-col gap-2 font-epilogue font-bold uppercase text-sm tracking-tight">
        {items.map((item, i) => {
          const base = item.href.split("#")[0];
          const isActive =
            (i === 0 && pathname === base) ||
            (i !== 0 && pathname === item.href);
          return (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              className={cn(
                "flex items-center gap-3 border-[3px] border-black p-3 transition-all",
                isActive
                  ? "bg-primary text-white shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                  : "text-black bg-white hover:bg-secondary hover:shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none",
              )}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined ? (
                <span className="ml-auto bg-primary text-white px-2 py-0.5 border-[2px] border-black text-[10px] tracking-tight">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
