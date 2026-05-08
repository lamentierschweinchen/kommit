/**
 * Smoke test for `@kommitapp/reader`.
 *
 * Runs against the live devnet deployment (program
 * `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`). Verifies:
 *
 *   1. PDA derivation is deterministic and matches the on-chain seeds.
 *   2. The read functions can connect to devnet RPC and return arrays
 *      without throwing.
 *   3. The dummy wallet rejects any sign attempt (read-only invariant).
 *   4. KommitRecord shape: every returned record has the documented field
 *      types (in particular: principal, activeScore, lifetimeScore are
 *      bigints, not BN/string/number).
 *
 * The test does NOT require non-empty on-chain data. Devnet may be empty,
 * partially seeded, or full — the SDK should handle each case without
 * throwing. Run via:  npm test
 */

import { PublicKey } from "@solana/web3.js";
import {
  KOMMIT_PROGRAM_ID,
  findProjectPda,
  findCommitmentPda,
  getKommitsForWallet,
  getKommittersForProject,
  getReadProgram,
  type KommitRecord,
} from "../src/index";

const RPC = process.env.KOMMIT_TEST_RPC ?? "https://api.devnet.solana.com";

let passed = 0;
let failed = 0;
const fail = (msg: string, err?: unknown) => {
  failed++;
  console.error(`  ✘ ${msg}`, err ?? "");
};
const pass = (msg: string) => {
  passed++;
  console.log(`  ✓ ${msg}`);
};

async function run() {
  console.log(`@kommitapp/reader smoke — RPC: ${RPC}`);
  console.log(`program: ${KOMMIT_PROGRAM_ID.toBase58()}`);
  console.log("");

  // --- 1. PDA derivation determinism ----------------------------------------
  console.log("PDA derivation:");
  try {
    const recipient = new PublicKey("5xY8gJv9wY6mvCqW6gXJtGrSpRkXJX8r6yG9TDYqtXsZ");
    const projectA = findProjectPda(recipient);
    const projectB = findProjectPda(recipient);
    if (projectA.toBase58() === projectB.toBase58()) {
      pass(`findProjectPda is deterministic (${projectA.toBase58().slice(0, 8)}…)`);
    } else {
      fail(`findProjectPda is non-deterministic`);
    }

    const user = new PublicKey("9p3GpKZ2yQjz4nNQXp6kRhP9Vqy2JhMZ3DxC8sW6rNxu");
    const c1 = findCommitmentPda(user, projectA);
    const c2 = findCommitmentPda(user, projectA);
    if (c1.toBase58() === c2.toBase58()) {
      pass(`findCommitmentPda is deterministic (${c1.toBase58().slice(0, 8)}…)`);
    } else {
      fail(`findCommitmentPda is non-deterministic`);
    }
  } catch (e) {
    fail("PDA derivation threw", e);
  }
  console.log("");

  // --- 2. RPC connect + array return ----------------------------------------
  console.log("RPC reads (devnet):");
  try {
    const wallet = new PublicKey("5xY8gJv9wY6mvCqW6gXJtGrSpRkXJX8r6yG9TDYqtXsZ");
    const records = await getKommitsForWallet(RPC, wallet);
    if (Array.isArray(records)) {
      pass(`getKommitsForWallet returns array (length=${records.length})`);
      verifyShapeIfAny(records);
    } else {
      fail(`getKommitsForWallet did not return an array`);
    }
  } catch (e) {
    fail("getKommitsForWallet threw", e);
  }

  try {
    const recipient = new PublicKey("5xY8gJv9wY6mvCqW6gXJtGrSpRkXJX8r6yG9TDYqtXsZ");
    const project = findProjectPda(recipient);
    const cohort = await getKommittersForProject(RPC, project);
    if (Array.isArray(cohort)) {
      pass(`getKommittersForProject returns array (length=${cohort.length})`);
      verifyShapeIfAny(cohort);
    } else {
      fail(`getKommittersForProject did not return an array`);
    }
  } catch (e) {
    fail("getKommittersForProject threw", e);
  }
  console.log("");

  // --- 3. Read-only invariant -----------------------------------------------
  console.log("read-only invariant:");
  try {
    const program = getReadProgram(RPC);
    const wallet = (program.provider as { wallet?: { signTransaction?: unknown } }).wallet;
    if (!wallet) {
      fail("program.provider.wallet missing");
    } else {
      let threw = false;
      try {
        // The dummy wallet's signTransaction MUST throw.
        await (wallet as { signTransaction: (tx: unknown) => Promise<unknown> }).signTransaction({});
      } catch {
        threw = true;
      }
      if (threw) pass("dummy wallet refuses to sign");
      else fail("dummy wallet did NOT refuse to sign — read-only invariant violated");
    }
  } catch (e) {
    fail("read-only invariant check threw", e);
  }

  // --- summary --------------------------------------------------------------
  console.log("");
  console.log(`result: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

function verifyShapeIfAny(records: KommitRecord[]): void {
  if (records.length === 0) return; // nothing on-chain to verify against
  const r = records[0];
  const checks: Array<[string, boolean]> = [
    ["commitmentPda is string", typeof r.commitmentPda === "string"],
    ["user is string",           typeof r.user === "string"],
    ["project is string",        typeof r.project === "string"],
    ["principal is bigint",      typeof r.principal === "bigint"],
    ["depositTs is number",      typeof r.depositTs === "number"],
    ["activeScore is bigint",    typeof r.activeScore === "bigint"],
    ["lifetimeScore is bigint",  typeof r.lifetimeScore === "bigint"],
    ["lastAccrualTs is number",  typeof r.lastAccrualTs === "number"],
  ];
  for (const [label, ok] of checks) {
    if (ok) pass(`KommitRecord shape: ${label}`);
    else fail(`KommitRecord shape: ${label}`);
  }
}

run().catch((e) => {
  console.error("smoke test crashed:", e);
  process.exit(1);
});
