import { SEED_WALLET_NAMES } from "./seed-engagement";

export type Role = "kommitter" | "founder" | "anon";

/**
 * Social account URLs for a user. Same shape as `Founder.socials` on
 * `data/projects.ts` so a single render component can take either. Empty
 * keys/objects are treated as "not set"; the renderer hides sections with
 * no entries.
 */
export type SocialLinks = {
  linkedin?: string;
  twitter?: string;
  website?: string;
};

export type User = {
  id: string;
  displayName: string;
  role: Role;
  avatarSeed: number;
  email: string;
  wallet: string;
  /** Slug of the project this user owns (founder only) */
  ownsProject?: string;
  /** Public-profile blurb shown on /account and on founder cards. */
  bio?: string;
  /** Public-profile social URLs. Render hides any missing entries. */
  socials?: SocialLinks;
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
    bio: "Building Kommit. Backing climate + bio. Reading more than I write.",
    socials: {
      linkedin: "https://www.linkedin.com/in/lukasseel",
      twitter: "https://twitter.com/lukasseel",
      website: "https://kommit.now",
    },
  },
  julian: {
    id: "julian",
    displayName: "Dr. Julian Vance",
    role: "founder",
    avatarSeed: 12,
    email: "julian@caldera.io",
    wallet: "CYzMs8zagf6jaanndLkR1Lv6h3x8nzAnoACGQfyBKMTF",
    ownsProject: "caldera",
    bio: "Heat-pump engineer turned founder. Building Caldera so commercial buildings can decarbonise without shutting down.",
    socials: {
      linkedin: "https://www.linkedin.com/in/julianvance",
      twitter: "https://twitter.com/julianvance",
      website: "https://caldera.energy",
    },
  },
  sara: {
    id: "sara",
    displayName: "Sara Chen",
    role: "kommitter",
    avatarSeed: 32,
    email: "sara@example.com",
    wallet: "HjTDMvHr3tuyoBuQweq4zoJjY1E5zNfJbt9ncgQujJoq",
    bio: "Backing teams that ship physical things. Patience > pitches.",
    socials: {
      linkedin: "https://www.linkedin.com/in/sarachen",
    },
  },
};

export function getUser(id: string): User | undefined {
  return USERS[id];
}

export function getUserByWallet(wallet: string): User | undefined {
  if (!wallet) return undefined;
  return Object.values(USERS).find((u) => u.wallet === wallet);
}

/**
 * Resolve a wallet to a display label. Prefers the persona's `displayName`
 * when the wallet matches a known cohort member; falls back to a truncated
 * "VTg…AqC4" so on-chain authors outside the demo cohort still render
 * something sensible. The `addressFallback` flag toggles whether unknown
 * wallets render as the truncated address (default) or a generic label.
 *
 * Seeded comment/note authors live in `data/seed-engagement.ts` and aren't
 * promoted to full `User` records — they're cohort members visible only in
 * engagement seeds. That map is consulted before falling through to the
 * truncated form so a comment from "Jordan" reads "Jordan", not
 * "JoR8…VwBd".
 */
export function walletDisplayName(
  wallet: string,
  opts: { genericLabel?: string } = {},
): string {
  if (!wallet) return opts.genericLabel ?? "—";
  const u = getUserByWallet(wallet);
  if (u) return u.displayName;
  const seedName = SEED_WALLET_NAMES[wallet];
  if (seedName) return seedName;
  if (opts.genericLabel) return opts.genericLabel;
  if (wallet.length < 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export function avatarUrl(seed: number, size = 80): string {
  return `https://i.pravatar.cc/${size}?img=${seed}`;
}
