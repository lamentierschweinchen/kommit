"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileActivity } from "@/components/profile/ProfileActivity";
import type { User } from "@/lib/data/users";
import type { FounderRecord } from "@/lib/founder-types";

export function ProfileClient({
  slug,
  user,
  founder,
}: {
  slug: string;
  user: User | null;
  /** Server-resolved founder record for this slug, if any. Drives the
   *  edit-profile modal when the viewer matches the founder's wallet. */
  founder: FounderRecord | null;
}) {
  const { user: viewer } = useAuth();

  // "Own profile" — viewer matches either the persona id (e.g. lukas) or
  // the wallet stub used for real-Privy users without a userId, OR the
  // wallet on the resolved founder record.
  const isOwnProfile =
    !!viewer &&
    (
      (!!user && viewer.id === user.id) ||
      (!user && !!viewer.wallet && viewer.wallet === slug) ||
      (!!founder && !!viewer.wallet && viewer.wallet === founder.wallet)
    );

  const wallet = user?.wallet ?? founder?.wallet ?? slug;

  return (
    <>
      <ProfileHeader
        user={user ?? undefined}
        slug={slug}
        wallet={wallet}
        isOwnProfile={isOwnProfile}
        founder={founder}
      />
      <ProfileActivity
        user={user ?? undefined}
        slug={slug}
        isOwnProfile={isOwnProfile}
      />
    </>
  );
}
