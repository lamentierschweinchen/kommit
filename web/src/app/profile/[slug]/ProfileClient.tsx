"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileActivity } from "@/components/profile/ProfileActivity";
import type { User } from "@/lib/data/users";

export function ProfileClient({
  slug,
  user,
}: {
  slug: string;
  user: User | null;
}) {
  const { user: viewer } = useAuth();

  // "Own profile" — viewer matches either the persona id (e.g. lukas) or
  // the wallet stub used for real-Privy users without a userId.
  const isOwnProfile =
    !!viewer &&
    (
      (!!user && viewer.id === user.id) ||
      (!user && !!viewer.wallet && viewer.wallet === slug)
    );

  const wallet = user?.wallet ?? slug;

  return (
    <>
      <ProfileHeader
        user={user ?? undefined}
        slug={slug}
        wallet={wallet}
        isOwnProfile={isOwnProfile}
      />
      <ProfileActivity
        user={user ?? undefined}
        slug={slug}
        isOwnProfile={isOwnProfile}
      />
    </>
  );
}
