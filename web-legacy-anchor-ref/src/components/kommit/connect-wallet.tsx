"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function truncate(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function ConnectWallet() {
  if (!PRIVY_CONFIGURED) {
    return (
      <Button size="sm" variant="outline" disabled title="NEXT_PUBLIC_PRIVY_APP_ID not set">
        Sign in
      </Button>
    );
  }
  return <ConnectWalletInner />;
}

function ConnectWalletInner() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];

  if (!ready) {
    return (
      <Button size="sm" variant="outline" disabled>
        Loading…
      </Button>
    );
  }

  if (!authenticated) {
    return (
      <Button size="sm" onClick={() => login()}>
        Sign in
      </Button>
    );
  }

  const label = wallet ? truncate(wallet.address) : (user?.email?.address ?? "Account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <span className="font-mono text-xs">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Your wallet
          {wallet && <div className="font-mono text-foreground mt-1 truncate">{wallet.address}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/projects">Browse projects</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className="text-destructive">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
