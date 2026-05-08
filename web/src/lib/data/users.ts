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
  lina: {
    id: "lina",
    displayName: "Lina Park",
    role: "founder",
    avatarSeed: 20,
    email: "lina@marginhouse.org",
    wallet: "83EDkAQhmpeTQW6mmBwc6RctS5S99324tvsq1oJVAqC4",
    ownsProject: "margin-house",
  },
  maya: {
    id: "maya",
    displayName: "Maya Okonkwo",
    role: "kommitter",
    avatarSeed: 32,
    email: "maya@example.com",
    wallet: "HjTDMvHr3tuyoBuQweq4zoJjY1E5zNfJbt9ncgQujJoq",
  },
  theo: {
    id: "theo",
    displayName: "Theo Reinhardt",
    role: "kommitter",
    avatarSeed: 45,
    email: "theo@example.com",
    wallet: "CG4uVkhn77jnCHjuTgSKeZVE8Bzbn6TM5TnJ7s2mYCPo",
  },
};

export function getUser(id: string): User | undefined {
  return USERS[id];
}

export function avatarUrl(seed: number, size = 80): string {
  return `https://i.pravatar.cc/${size}?img=${seed}`;
}
