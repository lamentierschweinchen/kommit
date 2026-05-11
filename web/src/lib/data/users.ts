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
  github?: string;
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
  /** Flag emoji prefix + city/country label, e.g. "🇩🇪 Berlin". Renders next to the role chip on /profile. */
  location?: string;
  /** Short tag list — DePIN, climate, etc. Rendered as chips. */
  interests?: string[];
  /**
   * True when the founder record carries role='admin' — Lukas / coordinator.
   * Used to bypass the /founder/<slug> ownership gate so admin can pinch-hit
   * on any project. Orthogonal to `role` (which is founder / kommitter /
   * anon for UI mode-switching).
   */
  isAdmin?: boolean;
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
    location: "🇩🇪 Berlin",
    interests: ["DePIN", "Climate", "Open science", "Bio"],
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
    bio: "Heat-pump engineer turned founder. Building Caldera so commercial buildings can decarbonise without shutting them down. Ran the DOE's commercial heat-pump pilot before going founder; PhD in geothermics from ETH Zürich.",
    location: "🇨🇭 Zürich",
    interests: ["Climate", "Mechanical systems", "Commercial retrofits"],
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
    location: "🇺🇸 San Francisco",
    interests: ["Hardware", "Climate", "Health"],
    socials: {
      linkedin: "https://www.linkedin.com/in/sarachen",
    },
  },
  // Founders — each owns a project in projects.ts. Seeded with rich bios so
  // the project-page → /profile link lands somewhere worth reading.
  priya: {
    id: "priya",
    displayName: "Priya Singh",
    role: "founder",
    avatarSeed: 49,
    email: "priya@caldera.io",
    wallet: "PRy7Q11SGzCALDeraPRYwTrcQ3vP1qXhM2NkRoSEKv7y",
    bio: "Designed Tesla's commercial-energy planner. Authored a chunk of the borefield-thermal models now in production. Lives in code; ships in calendar quarters, not sprints.",
    location: "🇺🇸 Palo Alto",
    interests: ["Climate", "Borefield modelling", "Energy systems"],
    socials: {
      linkedin: "https://www.linkedin.com/in/priyasingh",
      twitter: "https://twitter.com/priya_borefield",
    },
  },
  maya: {
    id: "maya",
    displayName: "Maya Chen",
    role: "founder",
    avatarSeed: 47,
    email: "maya@lighthouselabs.farm",
    wallet: "MaY9hLightHsLb22kCMc7nT3rGAFmsx4RDvP1qXhM5Kv",
    ownsProject: "lighthouse-labs",
    bio: "Six years at NOAA building short-range forecast models. Grew up in an orchard family in Oregon. Lighthouse is the forecast tool she wished her parents had had.",
    location: "🇺🇸 Portland",
    interests: ["Climate", "Microclimate", "Agriculture"],
    socials: {
      linkedin: "https://www.linkedin.com/in/mayachen-noaa",
      twitter: "https://twitter.com/mayachen_wx",
      website: "https://lighthouselabs.farm",
    },
  },
  tomas: {
    id: "tomas",
    displayName: "Tomás Reyes",
    role: "founder",
    avatarSeed: 33,
    email: "tomas@aurora.cash",
    wallet: "ToM7Aurora33QRsCDxhPay1tzcMa2NK3Lv9Wnz5DPbcs",
    ownsProject: "aurora",
    bio: "Led cross-border product at Stripe. Latin-America-first; banked in two currencies before he was twelve. Aurora closed a $2.4M seed extension at $18M post — kommitter allocation rights honored.",
    location: "🇲🇽 Mexico City",
    interests: ["Fintech", "LatAm", "Working capital"],
    socials: {
      linkedin: "https://www.linkedin.com/in/tomasreyes",
      twitter: "https://twitter.com/tomasreyes",
      website: "https://aurora.cash",
    },
  },
  sofia: {
    id: "sofia",
    displayName: "Sofia Ahlberg",
    role: "founder",
    avatarSeed: 24,
    email: "sofia@quire.chess",
    wallet: "SoF24Quire66QchsZAhLbRgWxN2NK3Lvz5cDPm7yYvRb",
    ownsProject: "quire-chess",
    bio: "Woman International Master. Spent five years as a chess streamer; knows where adult improvers stall. Pivoted Quire away from live tournaments to focus on the trainer — the retention was there all along.",
    location: "🇸🇪 Stockholm",
    interests: ["Chess", "Consumer learning", "Trainer products"],
    socials: {
      twitter: "https://twitter.com/sofia_wim",
      website: "https://quire.chess",
    },
  },
  ren: {
    id: "ren",
    displayName: "Ren Tanaka",
    role: "founder",
    avatarSeed: 15,
    email: "ren@framestudio.app",
    wallet: "ReN15FrameStudioPxhRTanaka2NK3Lvz5cDPm7yYvR9",
    ownsProject: "frame-studio",
    bio: "Built Frame.io's mobile review app. Left to do this without Adobe's roadmap pulling on it. 1,200 paying teams, 30% MoM revenue growth.",
    location: "🇯🇵 Tokyo",
    interests: ["Creator tools", "Video", "Editorial workflows"],
    socials: {
      linkedin: "https://www.linkedin.com/in/rentanaka",
      twitter: "https://twitter.com/rentanaka",
      website: "https://framestudio.app",
    },
  },
  anika: {
    id: "anika",
    displayName: "Dr. Anika Patel",
    role: "founder",
    avatarSeed: 58,
    email: "anika@beacon-sci.org",
    wallet: "AnK58BeaconSciPatelhRb2NK3Lvz5cDPmRgWxN7yYvR",
    ownsProject: "beacon-sci",
    bio: "Spent four years at bioRxiv. Believes peer review should be portable infrastructure, not a journal moat. Pivoted Beacon to the attestation layer — same problem, cleaner scope.",
    location: "🇮🇳 Bengaluru",
    interests: ["Open science", "Peer review", "Bio"],
    socials: {
      linkedin: "https://www.linkedin.com/in/anikapatel-biorxiv",
      twitter: "https://twitter.com/anikapatel",
      website: "https://beacon-sci.org",
    },
  },
  olivia: {
    id: "olivia",
    displayName: "Olivia Brand",
    role: "founder",
    avatarSeed: 11,
    email: "olivia@cadence.kitchen",
    wallet: "OlV11CadenceBrand2NK3Lvz5cDPmRgWxN7yYvRwTphR",
    ownsProject: "cadence",
    bio: "Ran video at Bon Appétit. Knows the difference between content people watch and content people learn from. Cadence is course-shaped, not recipe-shaped.",
    location: "🇺🇸 Brooklyn",
    interests: ["Edu", "Cooking", "Course design"],
    socials: {
      twitter: "https://twitter.com/oliviabrand",
    },
  },
  marcus: {
    id: "marcus",
    displayName: "Marcus Doyle",
    role: "founder",
    avatarSeed: 5,
    email: "marcus@forge.health",
    wallet: "McS5ForgeHealthDoyle2NK3Lvz5cDPmRgWxN7yYvR3a",
    ownsProject: "forge-health",
    bio: "Ten years at Epic on the interop team. Knows why this is hard, doing it anyway. Live in three U.S. health systems, targeting consumer beta in June.",
    location: "🇺🇸 Madison",
    interests: ["Health", "Interop", "FHIR"],
    socials: {
      linkedin: "https://www.linkedin.com/in/marcusdoyle",
    },
  },
  hannah: {
    id: "hannah",
    displayName: "Hannah Park",
    role: "founder",
    avatarSeed: 44,
    email: "hannah@verity.books",
    wallet: "HnH44VerityBooksPark2NK3Lvz5cDPmRgWxN7yYvR3b",
    ownsProject: "verity-books",
    bio: "Self-published twelve books. Got tired of doing royalty math on the kitchen table at 2am. Verity is what she'd want for herself.",
    location: "🇨🇦 Toronto",
    interests: ["Indie publishing", "Royalty", "SMB SaaS"],
    socials: {
      twitter: "https://twitter.com/hannahpark_indie",
      website: "https://verity.books",
    },
  },
  lina: {
    id: "lina",
    displayName: "Lina Park",
    role: "founder",
    avatarSeed: 20,
    email: "lina@marginhouse.co",
    wallet: "LnA20MarginHouseLinaP2NK3Lvz5cDPmRgWxN7yYvR3",
    ownsProject: "margin-house",
    bio: "Worked on Oakland's neighborhood-scale planning for six years. Margin House is what she'd want on her own block.",
    location: "🇺🇸 Oakland",
    interests: ["Community", "Urban planning", "Tool libraries"],
    socials: {
      twitter: "https://twitter.com/linapark_oak",
    },
  },
  // Seed kommitter personas — promoted to USERS so their /profile/<id>
  // routes resolve with bios + interests instead of a wallet stub. Wallet
  // strings come from SEED_WALLETS in seed-engagement.ts; keep them in
  // sync if those change. Bios are short on purpose.
  jordan: {
    id: "jordan",
    displayName: "Jordan",
    role: "kommitter",
    avatarSeed: 33,
    email: "jordan@example.com",
    wallet: "JoR8dN33xMA5kWzU4LhT9bvN7yC2RpQF6tS1XEGuVwBd",
    bio: "Backs founders who survive their own pivots. Quiet conviction; loud receipts.",
    location: "🇺🇸 Austin",
    interests: ["Climate", "Consumer", "Pivots"],
  },
  theo: {
    id: "theo",
    displayName: "Theo",
    role: "kommitter",
    avatarSeed: 58,
    email: "theo@example.com",
    wallet: "ThE7oH66Pb12NkRx4ZcL5MvJ8yDsGqW9tF1XVB2UYRcK",
    bio: "Retention-curve nerd. Backs teams that ship the scope cut, not the scope expansion.",
    location: "🇩🇪 Munich",
    interests: ["Consumer", "Retention", "Trainer products"],
  },
  aiko: {
    id: "aiko",
    displayName: "Aiko",
    role: "kommitter",
    avatarSeed: 24,
    email: "aiko@example.com",
    wallet: "AiK8oK77Gn34LpQy6XdMnRtJ9zEuHvR0aF2YBC3VWSdL",
    bio: "Engineering depth over engineering hype. Kommits early when the math holds up.",
    location: "🇯🇵 Tokyo",
    interests: ["Engineering", "Climate", "Chess"],
  },
  miriam: {
    id: "miriam",
    displayName: "Miriam",
    role: "kommitter",
    avatarSeed: 20,
    email: "miriam@example.com",
    wallet: "MrM7iA22qN98PvKx5HfFcLn1JyDp4Be0sWX3RT2EUcyA",
    bio: "Will tell you when your pivot drops the thing she came for. Stays anyway, usually.",
    location: "🇮🇱 Tel Aviv",
    interests: ["Consumer", "Community", "Edu"],
  },
  carmen: {
    id: "carmen",
    displayName: "Carmen",
    role: "kommitter",
    avatarSeed: 47,
    email: "carmen@example.com",
    wallet: "CaR1mC99Jd78NsTa9ZfOqUuL3bGyJzT4cH5ADE5XUYfN",
    bio: "Day-one backer energy. Allocation rights are a side effect, not the point.",
    location: "🇪🇸 Madrid",
    interests: ["Fintech", "LatAm", "Hardware"],
  },
  dmitri: {
    id: "dmitri",
    displayName: "Dmitri",
    role: "kommitter",
    avatarSeed: 5,
    email: "dmitri@example.com",
    wallet: "DmI2tD11Ke9PtUb1AhPrVvM4cHzKaU5dI7BEF6YVZgO",
    bio: "Watches public dashboards. Backs receipts, not decks.",
    location: "🇷🇸 Belgrade",
    interests: ["Climate", "DePIN", "Bio"],
  },
  henry: {
    id: "henry",
    displayName: "Henry",
    role: "kommitter",
    avatarSeed: 7,
    email: "henry@example.com",
    wallet: "HeN6yH55Oi35TxYf5ElTvZzQ8gLdOeY9hM1FIJ0CZdKS",
    bio: "Re-ups after pivots that point in the right direction. Skeptical of victory laps.",
    location: "🇬🇧 London",
    interests: ["Bio", "Open science", "Fintech"],
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
