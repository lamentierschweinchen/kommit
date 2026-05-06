import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { ConnectWallet } from "./connect-wallet";
import { RoleSwitcher } from "./role-switcher";

const NAV = [
  { href: "/projects", label: "Browse" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3">
        <Link href="/" className="font-medium tracking-tight text-lg shrink-0">
          Kommit
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV.map((n) => (
            <Button key={n.href} asChild size="sm" variant="ghost">
              <Link href={n.href}>{n.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2">
          <RoleSwitcher />
          <ConnectWallet />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Kommit</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV.map((n) => (
                <Button key={n.href} asChild variant="ghost" className="justify-start">
                  <Link href={n.href}>{n.label}</Link>
                </Button>
              ))}
            </nav>
            <div className="px-4 mt-2 flex flex-col gap-2">
              <RoleSwitcher />
              <ConnectWallet />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
