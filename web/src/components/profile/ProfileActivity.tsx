import Link from "next/link";
import { PROJECTS } from "@/lib/data/projects";
import { kommitsFor, formatNumber, formatUSD } from "@/lib/kommit-math";
import type { User } from "@/lib/data/users";

/**
 * "Kommit activity" — public-facing aggregate. Reads from the seeded
 * cohort lists across `PROJECTS`. Matches rows by `userId` (preferred)
 * or case-insensitive name. Deliberately doesn't pull from
 * localStorage / on-chain — the profile page is the read-only public
 * surface; per-user live state lives on /dashboard.
 */
export function ProfileActivity({
  user,
  slug,
  isOwnProfile,
}: {
  user?: User;
  slug: string;
  isOwnProfile: boolean;
}) {
  const rows = collectKommits(user, slug);
  const projectsBacked = rows.length;
  const currentlyCommitted = rows.reduce((acc, r) => acc + r.kommittedUSD, 0);
  const lifetimeKommits = rows.reduce(
    (acc, r) => acc + kommitsFor(r.kommittedUSD, r.sinceISO),
    0,
  );

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
          Kommit activity
        </h2>
        <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
          Public · cohort record
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        <Stat label="Projects backed" value={formatNumber(projectsBacked)} />
        <Stat label="Currently committed" value={formatUSD(currentlyCommitted)} accent />
        <Stat label="Lifetime kommits" value={formatNumber(lifetimeKommits)} />
      </div>

      {projectsBacked > 0 ? (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => (
            <li
              key={r.projectSlug}
              className="bg-white border-[3px] border-black shadow-brutal p-4 flex items-center gap-4 flex-wrap"
            >
              <Link
                href={`/projects/${r.projectSlug}`}
                className="font-epilogue font-black uppercase text-sm tracking-tight bg-gray-100 px-2 py-1 border-[2px] border-black hover:bg-secondary transition-colors"
              >
                {r.projectName}
              </Link>
              <span className="text-gray-500 uppercase text-xs tracking-widest font-epilogue font-bold">
                Kommitted
              </span>
              <span className="font-epilogue font-black">{formatUSD(r.kommittedUSD)}</span>
              <span className="ml-auto bg-primary text-white px-2 py-1 border-[2px] border-black uppercase text-xs font-epilogue font-black tracking-tight">
                {formatNumber(kommitsFor(r.kommittedUSD, r.sinceISO))} kommits
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 bg-white border-[3px] border-black shadow-brutal p-6 text-center">
          <p className="font-epilogue font-black uppercase text-sm tracking-tight">
            No kommits yet on record.
          </p>
        </div>
      )}

      {isOwnProfile ? (
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
          >
            Open your dashboard
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border-[3px] border-black shadow-brutal p-5">
      <div className="font-epilogue font-bold uppercase text-[10px] text-gray-500 tracking-widest">
        {label}
      </div>
      <div
        className={`mt-2 font-epilogue font-black text-3xl md:text-4xl tracking-tighter ${accent ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

type Row = {
  projectSlug: string;
  projectName: string;
  kommittedUSD: number;
  sinceISO: string;
};

function collectKommits(user: User | undefined, slug: string): Row[] {
  const idMatch = user?.id ?? slug;
  const nameMatch = user?.displayName.toLowerCase();
  const out: Row[] = [];
  for (const p of PROJECTS) {
    const row = p.kommitters.find((k) => {
      if (k.userId && idMatch && k.userId === idMatch) return true;
      if (nameMatch && k.name.toLowerCase() === nameMatch) return true;
      return false;
    });
    if (row) {
      out.push({
        projectSlug: p.slug,
        projectName: p.name,
        kommittedUSD: row.kommittedUSD,
        sinceISO: row.sinceISO,
      });
    }
  }
  return out;
}
