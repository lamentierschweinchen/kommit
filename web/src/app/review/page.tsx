import Link from "next/link";

/**
 * Single-scroll review gallery.
 *
 * Shows every audit-pass-2 fix as a section with a live <iframe> preview,
 * so the team can scroll through and walk all the changes without clicking
 * through 20 routes manually. Iframes deep-link with `?as=lukas` /
 * `?as=julian` / `?as=anon` so the auth state matches the change being
 * reviewed. Mock-auth mode (NEXT_PUBLIC_MOCK_AUTH=1) is required for the
 * authed iframes to render the right state — the page reminds you up top.
 *
 * Not a user-facing surface. Don't link from nav. Internal review tool.
 */
export const metadata = {
  title: "Review — Kommit",
  robots: { index: false, follow: false },
};

type Section = {
  id: string;
  round: 1 | 2 | 3 | 4;
  title: string;
  detail: string;
  audit?: string;
  preview?: { src: string; height: number; note?: string };
  link?: { href: string; label: string };
};

const SECTIONS: Section[] = [
  {
    id: "auth-gate-anon",
    round: 1,
    title: "Auth gate · anonymous",
    detail:
      "Anonymous visitor lands on /dashboard. Authed shell is replaced with an inline brutalist sign-in prompt. URL preserved so deep-links survive sign-in.",
    audit: "P0 #1",
    preview: { src: "/dashboard?as=anon", height: 720 },
  },
  {
    id: "auth-gate-non-owner",
    round: 1,
    title: "Auth gate · non-owner founder route",
    detail:
      "Lukas (kommitter) tries to view Julian's CALDERA founder dashboard. Renders the founder-only gate with links back to public page / your dashboard.",
    audit: "P0 #1",
    preview: { src: "/founder/caldera?as=lukas", height: 720 },
  },
  {
    id: "modal-wrapper",
    round: 1,
    title: "Modal wrapper hardened",
    detail:
      "Explicit opacity:1 on the Dialog overlay + content. Locked bg-black/50 scrim. Closes the 'no scrim on first paint' and 'low-opacity content' bugs the auditor caught.",
    audit: "P0 #2",
    link: { href: "/projects/caldera", label: "Open detail → click Kommit" },
  },
  {
    id: "icon-foit",
    round: 1,
    title: "Icon FOIT eliminated",
    detail:
      "Material Symbols ligatures replaced with lucide-react SVGs. No font load, no flash of unstyled icon text. Verified at globals.css.",
    audit: "P0 #3",
  },
  {
    id: "sidebar-active",
    round: 1,
    title: "Sidebar single active state",
    detail:
      "Withdraw / Your kommits items now anchor-link inside /dashboard so only Overview lights up at /dashboard. The phantom 'multiple purple shadows' is gone.",
    audit: "P1 #10",
    preview: { src: "/dashboard?as=lukas", height: 720 },
  },
  {
    id: "url-state",
    round: 1,
    title: "/projects · URL filter state",
    detail:
      "Sector / stage / search / sort persist in the URL. Back from a project detail returns to the filtered view. Refresh + share work.",
    audit: "P1 #14",
    preview: {
      src: "/projects?sector=Climate&sort=kommitted",
      height: 800,
      note: "URL: ?sector=Climate&sort=kommitted",
    },
  },
  {
    id: "disabled-buttons",
    round: 1,
    title: "Disabled button visual demoted",
    detail:
      "Disabled state now drops the offset shadow, softens border to grey, lower fill opacity. Stops disabled buttons reading as pressable. Visible on the project page Withdraw button when no position.",
    audit: "P1 #11",
    preview: { src: "/projects/caldera?as=anon", height: 720, note: "Withdraw is disabled (no position)" },
  },
  {
    id: "sort-label",
    round: 2,
    title: "SORT BY label on browse",
    detail:
      "'Sort by Most recent ▾' instead of just 'Most recent ▾'. Drops the 'is this a filter or a sort?' ambiguity.",
    audit: "P1 #15",
    preview: { src: "/projects", height: 600, note: "Toolbar — right side" },
  },
  {
    id: "account-subhead",
    round: 2,
    title: "Account subhead rewritten",
    detail:
      "Was: 'v1 minimal — email, wallet, sign-in methods, advanced. No notification preferences in v1; the dashboard is the inbox.' (developer-roadmap voice). Now: 'Manage how you sign in and where we reach you. Notifications live on your dashboard.'",
    audit: "P1 #16",
    preview: { src: "/account?as=lukas", height: 700 },
  },
  {
    id: "faq-accordion",
    round: 2,
    title: "FAQ accordion · inline expand",
    detail:
      "Dropped the heavy border-t between question and answer. Open state lights the question header. + → × rotation already wired. Click first question to verify.",
    audit: "P1 #6",
    preview: { src: "/#faq", height: 700, note: "Scroll to FAQ section" },
  },
  {
    id: "card-click-target",
    round: 2,
    title: "Project card · full click target",
    detail:
      "pointer-events:none on the darken overlay + image + title. draggable=false on img. Whole card area is now a single click target — image area no longer dead.",
    audit: "P1 #8",
    preview: { src: "/projects", height: 700, note: "Click anywhere on a card" },
  },
  {
    id: "image-contrast",
    round: 2,
    title: "Featured image · contrast raised",
    detail:
      "Image opacity 50→80, darken layer 35→25, dropped mix-blend-difference (was rendering pale grey on mid-tones). White title with drop shadow reads at full contrast.",
    audit: "P1 #9",
    preview: { src: "/projects", height: 700 },
  },
  {
    id: "breadcrumb",
    round: 2,
    title: "Project detail · breadcrumb cleaned",
    detail:
      "Was three patterns shoved together (back-link · separator · category-tag). Now: breadcrumb row carries only the back-link. Sector + state chips moved below H1 as project metadata.",
    audit: "P1 #17",
    preview: { src: "/projects/caldera", height: 720 },
  },
  {
    id: "sign-in-context",
    round: 2,
    title: "Sign-in modal · contextual title",
    detail:
      "Defaults to 'Sign in'. From PositionCard: 'Sign in to back CALDERA'. From header / drawer: route-agnostic.",
    audit: "P2",
    link: { href: "/projects/caldera?as=anon", label: "Open detail → click Kommit" },
  },
  {
    id: "header-search-dropped",
    round: 3,
    title: "Header search dropped globally",
    detail:
      "Search now lives only in the /projects toolbar, where there's actual scope. Header is auth-state + nav only on every other route.",
    audit: "P1 #5",
    preview: { src: "/account?as=lukas", height: 360, note: "Header — no search input" },
  },
  {
    id: "404-tape",
    round: 3,
    title: "404 · tape clipping fixed",
    detail:
      "Tape decorations re-anchored from the outer section to the inner brutal card. No more 'tape bleeding off the top edge of the viewport'.",
    audit: "P2",
    preview: { src: "/asdfasdf", height: 700 },
  },
  {
    id: "withdraw-dedup",
    round: 3,
    title: "'Withdraw anytime · No fees' dedup",
    detail:
      "Removed the duplicate from the position card. Lives only inside the commit modal's green reassurance band — at the moment that matters.",
    audit: "P2",
    preview: { src: "/projects/caldera?as=lukas", height: 800, note: "Sticky position card on the right" },
  },
  {
    id: "footer-status",
    round: 3,
    title: "Footer Status link working",
    detail:
      "Was greyed (text-zinc-500) and looked dead. Now black, points at a real /status page that renders devnet status.",
    audit: "P2",
    preview: { src: "/status", height: 600 },
  },
  {
    id: "build-form",
    round: 3,
    title: "Build form · scroll to first error",
    detail:
      "Hitting Apply with empty fields used to bounce to page top. Now focuses (and scrolls to) the first errored field. Try clicking Apply on an empty form.",
    audit: "P2",
    preview: { src: "/build", height: 720 },
  },
  {
    id: "faq-width",
    round: 4,
    title: "FAQ width matches section grid",
    detail:
      "Dropped max-w-4xl on the FAQ wrapper so question cards span the section grid like HOW IT WORKS. Reading-column constraint moved inside FAQItem (max-w-3xl on the answer prose).",
    audit: "P1 #7",
    preview: { src: "/#faq", height: 800, note: "Scroll to FAQ section" },
  },
  {
    id: "sector-colors",
    round: 4,
    title: "Sector chips · neutral",
    detail:
      "Was random per project (Climate purple, Fintech white, Health green…). Now every sector chip uses bg-white text-black border-black. Brutal frame is the visual treatment, sector text is the differentiator. Single source of truth at lib/data/sectors.ts.",
    audit: "P2",
    preview: { src: "/projects", height: 700 },
  },
  {
    id: "hero-illustration",
    round: 4,
    title: "Hero · live platform panel",
    detail:
      "Replaced the abstract shape collage with a stylized 'live' panel — three real platform stats (Kommitted, Kommitters, Kommits) computed live from PROJECTS, with a Live pill and an active-projects counter.",
    audit: "P2",
    preview: { src: "/", height: 800 },
  },
  {
    id: "favicon",
    round: 4,
    title: "Favicon + apple-touch-icon",
    detail:
      "src/app/icon.png and src/app/apple-icon.png (Next 15 conventions). Browser tabs + iOS home screen now show the kommit asterisk.",
    link: { href: "/icon.png", label: "View /icon.png" },
  },
  {
    id: "og-image",
    round: 4,
    title: "OG image · dynamic",
    detail:
      "src/app/opengraph-image.tsx — 1200×630 PNG generated at edge. Brand-coded composition: lowercase wordmark + asterisk, big TURN [CONVICTION] INTO CURRENCY headline (CONVICTION in a black box with purple offset shadow), purple-bordered italic subhead, green tape decoration.",
    link: { href: "/opengraph-image", label: "View OG image" },
  },
  {
    id: "metadata-base",
    round: 4,
    title: "metadataBase fixed",
    detail:
      "Was hardcoded to https://kommit.vercel.app (wrong host). Now reads NEXT_PUBLIC_SITE_URL → VERCEL_URL → kommit.now fallback. Same resolution used by robots/sitemap.",
  },
  {
    id: "robots",
    round: 4,
    title: "robots.txt",
    detail:
      "Allows public surfaces, disallows /dashboard /account /founder/* (auth gates aren't useful in search results). Sitemap pointer + host.",
    link: { href: "/robots.txt", label: "View /robots.txt" },
  },
  {
    id: "sitemap",
    round: 4,
    title: "sitemap.xml",
    detail:
      "Static surfaces + per-project routes (graduated projects get slightly lower priority).",
    link: { href: "/sitemap.xml", label: "View /sitemap.xml" },
  },
  {
    id: "theme-color",
    round: 4,
    title: "Theme color + colorScheme",
    detail:
      "<meta name='theme-color' content='#ffffff'>. colorScheme='light' so the browser doesn't try to render the page in a dark-mode tint.",
  },
];

function Round({ n }: { n: 1 | 2 | 3 | 4 }) {
  const labels = {
    1: "Round 1 · structural P0s",
    2: "Round 2 · P1 cluster",
    3: "Round 3 · visible polish",
    4: "Round 4 · audit cleanup + design infra",
  };
  return (
    <span className="inline-block bg-black text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black">
      {labels[n]}
    </span>
  );
}

export default function ReviewPage() {
  const grouped = (n: 1 | 2 | 3 | 4) => SECTIONS.filter((s) => s.round === n);
  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <header className="sticky top-0 z-50 bg-white border-b-[3px] border-black shadow-brutal px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter">
              Audit pass 2 · review gallery
            </h1>
            <p className="mt-1 font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              {SECTIONS.length} changes · scroll through to verify
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/"
              className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[3px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
            >
              ← Site
            </Link>
            <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              Mock auth: <code className="font-mono text-black">NEXT_PUBLIC_MOCK_AUTH=1</code>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-12 py-10 space-y-12">
        {[1, 2, 3, 4].map((round) => {
          const items = grouped(round as 1 | 2 | 3 | 4);
          return (
            <section key={round} className="space-y-6">
              <Round n={round as 1 | 2 | 3 | 4} />
              <div className="space-y-8">
                {items.map((s) => (
                  <Card key={s.id} section={s} />
                ))}
              </div>
            </section>
          );
        })}

        <footer className="pt-12 pb-6 border-t-[3px] border-black">
          <p className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500 text-center">
            End of review. Reach the bottom = you&rsquo;ve seen it all.
          </p>
        </footer>
      </main>
    </div>
  );
}

function Card({ section }: { section: Section }) {
  return (
    <article
      id={section.id}
      className="bg-white border-[3px] border-black shadow-brutal p-6 md:p-8 space-y-5 scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {section.audit ? (
              <span className="inline-block bg-primary text-white font-epilogue font-black uppercase text-[10px] tracking-widest px-2 py-1 border-[2px] border-black">
                {section.audit}
              </span>
            ) : null}
            <code className="font-mono text-[11px] text-gray-500">#{section.id}</code>
          </div>
          <h2 className="font-epilogue font-black uppercase text-xl md:text-2xl tracking-tight leading-tight">
            {section.title}
          </h2>
          <p className="mt-3 text-sm md:text-base font-medium text-gray-800 leading-relaxed max-w-3xl">
            {section.detail}
          </p>
        </div>
        {section.link ? (
          <a
            href={section.link.href}
            target="_blank"
            rel="noreferrer"
            className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-xs px-3 py-2 border-[3px] border-black shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform shrink-0"
          >
            {section.link.label} ↗
          </a>
        ) : null}
      </div>

      {section.preview ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
              Preview
            </span>
            <code className="font-mono text-[11px] text-black bg-gray-100 px-1.5 py-0.5 border-[2px] border-black">
              {section.preview.src}
            </code>
            <a
              href={section.preview.src}
              target="_blank"
              rel="noreferrer"
              className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-primary hover:underline"
            >
              Open in new tab ↗
            </a>
            {section.preview.note ? (
              <span className="font-epilogue font-bold uppercase text-[10px] tracking-widest text-gray-500">
                — {section.preview.note}
              </span>
            ) : null}
          </div>
          <div className="border-[3px] border-black shadow-brutal-sm overflow-hidden bg-white">
            <iframe
              src={section.preview.src}
              title={section.title}
              className="w-full block"
              style={{ height: section.preview.height }}
              loading="lazy"
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}
