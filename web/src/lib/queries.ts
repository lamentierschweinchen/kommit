/**
 * Read-side facade for the dashboard + project detail pages.
 *
 * Pass 2 reads on-chain via Anchor. The Supabase indexer view mirrors this
 * surface and can drop in later behind a `NEXT_PUBLIC_USE_INDEXER` flag (per
 * handoff 32 § 3) — keep the return shapes table-stable.
 *
 * On-chain reads use a read-only `Program<Kommit>` constructed lazily from a
 * dummy wallet. Reads never sign — Codex § Layer 5 / Anchor: "no signing key
 * belongs on the server for user transactions."
 */

import { AnchorProvider, Program, type Idl, type Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/lib/idl/kommit.json";
import { type Kommit, findProjectPda } from "@/lib/kommit";
import { PROJECTS, type Project } from "@/lib/data/projects";
import { type Commitment } from "@/lib/data/commitments";
import { isDemoMode } from "@/lib/demo-mode";
import { getDemoPosition, getDemoPositions } from "@/lib/demo-engagement";
import { getSandboxProjects } from "@/lib/sandbox-projects";
import {
  getWithdrawnOverlay,
  getWithdrawnForProject,
} from "@/lib/withdrawn-overlay";

/**
 * Demo-mode reads short-circuit Anchor entirely: the persona wallets aren't
 * on-chain, but the /demo entry page seeded localStorage with Lukas's
 * portfolio (and balances, and project updates) so simulateCommit /
 * simulateWithdraw mutations show up here without round-tripping a
 * non-existent on-chain account.
 *
 * Real auth always passes through to the Anchor read path below.
 */
function demoCommitmentsFor(wallet: string): Commitment[] | null {
  if (!isDemoMode()) return null;
  return getDemoPositions(wallet);
}

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

let cachedReadProgram: Program<Kommit> | null = null;

function getReadProgram(): Program<Kommit> {
  if (cachedReadProgram) return cachedReadProgram;
  const connection = new Connection(RPC_URL, "confirmed");
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error("Read-only — queries.ts never signs");
    },
    signAllTransactions: async () => {
      throw new Error("Read-only — queries.ts never signs");
    },
  } as unknown as Wallet;
  const provider = new AnchorProvider(connection, dummyWallet, AnchorProvider.defaultOptions());
  cachedReadProgram = new Program<Kommit>(idl as unknown as Idl, provider);
  return cachedReadProgram;
}

// Pre-derive PDA tables for the projects that have on-chain wallets.
const ON_CHAIN_PROJECTS: Project[] = PROJECTS.filter((p) => !!p.recipientWallet);

const PROJECT_PDA_TO_PROJECT = new Map<string, Project>();

// 1. Static catalog wallets — production / regular product surface.
for (const p of ON_CHAIN_PROJECTS) {
  PROJECT_PDA_TO_PROJECT.set(
    findProjectPda(new PublicKey(p.recipientWallet!)).toBase58(),
    p,
  );
}

// 2. Lane B sandbox projects (handoff 49 H1 closure) — fresh recipient
// wallets created by `setup-sandbox-projects.mjs` so their escrow ATAs
// can be locked to the sandbox SPL mint, separate from the production
// USDC-locked escrows of the static catalog. Without this loop, on-chain
// kommits from `/sandbox/onchain` were silently dropped at the
// `if (!project) continue;` filter below — judges would see the tx land
// on Solscan but no row on `/dashboard`.
for (const sp of getSandboxProjects()) {
  const meta = PROJECTS.find((p) => p.slug === sp.slug);
  if (meta) {
    PROJECT_PDA_TO_PROJECT.set(sp.projectPda.toBase58(), meta);
  }
}

const USDC_DECIMALS_DIVISOR = 1_000_000n;

function baseUnitsToUSD(value: bigint): number {
  // Display only. Loses precision past 2^53; safe at retail scales (max ~$10^10).
  const dollars = Number(value / USDC_DECIMALS_DIVISOR);
  const cents = Number(value % USDC_DECIMALS_DIVISOR) / 1_000_000;
  return dollars + cents;
}

function unixToISO(unixSeconds: number): string {
  const ms = unixSeconds * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Fetch every commitment for a given user wallet via memcmp at offset 8
 * (right after Anchor's 8-byte discriminator; first field is `user: Pubkey`).
 *
 * Returns the same `Commitment` shape consumed by the dashboard, so the swap
 * from mock fixtures to live reads is a pure data-source change.
 */
export async function getCommitmentsForUser(
  userWallet: PublicKey | string,
): Promise<Commitment[]> {
  const walletStr = typeof userWallet === "string" ? userWallet : userWallet.toBase58();
  const mock = demoCommitmentsFor(walletStr);
  if (mock !== null) return mock;
  const userKey = typeof userWallet === "string" ? new PublicKey(userWallet) : userWallet;
  const program = getReadProgram();
  const accounts = await program.account.commitment.all([
    { memcmp: { offset: 8, bytes: userKey.toBase58() } },
  ]);

  const out: Commitment[] = [];
  for (const a of accounts) {
    const projectPda = a.account.project.toBase58();
    const project = PROJECT_PDA_TO_PROJECT.get(projectPda);
    if (!project) continue; // commitment to a project not in our display catalog
    const principalBig = BigInt(a.account.principal.toString());
    const depositTs = Number(a.account.depositTs);
    out.push({
      projectSlug: project.slug,
      kommittedUSD: baseUnitsToUSD(principalBig),
      sinceISO: unixToISO(depositTs),
      sinceMs: depositTs * 1000,
    });
  }
  // Real-Privy withdrawn-state overlay. The Anchor `withdraw` handler does
  // NOT close the Commitment account on full withdraw — it sets principal=0
  // and active_score=0 but the PDA stays alive. So `commitment.all` still
  // returns the row, just with principal=0. Without enrichment from the
  // localStorage snapshot the row reads as a fresh $0 position: no
  // WITHDRAWN pill, lifetime ticker = 0, "kommits soulbound" promise broken.
  //
  // Two-pass merge:
  //   1. Enrich on-chain rows whose principal hit zero with the snapshot's
  //      withdrawnAtMs + frozenKommits (the actual production failure mode).
  //   2. Append snapshot-only rows for slugs absent from the on-chain set —
  //      future-proofs against an eventual v0.5.x program update that adds
  //      `close = user` on full withdraw.
  // Skip on-chain rows whose principal is non-zero: they've been re-kommitted
  // and CommitModal's `clearWithdrawn` will (or already has) wiped the
  // overlay; the on-chain row is the truth.
  const overlay = getWithdrawnOverlay(walletStr);
  if (overlay.length > 0) {
    const overlayBySlug = new Map(overlay.map((w) => [w.projectSlug, w]));
    for (const row of out) {
      if (row.kommittedUSD > 0) continue;
      const snap = overlayBySlug.get(row.projectSlug);
      if (!snap) continue;
      row.withdrawnAtMs = snap.withdrawnAtMs;
      row.frozenKommits = snap.frozenKommits;
    }
    const onChainSlugs = new Set(out.map((c) => c.projectSlug));
    for (const w of overlay) {
      if (onChainSlugs.has(w.projectSlug)) continue;
      out.push({
        projectSlug: w.projectSlug,
        kommittedUSD: 0,
        sinceISO: w.sinceISO,
        sinceMs: w.sinceMs,
        withdrawnAtMs: w.withdrawnAtMs,
        frozenKommits: w.frozenKommits,
      });
    }
  }
  return out;
}

/**
 * Fetch the single commitment for (user, project). Returns null if absent.
 * Project resolution is by slug — caller passes the slug they're rendering.
 */
export async function getCommitmentForUserAndProject(
  userWallet: PublicKey | string,
  projectSlug: string,
): Promise<Commitment | null> {
  const walletStr = typeof userWallet === "string" ? userWallet : userWallet.toBase58();

  // Demo-mode fast path runs first — applies to all projects (including
  // pre-launch ones with no recipientWallet) since the demo cohort doesn't
  // touch the on-chain account.
  if (isDemoMode()) {
    return getDemoPosition(walletStr, projectSlug);
  }

  const project = PROJECTS.find((p) => p.slug === projectSlug);
  // Sandbox PDA candidate — distinct from the static catalog wallet. A user
  // who kommitted via the on-chain demo entry has their position keyed
  // under this PDA, not under the production-USDC-locked escrow that
  // `project.recipientWallet` would derive.
  const sandboxRecord = getSandboxProjects().find((p) => p.slug === projectSlug);

  if (!project?.recipientWallet && !sandboxRecord) {
    return null;
  }

  const userKey = typeof userWallet === "string" ? new PublicKey(userWallet) : userWallet;
  const program = getReadProgram();
  const { findCommitmentPda } = await import("@/lib/kommit");

  // Try the catalog PDA first, then the sandbox PDA. First hit wins. Real-
  // Privy users in the current devnet deploy only have sandbox positions, so
  // they fall through to the sandbox candidate; preserved-from-prod state is
  // unaffected.
  const candidatePdas: PublicKey[] = [];
  if (project?.recipientWallet) {
    candidatePdas.push(findProjectPda(new PublicKey(project.recipientWallet)));
  }
  if (sandboxRecord) {
    candidatePdas.push(sandboxRecord.projectPda);
  }

  let onChain: Commitment | null = null;
  for (const pda of candidatePdas) {
    const commitmentPda = findCommitmentPda(userKey, pda);
    try {
      const account = await program.account.commitment.fetch(commitmentPda);
      const depositTs = Number(account.depositTs);
      onChain = {
        projectSlug,
        kommittedUSD: baseUnitsToUSD(BigInt(account.principal.toString())),
        sinceISO: unixToISO(depositTs),
        sinceMs: depositTs * 1000,
      };
      break;
    } catch {
      /* fall through to next candidate */
    }
  }

  // Withdrawn-state overlay merge — mirrors the list-read in
  // `getCommitmentsForUser`. The on-chain account stays alive at
  // principal=0 after a full withdraw, so enrich rather than only
  // falling back when on-chain is absent.
  const withdrawn = getWithdrawnForProject(walletStr, projectSlug);
  if (onChain) {
    if (withdrawn && onChain.kommittedUSD <= 0) {
      onChain.withdrawnAtMs = withdrawn.withdrawnAtMs;
      onChain.frozenKommits = withdrawn.frozenKommits;
    }
    return onChain;
  }
  if (withdrawn) {
    return {
      projectSlug,
      kommittedUSD: 0,
      sinceISO: withdrawn.sinceISO,
      sinceMs: withdrawn.sinceMs,
      withdrawnAtMs: withdrawn.withdrawnAtMs,
      frozenKommits: withdrawn.frozenKommits,
    };
  }

  return null;
}
