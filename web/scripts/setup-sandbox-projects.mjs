/**
 * One-shot setup for the Lane B sandbox on-chain Project PDAs.
 *
 * Why this script exists (Codex Pass 1 H1 closure):
 *
 * The static `PROJECTS` catalog ships with `recipientWallet` values pointing
 * at the legacy devnet projects from `web-legacy-anchor-ref` — six of which
 * have on-chain Project PDAs, all with escrow ATAs initialized against the
 * production USDC mint. The Lane B sandbox uses its own SPL mint
 * (`sandbox-mint.json`) so judges can be airdropped unlimited test funds
 * without touching Circle's faucet. Anchor's `commit` instruction's
 * `init_if_needed` for the per-project escrow ATA fails with a
 * `token::mint = usdc_mint` constraint mismatch the moment a sandbox-mint
 * deposit hits a USDC-locked escrow.
 *
 * Solution: this script generates a brand-new recipient keypair per slug,
 * calls the admin-only `create_project` instruction, and writes the
 * resulting `{slug, recipientWallet, projectPda}` triples into
 * `web/src/lib/sandbox-projects.json`. The picker on `/sandbox/onchain`
 * reads from there and uses the freshly-minted recipient wallet as the
 * `commitToProject()` argument — so the escrow PDA is fresh, gets
 * `init_if_needed`-initialized with the sandbox SPL mint on first commit,
 * and never collides with the production USDC-locked escrows.
 *
 * Operator workflow (run once per environment):
 *
 *   KOMMIT_DEVNET_FEE_PAYER_SECRET=<base58> \
 *   KOMMIT_DEVNET_ADMIN_SECRET=<base58> \
 *     node scripts/setup-sandbox-projects.mjs
 *
 *   git add web/src/lib/sandbox-projects.json
 *   git commit -m "lane-b: sandbox project PDAs"
 *   # redeploy
 *
 * Env vars:
 *
 *   - KOMMIT_DEVNET_FEE_PAYER_SECRET (required) — base58 secret of the
 *     visa-demo fee-payer keypair. Pays per-project rent (~0.002 SOL each,
 *     ~0.012 SOL total for 6 projects). Same secret used by /api/visa-demo
 *     and /api/sandbox/airdrop.
 *
 *   - KOMMIT_DEVNET_ADMIN_SECRET (required when admin != fee-payer) — base58
 *     secret of the keypair stored on-chain in `KommitConfig.admin`. The
 *     `create_project` instruction `require_keys_eq!`s the signer against
 *     `config.admin`. If unset, the script falls back to using the fee-payer
 *     as the signer; the on-chain `require` will then pass IFF fee-payer is
 *     also the admin (rare). Lukas: get this from the keypair you ran
 *     `initialize_config` with at devnet bring-up.
 *
 *   - FORCE=1 (optional) — re-create every sandbox project, generating fresh
 *     recipient wallets and burning rent on net-new PDAs. Default behavior
 *     skips slugs already present in sandbox-projects.json.
 *
 *   - SANDBOX_PROJECT_SLUGS (optional, comma-separated) — override the slug
 *     list. Default is the 6 slugs with `recipientWallet` set in the static
 *     catalog (caldera, lighthouse-labs, aurora, quire-chess, frame-studio,
 *     beacon-sci).
 *
 *   - NEXT_PUBLIC_HELIUS_RPC_URL (optional) — RPC endpoint. Default
 *     `https://api.devnet.solana.com`. Cluster-confined (M3): the script
 *     refuses to run if `getGenesisHash()` doesn't match the devnet hash.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECTS_JSON_PATH = resolve(HERE, "../src/lib/sandbox-projects.json");
const IDL_PATH = resolve(HERE, "../src/lib/idl/kommit.json");

const RPC_URL =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const FEE_PAYER_SECRET = process.env.KOMMIT_DEVNET_FEE_PAYER_SECRET;
const ADMIN_SECRET = process.env.KOMMIT_DEVNET_ADMIN_SECRET;
const FORCE = process.env.FORCE === "1";
const DEFAULT_SLUGS = [
  "caldera",
  "lighthouse-labs",
  "aurora",
  "quire-chess",
  "frame-studio",
  "beacon-sci",
];
const SLUGS = (process.env.SANDBOX_PROJECT_SLUGS?.trim()
  ? process.env.SANDBOX_PROJECT_SLUGS.split(",").map((s) => s.trim())
  : DEFAULT_SLUGS
).filter(Boolean);

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

function decodeKeypair(name, secret) {
  const trimmed = secret.trim();
  let bytes;
  try {
    if (trimmed.startsWith("[")) {
      bytes = new Uint8Array(JSON.parse(trimmed));
    } else {
      bytes = bs58.decode(trimmed);
    }
  } catch (e) {
    console.error(`${name} could not be decoded:`, e?.message ?? e);
    process.exit(1);
  }
  if (bytes.length !== 64) {
    console.error(`${name} must decode to 64 bytes (got ${bytes.length}).`);
    process.exit(1);
  }
  return Keypair.fromSecretKey(bytes);
}

function loadFeePayer() {
  if (!FEE_PAYER_SECRET) {
    console.error("KOMMIT_DEVNET_FEE_PAYER_SECRET unset.");
    console.error(
      "See web/src/lib/visa-demo-fee-payer.ts for one-time generation steps.",
    );
    process.exit(1);
  }
  return decodeKeypair("KOMMIT_DEVNET_FEE_PAYER_SECRET", FEE_PAYER_SECRET);
}

function loadAdminOrFallback(feePayer) {
  if (ADMIN_SECRET) {
    return decodeKeypair("KOMMIT_DEVNET_ADMIN_SECRET", ADMIN_SECRET);
  }
  console.warn(
    "KOMMIT_DEVNET_ADMIN_SECRET unset — falling back to the fee-payer as admin signer.",
  );
  console.warn(
    "  This will only succeed if the fee-payer pubkey equals KommitConfig.admin on-chain.",
  );
  console.warn(
    "  If create_project errors out with 'Unauthorized', set KOMMIT_DEVNET_ADMIN_SECRET",
  );
  console.warn(
    "  to the keypair you ran `initialize_config` with at devnet bring-up.",
  );
  return feePayer;
}

function readSandboxProjectsFile() {
  if (!existsSync(PROJECTS_JSON_PATH)) {
    return { cluster: "devnet", projects: [] };
  }
  try {
    const json = JSON.parse(readFileSync(PROJECTS_JSON_PATH, "utf8"));
    if (!Array.isArray(json?.projects)) {
      return { cluster: "devnet", projects: [] };
    }
    return json;
  } catch (e) {
    console.error(
      `sandbox-projects.json is unreadable: ${e?.message ?? e}.`,
    );
    console.error("Restore from git history before re-running.");
    process.exit(1);
  }
}

function writeSandboxProjectsFile(records) {
  const body = {
    cluster: "devnet",
    projects: records,
  };
  writeFileSync(
    PROJECTS_JSON_PATH,
    JSON.stringify(body, null, 2) + "\n",
    "utf8",
  );
}

/** Deterministic-but-distinct 32-byte placeholder hash per slug, so the
 *  on-chain field is non-zero and traceable back to the slug if anyone
 *  inspects it. NOT a real IPFS hash — sandbox projects don't have pinned
 *  metadata. */
function metadataHashForSlug(slug) {
  const digest = createHash("sha256").update(`kommit:sandbox:${slug}`).digest();
  return Array.from(digest);
}

const conn = new Connection(RPC_URL, "confirmed");

// M3: cluster confinement. Refuse to run if the RPC isn't devnet.
async function assertDevnet() {
  let genesis;
  try {
    genesis = await conn.getGenesisHash();
  } catch (e) {
    console.error(
      `Could not read genesis hash from ${RPC_URL}:`,
      e?.message ?? e,
    );
    process.exit(1);
  }
  if (genesis !== DEVNET_GENESIS_HASH) {
    console.error(
      `RPC ${RPC_URL} is not devnet (genesis ${genesis} != ${DEVNET_GENESIS_HASH}).`,
    );
    console.error(
      "Refusing to create sandbox project PDAs outside devnet. Unset",
    );
    console.error(
      "NEXT_PUBLIC_HELIUS_RPC_URL or point it at a devnet RPC and re-run.",
    );
    process.exit(1);
  }
}

await assertDevnet();

const idl = JSON.parse(readFileSync(IDL_PATH, "utf8"));
const programId = new PublicKey(idl.address);
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  programId,
);

const feePayer = loadFeePayer();
const admin = loadAdminOrFallback(feePayer);

const balance = await conn.getBalance(feePayer.publicKey, "confirmed");
console.log(`RPC:               ${RPC_URL}`);
console.log(`Program:           ${programId.toBase58()}`);
console.log(`Config PDA:        ${configPda.toBase58()}`);
console.log(`Fee-payer pubkey:  ${feePayer.publicKey.toBase58()}`);
console.log(`Admin pubkey:      ${admin.publicKey.toBase58()}`);
console.log(`Fee-payer balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

const wallet = new anchor.Wallet(admin);
const provider = new anchor.AnchorProvider(conn, wallet, {
  commitment: "confirmed",
  preflightCommitment: "confirmed",
});
const program = new anchor.Program(idl, provider);

// Sanity: confirm admin matches config.admin before submitting.
const cfg = await program.account.kommitConfig.fetch(configPda);
if (cfg.admin.toBase58() !== admin.publicKey.toBase58()) {
  console.error("");
  console.error(
    `Admin signer ${admin.publicKey.toBase58()} does not match config.admin ${cfg.admin.toBase58()}.`,
  );
  console.error(
    "create_project would fail on-chain. Set KOMMIT_DEVNET_ADMIN_SECRET to",
  );
  console.error("the correct admin keypair and re-run.");
  process.exit(1);
}

const file = readSandboxProjectsFile();
const existingBySlug = new Map(file.projects.map((p) => [p.slug, p]));
const out = [];

for (const slug of SLUGS) {
  const prior = existingBySlug.get(slug);
  if (prior && !FORCE) {
    console.log(
      `[${slug}] already configured — recipient ${prior.recipientWallet}, projectPda ${prior.projectPda}. Skipping.`,
    );
    out.push(prior);
    continue;
  }

  const recipient = Keypair.generate();
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), recipient.publicKey.toBuffer()],
    programId,
  );

  console.log(`[${slug}] creating Project PDA ${projectPda.toBase58()}…`);
  console.log(`         recipient wallet: ${recipient.publicKey.toBase58()}`);
  try {
    const sig = await program.methods
      .createProject(recipient.publicKey, metadataHashForSlug(slug))
      .accountsPartial({
        project: projectPda,
        admin: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`[${slug}] tx: ${sig}`);
  } catch (e) {
    console.error(`[${slug}] create_project failed:`, e?.message ?? e);
    if (out.length > 0) {
      console.error("");
      console.error(
        "Writing partial sandbox-projects.json with the slugs that succeeded so",
      );
      console.error("re-running picks up where this run left off.");
      writeSandboxProjectsFile(out);
    }
    process.exit(1);
  }

  out.push({
    slug,
    recipientWallet: recipient.publicKey.toBase58(),
    projectPda: projectPda.toBase58(),
    createdAt: new Date().toISOString(),
  });
}

writeSandboxProjectsFile(out);

console.log("");
console.log("=".repeat(72));
console.log("Sandbox projects configured.");
console.log(`  count:     ${out.length}`);
console.log(`  written:   ${PROJECTS_JSON_PATH}`);
console.log("=".repeat(72));
console.log("");
console.log("Next steps:");
console.log(
  "  1. git add web/src/lib/sandbox-projects.json && git commit -m 'lane-b: sandbox project PDAs'",
);
console.log("  2. Redeploy. /sandbox/onchain picker will pick these up.");
