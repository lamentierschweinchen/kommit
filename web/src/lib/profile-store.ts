/**
 * Demo-mode profile storage. The /account "About me" section reads + writes
 * through here. Each persona's overrides live at
 * `kommit:demo:profile:<wallet>` so a wallet-keyed lookup yields one row.
 *
 * Falls back to the seeded `USERS[id].bio / socials` when no override is
 * set. Save is a no-op when the demo is in frozen-recording mode (matches
 * the same gate every other demo mutator uses).
 *
 * Real-auth path: there's no backend wired yet. Save still writes
 * localStorage so the UI feels like a real form and shows the same
 * persistence the demo persona does. When a real backend exists, swap
 * `saveProfileOverride` to PATCH `/api/profile` instead.
 */

import { isDemoFrozen } from "@/lib/demo-mode";
import type { SocialLinks } from "@/lib/data/users";

export type ProfileOverride = {
  bio?: string;
  socials?: SocialLinks;
};

const KEY_PREFIX = "kommit:demo:profile:";

function key(wallet: string): string {
  return `${KEY_PREFIX}${wallet}`;
}

export function readProfileOverride(wallet: string): ProfileOverride | null {
  if (!wallet || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileOverride;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProfileOverride(wallet: string, value: ProfileOverride): boolean {
  if (!wallet || typeof window === "undefined") return false;
  if (isDemoFrozen()) return false;
  try {
    window.localStorage.setItem(key(wallet), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Strip empty strings from a SocialLinks payload so storage stays small
 * and the renderer can rely on `socials.linkedin` being either absent or a
 * usable URL.
 */
export function compactSocials(input: SocialLinks): SocialLinks {
  const out: SocialLinks = {};
  if (input.linkedin?.trim()) out.linkedin = input.linkedin.trim();
  if (input.twitter?.trim()) out.twitter = input.twitter.trim();
  if (input.website?.trim()) out.website = input.website.trim();
  return out;
}
