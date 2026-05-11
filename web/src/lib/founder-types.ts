/**
 * Shared founder types — bundle-safe.
 *
 * Lives separately from `founders-store.ts` (which carries
 * `import "server-only"`) so the same shapes can be re-used by client
 * components without dragging the service-role Supabase client into a
 * browser bundle. The store file re-imports these names.
 */

export type FounderLink = {
  label: string;
  url: string;
};

export type FounderRecord = {
  wallet: string;
  userId: string | null;
  email: string | null;
  displayName: string;
  role: "founder" | "admin";
  projectSlug: string | null;
  country: string | null;
  interests: string[];
  bio: string | null;
  links: FounderLink[];
  avatarSeed: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Editable subset — the fields a founder can change on their own profile
 *  via /api/me/profile. Excludes admin-managed columns (role, project_slug,
 *  user_id, email). */
export type FounderProfileUpdate = {
  displayName?: string;
  country?: string | null;
  bio?: string | null;
  interests?: string[];
  links?: FounderLink[];
  avatarSeed?: number | null;
};

/** Onboarding-script upsert shape — every column the script knows how to
 *  set. */
export type FounderUpsert = {
  wallet: string;
  userId?: string | null;
  email?: string | null;
  displayName: string;
  role?: "founder" | "admin";
  projectSlug?: string | null;
  country?: string | null;
  interests?: string[];
  bio?: string | null;
  links?: FounderLink[];
  avatarSeed?: number | null;
};
