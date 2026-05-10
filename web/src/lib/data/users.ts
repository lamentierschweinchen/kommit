export type Role = "kommitter" | "founder" | "anon";

export type User = {
  id: string;
  displayName: string;
  role: Role;
  avatarSeed: number;
  email: string;
  wallet: string;
  /** Slug of the project this user owns (founder only) */
  ownsProject?: string;
};

// Mock wallets are real-format base58 32-byte Solana pubkeys (44 chars) so
// the Copy button on the /account row + the DepositModal yields something a
// faucet UI will accept. Generated via `Keypair.generate()` — the matching
// private keys exist nowhere, so these addresses are effectively burn
// destinations. Mock auth is dev-only; production uses Privy embedded wallets.
export const USERS: Record<string, User> = {
  lukas: {
    id: "lukas",
    displayName: "Lukas",
    role: "kommitter",
    avatarSeed: 68,
    email: "lukas@example.com",
    wallet: "VTg41QkSp7K44RmDgerBgWxqnm2ySjcN7qCytkxhgAa",
  },
  julian: {
    id: "julian",
    displayName: "Dr. Julian Vance",
    role: "founder",
    avatarSeed: 12,
    email: "julian@caldera.io",
    wallet: "CYzMs8zagf6jaanndLkR1Lv6h3x8nzAnoACGQfyBKMTF",
    ownsProject: "caldera",
  },
  sara: {
    id: "sara",
    displayName: "Sara Chen",
    role: "kommitter",
    avatarSeed: 32,
    email: "sara@example.com",
    wallet: "HjTDMvHr3tuyoBuQweq4zoJjY1E5zNfJbt9ncgQujJoq",
  },
};

export function getUser(id: string): User | undefined {
  return USERS[id];
}

export function avatarUrl(seed: number, size = 80): string {
  return `https://i.pravatar.cc/${size}?img=${seed}`;
}
