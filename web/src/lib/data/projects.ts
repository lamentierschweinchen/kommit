export type Sector =
  | "Climate"
  | "Fintech"
  | "Bio"
  | "Health"
  | "Edu"
  | "Consumer"
  | "Creator tools"
  | "Media"
  | "Community";

export type ProjectState = "active" | "graduated" | "just-listed";

export type Founder = {
  name: string;
  role: string;
  bio: string;
  avatarSeed: number;
  /**
   * Social account URLs surfaced on the project detail founder card. If none
   * are present the icon row hides entirely — no dead links to nowhere.
   */
  socials?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
};

export type ProjectUpdate = {
  atISO: string;
  title: string;
  body: string;
  isPivot?: boolean;
  isGraduation?: boolean;
};

export type ProjectKommitter = {
  /** Free-form display name; not necessarily a User in users.ts */
  name: string;
  avatarSeed: number;
  /** Linked user id, when this kommitter is a known user (e.g. lukas) */
  userId?: string;
  kommittedUSD: number;
  sinceISO: string;
};

export type Project = {
  slug: string;
  name: string;
  pitch: string;
  longerPitch: string[];
  sector: Sector;
  state: ProjectState;
  founders: Founder[];
  kommittersCount: number;
  totalKommittedUSD: number;
  /** Cohort-total kommits (the founder dashboard headline number) */
  totalKommitsGenerated: number;
  activeSinceISO: string;
  graduatedAtISO?: string;
  raisedAmountUSD?: number;
  raisedAtValuationUSD?: number;
  /**
   * Benefits the kommitter cohort earned when this project graduated. Only
   * meaningful for `state === "graduated"`. Rendered on the project detail
   * page below the graduation banner and inside the claim-benefits stub on
   * the kommitter's dashboard row.
   */
  kommitterBenefits?: string[];
  imageSeed: string;
  /** Card title display variant — drives content-safe-zone sizing */
  titleSize?: "tight" | "normal";
  updates: ProjectUpdate[];
  kommitters: ProjectKommitter[];
  /**
   * On-chain recipient wallet address (base58). Drives `findProjectPda(...)` for
   * the kommit/withdraw flow. Optional — projects without an on-chain Project
   * account yet show a friendly "not yet open for kommitments" state.
   *
   * The 6 wallets below are the existing devnet projects from the
   * web-legacy-anchor-ref scaffold; we repurpose their on-chain accounts for
   * the demo. New projects need `scripts/create_project.ts` run first.
   */
  recipientWallet?: string;
};

const CALDERA: Project = {
  slug: "caldera",
  name: "CALDERA",
  pitch: "Heat pumps for buildings that can't afford a shutdown.",
  longerPitch: [
    "Most commercial buildings still run on gas. Replacing the boiler is expensive, slow, and disruptive — so it doesn't happen. Caldera ships a per-zone retrofit stack: a borefield design tool, a financing template, and a six-week installation crew that doesn't shut your building down.",
    "We've quietly retrofitted three buildings since November — a 70,000-square-foot office tower in Chicago, a regional bank's HQ in Toronto, and a manufacturing facility's office wing in Cleveland. Pilots are running with measured savings published on a public dashboard. The next twelve months are about hardening the design tool, turning the largest pilot's results into a published case study, and opening the install playbook to a second tier of customers.",
    "Caldera doesn't compete with general commercial HVAC contractors. The focus is the per-zone retrofit segment — slow customers, big capex, hard requirements. The conviction is that this segment needs its own stack, and the team is the right one to ship it.",
  ],
  sector: "Climate",
  state: "active",
  founders: [
    {
      name: "Dr. Julian Vance",
      role: "CEO · ex-DOE building energy",
      bio: "Ran the DOE's commercial heat-pump pilot. PhD in geothermics. Has put pumps in eighty-six buildings on three continents.",
      avatarSeed: 12,
      socials: {
        linkedin: "https://www.linkedin.com/in/julianvance",
        twitter: "https://twitter.com/julianvance",
        website: "https://caldera.energy",
      },
    },
    {
      name: "Priya Singh",
      role: "CTO · ex-Tesla Energy",
      bio: "Designed Tesla's commercial-energy planner. Authored a chunk of the borefield-thermal models now in production. Lives in code; ships in calendar quarters, not sprints.",
      avatarSeed: 49,
      socials: {
        linkedin: "https://www.linkedin.com/in/priyasingh",
        twitter: "https://twitter.com/priya_borefield",
      },
    },
  ],
  kommittersCount: 142,
  totalKommittedUSD: 87_400,
  totalKommitsGenerated: 1_240_500,
  activeSinceISO: "2026-03-12",
  imageSeed: "caldera",
  recipientWallet: "Fpn7Fp41SeZ1fSDcZDSZMYwjnTUyx23Ui2ie1NhLRDad",
  titleSize: "normal",
  updates: [
    {
      atISO: "2026-04-28",
      title: "Borefield modeller 0.9 — design time under 80 minutes",
      body: "Cut the median design loop from 14 hours to 78 minutes. Largest pilot's design reviewed and approved in one afternoon. Production switchover scheduled for late May.",
    },
    {
      atISO: "2026-04-14",
      title: "HVAC code audit closed, two findings resolved",
      body: "Carrier engineers finished the install audit. Two medium findings, both patched and re-tested. Public report goes up next week alongside the install playbook.",
    },
    {
      atISO: "2026-03-30",
      title: "Third pilot signed — regional bank HQ",
      body: "Letter of intent signed. Energy review starts in two weeks. We won't name the bank publicly until they go live; the conversation alone moved our retrofit spec forward.",
    },
    {
      atISO: "2026-03-18",
      title: "Hired our first field-ops lead",
      body: "Dipali joins from Mitsubishi Electric's commercial team. We were running install scheduling off two laptops and Priya's phone. We are no longer.",
    },
    {
      atISO: "2026-03-12",
      title: "Live on Kommit",
      body: "We're opening up a kommit page to find kommitters who want to back this without diluting equity. You keep your money; we see a real backer. Thanks for showing up.",
    },
  ],
  kommitters: [
    { name: "Lukas", avatarSeed: 68, userId: "lukas", kommittedUSD: 200, sinceISO: "2026-03-12" },
    { name: "Sana", avatarSeed: 49, kommittedUSD: 500, sinceISO: "2026-03-14" },
    { name: "Miriam", avatarSeed: 20, kommittedUSD: 50, sinceISO: "2026-03-28" },
    { name: "Jordan", avatarSeed: 33, kommittedUSD: 1_000, sinceISO: "2026-03-22" },
    { name: "Yuki", avatarSeed: 15, kommittedUSD: 25, sinceISO: "2026-04-14" },
    { name: "Rosa", avatarSeed: 44, kommittedUSD: 100, sinceISO: "2026-04-07" },
    { name: "Theo", avatarSeed: 58, kommittedUSD: 300, sinceISO: "2026-04-02" },
    { name: "Aiko", avatarSeed: 24, kommittedUSD: 150, sinceISO: "2026-03-15" },
    { name: "Ben", avatarSeed: 11, kommittedUSD: 75, sinceISO: "2026-03-19" },
    { name: "Carmen", avatarSeed: 47, kommittedUSD: 400, sinceISO: "2026-03-21" },
    { name: "Dmitri", avatarSeed: 5, kommittedUSD: 600, sinceISO: "2026-03-25" },
    { name: "Elena", avatarSeed: 32, kommittedUSD: 120, sinceISO: "2026-03-30" },
    { name: "Farouk", avatarSeed: 22, kommittedUSD: 250, sinceISO: "2026-04-04" },
    { name: "Greta", avatarSeed: 41, kommittedUSD: 80, sinceISO: "2026-04-08" },
    { name: "Henry", avatarSeed: 7, kommittedUSD: 350, sinceISO: "2026-04-11" },
    { name: "Iris", avatarSeed: 36, kommittedUSD: 50, sinceISO: "2026-04-15" },
    { name: "Jules", avatarSeed: 13, kommittedUSD: 800, sinceISO: "2026-04-17" },
    { name: "Kira", avatarSeed: 28, kommittedUSD: 175, sinceISO: "2026-04-19" },
    { name: "Leo", avatarSeed: 51, kommittedUSD: 90, sinceISO: "2026-04-21" },
    { name: "Mei", avatarSeed: 16, kommittedUSD: 200, sinceISO: "2026-04-23" },
  ],
};

const LIGHTHOUSE: Project = {
  slug: "lighthouse-labs",
  name: "LIGHTHOUSE LABS",
  pitch: "Hyper-local microclimate forecasts for orchards and small farms.",
  longerPitch: [
    "Mid-size orchards lose product to frost and heat events that the National Weather Service forecast misses by miles. Lighthouse runs a mesh of low-cost sensors plus regional forecast fusion to deliver microclimate forecasts at the field level.",
    "Three pilots in Oregon's Willamette Valley showed a 22% reduction in frost-loss events over the 2025 season. Working on a fourth pilot in Sonoma and a wholesale extension into vineyards.",
  ],
  sector: "Climate",
  state: "active",
  founders: [
    {
      name: "Maya Chen",
      role: "CEO · ex-NOAA forecaster",
      bio: "Spent six years at NOAA building short-range forecast models. Grew up in an orchard family in Oregon.",
      avatarSeed: 47,
      socials: {
        linkedin: "https://www.linkedin.com/in/mayachen-noaa",
        twitter: "https://twitter.com/mayachen_wx",
        website: "https://lighthouselabs.farm",
      },
    },
  ],
  kommittersCount: 89,
  totalKommittedUSD: 42_180,
  totalKommitsGenerated: 412_240,
  activeSinceISO: "2026-04-02",
  recipientWallet: "6JEf5rbNH73sKuNZfnELaMcuAbYUNLTjrgTTzpBAJ1sh",
  imageSeed: "lighthouse",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-04-22",
      title: "Sonoma pilot signed",
      body: "First vineyard pilot starts next week. Same mesh, different crop physiology — interesting test for the forecast model.",
    },
    {
      atISO: "2026-04-10",
      title: "Sensor v2 ships",
      body: "Cut sensor cost 40% with a new SoC. Field trials in May; production in June.",
    },
    {
      atISO: "2026-04-02",
      title: "Live on Kommit",
      body: "Building demand validation before we go to seed. Backers welcome.",
    },
  ],
  kommitters: [
    { name: "Lukas", avatarSeed: 68, userId: "lukas", kommittedUSD: 300, sinceISO: "2026-04-02" },
  ],
};

const AURORA: Project = {
  slug: "aurora",
  name: "AURORA",
  pitch: "Same-day cash on cross-border invoices.",
  longerPitch: [
    "International B2B invoices take 30-60 days to clear. Aurora advances the cash on day one, takes a small fee, and clears settlement asynchronously through a stablecoin-backed liquidity pool.",
    "Two months in, $14M in advances cleared with under 0.3% loss rate. The cohort's conviction carried us through the round — closed a $2.4M seed extension on April 22 at an $18M valuation, allocation reserved for the kommitters who showed up early.",
  ],
  sector: "Fintech",
  state: "graduated",
  founders: [
    {
      name: "Tomás Reyes",
      role: "CEO · ex-Stripe payments",
      bio: "Led cross-border product at Stripe. Latin-America-first; banked in two currencies before he was twelve.",
      avatarSeed: 33,
      socials: {
        linkedin: "https://www.linkedin.com/in/tomasreyes",
        twitter: "https://twitter.com/tomasreyes",
        website: "https://aurora.cash",
      },
    },
  ],
  kommittersCount: 217,
  totalKommittedUSD: 118_500,
  totalKommitsGenerated: 2_184_750,
  activeSinceISO: "2026-02-28",
  graduatedAtISO: "2026-04-22",
  raisedAmountUSD: 2_400_000,
  raisedAtValuationUSD: 18_000_000,
  kommitterBenefits: [
    "Allocation rights in the $2.4M seed extension",
    "10% lifetime discount on Aurora Pro",
    "Early access to v2 (private beta, June 2026)",
    "Kommitter-only quarterly AMA with the founders",
    "Listed in the public cohort credits page",
  ],
  recipientWallet: "AoB7NCrsHTuD7cDPrGebdVvi3oYgGW1RVJNJahrVXJYF",
  imageSeed: "aurora",
  titleSize: "normal",
  updates: [
    {
      atISO: "2026-04-22",
      title: "Graduated — $2.4M seed extension closed",
      body: "We did it. $2.4M seed extension at $18M post-money, anchored by your conviction. Allocation rights and the rest of the kommitter benefits go live this week — check your dashboard. Thank you for backing us before this was easy.",
      isGraduation: true,
    },
    {
      atISO: "2026-04-18",
      title: "Series of Brazilian SMEs onboarded",
      body: "Twenty-six new accounts this month. The compliance flow is starting to click.",
    },
    {
      atISO: "2026-03-25",
      title: "$10M cleared",
      body: "Crossed $10M in advances cleared with three default events, all recovered through arbitration.",
    },
  ],
  kommitters: [
    { name: "Lukas", avatarSeed: 68, userId: "lukas", kommittedUSD: 500, sinceISO: "2026-02-28" },
  ],
};

const QUIRE_CHESS: Project = {
  slug: "quire-chess",
  name: "QUIRE CHESS",
  pitch: "Adaptive opening trainer with engine-graded study lines.",
  longerPitch: [
    "Most chess training apps fall apart past 1800 ELO. Quire builds opening repertoires from your own games, grades each line by Stockfish at depth 22, and surfaces the moves you actually need to drill.",
    "Pivoted away from a live-tournament module in April; the trainer was always where retention lived. Cleaner scope now, same problem.",
  ],
  sector: "Consumer",
  state: "active",
  founders: [
    {
      name: "Sofia Ahlberg",
      role: "CEO · WIM",
      bio: "Woman International Master. Spent five years as a chess streamer; knows where adult improvers stall.",
      avatarSeed: 24,
      socials: {
        twitter: "https://twitter.com/sofia_wim",
        website: "https://quire.chess",
      },
    },
  ],
  kommittersCount: 74,
  totalKommittedUSD: 31_820,
  totalKommitsGenerated: 318_200,
  activeSinceISO: "2026-04-08",
  recipientWallet: "DVpAMZCyCeE53whFxvxdPcvAyUif52T4Xp6jPWapDugJ",
  imageSeed: "quire",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-04-04",
      title: "Pivot — dropping the live-tournament module",
      body: "Dropping the live-tournament module. New focus: the trainer keeps shipping; the trainer was where retention lived all along.",
      isPivot: true,
    },
    {
      atISO: "2026-04-08",
      title: "Live on Kommit",
      body: "Coming out of pivot looking for backers who care about the trainer story.",
    },
  ],
  kommitters: [
    { name: "Lukas", avatarSeed: 68, userId: "lukas", kommittedUSD: 100, sinceISO: "2026-04-08" },
  ],
};

const FRAME_STUDIO: Project = {
  slug: "frame-studio",
  name: "FRAME STUDIO",
  pitch: "Frame-accurate video review in the browser, no installs.",
  longerPitch: [
    "Editorial teams still pass MP4s around for review notes. Frame Studio is a browser-native review tool with frame-accurate timestamping, threaded comments, and version diffing.",
    "1,200 paying teams, 30% MoM revenue growth. Targeting Frame.io's mid-market sweet spot.",
  ],
  sector: "Creator tools",
  state: "active",
  founders: [
    {
      name: "Ren Tanaka",
      role: "CEO · ex-Frame.io",
      bio: "Built Frame.io's mobile review app. Left to do this without Adobe's roadmap pulling on it.",
      avatarSeed: 15,
      socials: {
        linkedin: "https://www.linkedin.com/in/rentanaka",
        twitter: "https://twitter.com/rentanaka",
        website: "https://framestudio.app",
      },
    },
  ],
  kommittersCount: 126,
  totalKommittedUSD: 58_930,
  totalKommitsGenerated: 1_876_400,
  activeSinceISO: "2026-01-22",
  recipientWallet: "5SnBWYLqpuphFNfrWSLHYrXQYMCJrfEpNjMFpGPETBMV",
  imageSeed: "frame",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-04-20",
      title: "Hit 1,200 paying teams",
      body: "Crossed 1,200 paying teams. Quiet month; numbers spoke for themselves.",
    },
    {
      atISO: "2026-03-15",
      title: "Multi-track timeline ships",
      body: "Editors can review across video + audio tracks now. Big ask from agencies.",
    },
  ],
  kommitters: [
    { name: "Lukas", avatarSeed: 68, userId: "lukas", kommittedUSD: 200, sinceISO: "2026-01-22" },
  ],
};

const BEACON_SCI: Project = {
  slug: "beacon-sci",
  name: "BEACON SCI",
  pitch: "Verified peer review for biology preprints.",
  longerPitch: [
    "After the pivot in February, Beacon focuses on a peer-review attestation layer biology teams can plug into their own preprint pipelines. Cleaner scope, same problem: how do credible reviews get attached to preprints fast.",
    "Three pilot journals, $6/preprint pricing, expanding to chemistry and engineering in Q3.",
  ],
  sector: "Bio",
  state: "active",
  founders: [
    {
      name: "Dr. Anika Patel",
      role: "CEO · ex-bioRxiv",
      bio: "Spent four years at bioRxiv. Believes peer review should be portable infrastructure, not a journal moat.",
      avatarSeed: 58,
      socials: {
        linkedin: "https://www.linkedin.com/in/anikapatel-biorxiv",
        twitter: "https://twitter.com/anikapatel",
        website: "https://beacon-sci.org",
      },
    },
  ],
  kommittersCount: 61,
  totalKommittedUSD: 24_610,
  totalKommitsGenerated: 482_760,
  activeSinceISO: "2026-02-14",
  recipientWallet: "3ZZbd8jcVJ4aoPa768U2JqVRqeHA6SQfGUm7geQocpCe",
  imageSeed: "beacon",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-04-19",
      title: "Third pilot journal signed",
      body: "Cell-adjacent journal joins the pilot. Validation pipeline taking shape.",
    },
    {
      atISO: "2026-02-14",
      title: "Pivot — peer-review attestation layer",
      body: "Dropping the open-data layer pitch. New focus: a peer-review attestation layer biology teams can plug into their own preprint pipelines. Cleaner scope, same problem.",
      isPivot: true,
    },
  ],
  kommitters: [
    { name: "Lukas", avatarSeed: 68, userId: "lukas", kommittedUSD: 100, sinceISO: "2026-02-14" },
  ],
};

const CADENCE: Project = {
  slug: "cadence",
  name: "CADENCE",
  pitch: "A teaching gym for home cooks: six-week courses, one knife at a time.",
  longerPitch: [
    "Most online cooking content is recipe-shaped. Cadence is course-shaped: six-week structured curricula with weekly cooking projects, peer review, and master-class video reviews.",
    "MasterClass had no follow-through; Cadence is the follow-through.",
  ],
  sector: "Edu",
  state: "just-listed",
  founders: [
    {
      name: "Olivia Brand",
      role: "CEO · ex-Bon Appétit",
      bio: "Ran video at Bon Appétit. Knows the difference between content people watch and content people learn from.",
      avatarSeed: 11,
    },
  ],
  // Pre-launch (no recipientWallet) — cohort counters stay zero so the page
  // doesn't render "X kommitters" alongside "Launching soon". `activeSinceISO`
  // doubles as the launch date for pre-launch listings (handoff 58 #6).
  kommittersCount: 0,
  totalKommittedUSD: 0,
  totalKommitsGenerated: 0,
  activeSinceISO: "2026-06-01",
  imageSeed: "cadence",
  titleSize: "normal",
  updates: [
    {
      atISO: "2026-04-25",
      title: "Course #4 enrolling",
      body: "Stocks & soups starts May 12. Capping at 200 students.",
    },
  ],
  kommitters: [],
};

const FORGE_HEALTH: Project = {
  slug: "forge-health",
  name: "FORGE HEALTH",
  pitch: "Move your medical records between providers, on appointment day.",
  longerPitch: [
    "FHIR exists. Implementations are inconsistent. Forge is a thin layer that handles the inconsistency: a patient-side app that pulls and ports records on demand, regardless of EHR vendor.",
    "Live in three U.S. health systems. Targeting consumer beta in June.",
  ],
  sector: "Health",
  state: "just-listed",
  founders: [
    {
      name: "Marcus Doyle",
      role: "CEO · ex-Epic interoperability",
      bio: "Ten years at Epic on the interop team. Knows why this is hard, doing it anyway.",
      avatarSeed: 5,
    },
  ],
  // Pre-launch (no recipientWallet) — cohort counters stay zero so the page
  // doesn't render "X kommitters" alongside "Launching soon". `activeSinceISO`
  // doubles as the launch date for pre-launch listings (handoff 58 #6).
  kommittersCount: 0,
  totalKommittedUSD: 0,
  totalKommitsGenerated: 0,
  activeSinceISO: "2026-06-15",
  imageSeed: "forge",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-04-15",
      title: "Third health system goes live",
      body: "Mid-size hospital network in Pennsylvania. Three down, the rest of America to go.",
    },
  ],
  kommitters: [],
};

const VERITY_BOOKS: Project = {
  slug: "verity-books",
  name: "VERITY BOOKS",
  pitch: "Royalty statements for indie authors who hate spreadsheets.",
  longerPitch: [
    "Self-published authors get royalty statements from KDP, IngramSpark, Apple, Kobo, Draft2Digital, and a long tail. Verity ingests them all and gives the author a single dashboard, plus a quarterly tax-ready report.",
    "Targeting the 1.7M annual self-publishers who aren't getting served by enterprise royalty software.",
  ],
  sector: "Media",
  state: "just-listed",
  founders: [
    {
      name: "Hannah Park",
      role: "CEO · indie author",
      bio: "Self-published twelve books. Got tired of doing royalty math on the kitchen table at 2am.",
      avatarSeed: 44,
    },
  ],
  // Pre-launch (no recipientWallet) — cohort counters stay zero so the page
  // doesn't render "X kommitters" alongside "Launching soon". `activeSinceISO`
  // doubles as the launch date for pre-launch listings (handoff 58 #6).
  kommittersCount: 0,
  totalKommittedUSD: 0,
  totalKommitsGenerated: 0,
  activeSinceISO: "2026-06-22",
  imageSeed: "verity",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-04-21",
      title: "Live on Kommit",
      body: "First version of the import flow ships next week. Backers get early access.",
    },
  ],
  kommitters: [],
};

const MARGIN_HOUSE: Project = {
  slug: "margin-house",
  name: "MARGIN HOUSE",
  pitch: "A neighborhood library for tools nobody owns alone.",
  longerPitch: [
    "Power tools, ladders, kayaks, sewing machines — most households use them under five times a year. Margin House is a neighborhood-scale tool library, member-owned, run on a kommit deposit.",
    "First branch opening in Oakland in July. Looking for kommitter cohort to validate the city we open second.",
  ],
  sector: "Community",
  state: "just-listed",
  founders: [
    {
      name: "Lina Park",
      role: "Founder · ex-urban-planning Oakland",
      bio: "Worked on Oakland's neighborhood-scale planning for six years. Margin House is what she'd want on her own block.",
      avatarSeed: 20,
    },
  ],
  kommittersCount: 0,
  totalKommittedUSD: 0,
  totalKommitsGenerated: 0,
  activeSinceISO: "2026-05-06",
  imageSeed: "marginhouse",
  titleSize: "tight",
  updates: [
    {
      atISO: "2026-05-06",
      title: "Live on Kommit",
      body: "Just opened the page. Help us figure out which city goes second.",
    },
  ],
  kommitters: [],
};

export const PROJECTS: Project[] = [
  CALDERA,
  LIGHTHOUSE,
  AURORA,
  QUIRE_CHESS,
  FRAME_STUDIO,
  BEACON_SCI,
  CADENCE,
  FORGE_HEALTH,
  VERITY_BOOKS,
  MARGIN_HOUSE,
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function projectImageUrl(seed: string, w = 800, h = 400): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}
