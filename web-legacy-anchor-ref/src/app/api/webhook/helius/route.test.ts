// Vitest fixture tests for the Helius webhook handler — covers the QA
// verification gaps Codex flagged in QA_VERIFICATION.md (C3 + C4):
//
//   1. Two `Committed` events emitted within the SAME transaction (and the
//      same kommit instruction) get distinct (event_index = 0, 1) identities
//      and both materialize. Pre-fix, the (tx_hash, event_name) unique
//      constraint would have rejected the second event.
//
//   2. Two `Committed` events for the SAME project in two distinct txs that
//      land in the SAME slot both materialize (no slot-blocking). The new
//      identity scheme allows additive same-slot updates.
//
//   3. A failing `process_event` SQL call returns HTTP 500 (so Helius
//      retries the batch) instead of the pre-fix behavior of returning 200
//      with the failure swallowed.
//
// All three are pure off-chain JS — no Solana RPC, no live klend.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import idlJson from "@/lib/idl/kommit.json";

// --- Mock the supabase admin client at module load time ----------------------

type MockedRpcCall = { fn: string; args: Record<string, unknown> };
const rpcCalls: MockedRpcCall[] = [];
const rpcResponses: Array<{ data?: unknown; error?: unknown }> = [];

vi.mock("@/lib/kommit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kommit")>();
  return {
    ...actual,
    getSupabaseAdminClient: () => ({
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        const next = rpcResponses.shift() ?? { data: true, error: null };
        return next;
      }),
    }),
  };
});

// Ensure the bearer-token gate accepts our test requests.
const SECRET = "test-helius-secret";
process.env.HELIUS_WEBHOOK_SECRET = SECRET;

// IMPORTANT: import the route AFTER the mock above is registered.
// Top-level `await import(...)` keeps the mock applied to the route's
// `getSupabaseAdminClient` import.
const { POST } = await import("./route");
const { KOMMIT_PROGRAM_ID } = await import("@/lib/kommit");

const PROGRAM_ID_STR = KOMMIT_PROGRAM_ID.toBase58();
const idl = idlJson as unknown as anchor.Idl & {
  events: Array<{ name: string; discriminator: number[] }>;
};
const coder = new anchor.BorshCoder(idl);

// --- Synthetic Anchor event log builders ------------------------------------

function encodeEventLog(name: string, data: Record<string, unknown>): string {
  const ev = idl.events.find((e) => e.name === name);
  if (!ev) throw new Error(`event ${name} missing from IDL`);
  const payload = coder.types.encode(name, data);
  const disc = Buffer.from(ev.discriminator);
  const full = Buffer.concat([disc, payload]);
  return `Program data: ${full.toString("base64")}`;
}

function encodeCommittedLog(
  user: PublicKey,
  project: PublicKey,
  amount: bigint,
  ts: bigint
): string {
  return encodeEventLog("Committed", {
    user,
    project,
    amount: new anchor.BN(amount.toString()),
    ts: new anchor.BN(ts.toString()),
  });
}

function buildKommitInvocationLogs(eventLogs: string[]): string[] {
  return [
    `Program ${PROGRAM_ID_STR} invoke [1]`,
    "Program log: Instruction: Commit",
    ...eventLogs,
    `Program ${PROGRAM_ID_STR} success`,
  ];
}

function makeTx(opts: {
  signature: string;
  slot: number;
  ts: number;
  eventLogs: string[];
}) {
  return {
    signature: opts.signature,
    slot: opts.slot,
    timestamp: opts.ts,
    meta: { logMessages: buildKommitInvocationLogs(opts.eventLogs) },
  };
}

function mkRequest(body: unknown): Request {
  return new Request("http://localhost/api/webhook/helius", {
    method: "POST",
    headers: {
      authorization: `Bearer ${SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// --- Tests ------------------------------------------------------------------

beforeEach(() => {
  rpcCalls.length = 0;
  rpcResponses.length = 0;
});

describe("helius webhook — QA C3/C4 fixture tests", () => {
  it("processes_two_committed_events_in_one_tx_distinctly", async () => {
    // Two distinct kommitters supply USDC inside the same Anchor instruction
    // (e.g., a hypothetical batched commit). Pre-fix the second event would
    // have been rejected by the (tx_hash, event_name) unique constraint;
    // post-C3 the (tx_hash, instruction_index, event_index) identity
    // distinguishes them.
    const u1 = anchor.web3.Keypair.generate().publicKey;
    const u2 = anchor.web3.Keypair.generate().publicKey;
    const project = anchor.web3.Keypair.generate().publicKey;
    const tx = makeTx({
      signature: "sig-multi-event",
      slot: 1000,
      ts: 1700000000,
      eventLogs: [
        encodeCommittedLog(u1, project, 1_000_000n, 1700000000n),
        encodeCommittedLog(u2, project, 2_000_000n, 1700000000n),
      ],
    });
    rpcResponses.push({ data: true, error: null }, { data: true, error: null });

    const res = await POST(mkRequest([tx]));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      eventCount: number;
      appliedCount: number;
    };
    expect(body.ok).toBe(true);
    expect(body.eventCount).toBe(2);
    expect(body.appliedCount).toBe(2);

    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[0].fn).toBe("process_event");
    expect(rpcCalls[1].fn).toBe("process_event");
    // Same tx_hash, same instruction_index, distinct event_index 0 / 1.
    expect(rpcCalls[0].args.p_tx_hash).toBe("sig-multi-event");
    expect(rpcCalls[1].args.p_tx_hash).toBe("sig-multi-event");
    expect(rpcCalls[0].args.p_instruction_index).toBe(
      rpcCalls[1].args.p_instruction_index
    );
    expect(rpcCalls[0].args.p_event_index).toBe(0);
    expect(rpcCalls[1].args.p_event_index).toBe(1);
    // Each event carried its own kommitter pubkey through the normalizer.
    const payload0 = rpcCalls[0].args.p_payload as Record<string, unknown>;
    const payload1 = rpcCalls[1].args.p_payload as Record<string, unknown>;
    expect(payload0.user).toBe(u1.toBase58());
    expect(payload1.user).toBe(u2.toBase58());
    expect(payload0.amount).toBe("1000000");
    expect(payload1.amount).toBe("2000000");
  });

  it("processes_same_slot_distinct_tx_updates_for_one_project", async () => {
    // Two separate transactions land in the same Solana slot, both touching
    // the same project. Pre-fix's slot-keyed identity could have collapsed
    // these to one materialization; the new identity keeps both.
    const u1 = anchor.web3.Keypair.generate().publicKey;
    const u2 = anchor.web3.Keypair.generate().publicKey;
    const project = anchor.web3.Keypair.generate().publicKey;
    const tx1 = makeTx({
      signature: "sig-slot-A",
      slot: 2024,
      ts: 1700000100,
      eventLogs: [encodeCommittedLog(u1, project, 1_500_000n, 1700000100n)],
    });
    const tx2 = makeTx({
      signature: "sig-slot-B",
      slot: 2024, // ← same slot, distinct signature
      ts: 1700000100,
      eventLogs: [encodeCommittedLog(u2, project, 3_500_000n, 1700000100n)],
    });
    rpcResponses.push({ data: true, error: null }, { data: true, error: null });

    const res = await POST(mkRequest([tx1, tx2]));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      eventCount: number;
      appliedCount: number;
    };
    expect(body.ok).toBe(true);
    expect(body.eventCount).toBe(2);
    expect(body.appliedCount).toBe(2);

    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[0].args.p_tx_hash).toBe("sig-slot-A");
    expect(rpcCalls[1].args.p_tx_hash).toBe("sig-slot-B");
    expect(rpcCalls[0].args.p_slot).toBe(2024);
    expect(rpcCalls[1].args.p_slot).toBe(2024);
  });

  it("failed_materialize_returns_500_for_helius_retry", async () => {
    // Simulated SQL/materialize failure (process_event raises). The handler
    // must surface this as HTTP 500 so Helius retries the whole batch.
    // Pre-C4 the failure would have been swallowed and the response would
    // have been 200 (Helius would never retry — the event was lost).
    const user = anchor.web3.Keypair.generate().publicKey;
    const project = anchor.web3.Keypair.generate().publicKey;
    const tx = makeTx({
      signature: "sig-fail",
      slot: 3030,
      ts: 1700000200,
      eventLogs: [encodeCommittedLog(user, project, 1_000_000n, 1700000200n)],
    });
    // Mirror supabase-js's PostgrestError shape (Error subclass) so the
    // route's `error instanceof Error ? error.message : String(e)` yields a
    // real string instead of `"[object Object]"`.
    rpcResponses.push({
      data: null,
      error: new Error("materialize_commit failed: duplicate key violation"),
    });

    const res = await POST(mkRequest([tx]));
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      ok: boolean;
      appliedCount: number;
      failures: Array<{ tx: string; event: string; error: string }>;
    };
    expect(body.ok).toBe(false);
    expect(body.appliedCount).toBe(0);
    expect(body.failures).toHaveLength(1);
    expect(body.failures[0].tx).toBe("sig-fail");
    expect(body.failures[0].event).toBe("Committed");
    expect(body.failures[0].error).toMatch(/materialize_commit failed/);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("process_event");
  });
});
