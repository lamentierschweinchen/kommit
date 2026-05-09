/**
 * Lane B sandbox projects — fresh on-chain Project PDAs created specifically
 * for the `/sandbox/onchain` judge surface, with brand-new recipient wallets
 * (NOT the same wallets as the static PROJECTS catalog).
 *
 * Why fresh wallets: the existing on-chain Project PDAs (e.g. Caldera's
 * `Fpn7Fp41…`) have escrow ATAs initialized with the production USDC mint.
 * The sandbox uses its own SPL mint (`sandbox-mint.json`) so judges can be
 * airdropped unlimited test funds without touching Circle's faucet. Anchor's
 * `init_if_needed` for the escrow ATA fails with a token::mint mismatch if
 * we try to commit a sandbox-mint deposit into a USDC-locked escrow.
 *
 * Solution (Codex Pass 1 H1 closure): the operator runs
 * `scripts/setup-sandbox-projects.mjs` once per environment. That script
 * generates fresh recipient keypairs (deterministic-by-slug — see the script
 * for the seed scheme), calls the admin-only `create_project` instruction,
 * and writes the resulting `{slug, recipientWallet, projectPda}` triples
 * into `sandbox-projects.json` next to this file. The picker on
 * `/sandbox/onchain` reads from here, joins with the static PROJECTS catalog
 * for display metadata, and uses the freshly-minted recipient wallet for
 * `commitToProject()`.
 *
 * The JSON ships with an empty `projects` array; the page renders a
 * "sandbox not configured" state until the operator commits a populated
 * file.
 */

import { PublicKey } from "@solana/web3.js";
import { PROJECTS } from "@/lib/data/projects";
import data from "./sandbox-projects.json";

export type SandboxProjectRecord = {
  /** Matches a slug in PROJECTS so the picker can pull display metadata. */
  slug: string;
  /** Base58 of the fresh recipient wallet — sandbox-only, never reused. */
  recipientWallet: string;
  /** Base58 of the on-chain Project PDA derived from `recipientWallet`. */
  projectPda: string;
  /** ISO timestamp of when the script ran. */
  createdAt: string;
};

type SandboxProjectsFile = {
  cluster: "devnet";
  projects: SandboxProjectRecord[];
};

const SANDBOX_PROJECTS_FILE = data as SandboxProjectsFile;

/** UI-side join: pulls display metadata (name, pitch) from the static
 *  catalog so the picker shows real project info but commits go to
 *  sandbox-only wallets. Drops any record whose slug doesn't resolve in
 *  PROJECTS — a stale JSON entry shouldn't crash the page. */
export type SandboxProjectForUI = {
  slug: string;
  name: string;
  pitch: string;
  recipientWallet: PublicKey;
  projectPda: PublicKey;
};

export function getSandboxProjects(): SandboxProjectForUI[] {
  const out: SandboxProjectForUI[] = [];
  for (const rec of SANDBOX_PROJECTS_FILE.projects) {
    const meta = PROJECTS.find((p) => p.slug === rec.slug);
    if (!meta) continue;
    let recipientWallet: PublicKey;
    let projectPda: PublicKey;
    try {
      recipientWallet = new PublicKey(rec.recipientWallet);
      projectPda = new PublicKey(rec.projectPda);
    } catch {
      continue;
    }
    out.push({
      slug: rec.slug,
      name: meta.name,
      pitch: meta.pitch,
      recipientWallet,
      projectPda,
    });
  }
  return out;
}

export function isSandboxProjectsConfigured(): boolean {
  return getSandboxProjects().length > 0;
}
