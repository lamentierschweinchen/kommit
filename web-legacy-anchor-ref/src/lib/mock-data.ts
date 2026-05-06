/**
 * Mock fixtures for the structural MVP.
 *
 * Real data path (drop-in replacements when off-chain stack lands):
 *   - getAllProjects()       → program.account.project.all() OR Supabase materialized view
 *   - getProjectBySlug(s)    → derive Project PDA from recipient_wallet OR Supabase by slug
 *   - getCommitmentsByUser   → program.account.commitment.all([memcmp on user offset])
 *   - getCommitmentsByProject→ program.account.commitment.all([memcmp on project offset])
 *
 * Slug → recipient_wallet mapping lives here as a private-beta workaround. v1.5
 * adds an off-chain projects table keyed by slug (Supabase). Until then, the
 * hand-seeded projects use deterministic mock recipient pubkeys so the PDA
 * derivations are stable across reads.
 */

import { PublicKey } from "@solana/web3.js";

export type Pivot = { from: string; date: string };

export type Project = {
  slug: string;
  name: string;
  pitch: string;
  longPitch: string;
  team: string;
  recipientWallet: string;
  sector: string;
  stage: "Pre-seed" | "Seed" | "Series A";
  teamSize: number;
  committed: number;
  supporters: number;
  weeklyYield: number;
  daysActive: number;
  since: string;
  founders: { name: string; role: string; bio: string }[];
  updates: { date: string; title: string; body: string; pivot?: boolean }[];
  pivoted?: Pivot;
};

export type Commitment = {
  projectSlug: string;
  team: string;
  amount: number;
  daysActive: number;
  since: string;
  /** Active reputation score — stored as bigint (u128 on-chain) for exact display past 2^53. */
  activePoints: bigint;
  weeklyYield: number;
};

export type Supporter = {
  wallet: string;
  amount: number;
  since: string;
  /** Lifetime reputation score — bigint for exact display past 2^53. */
  points: bigint;
};

export type YieldReceipt = {
  date: string;
  amount: number;
  tx: string;
};

export type Activity = {
  when: string;
  text: string;
};

export const MOCK_PROJECTS: Project[] = [
  {
    slug: "geyser",
    name: "Geyser",
    pitch: "A real-time data fabric for IoT sensor networks operating at the edge.",
    longPitch:
      "Industrial sensor networks generate terabytes of telemetry that current pipelines either drop, downsample, or ship to expensive proprietary clouds. Geyser is an open-source data plane that runs at the edge, deduplicates and compresses on-device, and federates across sites — so operators get the full signal without the bandwidth bill.",
    team: "Caldera",
    recipientWallet: "Fpn7Fp41SeZ1fSDcZDSZMYwjnTUyx23Ui2ie1NhLRDad",
    sector: "Infrastructure",
    stage: "Seed",
    teamSize: 4,
    committed: 18420,
    supporters: 87,
    weeklyYield: 18.42,
    daysActive: 51,
    since: "Mar 12",
    founders: [
      { name: "Lin Park", role: "CEO", bio: "Previously infrastructure lead at Cloudflare." },
      { name: "Aman Diallo", role: "CTO", bio: "ex-staff eng, AWS IoT." },
    ],
    updates: [
      {
        date: "Apr 28",
        title: "Three-site federated pilot live",
        body: "Closed the loop with our second design partner on a three-site federation. Compression hit 14× without lossy mode.",
      },
    ],
  },
  {
    slug: "beacon",
    name: "Beacon",
    pitch: "Open-source observability for serverless functions across providers.",
    longPitch:
      "Most teams running serverless code rely on bespoke logging, expensive APMs, or nothing at all. Beacon is an open-core observability layer that drops in across AWS Lambda, Cloudflare Workers, Vercel, and Deno Deploy with one SDK and a single dashboard.",
    team: "Lighthouse Labs",
    recipientWallet: "6JEf5rbNH73sKuNZfnELaMcuAbYUNLTjrgTTzpBAJ1sh",
    sector: "Developer tools",
    stage: "Seed",
    teamSize: 5,
    committed: 24800,
    supporters: 132,
    weeklyYield: 24.8,
    daysActive: 35,
    since: "Mar 28",
    pivoted: { from: "Lantern, a structured-logging library", date: "Mar 28" },
    founders: [
      { name: "Maya Khoury", role: "CEO", bio: "Previously eng lead, Datadog." },
      { name: "Ren Ito", role: "CTO", bio: "Staff engineer, ex-Stripe." },
      { name: "Priya Vasquez", role: "Founding eng", bio: "Previously infra, Vercel." },
    ],
    updates: [
      {
        date: "Apr 24",
        title: "Kafka adapter shipped, Datadog parity for 80% of dashboards",
        body: "Closed the last gap on the migration path most teams hit. Three pilots are now fully cut over.",
      },
      {
        date: "Apr 02",
        title: "First three design partners signed",
        body: "Cohort of three Series-B infra teams agreed to a 90-day pilot. Early feedback is driving the roadmap.",
      },
      {
        date: "Mar 28",
        title: "Why we pivoted from Lantern to Beacon",
        body: "Lantern was a structured-logging library that wasn't finding pull. Three customer interviews surfaced the deeper pain — observability for serverless. We're doubling down there.",
        pivot: true,
      },
    ],
  },
  {
    slug: "endgame",
    name: "Endgame",
    pitch: "Adaptive chess training with engine-graded openings tuned to your repertoire.",
    longPitch:
      "Most chess training apps either dump engine output on you or wrap canned puzzles with gamification. Endgame learns the openings you actually play, the mistakes you actually make, and grades training puzzles to push exactly the edge of your repertoire.",
    team: "Quire Chess",
    recipientWallet: "AoB7NCrsHTuD7cDPrGebdVvi3oYgGW1RVJNJahrVXJYF",
    sector: "Consumer",
    stage: "Pre-seed",
    teamSize: 3,
    committed: 6210,
    supporters: 41,
    weeklyYield: 6.21,
    daysActive: 30,
    since: "Apr 02",
    founders: [
      { name: "Sasha Renko", role: "CEO + Product", bio: "Former chess pro, FIDE 2380." },
      { name: "Tomás Ferreira", role: "CTO", bio: "ML infra, ex-DeepMind." },
    ],
    updates: [
      {
        date: "Apr 22",
        title: "1k DAU on the closed beta",
        body: "First milestone passed. Retention curve is steep but flatter than we expected — investigating why.",
      },
    ],
  },
  {
    slug: "north",
    name: "North",
    pitch: "Parametric climate insurance pricing for smallholder farms in emerging markets.",
    longPitch:
      "Smallholder farmers in emerging markets get squeezed by climate volatility but priced out of conventional insurance. North uses satellite + on-the-ground data to underwrite parametric policies that pay out on indices, not claims — settling in days, not months.",
    team: "Aurora Ventures",
    recipientWallet: "DVpAMZCyCeE53whFxvxdPcvAyUif52T4Xp6jPWapDugJ",
    sector: "Climate",
    stage: "Seed",
    teamSize: 6,
    committed: 31200,
    supporters: 154,
    weeklyYield: 31.2,
    daysActive: 88,
    since: "Feb 04",
    founders: [
      { name: "Emeka Okafor", role: "CEO", bio: "ex-Swiss Re, ag-insurance specialist." },
      { name: "Hana Ito", role: "Head of underwriting", bio: "Actuary, climate risk." },
    ],
    updates: [
      {
        date: "Apr 30",
        title: "First payout settled in 4 days",
        body: "Trigger fired on a Kenya cassava cooperative. Settlement: 4 days from index threshold to USDC in farmer wallets.",
      },
    ],
  },
  {
    slug: "atelier",
    name: "Atelier",
    pitch: "Collaborative video editing in the browser, with frame-accurate review.",
    longPitch:
      "Atelier is a frame-accurate, latency-tolerant collaborative video editor for distributed creative teams. Real-time presence, frame-stamped comments, render queues that feel native.",
    team: "Frame Studio",
    recipientWallet: "5SnBWYLqpuphFNfrWSLHYrXQYMCJrfEpNjMFpGPETBMV",
    sector: "Creator tools",
    stage: "Pre-seed",
    teamSize: 4,
    committed: 9870,
    supporters: 62,
    weeklyYield: 9.87,
    daysActive: 100,
    since: "Jan 22",
    founders: [
      { name: "Jules Marsh", role: "CEO + design", bio: "Ex-Figma." },
      { name: "Iva Korbel", role: "CTO", bio: "WebGL, ex-Google Stadia." },
    ],
    updates: [
      {
        date: "Apr 18",
        title: "100k frames cached per session, no jitter",
        body: "We moved the timeline cache off main thread. Editing feels like local even on cross-continent sessions.",
      },
    ],
  },
  {
    slug: "argent",
    name: "Argent",
    pitch: "A unified ledger for cross-border B2B settlements over Solana.",
    longPitch:
      "B2B treasurers running cross-border ops still juggle 4–6 banking relationships per market. Argent is a unified ledger and settlement layer that consolidates onto Solana stablecoins — same compliance posture, one balance sheet view.",
    team: "Mint & Co",
    recipientWallet: "3ZZbd8jcVJ4aoPa768U2JqVRqeHA6SQfGUm7geQocpCe",
    sector: "Fintech",
    stage: "Seed",
    teamSize: 3,
    committed: 14500,
    supporters: 71,
    weeklyYield: 14.5,
    daysActive: 22,
    since: "Apr 10",
    founders: [
      { name: "Diego Alvarez", role: "CEO", bio: "ex-treasury, Stripe APAC." },
      { name: "Mira Chen", role: "Head of compliance", bio: "ex-Wise legal." },
    ],
    updates: [],
  },
];

export const MOCK_COMMITMENTS: Commitment[] = [
  {
    projectSlug: "geyser",
    team: "Caldera",
    amount: 200,
    daysActive: 51,
    since: "Mar 12",
    activePoints: 3240n,
    weeklyYield: 0.42,
  },
  {
    projectSlug: "atelier",
    team: "Frame Studio",
    amount: 100,
    daysActive: 100,
    since: "Jan 22",
    activePoints: 9860n,
    weeklyYield: 0.21,
  },
  {
    projectSlug: "north",
    team: "Aurora Ventures",
    amount: 50,
    daysActive: 28,
    since: "Apr 04",
    activePoints: 720n,
    weeklyYield: 0.1,
  },
];

export const MOCK_SUPPORTERS: Supporter[] = [
  { wallet: "Hf3k…d4f9", amount: 200, since: "Mar 12", points: 3240n },
  { wallet: "Q9aB…c811", amount: 500, since: "Mar 14", points: 7820n },
  { wallet: "Lp2v…e004", amount: 50, since: "Mar 28", points: 540n },
  { wallet: "Mn7d…a1c3", amount: 1000, since: "Apr 01", points: 13200n },
  { wallet: "Tx5k…f902", amount: 25, since: "Apr 09", points: 210n },
  { wallet: "Vb6r…8aa2", amount: 100, since: "Apr 17", points: 870n },
  { wallet: "Yq1n…dd55", amount: 300, since: "Apr 21", points: 1980n },
];

export const MOCK_YIELD_RECEIPTS: YieldReceipt[] = [
  { date: "Apr 28", amount: 5.32, tx: "7eK3pQm2nL…x9" },
  { date: "Apr 21", amount: 4.91, tx: "4pM8tRk1hC…a2" },
  { date: "Apr 14", amount: 4.74, tx: "9bN1cVq7oS…c0" },
  { date: "Apr 07", amount: 4.12, tx: "2hL6rXw3jB…e7" },
  { date: "Mar 31", amount: 3.88, tx: "d5R2yZf8mP…11" },
];

export const MOCK_ACTIVITY: Activity[] = [
  { when: "6h ago", text: "committed $50" },
  { when: "1d ago", text: "committed $200" },
  { when: "2d ago", text: "committed $25" },
  { when: "3d ago", text: "withdrew $100" },
  { when: "4d ago", text: "committed $500" },
  { when: "6d ago", text: "committed $50" },
];

export const ROTATING_WORDS = [
  "big idea",
  "great team",
  "breakthrough innovation",
  "generational company",
  "moonshot",
];

export function getAllProjects(): Project[] {
  return MOCK_PROJECTS;
}

export function getProjectBySlug(slug: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.slug === slug);
}

export function getCommitmentsForUser(): Commitment[] {
  return MOCK_COMMITMENTS;
}

export function getSupportersForProject(): Supporter[] {
  return MOCK_SUPPORTERS;
}

export function getYieldReceiptsForProject(): YieldReceipt[] {
  return MOCK_YIELD_RECEIPTS;
}

export function getActivityForProject(): Activity[] {
  return MOCK_ACTIVITY;
}

export function projectRecipientPubkey(p: Project): PublicKey {
  return new PublicKey(p.recipientWallet);
}
