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

const NS = "demo:v1:";

const KEY_UPDATES = `${NS}updates`; // Record<projectPda, RemoteUpdate[]>
const KEY_REACTIONS = `${NS}reactions`; // Record<updateId, Record<emoji, number>>
const KEY_COMMENTS = `${NS}comments`; // Record<updateId, RemoteComment[]>
const KEY_POSITIONS = `${NS}positions`; // Record<wallet, Record<slug, StoredPosition>>
const KEY_BALANCES = `${NS}balances`; // Record<wallet, number>
const KEY_SEEDED = `${NS}seeded`; // marker — has activate-time seed run?

/** Each persona starts with this much simulated USDC available to kommit. */
export const DEMO_DEFAULT_BALANCE_USD = 5000;

type StoredPosition = {
  kommittedUSD: number;
  sinceISO: string;
  pivotedAtISO?: string;
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
 * Read the demo-mode positions for a wallet. Returned shape matches the
 * `Commitment` rows the dashboard already consumes, so swapping this in for
 * the on-chain read in queries.ts is a one-line change.
 */
export function getDemoPositions(wallet: string): Commitment[] {
  if (!wallet) return [];
  const byWallet = readAllPositions()[wallet] ?? {};
  return Object.entries(byWallet).map(([projectSlug, p]) => ({
    projectSlug,
    kommittedUSD: p.kommittedUSD,
    sinceISO: p.sinceISO,
    ...(p.pivotedAtISO ? { pivotedAtISO: p.pivotedAtISO } : {}),
  }));
}

/** Single-position lookup for the project detail page's UserPositionCard. */
export function getDemoPosition(
  wallet: string,
  projectSlug: string,
): Commitment | null {
  if (!wallet) return null;
  const p = readAllPositions()[wallet]?.[projectSlug];
  if (!p) return null;
  return {
    projectSlug,
    kommittedUSD: p.kommittedUSD,
    sinceISO: p.sinceISO,
    ...(p.pivotedAtISO ? { pivotedAtISO: p.pivotedAtISO } : {}),
  };
}

/**
 * Simulate a kommit. Tops up an existing position (preserving sinceISO so
 * the lifetime kommit accrual isn't reset) or creates a new one. Debits the
 * persona's available USDC balance.
 */
export function simulateCommit(args: {
  wallet: string;
  projectSlug: string;
  principalUSD: number;
}): Commitment {
  const { wallet, projectSlug, principalUSD } = args;
  const all = readAllPositions();
  if (!all[wallet]) all[wallet] = {};
  const existing = all[wallet][projectSlug];
  if (existing) {
    existing.kommittedUSD = round2(existing.kommittedUSD + principalUSD);
  } else {
    all[wallet][projectSlug] = {
      kommittedUSD: round2(principalUSD),
      sinceISO: nowISO().slice(0, 10),
    };
  }
  writeAllPositions(all);
  setDemoBalance(wallet, getDemoBalance(wallet) - principalUSD);
  appendDemoActivity({ kind: "commit", wallet, projectSlug, amountUSD: principalUSD });
  const pos = all[wallet][projectSlug];
  return {
    projectSlug,
    kommittedUSD: pos.kommittedUSD,
    sinceISO: pos.sinceISO,
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
  const all = readAllPositions();
  const pos = all[wallet]?.[projectSlug];
  if (!pos) return null;
  const next = round2(Math.max(0, pos.kommittedUSD - amountUSD));
  if (next <= 0) {
    delete all[wallet][projectSlug];
    if (Object.keys(all[wallet]).length === 0) delete all[wallet];
  } else {
    pos.kommittedUSD = next;
  }
  writeAllPositions(all);
  setDemoBalance(wallet, getDemoBalance(wallet) + amountUSD);
  appendDemoActivity({ kind: "withdraw", wallet, projectSlug, amountUSD });
  return next > 0
    ? { projectSlug, kommittedUSD: next, sinceISO: pos.sinceISO }
    : null;
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
  const all = readAllBalances();
  all[wallet] = round2(Math.max(0, amount));
  writeStore(KEY_BALANCES, all);
}

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
    pda: string;
    authorWallet: string;
    seed: Array<{ atISO: string; title: string; body: string; isPivot?: boolean; isGraduation?: boolean }>;
  }>;
}) {
  if (typeof window === "undefined") return;
  const already = window.localStorage.getItem(KEY_SEEDED);
  if (already === "1") return;

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

  // Seed every project's update history into the API-shape store, with
  // deterministic IDs so reactions persist across reloads.
  const allUpdates = readAllUpdates();
  for (const p of args.projectUpdates) {
    if ((allUpdates[p.pda]?.length ?? 0) > 0) continue;
    allUpdates[p.pda] = p.seed.map((u, i) => ({
      id: stableId(p.pda, u.atISO, i),
      project_pda: p.pda,
      author_wallet: p.authorWallet,
      title: u.title,
      body: u.body,
      is_pivot: !!u.isPivot,
      is_graduation: !!u.isGraduation,
      // Rendered via longDate(slice(0,10)) — pad to ISO so slicing matches.
      posted_at: `${u.atISO}T12:00:00.000Z`,
    }));
  }
  writeAllUpdates(allUpdates);

  try {
    window.localStorage.setItem(KEY_SEEDED, "1");
  } catch {
    /* non-fatal */
  }
}

function stableId(pda: string, atISO: string, idx: number): string {
  // FNV-1a 32-bit on (pda + atISO + idx) → format as a UUID-ish string. The
  // API route accepts any string for update_id; reactions/comments key off
  // it. Stable across reloads because the inputs are stable.
  const seed = `${pda}|${atISO}|${idx}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  // Build a v4-ish UUID — passes the regex on the real /api/updates/[id]/* routes.
  const a = hex;
  const b = hex.slice(0, 4);
  const c = "4" + hex.slice(1, 4);
  const d = "8" + hex.slice(1, 4);
  const e = (hex + hex).slice(0, 12);
  return `${a}-${b}-${c}-${d}-${e}`;
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
    window.localStorage.removeItem(KEY_ACTIVITY);
    window.localStorage.removeItem(KEY_SEEDED);
  } catch {
    /* non-fatal */
  }
}
