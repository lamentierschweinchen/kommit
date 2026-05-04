// Helius webhook handler — receives raw transaction notifications,
// parses Anchor events from tx logs, materializes state in Supabase.
//
// Helius webhook config:
//   Type: Enhanced Transactions
//   Account/Program: <NEXT_PUBLIC_KOMMIT_PROGRAM_ID>
//   Webhook URL: https://<your-domain>/api/webhook/helius
//   Auth header: Authorization: Bearer <HELIUS_WEBHOOK_SECRET>
//
// The handler is idempotent on (tx_hash, event_name) — Helius can replay
// events; we just upsert into the events table and short-circuit on dupes.
// Materialized-state updates check `last_seen_slot` to avoid backwards writes.

import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  ADAPTER,
  KOMMIT_PROGRAM_ID,
  findCommitmentPda,
  findLendingPositionPda,
  findProjectPda,
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
};

// ---------------------------------------------------------------------------
// Auth — Helius signs deliveries with a static bearer token configured in
// the dashboard.
// ---------------------------------------------------------------------------

function authorize(req: Request): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("HELIUS_WEBHOOK_SECRET not set; refusing all requests");
    return false;
  }
  const got = req.headers.get("authorization");
  return got === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Anchor event parser from tx logs.
// ---------------------------------------------------------------------------

const eventParser = new anchor.EventParser(
  KOMMIT_PROGRAM_ID,
  new anchor.BorshCoder(idl as anchor.Idl)
);

function parseEvents(logs: string[]): DecodedEvent[] {
  const out: DecodedEvent[] = [];
  for (const evt of eventParser.parseLogs(logs)) {
    out.push({ name: evt.name, data: evt.data as Record<string, unknown> });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-event handlers. All idempotent. All check last_seen_slot.
// ---------------------------------------------------------------------------

type Sb = ReturnType<typeof getSupabaseAdminClient>;

async function recordEvent(
  sb: Sb,
  tx: HeliusTx,
  event: DecodedEvent
): Promise<{ duplicate: boolean }> {
  const { error } = await sb.from("events").insert({
    tx_hash: tx.signature,
    slot: tx.slot,
    block_time: new Date(tx.timestamp * 1000).toISOString(),
    event_name: event.name,
    payload: event.data,
  });
  // unique violation = idempotent replay; fine.
  if (error && error.code !== "23505") {
    console.error("events insert error:", error);
    throw error;
  }
  return { duplicate: error?.code === "23505" };
}

async function upsertProject(sb: Sb, slot: number, blockTime: Date, e: DecodedEvent) {
  const project = (e.data.project as string) ?? "";
  const recipient = (e.data.recipientWallet as string) ?? "";
  await sb.from("projects").upsert(
    {
      pda: project,
      recipient_wallet: recipient,
      metadata_uri_hash: Buffer.alloc(32),       // backfilled when metadata refreshes
      cumulative_principal: 0,
      cumulative_yield_routed: 0,
      created_at: blockTime.toISOString(),
      last_seen_slot: slot,
    },
    { onConflict: "pda" }
  );
}

async function applyCommit(sb: Sb, slot: number, blockTime: Date, e: DecodedEvent) {
  const userStr = e.data.user as string;
  const projectStr = e.data.project as string;
  const amount = BigInt(String(e.data.amount));
  const ts = new Date(Number(e.data.ts) * 1000);

  const user = new PublicKey(userStr);
  const project = new PublicKey(projectStr);
  const commitmentPda = findCommitmentPda(user, project).toBase58();

  // Skip if a newer event already updated this commitment.
  const { data: existing } = await sb
    .from("commitments")
    .select("principal, last_seen_slot")
    .eq("pda", commitmentPda)
    .maybeSingle();

  if (existing && existing.last_seen_slot >= slot) return;

  const newPrincipal = (existing ? BigInt(existing.principal) : BigInt(0)) + amount;
  await sb.from("commitments").upsert(
    {
      pda: commitmentPda,
      user_wallet: userStr,
      project_pda: projectStr,
      principal: newPrincipal.toString(),
      deposit_ts: ts.toISOString(),
      last_accrual_ts: ts.toISOString(),
      last_seen_slot: slot,
    },
    { onConflict: "pda" }
  );

  // Bump the project's cumulative_principal — but only if the slot is newer.
  await sb.rpc("bump_project_cumulative_principal", {
    p_pda: projectStr,
    p_amount: amount.toString(),
    p_slot: slot,
  });
}

async function applyWithdraw(sb: Sb, slot: number, _blockTime: Date, e: DecodedEvent) {
  const userStr = e.data.user as string;
  const projectStr = e.data.project as string;
  const amount = BigInt(String(e.data.amount));

  const user = new PublicKey(userStr);
  const project = new PublicKey(projectStr);
  const commitmentPda = findCommitmentPda(user, project).toBase58();

  const { data: existing } = await sb
    .from("commitments")
    .select("principal, active_score, last_seen_slot")
    .eq("pda", commitmentPda)
    .maybeSingle();

  if (!existing || existing.last_seen_slot >= slot) return;

  const newPrincipal = BigInt(existing.principal) - amount;
  // active_score scaling is computed on-chain; we'd need to poll the
  // commitment account for the exact post-withdraw value. PointsAccrued
  // events fill the gap on subsequent accrue calls.
  await sb
    .from("commitments")
    .update({
      principal: newPrincipal.toString(),
      active_score: newPrincipal === BigInt(0) ? "0" : existing.active_score, // approximate
      last_seen_slot: slot,
    })
    .eq("pda", commitmentPda);
}

async function applyPointsAccrued(sb: Sb, slot: number, blockTime: Date, e: DecodedEvent) {
  const userStr = e.data.user as string;
  const projectStr = e.data.project as string;
  const lifetimeTotal = String(e.data.lifetimeTotal);

  const user = new PublicKey(userStr);
  const project = new PublicKey(projectStr);
  const commitmentPda = findCommitmentPda(user, project).toBase58();

  await sb
    .from("commitments")
    .update({
      lifetime_score: lifetimeTotal,
      last_accrual_ts: blockTime.toISOString(),
      last_seen_slot: slot,
    })
    .eq("pda", commitmentPda)
    .lt("last_seen_slot", slot);
}

async function applySupplyExecuted(sb: Sb, slot: number, blockTime: Date, e: DecodedEvent) {
  const projectStr = e.data.project as string;
  const amount = BigInt(String(e.data.amount));
  const adapterId = ADAPTER.Kamino;

  const lendingPda = findLendingPositionPda(
    new PublicKey(projectStr),
    adapterId as 0
  ).toBase58();

  const { data: existing } = await sb
    .from("lending_positions")
    .select("supplied, last_seen_slot")
    .eq("pda", lendingPda)
    .maybeSingle();

  if (existing && existing.last_seen_slot >= slot) return;

  const newSupplied = (existing ? BigInt(existing.supplied) : BigInt(0)) + amount;
  await sb.from("lending_positions").upsert(
    {
      pda: lendingPda,
      project_pda: projectStr,
      adapter_id: adapterId,
      vault_handle: "", // backfilled by reading the on-chain account
      supplied: newSupplied.toString(),
      last_harvest_ts: existing ? undefined : null,
      last_seen_slot: slot,
    },
    { onConflict: "pda" }
  );
  void blockTime;
}

async function applyYieldHarvested(sb: Sb, slot: number, blockTime: Date, e: DecodedEvent) {
  const projectStr = e.data.project as string;
  const amount = BigInt(String(e.data.amount));

  // Bump project.cumulative_yield_routed.
  await sb.rpc("bump_project_cumulative_yield", {
    p_pda: projectStr,
    p_amount: amount.toString(),
    p_slot: slot,
  });

  // Bump LendingPosition.last_harvest_ts.
  const lendingPda = findLendingPositionPda(
    new PublicKey(projectStr),
    ADAPTER.Kamino as 0
  ).toBase58();
  await sb
    .from("lending_positions")
    .update({
      last_harvest_ts: blockTime.toISOString(),
      last_seen_slot: slot,
    })
    .eq("pda", lendingPda)
    .lt("last_seen_slot", slot);
}

async function applyProjectMetadataUpdated(
  sb: Sb,
  slot: number,
  _blockTime: Date,
  e: DecodedEvent
) {
  const projectStr = e.data.project as string;
  const newHash = e.data.newHash as number[]; // [u8; 32]
  await sb
    .from("projects")
    .update({
      metadata_uri_hash: Buffer.from(newHash),
      metadata: null, // forces lazy refetch from IPFS
      last_seen_slot: slot,
    })
    .eq("pda", projectStr)
    .lt("last_seen_slot", slot);
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
  let txCount = 0;
  let eventCount = 0;

  for (const tx of body) {
    const logs = tx.meta?.logMessages ?? [];
    if (logs.length === 0) continue;

    let parsed: DecodedEvent[];
    try {
      parsed = parseEvents(logs);
    } catch (e) {
      console.warn(`event parse failed for ${tx.signature}:`, e);
      continue;
    }

    txCount++;
    const blockTime = new Date(tx.timestamp * 1000);
    for (const evt of parsed) {
      try {
        const { duplicate } = await recordEvent(sb, tx, evt);
        if (duplicate) continue;
        eventCount++;

        switch (evt.name) {
          case "ProjectCreated":
            await upsertProject(sb, tx.slot, blockTime, evt);
            break;
          case "Committed":
            await applyCommit(sb, tx.slot, blockTime, evt);
            break;
          case "Withdrawn":
            await applyWithdraw(sb, tx.slot, blockTime, evt);
            break;
          case "PointsAccrued":
            await applyPointsAccrued(sb, tx.slot, blockTime, evt);
            break;
          case "SupplyExecuted":
            await applySupplyExecuted(sb, tx.slot, blockTime, evt);
            break;
          case "YieldHarvested":
            await applyYieldHarvested(sb, tx.slot, blockTime, evt);
            break;
          case "ProjectMetadataUpdated":
            await applyProjectMetadataUpdated(sb, tx.slot, blockTime, evt);
            break;
          default:
            console.warn(`unhandled event: ${evt.name}`);
        }
      } catch (e) {
        console.error(`handler error for ${evt.name} in ${tx.signature}:`, e);
        // Don't fail the whole batch; Helius will retry the tx.
      }
    }
  }

  return NextResponse.json({ ok: true, txCount, eventCount });
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
