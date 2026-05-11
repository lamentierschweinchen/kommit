"use client";

/**
 * Edit-profile modal — opened from the "Edit profile" button on
 * /profile/[slug] when the viewer is looking at their own founder profile.
 *
 * Bridges the in-memory FounderRecord into a form, POSTs to /api/me/profile,
 * then asks the AuthProvider to re-fetch its enrichment on success. The
 * profile page re-renders via `router.refresh()` so the new fields appear
 * without a full reload.
 *
 * Field set matches what /api/me/profile accepts:
 *   - displayName, country (ISO), bio, interests (chip list), links (label+url),
 *     avatarSeed (1..70 pravatar pick)
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/Modal";
import { BrutalInput, BrutalTextarea } from "@/components/common/BrutalInput";
import { Icon } from "@/components/common/Icon";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { patchMeProfile } from "@/lib/me-client";
import type { FounderLink, FounderRecord } from "@/lib/founder-types";

const BIO_MAX = 2000;
const DISPLAY_MAX = 80;
const INTEREST_MAX = 40;
const MAX_INTERESTS = 20;
const MAX_LINKS = 8;
const LINK_LABEL_MAX = 40;
const LINK_URL_MAX = 300;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  founder: FounderRecord;
};

export function EditProfileModal({ open, onOpenChange, founder }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(founder.displayName);
  const [country, setCountry] = useState(founder.country ?? "");
  const [bio, setBio] = useState(founder.bio ?? "");
  const [interestsRaw, setInterestsRaw] = useState(
    founder.interests.join(", "),
  );
  const [links, setLinks] = useState<FounderLink[]>(
    founder.links.length > 0 ? founder.links : [{ label: "", url: "" }],
  );
  const [avatarSeed, setAvatarSeed] = useState<number>(founder.avatarSeed ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddLink = () => {
    if (links.length >= MAX_LINKS) return;
    setLinks((cur) => [...cur, { label: "", url: "" }]);
  };

  const handleRemoveLink = (idx: number) => {
    setLinks((cur) => cur.filter((_, i) => i !== idx));
  };

  const handleLinkChange = (idx: number, key: keyof FounderLink, value: string) => {
    setLinks((cur) =>
      cur.map((l, i) => (i === idx ? { ...l, [key]: value } : l)),
    );
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedName = displayName.trim();
    if (trimmedName.length === 0) {
      setError("Display name required.");
      return;
    }

    const trimmedCountry = country.trim().toUpperCase();
    if (trimmedCountry && !/^[A-Z]{2}$/.test(trimmedCountry)) {
      setError("Country must be a 2-letter ISO code (e.g. DE, US).");
      return;
    }

    const interests = interestsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, MAX_INTERESTS);

    const cleanLinks: FounderLink[] = links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label.length > 0 && l.url.length > 0);

    // Quick client-side URL sanity — server zod re-validates.
    for (const l of cleanLinks) {
      try {
        new URL(l.url);
      } catch {
        setError(`Bad URL for "${l.label}".`);
        return;
      }
    }

    setSubmitting(true);
    const updated = await patchMeProfile({
      displayName: trimmedName,
      country: trimmedCountry ? trimmedCountry : null,
      bio: bio.trim() ? bio.trim() : null,
      interests,
      links: cleanLinks,
      avatarSeed,
    });
    setSubmitting(false);

    if (!updated) {
      setError("Save failed. Try again — if it persists, ping Lukas.");
      return;
    }

    // Re-fetch the in-memory auth user so sidebar etc. picks up the new
    // displayName/avatar immediately; refresh the route so the
    // server-resolved profile page re-renders with the new bio/links.
    await refreshUser();
    router.refresh();
    toast.confirm("Profile saved.");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      maxWidth="max-w-2xl"
      description="Update your display name, bio, country, interests, and links."
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {error ? (
          <div className="bg-primary/10 border-[3px] border-primary p-3">
            <p className="font-epilogue font-bold uppercase text-[11px] tracking-widest text-primary">
              {error}
            </p>
          </div>
        ) : null}

        <FormField label="Display name" required>
          <BrutalInput
            type="text"
            maxLength={DISPLAY_MAX}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </FormField>

        <FormField
          label="Country"
          help="Two-letter ISO code — DE, US, JP, BR. We render the flag from this."
        >
          <BrutalInput
            type="text"
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="DE"
            className="uppercase tracking-widest"
          />
        </FormField>

        <FormField
          label="Bio"
          help={`Public — shown on your profile + alongside your kommits. ${bio.length}/${BIO_MAX}`}
        >
          <BrutalTextarea
            rows={4}
            maxLength={BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you're building. Why now. The team."
          />
        </FormField>

        <FormField
          label="Interests"
          help="Comma-separated. e.g. Climate, Open science, Bio."
        >
          <BrutalInput
            type="text"
            maxLength={INTEREST_MAX * MAX_INTERESTS}
            value={interestsRaw}
            onChange={(e) => setInterestsRaw(e.target.value)}
            placeholder="Climate, DePIN, Hardware"
          />
        </FormField>

        <FormField
          label="Avatar"
          help="Pick a number 1–70. The same image renders across the app."
        >
          <BrutalInput
            type="number"
            min={1}
            max={70}
            value={avatarSeed}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isFinite(n)) setAvatarSeed(Math.max(1, Math.min(70, n)));
            }}
          />
        </FormField>

        <div>
          <label className="block font-epilogue font-black uppercase text-[11px] tracking-widest mb-2">
            Links
          </label>
          <div className="space-y-3">
            {links.map((l, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <BrutalInput
                  type="text"
                  maxLength={LINK_LABEL_MAX}
                  value={l.label}
                  onChange={(e) => handleLinkChange(idx, "label", e.target.value)}
                  placeholder="Label (Twitter, Website, …)"
                  className="md:w-44 shrink-0"
                />
                <BrutalInput
                  type="url"
                  inputMode="url"
                  maxLength={LINK_URL_MAX}
                  value={l.url}
                  onChange={(e) => handleLinkChange(idx, "url", e.target.value)}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLink(idx)}
                  aria-label="Remove link"
                  className="shrink-0 w-12 h-12 border-[3px] border-black bg-white shadow-brutal-sm hover:bg-primary hover:text-white hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex items-center justify-center"
                >
                  <Icon name="close" size="sm" />
                </button>
              </div>
            ))}
          </div>
          {links.length < MAX_LINKS ? (
            <button
              type="button"
              onClick={handleAddLink}
              className="mt-3 inline-flex items-center gap-2 bg-white text-black font-epilogue font-black uppercase text-xs tracking-widest px-3 py-2 border-[2px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
            >
              <Icon name="add" size="xs" />
              Add link
            </button>
          ) : null}
        </div>

        <div className="flex gap-3 pt-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="bg-white text-black font-epilogue font-black uppercase tracking-wide text-base px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform disabled:opacity-50 disabled:pointer-events-none"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-epilogue font-black uppercase text-[11px] tracking-widest mb-2">
        {label} {required ? <span className="text-gray-500">*</span> : null}
      </label>
      {children}
      {help ? (
        <p className="mt-2 text-xs font-medium text-gray-500 leading-relaxed">
          {help}
        </p>
      ) : null}
    </div>
  );
}
