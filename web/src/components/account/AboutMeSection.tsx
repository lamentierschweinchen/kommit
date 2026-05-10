"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { BrutalInput, BrutalTextarea } from "@/components/common/BrutalInput";
import { Icon } from "@/components/common/Icon";
import {
  compactSocials,
  readProfileOverride,
  saveProfileOverride,
} from "@/lib/profile-store";
import type { SocialLinks } from "@/lib/data/users";

const BIO_MAX = 240;

/**
 * Editable "About me" + socials block on /account. Shows a read view by
 * default; "Edit" reveals the form. Changes persist to localStorage in
 * demo mode (overrides the seeded USERS bio/socials for that wallet) and
 * also work in real-auth mode as a local-only stub until a backend exists.
 *
 * The matching read-only render on a founder's project card lives at
 * `web/src/app/projects/[slug]/page.tsx` and consumes `Project.founders.socials`
 * directly — that's a separate code path so the public page doesn't depend
 * on the visitor's localStorage.
 */
export function AboutMeSection() {
  const { user } = useAuth();
  const { confirm } = useToast();

  const seededBio = user?.bio ?? "";
  const seededSocials: SocialLinks = useMemo(() => user?.socials ?? {}, [user?.socials]);

  const [bio, setBio] = useState(seededBio);
  const [socials, setSocials] = useState<SocialLinks>(seededSocials);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load any locally-saved override on mount and whenever the active wallet
  // changes (persona switch).
  useEffect(() => {
    if (!user?.wallet) return;
    const override = readProfileOverride(user.wallet);
    setBio(override?.bio ?? seededBio);
    setSocials(override?.socials ?? seededSocials);
  }, [user?.wallet, seededBio, seededSocials]);

  const compactedSocials = useMemo(() => compactSocials(socials), [socials]);
  const hasAnySocial = Object.keys(compactedSocials).length > 0;

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    const compact = compactSocials(socials);
    const ok = saveProfileOverride(user.wallet, {
      bio: bio.trim() || undefined,
      socials: Object.keys(compact).length > 0 ? compact : undefined,
    });
    setSaving(false);
    if (ok) {
      confirm("Profile saved.");
      setSocials(compact);
      setEditing(false);
    } else {
      // The only failure path right now is the recording-mode freeze; surface that.
      confirm("Demo recording mode is frozen — changes not saved.");
    }
  };

  const handleCancel = () => {
    const override = readProfileOverride(user.wallet);
    setBio(override?.bio ?? seededBio);
    setSocials(override?.socials ?? seededSocials);
    setEditing(false);
  };

  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
            About me
          </div>
          <p className="mt-1 text-xs font-medium text-gray-600">
            Public — shown next to your kommits and on founder pages.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutal transition-transform inline-flex items-center gap-2"
          >
            <Icon name="edit_note" size="sm" />
            Edit
          </button>
        ) : null}
      </header>

      {!editing ? (
        <div className="mt-5 space-y-4">
          {bio ? (
            <p className="text-sm md:text-base font-medium text-gray-800 leading-relaxed">
              {bio}
            </p>
          ) : (
            <p className="text-sm font-medium text-gray-500 italic">
              No bio yet. Add one — it&rsquo;s how founders learn who you are when you
              back them.
            </p>
          )}
          {hasAnySocial ? (
            <div className="flex items-center gap-2 flex-wrap">
              {compactedSocials.linkedin ? (
                <SocialChip url={compactedSocials.linkedin} label="LinkedIn" />
              ) : null}
              {compactedSocials.twitter ? (
                <SocialChip url={compactedSocials.twitter} label="Twitter" />
              ) : null}
              {compactedSocials.website ? (
                <SocialChip url={compactedSocials.website} label="Website" />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <FormField
            label="Bio"
            help={`One or two sentences. ${bio.length}/${BIO_MAX} characters.`}
          >
            <BrutalTextarea
              rows={3}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What you back, why you back it."
            />
          </FormField>
          <FormField label="LinkedIn">
            <BrutalInput
              type="url"
              inputMode="url"
              maxLength={300}
              value={socials.linkedin ?? ""}
              onChange={(e) =>
                setSocials((s) => ({ ...s, linkedin: e.target.value }))
              }
              placeholder="https://www.linkedin.com/in/…"
            />
          </FormField>
          <FormField label="Twitter / X">
            <BrutalInput
              type="url"
              inputMode="url"
              maxLength={300}
              value={socials.twitter ?? ""}
              onChange={(e) =>
                setSocials((s) => ({ ...s, twitter: e.target.value }))
              }
              placeholder="https://twitter.com/…"
            />
          </FormField>
          <FormField label="Website">
            <BrutalInput
              type="url"
              inputMode="url"
              maxLength={300}
              value={socials.website ?? ""}
              onChange={(e) =>
                setSocials((s) => ({ ...s, website: e.target.value }))
              }
              placeholder="https://…"
            />
          </FormField>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function FormField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-epilogue font-black uppercase text-[11px] tracking-widest mb-2">
        {label}
      </label>
      {children}
      {help ? (
        <p className="mt-2 text-xs font-medium text-gray-500 leading-relaxed">{help}</p>
      ) : null}
    </div>
  );
}

function SocialChip({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-white border-[2px] border-black shadow-brutal-sm px-3 py-1.5 font-epilogue font-black uppercase text-xs tracking-tight hover:bg-secondary hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
    >
      {label}
      <Icon name="arrow_outward" size="xs" />
    </a>
  );
}
