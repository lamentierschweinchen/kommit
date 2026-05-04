/**
 * Role-aware menu per design.md "Two user types, one app":
 * Shows "Switch to founder view" only if the user owns at least one project
 * (queries Project PDAs by `recipient_wallet == user.publicKey`).
 *
 * Mock implementation: hard-coded list of "founder demo" wallets in dev.
 * Real swap path: program.account.project.all([{ memcmp: { offset: 8, bytes: user.publicKey } }])
 */

"use client";

import Link from "next/link";
import { useWallets } from "@privy-io/react-auth/solana";
import { Button } from "@/components/ui/button";
import { MOCK_PROJECTS } from "@/lib/mock-data";

const PRIVY_CONFIGURED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function RoleSwitcher() {
  if (!PRIVY_CONFIGURED) return null;
  return <RoleSwitcherInner />;
}

function RoleSwitcherInner() {
  const { wallets } = useWallets();
  const wallet = wallets[0];
  if (!wallet) return null;

  const owned = MOCK_PROJECTS.find((p) => p.recipientWallet === wallet.address);
  if (!owned) return null;

  return (
    <Button asChild size="sm" variant="ghost">
      <Link href={`/founder/${owned.slug}`}>Switch to founder view</Link>
    </Button>
  );
}
