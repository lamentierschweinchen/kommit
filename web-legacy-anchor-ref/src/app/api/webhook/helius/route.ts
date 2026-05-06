// Helius webhook handler — receives raw transaction notifications, parses
// Anchor events from tx logs, calls process_event(...) per event for
// transactional record + materialize.
//
// Helius webhook config:
//   Type: Enhanced Transactions
//   Account/Program: <NEXT_PUBLIC_KOMMIT_PROGRAM_ID>
//   Webhook URL: https://<your-domain>/api/webhook/helius
//   Auth header: Authorization: Bearer <HELIUS_WEBHOOK_SECRET>
//
// **Idempotency (QA C3):** per-event identity is `(tx_hash,
// instruction_index, event_index)`. instruction_index counts our program's
// inner-CPI invokes within the transaction; event_index counts Anchor
// events emitted *within that instruction*. Two `Committed` events in one
// tx, or two same-name events in same slot across separate txs, are both
// preserved.
//
// **Durability (QA C4):** every event is recorded + materialized inside
// one Postgres transaction via the `process_event` SQL function. If
// materialization throws, the events row is rolled back and Helius retry
// runs the full sequence again. Any failed event in a batch → HTTP 500.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  ADAPTER,
  KOMMIT_PROGRAM_ID,
  findCommitmentPda,
  findLendingPositionPda,
  getSupabaseAdminClient,
} from "@/lib/kommit";
import idl from "@/lib/idl/kommit.json";

export const runtime = "nodejs"; // anchor needs node primitives, not edge

// ---------------------------------------------------------------------------
// Helius payload shape (best-effort — Helius reformats over time; tolerate
// missing fields).
// ---------------------------------------------------------------------------

type HeliusTx = {
  signature: string;
  slot: number;
  timestamp: number;
  meta?: { logMessages?: string[] };
};

type DecodedEvent = {
  name: string;
  data: Record<string, unknown>;
  instructionIndex: number;
  eventIndex: number;
};

// ---------------------------------------------------------------------------
// Auth — Helius signs deliveries with a static bearer token configured in
// the dashboard. Constant-time compare (QA L1).
// ---------------------------------------------------------------------------

function authorize(req: Request): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("HELIUS_WEBHOOK_SECRET not set; refusing all requests");
    return false;
  }
  const got = req.headers.get("authorization");
  if (!got) return false;
  const expected = `Bearer ${secret}`;
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Anchor event parser from tx logs. Tracks instruction_index by counting
// `Program <kommit-id> invoke [N]` markers (where N == 1 means a top-level
// invocation; N > 1 is an inner CPI nested under our program).
// ---------------------------------------------------------------------------

const eventParser = new anchor.EventParser(
  KOMMIT_PROGRAM_ID,
  new anchor.BorshCoder(idl as anchor.Idl)
);

const KOMMIT_PROGRAM_STR = KOMMIT_PROGRAM_ID.toBase58();
const INVOKE_RE = new RegExp(
  `^Program ${KOMMIT_PROGRAM_STR} invoke \\[(\\d+)\\]`
);
const SUCCESS_RE = new RegExp(`^Program ${KOMMIT_PROGRAM_STR} success`);

function parseEvents(logs: string[]): DecodedEvent[] {
  const out: DecodedEvent[] = [];
  let kommitInstructionIndex = -1;     // -1 = none yet seen
  let depth = 0;                       // nesting depth inside our program
  let eventIndexInInstruction = 0;

  // We walk logs ourselves so we can attribute each event to a
  // (instruction_index, event_index) pair. Anchor's EventParser is then
  // applied to the per-instruction sub-window.
  let windowStart: number | null = null;
  for (let i = 0; i < logs.length; i++) {
    const line = logs[i];
    const invMatch = line.match(INVOKE_RE);
    if (invMatch && invMatch[1] === "1") {
      // top-level invocation of the kommit program
      kommitInstructionIndex++;
      depth = 1;
      eventIndexInInstruction = 0;
      windowStart = i;
      continue;
    }
    if (line.match(INVOKE_RE)) {
      depth++; // nested kommit→kommit (rare, but bookkeep for symmetry)
      continue;
    }
    if (line.match(SUCCESS_RE) && depth > 0) {
      depth--;
      if (depth === 0 && windowStart !== null) {
        const window = logs.slice(windowStart, i + 1);
        for (const evt of eventParser.parseLogs(window)) {
          out.push({
            name: evt.name,
            data: evt.data as Record<string, unknown>,
            instructionIndex: kommitInstructionIndex,
            eventIndex: eventIndexInInstruction++,
          });
        }
        windowStart = null;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-event PDA derivation (passed into process_event so SQL doesn't have to
// reproduce Solana PDA math).
// ---------------------------------------------------------------------------

function pdasFor(evt: DecodedEvent): {
  commitmentPda: string | null;
  lendingPda: string | null;
  adapterId: number;
} {
  switch (evt.name) {
    case "Committed":
    case "Withdrawn":
    case "PointsAccrued": {
      const user = new PublicKey(String(evt.data.user));
      const project = new PublicKey(String(evt.data.project));
      return {
        commitmentPda: findCommitmentPda(user, project).toBase58(),
        lendingPda: null,
        adapterId: 0,
      };
    }
    case "SupplyExecuted":
    case "YieldHarvested": {
      const project = new PublicKey(String(evt.data.project));
      const adapterId = ADAPTER.Kamino as 0;
      return {
        commitmentPda: null,
        lendingPda: findLendingPositionPda(project, adapterId).toBase58(),
        adapterId,
      };
    }
    default:
      return { commitmentPda: null, lendingPda: null, adapterId: 0 };
  }
}

// Anchor's BorshCoder hands us BN / number[] / PublicKey / etc. Normalize
// to JSON-safe primitives before sending to Postgres. Pubkeys → base58
// strings, BN → decimal strings, [u8;32] → hex string + raw array.
function normalizePayload(evt: DecodedEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(evt.data)) {
    if (v && typeof v === "object" && "toBase58" in v && typeof (v as { toBase58: unknown }).toBase58 === "function") {
      out[k] = (v as PublicKey).toBase58();
    } else if (v && typeof v === "object" && "toString" in v && typeof (v as { toString: unknown }).toString === "function" && (v as object).constructor?.name === "BN") {
      out[k] = (v as { toString: () => string }).toString();
    } else if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
      // number[] — likely a [u8; N] array. Keep the array AND surface a hex form.
      out[k] = v;
      const hex = (v as number[])
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      // Convention: <field>Hex sibling so the SQL function can `decode(..., 'hex')`.
      out[`${k}Hex`] = hex;
    } else if (typeof v === "bigint") {
      out[k] = v.toString();
    } else {
      out[k] = v as unknown;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main handler.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  if (!authorize(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as HeliusTx[];
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "expected array of transactions" }, { status: 400 });
  }

  const sb = getSupabaseAdminClient();
  const failures: Array<{ tx: string; event: string; error: string }> = [];
  let txCount = 0;
  let eventCount = 0;
  let appliedCount = 0;

  for (const tx of body) {
    const logs = tx.meta?.logMessages ?? [];
    if (logs.length === 0) continue;

    let parsed: DecodedEvent[];
    try {
      parsed = parseEvents(logs);
    } catch (e) {
      console.warn(`event parse failed for ${tx.signature}:`, e);
      failures.push({ tx: tx.signature, event: "<parse>", error: String(e) });
      continue;
    }
    if (parsed.length === 0) continue;

    txCount++;
    const blockTime = new Date(tx.timestamp * 1000).toISOString();

    for (const evt of parsed) {
      eventCount++;
      const { commitmentPda, lendingPda, adapterId } = pdasFor(evt);
      const payload = normalizePayload(evt);
      try {
        const { data, error } = await sb.rpc("process_event", {
          p_tx_hash: tx.signature,
          p_instruction_index: evt.instructionIndex,
          p_event_index: evt.eventIndex,
          p_event_name: evt.name,
          p_payload: payload,
          p_slot: tx.slot,
          p_block_time: blockTime,
          p_commitment_pda: commitmentPda,
          p_lending_pda: lendingPda,
          p_adapter_id: adapterId,
        });
        if (error) {
          // Materialize threw. The events row was rolled back. Surface to
          // Helius via 500 so it retries the whole batch.
          throw error;
        }
        // process_event returns true if newly applied, false if duplicate.
        if (data === true) appliedCount++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error(
          `process_event failed for ${tx.signature} ${evt.name} ${evt.instructionIndex}.${evt.eventIndex}:`,
          errMsg
        );
        failures.push({ tx: tx.signature, event: evt.name, error: errMsg });
      }
    }
  }

  if (failures.length > 0) {
    return NextResponse.json(
      { ok: false, txCount, eventCount, appliedCount, failures },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, txCount, eventCount, appliedCount });
}

// Acknowledge config/health pings.
export async function GET() {
  return NextResponse.json({
    ok: true,
    program: KOMMIT_PROGRAM_ID.toBase58(),
    handler: "kommit-helius-webhook",
  });
}

// Connection helper kept for completeness — not currently used by the
// handler, but the next iteration may reconcile materialized state by
// re-fetching the on-chain account when an event is missed.
function _unused_getConnection(): Connection {
  return new Connection(
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );
}
void _unused_getConnection;
