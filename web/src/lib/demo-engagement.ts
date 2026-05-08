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

const NS = "demo:v1:";

const KEY_UPDATES = `${NS}updates`; // Record<projectPda, RemoteUpdate[]>
const KEY_REACTIONS = `${NS}reactions`; // Record<updateId, Record<emoji, number>>
const KEY_COMMENTS = `${NS}comments`; // Record<updateId, RemoteComment[]>

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

/** Reset all demo engagement state. Useful for the "fresh demo" affordance. */
export function clearDemoEngagement() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_UPDATES);
    window.localStorage.removeItem(KEY_REACTIONS);
    window.localStorage.removeItem(KEY_COMMENTS);
  } catch {
    /* non-fatal */
  }
}
