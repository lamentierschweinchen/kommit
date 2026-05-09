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
import { isSandboxOverlayActive } from "@/lib/sandbox-overlay";

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

/**
 * Lane B sandbox overlay (handoff 49 item 8): when a real-Privy user has
 * been through the visa-demo card-mock flow, their simulated commit lives
 * in localStorage under their Privy wallet. This helper surfaces those
 * positions so the dashboard read merges them with on-chain commits.
 *
 * Returns [] when the overlay flag is off (or in demo mode — that path
 * already returns the localStorage view via demoCommitmentsFor).
 */
function sandboxOverlayCommitmentsFor(wallet: string): Commitment[] {
  if (isDemoMode()) return [];
  if (!isSandboxOverlayActive()) return [];
  return getDemoPositions(wallet);
}

/** Merge an on-chain commitment list with localStorage simulated overlays.
 *  Same project = sum kommittedUSD, retain earlier sinceISO. */
function mergeCommitments(
  onChain: Commitment[],
  overlay: Commitment[],
): Commitment[] {
  if (overlay.length === 0) return onChain;
  const bySlug = new Map<string, Commitment>();
  for (const c of onChain) bySlug.set(c.projectSlug, c);
  for (const o of overlay) {
    const existing = bySlug.get(o.projectSlug);
    if (!existing) {
      bySlug.set(o.projectSlug, o);
      continue;
    }
    const earlier = existing.sinceISO < o.sinceISO ? existing.sinceISO : o.sinceISO;
    bySlug.set(o.projectSlug, {
      ...existing,
      kommittedUSD: existing.kommittedUSD + o.kommittedUSD,
      sinceISO: earlier,
      pivotedAtISO: existing.pivotedAtISO ?? o.pivotedAtISO,
    });
  }
  return Array.from(bySlug.values());
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

const PROJECT_PDA_TO_PROJECT = new Map<string, Project>(
  ON_CHAIN_PROJECTS.map((p) => [
    findProjectPda(new PublicKey(p.recipientWallet!)).toBase58(),
    p,
  ]),
);

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
    });
  }
  return mergeCommitments(out, sandboxOverlayCommitmentsFor(walletStr));
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
  if (!project?.recipientWallet) {
    // Even without on-chain wiring, a sandbox-overlay user may have a
    // simulated position from the visa-demo card-mock flow.
    return isSandboxOverlayActive() ? getDemoPosition(walletStr, projectSlug) : null;
  }

  const userKey = typeof userWallet === "string" ? new PublicKey(userWallet) : userWallet;
  const projectPda = findProjectPda(new PublicKey(project.recipientWallet));
  const program = getReadProgram();

  // Single-account fetch by computed PDA — cheaper than memcmp.
  const { findCommitmentPda } = await import("@/lib/kommit");
  const commitmentPda = findCommitmentPda(userKey, projectPda);
  let onChain: Commitment | null = null;
  try {
    const account = await program.account.commitment.fetch(commitmentPda);
    onChain = {
      projectSlug,
      kommittedUSD: baseUnitsToUSD(BigInt(account.principal.toString())),
      sinceISO: unixToISO(Number(account.depositTs)),
    };
  } catch {
    onChain = null;
  }

  if (!isSandboxOverlayActive()) return onChain;

  const overlay = getDemoPosition(walletStr, projectSlug);
  if (!overlay) return onChain;
  if (!onChain) return overlay;
  return {
    projectSlug,
    kommittedUSD: onChain.kommittedUSD + overlay.kommittedUSD,
    sinceISO: onChain.sinceISO < overlay.sinceISO ? onChain.sinceISO : overlay.sinceISO,
    pivotedAtISO: onChain.pivotedAtISO ?? overlay.pivotedAtISO,
  };
}
