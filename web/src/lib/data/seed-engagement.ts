/**
 * Deterministic seed data for the engagement loop: comments + reactions
 * attached to specific pivot/graduation updates, and backer notes attached
 * to specific commitments. Loaded by the /demo entry's `seedDemoCohort`
 * call into localStorage; rendered by `UpdatesPanel` + `BackerNotes` +
 * the founder dashboard.
 *
 * Keyed by `projectSlug` + `atISO` so the entries survive any future
 * renaming or reordering of static updates in `data/projects.ts` — the
 * lookup is by ISO date string, not by array index.
 *
 * Picked deliberately small: 4-7 comments per pivot update, mix of
 * supportive + skeptical voices, reaction counts in the 8-40 band so the
 * UI reads as "lived-in" rather than "viral." All wallet attributions
 * point to seeded kommitter personas so `walletDisplayName` resolves to
 * a real name in the comment header instead of a truncated address.
 */

import type { ReactionToken } from "@/lib/api-types";

/** A wallet-shaped pseudo-identifier — `walletDisplayName` falls back to
 *  the truncated form for unknown wallets, so the comment author reads as
 *  "Mr5… …kJL" rather than empty when no persona exists for the seed.
 *  Real-format base58 length keeps the truncation aligned with on-chain
 *  comment authors. */
type SeedWallet = string;

/** A short, stable wallet for a seeded kommitter persona — picked so the
 *  truncated display reads sensibly. */
const SEED_WALLETS = {
  sana: "SnA9rT11gh65fGzqL7w4dxR3jH2vCk8MqW6xPB1uYZ4t",
  miriam: "MrM7iA22qN98PvKx5HfFcLn1JyDp4Be0sWX3RT2EUcyA",
  jordan: "JoR8dN33xMA5kWzU4LhT9bvN7yC2RpQF6tS1XEGuVwBd",
  yuki: "YkI5uK44Zr67bMpQ8WyR1Lv9DnXc3GtH2fSE4UNV6PxB",
  rosa: "RoS6aS55Vt89WnXt2KbY3MzH5xCdEpQF7gL8RUVw1PbAj",
  theo: "ThE7oH66Pb12NkRx4ZcL5MvJ8yDsGqW9tF1XVB2UYRcK",
  aiko: "AiK8oK77Gn34LpQy6XdMnRtJ9zEuHvR0aF2YBC3VWSdL",
  ben: "BeN9pB88Hc56MrSz8YeNpStK1aFwIxS2bG3ZCD4WTXeM",
  carmen: "CaR1mC99Jd78NsTa9ZfOqUuL3bGyJzT4cH5ADE5XUYfN",
  dmitri: "DmI2tD11Ke9PtUb1AhPrVvM4cHzKaU5dI7BEF6YVZgO",
  elena: "ElE3nE22Lf02QuVc2BiQsWwN5dIaLbV6eJ8CFG7ZWaHP",
  farouk: "FaR4kF33Mg13RvWd3CjRtXxO6eJbMcW7fK9DGH8AXbIQ",
  greta: "GrE5tG44Nh24SwXe4DkSuYyP7fKcNdX8gL0EHI9BYcJR",
  henry: "HeN6yH55Oi35TxYf5ElTvZzQ8gLdOeY9hM1FIJ0CZdKS",
  iris: "IrI7sI66Pj46UyZg6FmUwAaR9hMePfZ0iN2GJK1DAEeT",
  jules: "JuL8eJ77Qk57VzAh7GnVxBbS1iNfQg18jO3HKL2EBfFU",
  kira: "KiR9aK88Rl68WaBi8HoWyCcT2jOgRhA9kP4ILM3FCgGV",
  leo: "LeO0nL99Sm79XbCj9IpXzDdU3kPhSiB0lQ5JMN4GDhHW",
  mei: "MeI1iM00Tn80YcDk0JqY1EeV4lQiTjC1mR6KNO5HEiIX",
} as const satisfies Record<string, SeedWallet>;

/**
 * Wallet → display-name overrides for seeded comment authors. Resolved
 * by `walletDisplayName` when none of the demo personas in `users.ts`
 * matches the wallet — preserves the persona attribution Lukas asked
 * for ("signed by the existing seeded kommitter personas") without
 * promoting every seed kommitter to a real `User` record.
 */
export const SEED_WALLET_NAMES: Record<string, string> = {
  [SEED_WALLETS.sana]: "Sana",
  [SEED_WALLETS.miriam]: "Miriam",
  [SEED_WALLETS.jordan]: "Jordan",
  [SEED_WALLETS.yuki]: "Yuki",
  [SEED_WALLETS.rosa]: "Rosa",
  [SEED_WALLETS.theo]: "Theo",
  [SEED_WALLETS.aiko]: "Aiko",
  [SEED_WALLETS.ben]: "Ben",
  [SEED_WALLETS.carmen]: "Carmen",
  [SEED_WALLETS.dmitri]: "Dmitri",
  [SEED_WALLETS.elena]: "Elena",
  [SEED_WALLETS.farouk]: "Farouk",
  [SEED_WALLETS.greta]: "Greta",
  [SEED_WALLETS.henry]: "Henry",
  [SEED_WALLETS.iris]: "Iris",
  [SEED_WALLETS.jules]: "Jules",
  [SEED_WALLETS.kira]: "Kira",
  [SEED_WALLETS.leo]: "Leo",
  [SEED_WALLETS.mei]: "Mei",
};

export type SeedComment = {
  authorWallet: SeedWallet;
  body: string;
  /** ISO timestamp — usually a few hours after the update's atISO so the
   *  comment shows as "Xh ago" relative to the update. */
  postedAtISO: string;
};

export type SeedReactionCounts = Partial<Record<ReactionToken, number>>;

export type SeedBackerNote = {
  /** Project slug this note attaches to — drives the founder dashboard
   *  + public BackerNotes panel lookup. */
  projectSlug: string;
  authorName: string;
  /** Persona wallet for attribution — used by founder dashboard listing. */
  authorWallet: SeedWallet;
  principalUSD: number;
  note: string;
  atISO: string;
};

export type SeedEngagementEntry = {
  /** Project slug — joins to `PROJECTS[].slug` in data/projects.ts. */
  projectSlug: string;
  /** Update `atISO` — joins to a specific update in `PROJECTS[].updates[]`. */
  updateAtISO: string;
  reactions?: SeedReactionCounts;
  comments?: SeedComment[];
};

/**
 * Comment + reaction seeds for specific updates. Keyed via lookup helper
 * `findSeedEngagement(projectSlug, updateAtISO)` so the loader can match
 * against either RemoteUpdate (stable id) or SeedUpdate (slug+atISO).
 */
export const SEED_ENGAGEMENT: SeedEngagementEntry[] = [
  // QUIRE CHESS — pivot to drop live-tournament module.
  {
    projectSlug: "quire-chess",
    updateAtISO: "2026-04-04",
    reactions: { "+1": 27, fire: 14, heart: 19, hmm: 8 },
    comments: [
      {
        authorWallet: SEED_WALLETS.jordan,
        body: "Trainer was always the wedge. Live-tournament was the distraction. Glad to see it called out — backing this stays a yes for me.",
        postedAtISO: "2026-04-04T14:20:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.miriam,
        body: "I came in for the tournaments — bummed to see them go. Will the trainer ship something for sub-1200 players too?",
        postedAtISO: "2026-04-04T17:05:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.theo,
        body: "Right call. Retention numbers don't lie. Adult-improver market is way bigger than the tournament-streamer one.",
        postedAtISO: "2026-04-05T09:42:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.aiko,
        body: "Curious how the engine-graded study lines scale past 2200 ELO. Anything beyond Stockfish depth 22 you're considering?",
        postedAtISO: "2026-04-05T11:30:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.kira,
        body: "Sticking around. Pivots that shrink scope to where retention is are the ones that work. Don't add features back, please.",
        postedAtISO: "2026-04-06T16:11:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.dmitri,
        body: "I'd like more transparency on the cash runway after this. What does dropping the module do to burn?",
        postedAtISO: "2026-04-07T08:55:00.000Z",
      },
    ],
  },
  // BEACON SCI — pivot to peer-review attestation layer.
  {
    projectSlug: "beacon-sci",
    updateAtISO: "2026-02-14",
    reactions: { "+1": 31, fire: 22, heart: 16, hmm: 11 },
    comments: [
      {
        authorWallet: SEED_WALLETS.elena,
        body: "Peer-review-as-infrastructure is the right framing. The journal moat has been due for unbundling for a decade.",
        postedAtISO: "2026-02-14T19:40:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.farouk,
        body: "Worried the attestation layer is too narrow without the open-data piece. How do you compete with PREreview / Hypothesis on volume?",
        postedAtISO: "2026-02-15T10:22:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.greta,
        body: "Pricing at $6/preprint is bold. What's the unit economics look like at 100k preprints/year?",
        postedAtISO: "2026-02-15T13:14:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.henry,
        body: "Cleaner scope is a feature. Backed at the open-data pitch — still backed at this one. Anika has the right read on bioRxiv's adjacent.",
        postedAtISO: "2026-02-16T08:30:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.iris,
        body: "Will the attestations be portable across journals? If yes, this is infrastructure. If no, it's another vertical SaaS.",
        postedAtISO: "2026-02-17T11:50:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.jules,
        body: "Three pilots is a real start. Send the standards draft when it's ready — happy to push on it inside our editorial board.",
        postedAtISO: "2026-02-18T15:25:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.leo,
        body: "Skeptical the attestation layer alone justifies the team size. Show me the moat against scite.ai in six months.",
        postedAtISO: "2026-02-20T09:15:00.000Z",
      },
    ],
  },
  // AURORA — graduation announcement gets celebration + reflection.
  {
    projectSlug: "aurora",
    updateAtISO: "2026-04-22",
    reactions: { "+1": 38, fire: 29, heart: 34, hmm: 4 },
    comments: [
      {
        authorWallet: SEED_WALLETS.carmen,
        body: "Backed Aurora at $14M in advances, watched it triple. Glad the allocation rights are honored — this is what kommit was supposed to be.",
        postedAtISO: "2026-04-22T16:10:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.henry,
        body: "Congrats to the team. $18M post is fair — the loss rate alone should have priced this higher. Stay sharp on the Brazilian compliance flow.",
        postedAtISO: "2026-04-22T18:45:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.mei,
        body: "Quarterly AMAs sound great. First question already queued: when does the LatAm corridor go bi-directional?",
        postedAtISO: "2026-04-23T09:20:00.000Z",
      },
      {
        authorWallet: SEED_WALLETS.aiko,
        body: "First graduation on the platform — feels significant. Hope the v2 beta in June ships on time.",
        postedAtISO: "2026-04-24T11:05:00.000Z",
      },
    ],
  },
];

/**
 * Backer notes left at commit time. Two per pivoted project — short text
 * explaining why the backer stayed (or pivoted out). Demo-only state, but
 * surfaces in three places: the public `BackerNotes` panel on
 * `/projects/[slug]`, the founder dashboard backer-notes section, and the
 * kommitter cohort timeline.
 */
export const SEED_BACKER_NOTES: SeedBackerNote[] = [
  // QUIRE CHESS — pivot
  {
    projectSlug: "quire-chess",
    authorName: "Jordan",
    authorWallet: SEED_WALLETS.jordan,
    principalUSD: 1_000,
    note: "Stayed through the pivot. The trainer is what I backed; happy to see the team admit it. Doubling down once v1 ships.",
    atISO: "2026-04-08T15:30:00.000Z",
  },
  {
    projectSlug: "quire-chess",
    authorName: "Theo",
    authorWallet: SEED_WALLETS.theo,
    principalUSD: 300,
    note: "Cut scope, kept conviction. That's the trade I want founders to make.",
    atISO: "2026-04-10T10:15:00.000Z",
  },
  // BEACON SCI — pivot
  {
    projectSlug: "beacon-sci",
    authorName: "Henry",
    authorWallet: SEED_WALLETS.henry,
    principalUSD: 350,
    note: "Backed Anika before the open-data pitch shipped. Still backing her after the pivot. Peer-review infra is the real prize.",
    atISO: "2026-02-15T14:20:00.000Z",
  },
  {
    projectSlug: "beacon-sci",
    authorName: "Greta",
    authorWallet: SEED_WALLETS.greta,
    principalUSD: 80,
    note: "Stayed in. Wanted the bigger scope, but a smaller scope that ships beats a bigger one that doesn't.",
    atISO: "2026-02-17T09:40:00.000Z",
  },
  {
    projectSlug: "beacon-sci",
    authorName: "Iris",
    authorWallet: SEED_WALLETS.iris,
    principalUSD: 50,
    note: "Re-upped after the pivot. Portability is what I want to see — keeping an eye on the standards draft.",
    atISO: "2026-02-19T16:00:00.000Z",
  },
  // AURORA — graduated
  {
    projectSlug: "aurora",
    authorName: "Carmen",
    authorWallet: SEED_WALLETS.carmen,
    principalUSD: 400,
    note: "Day-one backer, day-one allocation rights. The pitch landed exactly the way the founder said it would.",
    atISO: "2026-04-22T17:00:00.000Z",
  },
  {
    projectSlug: "aurora",
    authorName: "Mei",
    authorWallet: SEED_WALLETS.mei,
    principalUSD: 200,
    note: "Came in late but stayed. Excited for v2 — the LatAm corridor reshapes how I think about SME working capital.",
    atISO: "2026-04-23T12:30:00.000Z",
  },
  {
    projectSlug: "aurora",
    authorName: "Henry",
    authorWallet: SEED_WALLETS.henry,
    principalUSD: 350,
    note: "Aurora was the most honest update cadence on Kommit. That made the conviction easy.",
    atISO: "2026-04-24T08:45:00.000Z",
  },
  // CALDERA — non-pivot, conviction notes so Julian's founder dashboard
  // surfaces a populated Backer notes section.
  {
    projectSlug: "caldera",
    authorName: "Jordan",
    authorWallet: SEED_WALLETS.jordan,
    principalUSD: 1_000,
    note: "Three retrofits in, real numbers on the dashboard. Most climate startups are still in deck land — y'all are in mechanical rooms.",
    atISO: "2026-03-22T14:00:00.000Z",
  },
  {
    projectSlug: "caldera",
    authorName: "Carmen",
    authorWallet: SEED_WALLETS.carmen,
    principalUSD: 400,
    note: "Backing because the install playbook will be the moat — not the borefield model. Keep shipping the boring parts.",
    atISO: "2026-03-21T11:30:00.000Z",
  },
  {
    projectSlug: "caldera",
    authorName: "Dmitri",
    authorWallet: SEED_WALLETS.dmitri,
    principalUSD: 600,
    note: "Watched the median design loop drop from 14h to 78 min on the public dashboard. That's the kind of receipts I came for.",
    atISO: "2026-04-26T09:00:00.000Z",
  },
];

/** O(n) lookup; n is single-digit. */
export function findSeedEngagement(
  projectSlug: string,
  updateAtISO: string,
): SeedEngagementEntry | undefined {
  return SEED_ENGAGEMENT.find(
    (e) => e.projectSlug === projectSlug && e.updateAtISO === updateAtISO,
  );
}
