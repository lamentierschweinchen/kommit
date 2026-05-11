import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { ProfileClient } from "./ProfileClient";
import { getUser, getUserByWallet, type User } from "@/lib/data/users";
import { getFounderBySlugOrWallet } from "@/lib/founders-store";
import { flagAndCountryLabel } from "@/lib/country-flag";
import { sanitizeExternalUrl } from "@/lib/url-safety";
import type { FounderRecord } from "@/lib/founder-types";

/**
 * Translate a server-fetched FounderRecord into the User shape the rest of
 * the profile page consumes. Same mapping as RealAuthProvider's
 * mergeFounderIntoUser, but server-side — the profile page renders for
 * visitors who aren't the founder, so we can't rely on the auth-provider
 * cached copy.
 */
function founderToUser(record: FounderRecord): User {
  const socials: User["socials"] = {};
  for (const { label, url } of record.links) {
    const safeUrl = sanitizeExternalUrl(url);
    if (!safeUrl) continue;
    const k = label.trim().toLowerCase();
    if (k === "twitter" || k === "x") socials.twitter = safeUrl;
    else if (k === "linkedin") socials.linkedin = safeUrl;
    else if (k === "github") socials.github = safeUrl;
    else if (k === "website" || k === "site") socials.website = safeUrl;
  }
  return {
    id: record.userId ?? record.wallet,
    displayName: record.displayName,
    role: record.role === "admin" ? "kommitter" : "founder",
    avatarSeed: record.avatarSeed ?? 1,
    email: "",
    wallet: record.wallet,
    ownsProject: record.projectSlug ?? undefined,
    bio: record.bio ?? undefined,
    location: flagAndCountryLabel(record.country) ?? undefined,
    interests: record.interests.length > 0 ? record.interests : undefined,
    socials: Object.keys(socials).length > 0 ? socials : undefined,
  };
}

function founderToClientRecord(record: FounderRecord): FounderRecord {
  return {
    ...record,
    email: null,
    role: "founder",
    links: record.links.flatMap((link) => {
      const safeUrl = sanitizeExternalUrl(link.url);
      return safeUrl ? [{ ...link, url: safeUrl }] : [];
    }),
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Resolution priority:
  //   1. USERS[slug]                                       → seeded persona
  //   2. getUserByWallet(slug)                             → seeded persona via wallet
  //   3. founders table where user_id = slug OR wallet = slug → real-Privy founder
  //   4. (fallthrough) slim wallet stub                    → real-Privy kommitter
  let user: User | null = getUser(slug) ?? getUserByWallet(slug) ?? null;
  let founder: FounderRecord | null = null;

  if (!user) {
    founder = await getFounderBySlugOrWallet(slug);
    if (founder) user = founderToUser(founder);
  }

  const clientFounder = founder ? founderToClientRecord(founder) : null;

  return (
    <>
      <AuthHeader homeHref="/app" />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-5xl mx-auto w-full">
        <ProfileClient slug={slug} user={user} founder={clientFounder} />
      </main>
      <Footer />
    </>
  );
}
