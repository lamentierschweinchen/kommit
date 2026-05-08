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
import { LUKAS_COMMITMENTS, type Commitment } from "@/lib/data/commitments";
import { USERS } from "@/lib/data/users";

const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "1";

/**
 * In mock-auth mode, the seeded users carry placeholder wallets that are
 * valid-format base58 pubkeys but not registered on-chain — calling Anchor
 * with them would just return empty result sets. Short-circuit to mock
 * fixtures so the dashboard renders something substantive for QA. Real auth
 * always passes through the on-chain reads.
 */
function mockCommitmentsFor(wallet: string): Commitment[] | null {
  if (!MOCK_AUTH) return null;
  // Match against the USERS table by wallet field; only Lukas has a populated
  // demo portfolio (other mock users seed empty for now).
  const lukas = USERS.lukas;
  if (lukas && wallet === lukas.wallet) return LUKAS_COMMITMENTS;
  return [];
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
  const mock = mockCommitmentsFor(walletStr);
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
  const project = PROJECTS.find((p) => p.slug === projectSlug);
  if (!project?.recipientWallet) return null;

  // Mock-auth fast path — match by slug against the seeded LUKAS_COMMITMENTS.
  if (MOCK_AUTH) {
    const walletStr = typeof userWallet === "string" ? userWallet : userWallet.toBase58();
    const mock = mockCommitmentsFor(walletStr);
    if (mock !== null) return mock.find((c) => c.projectSlug === projectSlug) ?? null;
  }

  const userKey = typeof userWallet === "string" ? new PublicKey(userWallet) : userWallet;
  const projectPda = findProjectPda(new PublicKey(project.recipientWallet));
  const program = getReadProgram();

  // Single-account fetch by computed PDA — cheaper than memcmp.
  const { findCommitmentPda } = await import("@/lib/kommit");
  const commitmentPda = findCommitmentPda(userKey, projectPda);
  try {
    const account = await program.account.commitment.fetch(commitmentPda);
    return {
      projectSlug,
      kommittedUSD: baseUnitsToUSD(BigInt(account.principal.toString())),
      sinceISO: unixToISO(Number(account.depositTs)),
    };
  } catch {
    // Account doesn't exist — user has no position in this project.
    return null;
  }
}
