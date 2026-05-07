/**
 * Shared types for the engagement API surface (project_updates, reactions,
 * comments). Mirrors the row shapes returned by the routes under
 * /api/founder/updates, /api/projects/[pda]/updates,
 * /api/updates/[id]/reactions, /api/updates/[id]/comments.
 */

export type RemoteUpdate = {
  id: string;
  project_pda: string;
  author_wallet: string;
  title: string;
  body: string;
  is_pivot: boolean;
  is_graduation: boolean;
  posted_at: string;
  /** emoji → count, present on the GET /api/projects/[pda]/updates payload */
  reactions?: Record<string, number>;
};

export type RemoteComment = {
  id: string;
  update_id: string;
  author_wallet: string;
  body: string;
  posted_at: string;
};

/** The four reaction tokens the v0.5 UI ships with. Server accepts any
 *  short string; the client constrains to this set so counts stay tidy. */
export const REACTION_TOKENS = ["+1", "fire", "heart", "hmm"] as const;
export type ReactionToken = (typeof REACTION_TOKENS)[number];
