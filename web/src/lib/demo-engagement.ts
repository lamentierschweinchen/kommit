"use client";

/**
 * Demo-mode backing store for the engagement loop.
 *
 * In demo mode we don't hit the production API routes (the server would
 * reject the mock-wallet header in production builds, and the founder/
 * sybil checks expect real on-chain rows we don't have for demo personas).
 * Instead, `authedFetch` short-circuits to this module's `demoFetch`, which
 * speaks the same Response shape as the real routes but persists state in
 * localStorage.
 *
 * Endpoints covered:
 *   POST   /api/founder/updates                  → append to demo:updates
 *   GET    /api/projects/[pda]/updates           → seed + appended updates
 *   POST   /api/updates/[id]/reactions           → bump counts in demo:reactions
 *   DELETE /api/updates/[id]/reactions           → decrement
 *   GET    /api/updates/[id]/comments            → read demo:comments[id]
 *   POST   /api/updates/[id]/comments            → append
 *
 * Storage keys are versioned with `demo:v1:` so a future schema change can
 * invalidate cleanly. Personas reactions/comments share one keyspace per
 * browser — switching persona doesn't swap storage, which mirrors the
 * "shared cohort" framing of the demo (every persona sees the same
 * accumulated state).
 */

import type { RemoteComment, RemoteUpdate } from "@/lib/api-types";
import type { Commitment } from "@/lib/data/commitments";
import { getProject } from "@/lib/data/projects";
import { isDemoFrozen } from "@/lib/demo-mode";

const NS = "demo:v1:";

const KEY_UPDATES = `${NS}updates`; // Record<projectPda, RemoteUpdate[]>
const KEY_REACTIONS = `${NS}reactions`; // Record<updateId, Record<emoji, number>>
const KEY_COMMENTS = `${NS}comments`; // Record<updateId, RemoteComment[]>
const KEY_POSITIONS = `${NS}positions`; // Record<wallet, Record<slug, StoredPosition>>
const KEY_BALANCES = `${NS}balances`; // Record<wallet, number>
const KEY_BACKER_NOTES = `${NS}backerNotes`; // Record<projectSlug, BackerNote[]>
const KEY_SEEDED = `${NS}seeded`; // marker — has activate-time seed run?
// Per-piece seed markers (handoff 63): engagement (reactions + comments per
// pivot/graduation update) + backer notes ship after the original cohort
// seed. They run idempotently against their own markers so browsers that
// already activated demo under v1 get the new content without needing a
// manual `clearDemoEngagement` to flush v1 state.
const KEY_ENGAGEMENT_SEEDED = `${NS}engagementSeeded`;
const KEY_NOTES_SEEDED = `${NS}notesSeeded`;

/** Each persona starts with this much simulated USDC available to kommit. */
export const DEMO_DEFAULT_BALANCE_USD = 5000;

type StoredPosition = {
  kommittedUSD: number;
  sinceISO: string;
  /** Millisecond-precision commit timestamp — fresh demo commits set this so
   *  the live-kommits hook can tick from the actual moment of commit instead
   *  of from midnight UTC of the date. Absent on positions migrated from
   *  before this field was introduced; the hook falls back to `sinceISO`. */
  sinceMs?: number;
  pivotedAtISO?: string;
  /** Handoff 65 B2: a full withdraw zeroes `kommittedUSD` but keeps the row
   *  with `withdrawnAtMs` set so the dashboard renders a "WITHDRAWN" tile
   *  with the kommit count frozen at this moment. */
  withdrawnAtMs?: number;
  /** Lifetime kommits snapshot at the moment the position froze (full
   *  withdraw). Live ticking stops; the dashboard sum holds steady. */
  frozenKommits?: number;
};

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: not cryptographically strong, but we only need uniqueness in
  // a single browser's localStorage scope.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---- Updates ---------------------------------------------------------------

function readAllUpdates(): Record<string, RemoteUpdate[]> {
  return readStore<Record<string, RemoteUpdate[]>>(KEY_UPDATES, {});
}

function writeAllUpdates(updates: Record<string, RemoteUpdate[]>) {
  writeStore(KEY_UPDATES, updates);
}

function appendUpdate(update: RemoteUpdate): RemoteUpdate {
  if (isDemoFrozen()) return update;
  const all = readAllUpdates();
  const list = all[update.project_pda] ?? [];
  // Newest first to match the real route's ORDER BY posted_at DESC.
  all[update.project_pda] = [update, ...list];
  writeAllUpdates(all);
  return update;
}

function listUpdatesByPda(projectPda: string): RemoteUpdate[] {
  const all = readAllUpdates();
  return all[projectPda] ?? [];
}

// ---- Reactions -------------------------------------------------------------

function readAllReactions(): Record<string, Record<string, number>> {
  return readStore<Record<string, Record<string, number>>>(KEY_REACTIONS, {});
}

function writeAllReactions(reactions: Record<string, Record<string, number>>) {
  writeStore(KEY_REACTIONS, reactions);
}

function bumpReaction(updateId: string, emoji: string, delta: 1 | -1) {
  if (isDemoFrozen()) return;
  const all = readAllReactions();
  const counts = all[updateId] ?? {};
  const next = Math.max(0, (counts[emoji] ?? 0) + delta);
  if (next === 0) {
    delete counts[emoji];
  } else {
    counts[emoji] = next;
  }
  if (Object.keys(counts).length === 0) delete all[updateId];
  else all[updateId] = counts;
  writeAllReactions(all);
}

function readReactionsFor(updateId: string): Record<string, number> {
  return readAllReactions()[updateId] ?? {};
}

// ---- Comments --------------------------------------------------------------

function readAllComments(): Record<string, RemoteComment[]> {
  return readStore<Record<string, RemoteComment[]>>(KEY_COMMENTS, {});
}

function writeAllComments(all: Record<string, RemoteComment[]>) {
  writeStore(KEY_COMMENTS, all);
}

function appendComment(updateId: string, comment: RemoteComment) {
  if (isDemoFrozen()) return;
  const all = readAllComments();
  all[updateId] = [...(all[updateId] ?? []), comment];
  writeAllComments(all);
}

function listCommentsFor(updateId: string): RemoteComment[] {
  return readAllComments()[updateId] ?? [];
}

// ---- Router ----------------------------------------------------------------

const RE_FOUNDER_UPDATES = /^\/api\/founder\/updates\/?$/;
const RE_PROJECT_UPDATES = /^\/api\/projects\/([^/]+)\/updates\/?$/;
const RE_UPDATE_REACTIONS = /^\/api\/updates\/([^/]+)\/reactions\/?$/;
const RE_UPDATE_COMMENTS = /^\/api\/updates\/([^/]+)\/comments\/?$/;

/**
 * Route a fetch to a localStorage handler that mirrors the API contract.
 * Returns null if the URL isn't an engagement-loop endpoint we simulate —
 * the caller (`authedFetch`) should fall through to the network in that
 * case (e.g. RPC, Privy iframe, asset routes).
 */
export async function demoFetch(
  input: string,
  init: RequestInit & { mockWallet?: string | null } = {},
): Promise<Response | null> {
  const url = typeof input === "string" ? input : "";
  const method = (init.method ?? "GET").toUpperCase();
  const callerWallet = init.mockWallet ?? "";

  // Founder posts an update.
  if (RE_FOUNDER_UPDATES.test(url) && method === "POST") {
    const body = parseJSONBody(init.body);
    if (!body) return jsonResponse({ error: "invalid-body" }, 400);
    const update: RemoteUpdate = {
      id: uuid(),
      project_pda: String(body.project_pda ?? ""),
      author_wallet: callerWallet,
      title: String(body.title ?? "").slice(0, 200),
      body: String(body.body ?? "").slice(0, 10_000),
      is_pivot: !!body.is_pivot,
      is_graduation: !!body.is_graduation,
      posted_at: nowISO(),
    };
    appendDemoActivity({
      kind: "post-update",
      wallet: callerWallet,
      label: update.title.slice(0, 60),
    });
    return jsonResponse({ update: appendUpdate(update) }, 201);
  }

  // Public list of updates for a project.
  const projectMatch = url.match(RE_PROJECT_UPDATES);
  if (projectMatch && method === "GET") {
    const pda = decodeURIComponent(projectMatch[1]);
    const list = listUpdatesByPda(pda);
    const enriched = list.map((u) => ({
      ...u,
      reactions: readReactionsFor(u.id),
    }));
    return jsonResponse({ updates: enriched });
  }

  // Reactions toggle.
  const reactionsMatch = url.match(RE_UPDATE_REACTIONS);
  if (reactionsMatch && (method === "POST" || method === "DELETE")) {
    const updateId = decodeURIComponent(reactionsMatch[1]);
    const body = parseJSONBody(init.body);
    const emoji = body?.emoji ? String(body.emoji) : "";
    if (!emoji) return jsonResponse({ error: "invalid-body" }, 400);
    bumpReaction(updateId, emoji, method === "POST" ? 1 : -1);
    if (method === "POST") {
      appendDemoActivity({
        kind: "react",
        wallet: callerWallet,
        label: `${emoji} on an update`,
      });
    }
    return jsonResponse({ ok: true });
  }

  // Comments.
  const commentsMatch = url.match(RE_UPDATE_COMMENTS);
  if (commentsMatch) {
    const updateId = decodeURIComponent(commentsMatch[1]);
    if (method === "GET") {
      return jsonResponse({ comments: listCommentsFor(updateId) });
    }
    if (method === "POST") {
      const body = parseJSONBody(init.body);
      const text = body?.body ? String(body.body).slice(0, 2000) : "";
      if (!text) return jsonResponse({ error: "invalid-body" }, 400);
      const comment: RemoteComment = {
        id: uuid(),
        update_id: updateId,
        author_wallet: callerWallet,
        body: text,
        posted_at: nowISO(),
      };
      appendComment(updateId, comment);
      appendDemoActivity({
        kind: "comment",
        wallet: callerWallet,
        label: text.slice(0, 60),
      });
      return jsonResponse({ comment }, 201);
    }
  }

  return null;
}

function parseJSONBody(body: BodyInit | null | undefined): Record<string, unknown> | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Seed initial demo updates for a project — called by /demo entry once per
 * activation so visitors don't see an empty timeline. Idempotent: only seeds
 * if no updates exist for the given pda yet.
 */
export function seedDemoUpdates(projectPda: string, seed: RemoteUpdate[]) {
  const all = readAllUpdates();
  if ((all[projectPda]?.length ?? 0) > 0) return;
  all[projectPda] = seed;
  writeAllUpdates(all);
}

// ---- Positions (commit/withdraw simulation) --------------------------------

function readAllPositions(): Record<string, Record<string, StoredPosition>> {
  return readStore<Record<string, Record<string, StoredPosition>>>(KEY_POSITIONS, {});
}

function writeAllPositions(all: Record<string, Record<string, StoredPosition>>) {
  writeStore(KEY_POSITIONS, all);
}

/**
 * Notify same-tab listeners that the positions store changed. Browsers
 * only fire `storage` events to OTHER tabs, so a kommit in this tab
 * leaves components like the project page's KommittersList and
 * UpdatesPanel reading stale data until reload. Dispatching a synthetic
 * StorageEvent on the positions key lets those listeners re-fetch
 * without coupling them to the commit modal's onSuccess callback.
 */
function notifyPositionsChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: KEY_POSITIONS }));
  } catch {
    /* non-fatal */
  }
}

/** Storage key clients can watch to react to position mutations. */
export const DEMO_POSITIONS_STORAGE_KEY = KEY_POSITIONS;

/** Storage key flipped to "1" the first time the engagement seed completes
 *  (reactions + comments for pivot/graduation updates). Clients listen on
 *  `storage` events for this key to refetch after the seed lands — handoff
 *  65 B3 fixes the race where UpdateComments mounted before the seed wrote
 *  its 6 quire-chess pivot comments. */
export const DEMO_ENGAGEMENT_SEEDED_KEY = KEY_ENGAGEMENT_SEEDED;

/**
 * Read the demo-mode positions for a wallet. Returned shape matches the
 * `Commitment` rows the dashboard already consumes, so swapping this in for
 * the on-chain read in queries.ts is a one-line change.
 */
export function getDemoPositions(wallet: string): Commitment[] {
  if (!wallet) return [];
  const byWallet = readAllPositions()[wallet] ?? {};
  return Object.entries(byWallet).map(([projectSlug, p]) =>
    toCommitment(projectSlug, p),
  );
}

function toCommitment(projectSlug: string, p: StoredPosition): Commitment {
  // Contract: `withdrawnAtMs` describes the position's *current* state — only
  // expose it when actually withdrawn (principal at zero). On a re-kommit
  // the stored snapshot keeps it for the audit trail, but surfacing it on
  // the live row would re-trigger the WITHDRAWN pill and clamp accrual to
  // the prior withdraw moment via CommitmentRow's freezeAtMs.
  // `frozenKommits` is the lifetime accumulator and carries forward always.
  const isCurrentlyWithdrawn = p.kommittedUSD <= 0;
  return {
    projectSlug,
    kommittedUSD: p.kommittedUSD,
    sinceISO: p.sinceISO,
    ...(p.sinceMs ? { sinceMs: p.sinceMs } : {}),
    ...(p.pivotedAtISO ? { pivotedAtISO: p.pivotedAtISO } : {}),
    ...(isCurrentlyWithdrawn && p.withdrawnAtMs
      ? { withdrawnAtMs: p.withdrawnAtMs }
      : {}),
    ...(p.frozenKommits != null ? { frozenKommits: p.frozenKommits } : {}),
  };
}

/** Single-position lookup for the project detail page's UserPositionCard. */
export function getDemoPosition(
  wallet: string,
  projectSlug: string,
): Commitment | null {
  if (!wallet) return null;
  const p = readAllPositions()[wallet]?.[projectSlug];
  if (!p) return null;
  return toCommitment(projectSlug, p);
}

/**
 * Simulate a kommit. Tops up an existing position (preserving accrued
 * kommits via a weighted re-derivation of `sinceMs`, see below) or creates
 * a new one. Debits the persona's available USDC balance.
 *
 * Top-up math (handoff 58 #1): naively summing kommittedUSD while keeping
 * the original `sinceISO/sinceMs` retroactively reattributes the new
 * principal to the original commit time, producing a massive jump in the
 * live-ticker (`newUSD × oldHours` instead of `oldUSD × oldHours +
 * newUSD × 0h`). Solution: re-derive `sinceMs` so the existing accrued
 * kommits stay invariant — the new principal then accrues from "now".
 *   oldKommits = oldUSD × (now - oldSinceMs) / hourMs
 *   newSinceMs = now - (oldKommits × hourMs) / newUSD
 * The `sinceISO` legacy field is rebuilt from `newSinceMs`.
 */
export function simulateCommit(args: {
  wallet: string;
  projectSlug: string;
  principalUSD: number;
  /** Optional public note from the backer — appears in the project's
   *  "Backer notes" panel. Trimmed/clamped to 280 chars by the caller. */
  note?: string;
  /** Display name to attribute the note to. Falls back to a short wallet
   *  if absent, but the caller usually has it. */
  authorName?: string;
}): Commitment {
  const { wallet, projectSlug, principalUSD, note, authorName } = args;
  if (isDemoFrozen()) {
    // Frozen: return the existing position unchanged so callers don't break.
    const existing = readAllPositions()[wallet]?.[projectSlug];
    return existing
      ? {
          projectSlug,
          kommittedUSD: existing.kommittedUSD,
          sinceISO: existing.sinceISO,
          ...(existing.sinceMs ? { sinceMs: existing.sinceMs } : {}),
        }
      : { projectSlug, kommittedUSD: 0, sinceISO: nowISO().slice(0, 10) };
  }
  const all = readAllPositions();
  if (!all[wallet]) all[wallet] = {};
  const existing = all[wallet][projectSlug];
  if (existing) {
    const now = Date.now();
    const HOUR_MS = 3_600_000;
    const oldSinceMs =
      existing.sinceMs ?? new Date(`${existing.sinceISO}T00:00:00Z`).getTime();
    const oldKommits = Math.max(
      0,
      existing.kommittedUSD * ((now - oldSinceMs) / HOUR_MS),
    );
    const newUSD = round2(existing.kommittedUSD + principalUSD);
    const newSinceMs =
      newUSD > 0 ? now - (oldKommits * HOUR_MS) / newUSD : now;
    existing.kommittedUSD = newUSD;
    existing.sinceMs = newSinceMs;
    existing.sinceISO = new Date(newSinceMs).toISOString().slice(0, 10);
  } else {
    all[wallet][projectSlug] = {
      kommittedUSD: round2(principalUSD),
      sinceISO: nowISO().slice(0, 10),
      sinceMs: Date.now(),
    };
  }
  writeAllPositions(all);
  setDemoBalance(wallet, getDemoBalance(wallet) - principalUSD);
  appendDemoActivity({ kind: "commit", wallet, projectSlug, amountUSD: principalUSD });
  // Optional backer note — recorded alongside the commit if provided.
  if (note && note.trim().length > 0) {
    appendBackerNote({
      projectSlug,
      wallet,
      authorName: authorName ?? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
      principalUSD,
      note: note.trim().slice(0, 280),
    });
  }
  notifyPositionsChanged();
  const pos = all[wallet][projectSlug];
  return {
    projectSlug,
    kommittedUSD: pos.kommittedUSD,
    sinceISO: pos.sinceISO,
    ...(pos.sinceMs ? { sinceMs: pos.sinceMs } : {}),
  };
}

/**
 * Simulate a withdraw. Decrements the position; if it hits zero the
 * position is removed. Credits the persona's balance.
 */
export function simulateWithdraw(args: {
  wallet: string;
  projectSlug: string;
  amountUSD: number;
}): Commitment | null {
  const { wallet, projectSlug, amountUSD } = args;
  if (isDemoFrozen()) {
    const existing = readAllPositions()[wallet]?.[projectSlug];
    return existing
      ? { projectSlug, kommittedUSD: existing.kommittedUSD, sinceISO: existing.sinceISO }
      : null;
  }
  const all = readAllPositions();
  const pos = all[wallet]?.[projectSlug];
  if (!pos) return null;
  const next = round2(Math.max(0, pos.kommittedUSD - amountUSD));
  if (next <= 0) {
    // Handoff 65 B2: "soulbound, yours forever". Don't delete the row on a
    // full withdraw — keep it at $0 with a frozen kommit snapshot so the
    // dashboard renders a "WITHDRAWN" tile and the lifetime stat doesn't
    // regress.
    const now = Date.now();
    const HOUR_MS = 3_600_000;
    const sinceMs =
      pos.sinceMs ?? new Date(`${pos.sinceISO}T00:00:00Z`).getTime();
    // If the project is already graduated, accrual froze earlier — cap the
    // snapshot at the graduation moment so a late withdraw doesn't credit
    // post-graduation hours.
    const gradISO = getProject(projectSlug)?.graduatedAtISO;
    const gradMs = gradISO
      ? new Date(`${gradISO}T00:00:00Z`).getTime()
      : null;
    const capMs = gradMs ? Math.min(now, gradMs) : now;
    const accruedKommits = Math.max(
      0,
      pos.kommittedUSD * ((capMs - sinceMs) / HOUR_MS),
    );
    const frozenKommits = round2(
      (pos.frozenKommits ?? 0) + accruedKommits,
    );
    pos.kommittedUSD = 0;
    pos.withdrawnAtMs = now;
    pos.frozenKommits = frozenKommits;
  } else {
    pos.kommittedUSD = next;
  }
  writeAllPositions(all);
  setDemoBalance(wallet, getDemoBalance(wallet) + amountUSD);
  appendDemoActivity({ kind: "withdraw", wallet, projectSlug, amountUSD });
  notifyPositionsChanged();
  return toCommitment(projectSlug, pos);
}

// ---- Balances --------------------------------------------------------------

function readAllBalances(): Record<string, number> {
  return readStore<Record<string, number>>(KEY_BALANCES, {});
}

export function getDemoBalance(wallet: string): number {
  if (!wallet) return 0;
  const all = readAllBalances();
  return all[wallet] ?? DEMO_DEFAULT_BALANCE_USD;
}

function setDemoBalance(wallet: string, amount: number) {
  if (!wallet) return;
  if (isDemoFrozen()) return;
  const all = readAllBalances();
  all[wallet] = round2(Math.max(0, amount));
  writeStore(KEY_BALANCES, all);
}

// ---- Backer notes ----------------------------------------------------------

/**
 * Optional note left at commit time. Demo-only for v0.5; renders in the
 * "Backer notes" panel on the project detail page. Real-mode wires into
 * a server-backed comments store post-submission.
 */
export type BackerNote = {
  projectSlug: string;
  wallet: string;
  authorName: string;
  principalUSD: number;
  note: string;
  atISO: string;
};

function readAllBackerNotes(): Record<string, BackerNote[]> {
  return readStore<Record<string, BackerNote[]>>(KEY_BACKER_NOTES, {});
}

function writeAllBackerNotes(all: Record<string, BackerNote[]>) {
  writeStore(KEY_BACKER_NOTES, all);
}

function appendBackerNote(args: Omit<BackerNote, "atISO">) {
  if (isDemoFrozen()) return;
  const all = readAllBackerNotes();
  const list = all[args.projectSlug] ?? [];
  all[args.projectSlug] = [{ ...args, atISO: nowISO() }, ...list];
  writeAllBackerNotes(all);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: KEY_BACKER_NOTES }));
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Public wrapper around appendBackerNote — used by real-mode commit to
 * stash the note in localStorage as a v0.5 stub. Will rewire to a
 * server-backed comments store post-submission.
 */
export function saveBackerNote(args: Omit<BackerNote, "atISO">) {
  appendBackerNote(args);
}

export function listBackerNotes(projectSlug: string): BackerNote[] {
  if (!projectSlug) return [];
  return readAllBackerNotes()[projectSlug] ?? [];
}

/** Storage key clients can watch to react to backer-note mutations. */
export const DEMO_BACKER_NOTES_STORAGE_KEY = KEY_BACKER_NOTES;

// ---- Activity log ----------------------------------------------------------

const KEY_ACTIVITY = `${NS}activity`;

export type DemoActivityEntry = {
  kind: "commit" | "withdraw" | "post-update" | "react" | "comment";
  wallet: string;
  projectSlug?: string;
  amountUSD?: number;
  atISO: string;
  /** Optional human label — set when the entry needs a one-line description
   *  the activity feed can render without re-deriving from project data. */
  label?: string;
};

function appendDemoActivity(entry: Omit<DemoActivityEntry, "atISO">) {
  if (isDemoFrozen()) return;
  const log = readStore<DemoActivityEntry[]>(KEY_ACTIVITY, []);
  log.unshift({ ...entry, atISO: nowISO() });
  writeStore(KEY_ACTIVITY, log.slice(0, 200));
}

export function getDemoActivity(wallet: string, limit = 50): DemoActivityEntry[] {
  if (!wallet) return [];
  const log = readStore<DemoActivityEntry[]>(KEY_ACTIVITY, []);
  return log.filter((e) => e.wallet === wallet).slice(0, limit);
}

// ---- One-time activation seed ---------------------------------------------

/**
 * Idempotently seed the demo cohort state. Called by the /demo entry page
 * after `activateDemoMode()` so visitors land in a populated world: Lukas
 * has his portfolio, every project has its update history, and personas
 * carry default balances.
 */
export function seedDemoCohort(args: {
  lukasWallet: string;
  lukasCommitments: Commitment[];
  projectUpdates: Array<{
    /** Project slug — used by engagement seeds to attach
     *  comments/reactions/notes to the right project+update. */
    slug: string;
    pda: string;
    authorWallet: string;
    seed: Array<{ atISO: string; title: string; body: string; isPivot?: boolean; isGraduation?: boolean }>;
  }>;
  /** Per-update engagement seeds: reactions + comments to attach to specific
   *  (slug, atISO) update pairs. Resolved against the same stable IDs the
   *  update seed loop builds, so reactions survive reloads. */
  engagement?: Array<{
    projectSlug: string;
    updateAtISO: string;
    reactions?: Record<string, number>;
    comments?: Array<{ authorWallet: string; body: string; postedAtISO: string }>;
  }>;
  /** Per-project backer notes — surface in `BackerNotes` on the project
   *  detail page + the founder dashboard. */
  backerNotes?: Array<{
    projectSlug: string;
    authorName: string;
    authorWallet: string;
    principalUSD: number;
    note: string;
    atISO: string;
  }>;
}) {
  if (typeof window === "undefined") return;
  const already = window.localStorage.getItem(KEY_SEEDED);

  // The legacy seed marker (`demo:v1:seeded`) gates positions + initial
  // updates + Lukas's activity log — running those twice would clobber
  // in-progress kommits and activity. The newer engagement/backer-note
  // seeds (handoff 63) gate on their own per-piece existence checks so
  // they run on browsers that already activated the demo under v1 without
  // forcing the user to clear local state.
  if (already !== "1") {
    // Seed Lukas's portfolio.
    const positions = readAllPositions();
    positions[args.lukasWallet] = {};
    for (const c of args.lukasCommitments) {
      positions[args.lukasWallet][c.projectSlug] = {
        kommittedUSD: c.kommittedUSD,
        sinceISO: c.sinceISO,
        ...(c.pivotedAtISO ? { pivotedAtISO: c.pivotedAtISO } : {}),
      };
    }
    writeAllPositions(positions);
  }

  // Seed every project's update history into the API-shape store, with
  // deterministic IDs so reactions persist across reloads. The (slug → pda)
  // map is captured here so the engagement-seed loop below can resolve a
  // slug+atISO to the same stable id this loop assigns.
  const allUpdates = readAllUpdates();
  const updateIdBySlugAndDate = new Map<string, string>();
  for (const p of args.projectUpdates) {
    if ((allUpdates[p.pda]?.length ?? 0) > 0) {
      // Even when updates were pre-seeded, capture the existing IDs so the
      // engagement seed loop can attach reactions/comments to them.
      for (const u of allUpdates[p.pda] ?? []) {
        updateIdBySlugAndDate.set(
          `${p.slug}|${u.posted_at.slice(0, 10)}`,
          u.id,
        );
      }
      continue;
    }
    allUpdates[p.pda] = p.seed.map((u) => {
      const id = seedFallbackUpdateId(p.slug, u.atISO);
      updateIdBySlugAndDate.set(`${p.slug}|${u.atISO}`, id);
      return {
        id,
        project_pda: p.pda,
        author_wallet: p.authorWallet,
        title: u.title,
        body: u.body,
        is_pivot: !!u.isPivot,
        is_graduation: !!u.isGraduation,
        // Rendered via longDate(slice(0,10)) — pad to ISO so slicing matches.
        posted_at: `${u.atISO}T12:00:00.000Z`,
      };
    });
  }
  writeAllUpdates(allUpdates);

  // Seed engagement: reaction counts + comments per pivot/graduation update.
  // Idempotent via its own marker — runs once across the whole session even
  // if seedDemoCohort is called multiple times.
  const engagementMarker = window.localStorage.getItem(KEY_ENGAGEMENT_SEEDED);
  if (
    engagementMarker !== "1" &&
    args.engagement &&
    args.engagement.length > 0
  ) {
    const allReactions = readAllReactions();
    const allComments = readAllComments();
    for (const e of args.engagement) {
      const updateId = updateIdBySlugAndDate.get(
        `${e.projectSlug}|${e.updateAtISO}`,
      );
      if (!updateId) continue;
      if (e.reactions && Object.keys(e.reactions).length > 0) {
        // Merge — preserve any reactions a user already clicked through the
        // demo UI; seed counts add on top instead of overwriting.
        const cur = allReactions[updateId] ?? {};
        for (const [token, count] of Object.entries(e.reactions)) {
          cur[token] = (cur[token] ?? 0) + count;
        }
        allReactions[updateId] = cur;
      }
      if (e.comments && e.comments.length > 0) {
        const existing = allComments[updateId] ?? [];
        const seeded: RemoteComment[] = e.comments.map((c, i) => ({
          id: stableId(updateId, c.postedAtISO, i),
          update_id: updateId,
          author_wallet: c.authorWallet,
          body: c.body,
          posted_at: c.postedAtISO,
        }));
        allComments[updateId] = [...seeded, ...existing];
      }
    }
    writeAllReactions(allReactions);
    writeAllComments(allComments);
    try {
      window.localStorage.setItem(KEY_ENGAGEMENT_SEEDED, "1");
      // Browsers fire `storage` events only to OTHER tabs — dispatch a
      // synthetic one in this tab so components that mounted before the
      // seed (handoff 65 B3: UpdateComments on the quire-chess pivot)
      // can refetch and surface the just-written seeded comments.
      window.dispatchEvent(
        new StorageEvent("storage", { key: KEY_ENGAGEMENT_SEEDED }),
      );
    } catch {
      /* non-fatal */
    }
  }

  // Seed backer notes: surface in `BackerNotes` panel on project detail and
  // the founder dashboard. Idempotent via its own marker.
  const notesMarker = window.localStorage.getItem(KEY_NOTES_SEEDED);
  if (
    notesMarker !== "1" &&
    args.backerNotes &&
    args.backerNotes.length > 0
  ) {
    const allNotes = readAllBackerNotes();
    for (const n of args.backerNotes) {
      const list = allNotes[n.projectSlug] ?? [];
      allNotes[n.projectSlug] = [
        {
          projectSlug: n.projectSlug,
          wallet: n.authorWallet,
          authorName: n.authorName,
          principalUSD: n.principalUSD,
          note: n.note,
          atISO: n.atISO,
        },
        ...list,
      ];
    }
    writeAllBackerNotes(allNotes);
    try {
      window.localStorage.setItem(KEY_NOTES_SEEDED, "1");
    } catch {
      /* non-fatal */
    }
  }

  if (already !== "1") {
    // Seed Lukas's activity history so the dashboard "My history" feed has
    // something to render — a veteran kommitter ought to look ACTIVE on first
    // paint. Built from the commits he already has plus a plausible mix of
    // partial withdrawals, reactions, and comments. Idempotent: keyed off the
    // same KEY_SEEDED marker as the rest of the cohort seed.
    const existingActivity = readStore<DemoActivityEntry[]>(KEY_ACTIVITY, []);
    const hasLukasActivity = existingActivity.some(
      (e) => e.wallet === args.lukasWallet,
    );
    if (!hasLukasActivity) {
      const entries = buildLukasSeedActivity(args.lukasWallet, args.lukasCommitments);
      const merged = [...entries, ...existingActivity].slice(0, 200);
      writeStore(KEY_ACTIVITY, merged);
    }

    try {
      window.localStorage.setItem(KEY_SEEDED, "1");
    } catch {
      /* non-fatal */
    }
  }
}

/**
 * Synthesize a plausible activity log for Lukas. Each commitment becomes a
 * "commit" entry at noon UTC of its `sinceISO`, plus a sprinkle of
 * withdrawals / reactions / comments at later, scattered timestamps so the
 * feed reads like a real veteran user — not a list of identical events.
 */
function buildLukasSeedActivity(
  wallet: string,
  commitments: Commitment[],
): DemoActivityEntry[] {
  const out: DemoActivityEntry[] = [];

  for (const c of commitments) {
    out.push({
      kind: "commit",
      wallet,
      projectSlug: c.projectSlug,
      amountUSD: c.kommittedUSD,
      atISO: `${c.sinceISO}T12:00:00.000Z`,
    });
  }

  const WITHDRAWALS: Array<{ slug: string; amount: number; atISO: string }> = [
    { slug: "aurora", amount: 100, atISO: "2026-03-22T15:30:00.000Z" },
    { slug: "frame-studio", amount: 50, atISO: "2026-04-09T11:45:00.000Z" },
    { slug: "lighthouse-labs", amount: 75, atISO: "2026-04-23T18:20:00.000Z" },
  ];
  for (const w of WITHDRAWALS) {
    if (!commitments.some((c) => c.projectSlug === w.slug)) continue;
    out.push({
      kind: "withdraw",
      wallet,
      projectSlug: w.slug,
      amountUSD: w.amount,
      atISO: w.atISO,
    });
  }

  const REACTIONS: Array<{ atISO: string; emoji: string; project: string }> = [
    { atISO: "2026-04-26T09:15:00.000Z", emoji: "🔥", project: "CALDERA" },
    { atISO: "2026-04-22T17:40:00.000Z", emoji: "🚀", project: "Lighthouse Labs" },
    { atISO: "2026-04-21T14:05:00.000Z", emoji: "👏", project: "Frame Studio" },
    { atISO: "2026-04-19T20:30:00.000Z", emoji: "💪", project: "Beacon Sci" },
    { atISO: "2026-04-15T10:20:00.000Z", emoji: "🔥", project: "Caldera" },
    { atISO: "2026-04-04T13:50:00.000Z", emoji: "🤝", project: "Quire Chess" },
  ];
  for (const r of REACTIONS) {
    out.push({
      kind: "react",
      wallet,
      atISO: r.atISO,
      label: `${r.emoji} on ${r.project} update`,
    });
  }

  const COMMENTS: Array<{ atISO: string; label: string }> = [
    {
      atISO: "2026-04-25T16:20:00.000Z",
      label: "On Caldera — appreciate the rapid borefield iteration. Stay focused.",
    },
    {
      atISO: "2026-04-04T18:40:00.000Z",
      label: "On Quire — pivot is the right call. Trainer was always the wedge.",
    },
  ];
  for (const c of COMMENTS) {
    out.push({ kind: "comment", wallet, atISO: c.atISO, label: c.label });
  }

  out.sort((a, b) => b.atISO.localeCompare(a.atISO));
  return out;
}

/**
 * Stable update id keyed by (slug, atISO, idx) — same FNV scheme + format as
 * `seedFallbackId` in UpdatesPanel so the demo seed and the static-fallback
 * render path produce identical ids. Handoff 69 B10: when demoFetch's update
 * GET returns empty (rare, but possible after localStorage churn or a
 * cross-tab clear during the seed window), UpdatesPanel renders
 * `SeedUpdateRow` instead of `RemoteUpdateRow`, and previously its
 * `seedFallbackId(slug,...)` lookup didn't match the seed's `stableId(pda,...)`
 * write, so the 6 pivot comments stayed invisible. Unifying on (slug, atISO,
 * idx) closes that gap end-to-end.
 *
 * Exported so demo seed callers and the UpdatesPanel fallback can share the
 * one truth.
 */
/** Generic FNV-1a UUID-shaped id used for seed comment rows (keyed off
 *  updateId + postedAtISO + idx). Update ids themselves use the
 *  slug-keyed `seedFallbackUpdateId` below so the demo seed and the static
 *  fallback render path agree. */
function stableId(pda: string, atISO: string, idx: number): string {
  const seed = `${pda}|${atISO}|${idx}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(1, 4)}-${(hex + hex).slice(0, 12)}`;
}

export function seedFallbackUpdateId(slug: string, atISO: string): string {
  // (slug, atISO) is unique per static update — no project has two updates on
  // the same date. Dropping the previous `idx` parameter makes the id stable
  // even if the order of `project.updates` changes (e.g. inserting a new
  // older update). The old idx-keyed id orphans past interactions; this is
  // the one-time cost of stabilization.
  const seed = `seed:${slug}|${atISO}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  // v4-ish UUID — passes the regex on the real /api/updates/[id]/* routes.
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(1, 4)}-${(hex + hex).slice(0, 12)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Reset all demo engagement state. Useful for the "fresh demo" affordance. */
export function clearDemoEngagement() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_UPDATES);
    window.localStorage.removeItem(KEY_REACTIONS);
    window.localStorage.removeItem(KEY_COMMENTS);
    window.localStorage.removeItem(KEY_POSITIONS);
    window.localStorage.removeItem(KEY_BALANCES);
    window.localStorage.removeItem(KEY_BACKER_NOTES);
    window.localStorage.removeItem(KEY_ACTIVITY);
    window.localStorage.removeItem(KEY_SEEDED);
    window.localStorage.removeItem(KEY_ENGAGEMENT_SEEDED);
    window.localStorage.removeItem(KEY_NOTES_SEEDED);
  } catch {
    /* non-fatal */
  }
}
