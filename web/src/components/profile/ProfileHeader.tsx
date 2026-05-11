"use client";

import { useState } from "react";
import { useToast } from "@/components/common/ToastProvider";
import { Icon, type IconName } from "@/components/common/Icon";
import { avatarUrl, type SocialLinks, type User } from "@/lib/data/users";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import type { FounderRecord } from "@/lib/founder-types";

type ProfileHeaderProps = {
  /** Persona — when present, every field on the page renders rich. */
  user?: User;
  /** Slug used in the URL — for stub profiles this is the truncated wallet. */
  slug: string;
  /** Wallet to show on stub profiles. */
  wallet?: string;
  /** True when the viewer is looking at their own profile. */
  isOwnProfile: boolean;
  /** Server-resolved founder record — drives the edit-profile modal when
   *  the viewer is the founder. Null for personas and stub profiles. */
  founder?: FounderRecord | null;
};

const SOCIAL_LABELS: Array<{ key: keyof SocialLinks; label: string; icon: IconName }> = [
  { key: "twitter", label: "Twitter", icon: "arrow_outward" },
  { key: "linkedin", label: "LinkedIn", icon: "arrow_outward" },
  { key: "github", label: "GitHub", icon: "arrow_outward" },
  { key: "website", label: "Website", icon: "open_in_new" },
];

export function ProfileHeader({
  user,
  slug,
  wallet,
  isOwnProfile,
  founder,
}: ProfileHeaderProps) {
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const displayName = user?.displayName ?? truncateWallet(wallet ?? slug);
  const roleLabel = user
    ? `${user.role === "founder" ? "Founder" : "Kommitter"}${user.location ? ` · ${user.location}` : ""}`
    : "Real-Privy kommitter";

  return (
    <section className="mt-12 md:mt-16 bg-white border-[3px] border-black shadow-brutal p-6 md:p-8">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-24 h-24 rounded-full border-[3px] border-black overflow-hidden bg-gray-100 shrink-0">
          {user ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl(user.avatarSeed, 200)}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Icon name="person" size="xl" className="text-gray-400" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-epilogue font-black uppercase text-3xl md:text-5xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
            {displayName}
          </h1>
          <div className="mt-3 font-epilogue font-bold uppercase text-[11px] tracking-widest text-gray-600">
            {roleLabel}
          </div>
          {user?.bio ? (
            <p className="mt-4 max-w-2xl text-base font-medium text-gray-800 leading-relaxed">
              {user.bio}
            </p>
          ) : !user ? (
            <p className="mt-4 max-w-2xl text-sm font-medium text-gray-600">
              This kommitter hasn&rsquo;t filled out their profile yet. The
              activity strip below is read straight from the chain.
            </p>
          ) : null}

          {user?.interests && user.interests.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {user.interests.map((tag) => (
                <span
                  key={tag}
                  className="font-epilogue font-bold uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black bg-secondary text-black"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {user?.socials ? <SocialRow socials={user.socials} /> : null}
        </div>

        {isOwnProfile ? (
          <button
            type="button"
            onClick={() => {
              if (founder) {
                setEditOpen(true);
                return;
              }
              // Personas + slim wallet profiles: no editable backend yet.
              // The /account About-me section handles bio + socials for
              // those; founders get the rich modal below.
              toast.confirm(
                "Profile editing is for founders right now",
                "Persona profiles + slim wallet profiles are read-only on /profile. Founder fields land here when Lukas onboards the wallet.",
              );
            }}
            className="font-epilogue font-bold uppercase tracking-widest text-[10px] px-3 py-2 border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform shrink-0 inline-flex items-center gap-1.5"
          >
            <Icon name="edit_note" size="xs" />
            Edit profile
          </button>
        ) : null}
      </div>
      {founder ? (
        <EditProfileModal
          open={editOpen}
          onOpenChange={setEditOpen}
          founder={founder}
        />
      ) : null}
    </section>
  );
}

function SocialRow({ socials }: { socials: SocialLinks }) {
  const entries = SOCIAL_LABELS.filter(({ key }) => !!socials[key]);
  if (entries.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      {entries.map(({ key, label, icon }) => (
        <a
          key={key}
          href={socials[key]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-epilogue font-bold uppercase text-[11px] tracking-widest px-3 py-1.5 border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
        >
          {label}
          <Icon name={icon} size="xs" />
        </a>
      ))}
    </div>
  );
}

function truncateWallet(wallet: string): string {
  if (!wallet) return "—";
  if (wallet.length < 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}
