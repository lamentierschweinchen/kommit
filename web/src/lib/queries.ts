/**
 * Single read-side facade across three data sources. Screens import from here
 * and don't know which source they're reading from.
 *
 * Source selection (env flags, evaluated at import-time on the client):
 *   NEXT_PUBLIC_USE_INDEXER === 'true'      → Supabase materialized views
 *   NEXT_PUBLIC_USE_MOCK_DATA === 'false'   → on-chain Anchor reads
 *   else (default)                           → mock fixtures
 *
 * Indexer wins when both are set. The default keeps the demo working without
 * any external service.
 *
 * Slug ↔ recipient_wallet mapping lives in lib/mock-data.ts as the off-chain
 * "projects table" stand-in for v1 private beta. When IPFS metadata pinning
 * is fully wired (engineer's track), the indexer's `metadata` jsonb column
 * supplies name/pitch/team/founders, and we drop the seed-join here.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import idl from "@/lib/idl/kommit.json";
import {
  KOMMIT_PROGRAM_ID,
  type Kommit,
  findProjectPda,
  getSupabaseClient,
} from "@/lib/kommit";
import {
  MOCK_PROJECTS,
  MOCK_COMMITMENTS,
  MOCK_SUPPORTERS,
  MOCK_YIELD_RECEIPTS,
  MOCK_ACTIVITY,
  type Project,
  type Commitment,
  type Supporter,
  type YieldReceipt,
  type Activity,
} from "@/lib/mock-data";
import { formatTokenAmount, toBigInt } from "@/lib/money";

// ---------------------------------------------------------------------------
// Source selection
// ---------------------------------------------------------------------------

export type DataSource = "mock" | "anchor" | "indexer";

export function getDataSource(): DataSource {
  if (process.env.NEXT_PUBLIC_USE_INDEXER === "true") return "indexer";
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "false") return "anchor";
  return "mock";
}

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

// ---------------------------------------------------------------------------
// Read-only Anchor program. No wallet → can fetch but never sign.
// ---------------------------------------------------------------------------

let cachedReadProgram: Program<Kommit> | null = null;

function getReadProgram(): Program<Kommit> {
  if (cachedReadProgram) return cachedReadProgram;
  const connection = new Connection(RPC_URL, "confirmed");
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error("Read-only — no signing available in queries.ts");
    },
    signAllTransactions: async () => {
      throw new Error("Read-only — no signing available in queries.ts");
    },
  } as unknown as Wallet;
  const provider = new AnchorProvider(
    connection,
    dummyWallet,
    AnchorProvider.defaultOptions()
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cachedReadProgram = new Program<Kommit>(idl as any, provider);
  return cachedReadProgram;
}

// Pre-derive Project PDAs for hand-seeded projects so we can match on-chain
// reads back to slug + display metadata in O(1).
const PROJECT_PDA_BY_RECIPIENT: Record<string, string> = Object.fromEntries(
  MOCK_PROJECTS.map((p) => [
    p.recipientWallet,
    findProjectPda(new PublicKey(p.recipientWallet)).toBase58(),
  ])
);
const SEED_BY_RECIPIENT: Record<string, Project> = Object.fromEntries(
  MOCK_PROJECTS.map((p) => [p.recipientWallet, p])
);
const SEED_BY_PROJECT_PDA: Record<string, Project> = Object.fromEntries(
  MOCK_PROJECTS.map((p) => [
    findProjectPda(new PublicKey(p.recipientWallet)).toBase58(),
    p,
  ])
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USDC_DECIMALS = 6;

/**
 * Decode a u64 base-units field (Anchor BN string, Supabase bigint-as-string,
 * or already-bigint) into a number of dollars for display. Goes through
 * `formatTokenAmount` first — exact decimal semantics, then `parseFloat`
 * accepts the precision loss only at the display boundary. For private-beta
 * scales (max 10^10 USDC) this is well within Number's safe range.
 */
function baseUnitsToDollars(value: bigint | string | number): number {
  const big = toBigInt(value);
  return parseFloat(formatTokenAmount(big, USDC_DECIMALS));
}

/** Decode a u64 base-units field into an exact bigint. Use for tx and totals. */
function baseUnitsToBigInt(value: bigint | string | number): bigint {
  return toBigInt(value);
}

/** Decode a u128 score field into bigint (no precision loss). */
function scoreToBigInt(value: bigint | string | number): bigint {
  return toBigInt(value);
}

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function daysSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// getAllProjects
// ---------------------------------------------------------------------------

export async function getAllProjects(): Promise<Project[]> {
  const source = getDataSource();
  if (source === "mock") return MOCK_PROJECTS;

  if (source === "indexer") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("project_dashboard")
      .select(
        "pda, recipient_wallet, cumulative_principal, cumulative_yield_routed, supporter_count"
      );
    if (error) throw new Error(`indexer getAllProjects: ${error.message}`);
    return (data ?? [])
      .map((row) => indexerRowToProject(row as IndexerProjectRow))
      .filter((p): p is Project => p !== null);
  }

  // anchor
  const program = getReadProgram();
  const onchain = await program.account.project.all();
  return onchain
    .map((p) =>
      onchainProjectToProject({
        recipientWallet: p.account.recipientWallet.toBase58(),
        cumulativePrincipal: BigInt(p.account.cumulativePrincipal.toString()),
        cumulativeYieldRouted: BigInt(p.account.cumulativeYieldRouted.toString()),
      })
    )
    .filter((p): p is Project => p !== null);
}

// ---------------------------------------------------------------------------
// getProjectBySlug
// ---------------------------------------------------------------------------

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const seed = MOCK_PROJECTS.find((p) => p.slug === slug);
  if (!seed) return undefined;

  const source = getDataSource();
  if (source === "mock") return seed;

  if (source === "indexer") {
    const supabase = getSupabaseClient();
    const projectPda = PROJECT_PDA_BY_RECIPIENT[seed.recipientWallet];
    const { data, error } = await supabase
      .from("project_dashboard")
      .select(
        "pda, recipient_wallet, cumulative_principal, cumulative_yield_routed, supporter_count"
      )
      .eq("pda", projectPda)
      .maybeSingle();
    if (error) {
      console.warn(`indexer getProjectBySlug fallback to mock: ${error.message}`);
      return seed;
    }
    if (!data) return seed;
    return indexerRowToProject(data as IndexerProjectRow) ?? seed;
  }

  // anchor
  try {
    const program = getReadProgram();
    const projectPda = new PublicKey(PROJECT_PDA_BY_RECIPIENT[seed.recipientWallet]);
    const account = await program.account.project.fetch(projectPda);
    return (
      onchainProjectToProject({
        recipientWallet: account.recipientWallet.toBase58(),
        cumulativePrincipal: BigInt(account.cumulativePrincipal.toString()),
        cumulativeYieldRouted: BigInt(account.cumulativeYieldRouted.toString()),
      }) ?? seed
    );
  } catch (e) {
    console.warn(`anchor getProjectBySlug fallback to mock: ${e}`);
    return seed;
  }
}

// ---------------------------------------------------------------------------
// getCommitmentsForUser
// ---------------------------------------------------------------------------

export async function getCommitmentsForUser(
  userWallet: PublicKey | string | null
): Promise<Commitment[]> {
  const source = getDataSource();
  if (source === "mock") return MOCK_COMMITMENTS;
  if (!userWallet) return [];

  const userKey = typeof userWallet === "string" ? new PublicKey(userWallet) : userWallet;

  if (source === "indexer") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("user_dashboard")
      .select(
        "user_wallet, project_pda, recipient_wallet, principal, deposit_ts, active_score, lifetime_score, estimated_yield_share"
      )
      .eq("user_wallet", userKey.toBase58());
    if (error) throw new Error(`indexer getCommitmentsForUser: ${error.message}`);
    return (data ?? [])
      .map((row) => indexerRowToCommitment(row as IndexerCommitmentRow))
      .filter((c): c is Commitment => c !== null);
  }

  // anchor — memcmp on the `user` field at offset 8 of Commitment
  const program = getReadProgram();
  const accounts = await program.account.commitment.all([
    { memcmp: { offset: 8, bytes: userKey.toBase58() } },
  ]);
  return accounts
    .map((c) =>
      onchainCommitmentToCommitment({
        project: c.account.project.toBase58(),
        principal: BigInt(c.account.principal.toString()),
        depositTs: Number(c.account.depositTs),
        activeScore: c.account.activeScore.toString(),
        lifetimeScore: c.account.lifetimeScore.toString(),
      })
    )
    .filter((c): c is Commitment => c !== null);
}

// ---------------------------------------------------------------------------
// getSupportersForProject
// ---------------------------------------------------------------------------

export async function getSupportersForProject(slug: string): Promise<Supporter[]> {
  const source = getDataSource();
  if (source === "mock") return MOCK_SUPPORTERS;

  const seed = MOCK_PROJECTS.find((p) => p.slug === slug);
  if (!seed) return [];
  const projectPda = PROJECT_PDA_BY_RECIPIENT[seed.recipientWallet];

  if (source === "indexer") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("commitments")
      .select("user_wallet, principal, deposit_ts, lifetime_score")
      .eq("project_pda", projectPda);
    if (error) throw new Error(`indexer getSupportersForProject: ${error.message}`);
    return (data ?? []).map((row) => ({
      wallet: truncateAddr((row as { user_wallet: string }).user_wallet),
      amount: baseUnitsToDollars((row as { principal: number | string }).principal),
      since: shortDate(new Date((row as { deposit_ts: string }).deposit_ts)),
      points: scoreToBigInt((row as { lifetime_score: string }).lifetime_score),
    }));
  }

  // anchor — memcmp on the `project` field at offset 8 + 32
  const program = getReadProgram();
  const accounts = await program.account.commitment.all([
    { memcmp: { offset: 8 + 32, bytes: projectPda } },
  ]);
  return accounts.map((c) => ({
    wallet: truncateAddr(c.account.user.toBase58()),
    amount: baseUnitsToDollars(c.account.principal.toString()),
    since: shortDate(new Date(Number(c.account.depositTs) * 1000)),
    points: scoreToBigInt(c.account.lifetimeScore.toString()),
  }));
}

// ---------------------------------------------------------------------------
// getYieldReceiptsForProject
// ---------------------------------------------------------------------------

export async function getYieldReceiptsForProject(slug: string): Promise<YieldReceipt[]> {
  const source = getDataSource();
  // Anchor doesn't expose harvest history without scraping tx logs — too slow
  // for a frontend read. Fall back to mock until indexer kicks in.
  if (source !== "indexer") return MOCK_YIELD_RECEIPTS;

  const seed = MOCK_PROJECTS.find((p) => p.slug === slug);
  if (!seed) return [];
  const projectPda = PROJECT_PDA_BY_RECIPIENT[seed.recipientWallet];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("tx_hash, payload, block_time")
    .eq("event_name", "YieldHarvested")
    .order("block_time", { ascending: false })
    .limit(20);
  if (error) throw new Error(`indexer getYieldReceiptsForProject: ${error.message}`);

  return (data ?? [])
    .filter(
      (row) =>
        ((row as { payload: { project?: string } }).payload?.project ?? "") === projectPda
    )
    .map((row) => {
      const r = row as {
        tx_hash: string;
        payload: { amount: number | string };
        block_time: string;
      };
      return {
        date: shortDate(new Date(r.block_time)),
        amount: baseUnitsToDollars(r.payload.amount),
        tx: r.tx_hash.slice(0, 12) + "…",
      };
    });
}

// ---------------------------------------------------------------------------
// getActivityForProject
// ---------------------------------------------------------------------------

export async function getActivityForProject(slug: string): Promise<Activity[]> {
  const source = getDataSource();
  // Anchor: same scrape problem as harvest receipts.
  if (source !== "indexer") return MOCK_ACTIVITY;

  const seed = MOCK_PROJECTS.find((p) => p.slug === slug);
  if (!seed) return [];
  const projectPda = PROJECT_PDA_BY_RECIPIENT[seed.recipientWallet];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("event_name, payload, block_time")
    .in("event_name", ["Committed", "Withdrawn"])
    .order("block_time", { ascending: false })
    .limit(30);
  if (error) throw new Error(`indexer getActivityForProject: ${error.message}`);

  return (data ?? [])
    .filter(
      (row) =>
        ((row as { payload: { project?: string } }).payload?.project ?? "") === projectPda
    )
    .slice(0, 8)
    .map((row) => {
      const r = row as {
        event_name: string;
        payload: { amount: number | string };
        block_time: string;
      };
      const dollars = baseUnitsToDollars(r.payload.amount);
      const verb = r.event_name === "Committed" ? "committed" : "withdrew";
      return {
        when: relativeTime(new Date(r.block_time)),
        text: `${verb} $${dollars.toFixed(dollars >= 1 ? 0 : 2)}`,
      };
    });
}

// ---------------------------------------------------------------------------
// Internal: row → typed Project / Commitment
// ---------------------------------------------------------------------------

type IndexerProjectRow = {
  pda: string;
  recipient_wallet: string;
  cumulative_principal: number | string;
  cumulative_yield_routed: number | string;
  supporter_count: number | string;
};

type IndexerCommitmentRow = {
  user_wallet: string;
  project_pda: string;
  recipient_wallet: string;
  principal: number | string;
  deposit_ts: string;
  active_score: string;
  lifetime_score: string;
  estimated_yield_share: number | string;
};

function indexerRowToProject(row: IndexerProjectRow): Project | null {
  const seed = SEED_BY_RECIPIENT[row.recipient_wallet];
  if (!seed) return null;
  return {
    ...seed,
    committed: baseUnitsToDollars(row.cumulative_principal) || seed.committed,
    supporters: Number(row.supporter_count) || seed.supporters,
    weeklyYield: seed.weeklyYield, // TODO: derive from harvest event window
  };
}

function onchainProjectToProject(row: {
  recipientWallet: string;
  cumulativePrincipal: bigint;
  cumulativeYieldRouted: bigint;
}): Project | null {
  const seed = SEED_BY_RECIPIENT[row.recipientWallet];
  if (!seed) return null;
  return {
    ...seed,
    committed: baseUnitsToDollars(row.cumulativePrincipal) || seed.committed,
    // supporter count not easily available from a single Project read;
    // would need a second memcmp scan against commitments. Mock value for now.
    supporters: seed.supporters,
    weeklyYield: seed.weeklyYield,
  };
}

function indexerRowToCommitment(row: IndexerCommitmentRow): Commitment | null {
  const seed = SEED_BY_RECIPIENT[row.recipient_wallet];
  if (!seed) return null;
  const deposit = new Date(row.deposit_ts);
  return {
    projectSlug: seed.slug,
    team: seed.team,
    amount: baseUnitsToDollars(row.principal),
    daysActive: daysSince(deposit),
    since: shortDate(deposit),
    activePoints: scoreToBigInt(row.active_score),
    weeklyYield: baseUnitsToDollars(row.estimated_yield_share) / 4 || 0,
  };
}

function onchainCommitmentToCommitment(c: {
  project: string;
  principal: bigint;
  depositTs: number;
  activeScore: string;
  lifetimeScore: string;
}): Commitment | null {
  const seed = SEED_BY_PROJECT_PDA[c.project];
  if (!seed) return null;
  const deposit = new Date(c.depositTs * 1000);
  return {
    projectSlug: seed.slug,
    team: seed.team,
    amount: baseUnitsToDollars(c.principal),
    daysActive: daysSince(deposit),
    since: shortDate(deposit),
    activePoints: scoreToBigInt(c.activeScore),
    // anchor reads can't derive weekly yield without harvest event history.
    weeklyYield: 0,
  };
}

// Re-export the types so screens import everything from one place.
export type { Project, Commitment, Supporter, YieldReceipt, Activity };

// Silence unused-import lint when these aren't directly referenced in this
// file (kept around for future use + to anchor module-level invariants).
void KOMMIT_PROGRAM_ID;
void baseUnitsToBigInt;
