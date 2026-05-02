'use client';

import { useEffect, useState, ReactNode } from 'react';

// ─── Sample data ──────────────────────────────────────────────────────────
const PROJECTS = [
  {
    slug: 'geyser',
    name: 'Geyser',
    pitch: 'A real-time data fabric for IoT sensor networks operating at the edge.',
    team: 'Caldera',
    sector: 'Infrastructure',
    stage: 'Seed',
    teamSize: 4,
    committed: 18420,
    supporters: 87,
    weeklyYield: 18.42,
    pivoted: null as null | { from: string; date: string },
  },
  {
    slug: 'beacon',
    name: 'Beacon',
    pitch: 'Open-source observability for serverless functions across providers.',
    team: 'Lighthouse Labs',
    sector: 'Developer tools',
    stage: 'Seed',
    teamSize: 5,
    committed: 24800,
    supporters: 132,
    weeklyYield: 24.8,
    pivoted: { from: 'Lantern, a structured-logging library', date: 'Mar 28' },
  },
  {
    slug: 'endgame',
    name: 'Endgame',
    pitch: 'Adaptive chess training with engine-graded openings tuned to your repertoire.',
    team: 'Quire Chess',
    sector: 'Consumer',
    stage: 'Pre-seed',
    teamSize: 3,
    committed: 6210,
    supporters: 41,
    weeklyYield: 6.21,
    pivoted: null,
  },
  {
    slug: 'north',
    name: 'North',
    pitch: 'Parametric climate insurance pricing for smallholder farms in emerging markets.',
    team: 'Aurora Ventures',
    sector: 'Climate',
    stage: 'Seed',
    teamSize: 6,
    committed: 31200,
    supporters: 154,
    weeklyYield: 31.2,
    pivoted: null,
  },
  {
    slug: 'atelier',
    name: 'Atelier',
    pitch: 'Collaborative video editing in the browser, with frame-accurate review.',
    team: 'Frame Studio',
    sector: 'Creator tools',
    stage: 'Pre-seed',
    teamSize: 4,
    committed: 9870,
    supporters: 62,
    weeklyYield: 9.87,
    pivoted: null,
  },
  {
    slug: 'argent',
    name: 'Argent',
    pitch: 'A unified ledger for cross-border B2B settlements over Solana.',
    team: 'Mint & Co',
    sector: 'Fintech',
    stage: 'Seed',
    teamSize: 3,
    committed: 14500,
    supporters: 71,
    weeklyYield: 14.5,
    pivoted: null,
  },
];

const COMMITMENTS = [
  { team: 'Caldera', project: 'Geyser', amount: 200, since: 'Mar 12', points: 3240, weekYield: 0.42 },
  { team: 'Frame Studio', project: 'Atelier', amount: 100, since: 'Jan 22', points: 9860, weekYield: 0.21 },
  { team: 'Aurora Ventures', project: 'North', amount: 50, since: 'Apr 04', points: 720, weekYield: 0.1 },
];

const ACTIVITY = [
  { when: '6h ago', text: 'committed $50' },
  { when: '1d ago', text: 'committed $200' },
  { when: '2d ago', text: 'committed $25' },
  { when: '3d ago', text: 'withdrew $100' },
  { when: '4d ago', text: 'committed $500' },
  { when: '6d ago', text: 'committed $50' },
];

const FOUNDERS_BEACON = [
  { name: 'Maya Khoury', role: 'CEO · previously eng lead, Datadog' },
  { name: 'Ren Ito', role: 'CTO · staff engineer, ex-Stripe' },
  { name: 'Priya Vasquez', role: 'Founding eng · previously infra, Vercel' },
];

const UPDATES_BEACON = [
  {
    date: 'Apr 24',
    title: 'Kafka adapter shipped, Datadog parity for 80% of dashboards',
    body: 'Closed the last gap on the migration path most teams hit. Three pilots are now fully cut over.',
    pivot: false,
  },
  {
    date: 'Apr 02',
    title: 'First three design partners signed',
    body: 'Cohort of three Series-B infra teams agreed to a 90-day pilot. Early feedback driving roadmap.',
    pivot: false,
  },
  {
    date: 'Mar 28',
    title: 'Why we pivoted from Lantern to Beacon',
    body: 'Lantern was a structured-logging library that wasn\'t finding pull. Three customer interviews surfaced the real pain — observability for serverless. We\'re doubling down there.',
    pivot: true,
  },
];

const FAQ = [
  {
    q: 'What happens to my USDC?',
    a: 'It sits in a Solana program escrow account that only you can withdraw from. Kommit deposits it into a vetted lending market (currently Kamino USDC) and routes only the yield to the team you back. Your principal never moves to the team.',
  },
  {
    q: 'Why is the yield so small per week?',
    a: 'Because USDC lending yields are real and recurring, not based on token speculation. A $100 commitment at ~5% APY produces about $0.10/week. Yield scales with the size and patience of a team\'s community, not hype.',
  },
  {
    q: 'What are points and what can I do with them?',
    a: 'Points are a soulbound on-chain score representing capital × time. They are not a tradable token. They are readable by other Solana protocols as a primitive for patient-capital reputation. Other apps decide what to do with that signal.',
  },
  {
    q: 'What if a team I back pivots?',
    a: 'You\'ll see it on the project page as a "pivoted from" line, and any pivot-flagged update appears in the activity feed. You can keep your commitment or withdraw your principal at any time. Retention through a pivot is the strongest signal a team can earn.',
  },
];

const SUPPORTERS = [
  { wallet: 'Hf3k...d4f9', amount: 200, since: 'Mar 12', points: 3240 },
  { wallet: 'Q9aB...c811', amount: 500, since: 'Mar 14', points: 7820 },
  { wallet: 'Lp2v...e004', amount: 50, since: 'Mar 28', points: 540 },
  { wallet: 'Mn7d...a1c3', amount: 1000, since: 'Apr 01', points: 13200 },
  { wallet: 'Tx5k...f902', amount: 25, since: 'Apr 09', points: 210 },
  { wallet: 'Vb6r...8aa2', amount: 100, since: 'Apr 17', points: 870 },
  { wallet: 'Yq1n...dd55', amount: 300, since: 'Apr 21', points: 1980 },
];

const RECEIPTS = [
  { date: 'Apr 28', amount: 5.32, tx: '7eK3pQm2nL...x9' },
  { date: 'Apr 21', amount: 4.91, tx: '4pM8tRk1hC...a2' },
  { date: 'Apr 14', amount: 4.74, tx: '9bN1cVq7oS...c0' },
  { date: 'Apr 07', amount: 4.12, tx: '2hL6rXw3jB...e7' },
  { date: 'Mar 31', amount: 3.88, tx: 'd5R2yZf8mP...11' },
  { date: 'Mar 24', amount: 3.41, tx: 'k7T0aHj4uN...3f' },
];

const ROTATING_WORDS = [
  'big idea',
  'great team',
  'breakthrough innovation',
  'generational company',
  'moonshot',
];

type ScreenKey = 'landing' | 'browse' | 'project' | 'dashboard' | 'founder' | 'commit' | 'withdraw';

const TABS: { key: ScreenKey; label: string }[] = [
  { key: 'landing', label: 'Landing' },
  { key: 'browse', label: 'Browse' },
  { key: 'project', label: 'Project' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'founder', label: 'Founder' },
  { key: 'commit', label: 'Commit' },
  { key: 'withdraw', label: 'Withdraw' },
];

const featuredProject = PROJECTS.find((p) => p.slug === 'beacon')!;

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-500">
      {children}
    </div>
  );
}

function SectionHeading({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="space-y-3">
      {label && <SectionLabel>{label}</SectionLabel>}
      <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-gray-900">{children}</h2>
    </div>
  );
}

function PhotoBox({
  size = 'md',
  shape = 'rect',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rect' | 'circle';
}) {
  const sizes = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
    xl: 'h-40 w-full',
  };
  return (
    <div
      className={`${sizes[size]} ${
        shape === 'circle' ? 'rounded-full' : 'rounded-sm'
      } bg-gray-100 border border-gray-200 shrink-0`}
    />
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1 font-serif text-2xl md:text-3xl text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}) {
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-3 text-sm',
    lg: 'px-6 py-4 text-base',
  };
  const variants = {
    primary: 'bg-gray-900 text-white hover:bg-gray-700 border border-gray-900',
    outline: 'bg-white text-gray-900 border border-gray-900 hover:bg-gray-50',
    ghost: 'bg-transparent text-gray-700 hover:text-gray-900 border border-transparent',
  };
  return (
    <button
      onClick={onClick}
      className={`${sizes[size]} ${variants[variant]} ${
        full ? 'w-full' : ''
      } font-medium tracking-tight transition rounded-sm`}
    >
      {children}
    </button>
  );
}

// ─── Top nav ──────────────────────────────────────────────────────────────
function TopNav({
  current,
  onChange,
}: {
  current: ScreenKey;
  onChange: (s: ScreenKey) => void;
}) {
  return (
    <nav className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="flex items-center h-16 gap-6">
          <button
            onClick={() => onChange('landing')}
            className="font-serif text-xl tracking-tight text-gray-900 shrink-0"
          >
            Kommit
          </button>
          <div className="flex-1 overflow-x-auto">
            <ul className="flex items-center gap-1 min-w-max">
              {TABS.slice(0, 5).map((t) => (
                <li key={t.key}>
                  <button
                    onClick={() => onChange(t.key)}
                    className={`px-3 py-2 text-sm transition border-b-2 ${
                      current === t.key
                        ? 'text-gray-900 font-medium border-gray-900'
                        : 'text-gray-500 hover:text-gray-900 border-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
              <li className="mx-3 text-gray-300 select-none">·</li>
              {TABS.slice(5).map((t) => (
                <li key={t.key}>
                  <button
                    onClick={() => onChange(t.key)}
                    className={`px-3 py-2 text-sm transition border-b-2 ${
                      current === t.key
                        ? 'text-gray-900 font-medium border-gray-900'
                        : 'text-gray-500 hover:text-gray-900 border-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden md:block font-mono text-[11px] uppercase tracking-[0.18em] text-gray-400 shrink-0">
            Wireframe
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Screen 1: Landing ────────────────────────────────────────────────────
function Landing({
  onBrowse,
  wordIndex,
  openFaq,
  setOpenFaq,
}: {
  onBrowse: () => void;
  wordIndex: number;
  openFaq: number | null;
  setOpenFaq: (i: number | null) => void;
}) {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
      {/* Hero */}
      <section className="pt-24 md:pt-32 pb-32">
        <SectionLabel>A Solana primitive</SectionLabel>
        <h1 className="mt-8 font-serif text-5xl md:text-7xl lg:text-[112px] leading-[1.02] tracking-[-0.02em] text-gray-900">
          <span className="block">Back the next</span>
          <span key={wordIndex} className="word-rotate italic text-gray-700">
            {ROTATING_WORDS[wordIndex]}
          </span>
        </h1>
        <p className="mt-10 max-w-2xl text-lg md:text-xl leading-relaxed text-gray-600">
          Park USDC. Yield streams to the team building it. Withdraw your principal anytime. Earn on-chain reputation.
        </p>
        <div className="mt-12">
          <Btn size="lg" onClick={onBrowse}>
            Browse projects
          </Btn>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-gray-200">
        <SectionLabel>How it works</SectionLabel>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {[
            {
              n: '01',
              title: 'Park USDC',
              body: 'Your principal stays in escrow that only you can withdraw from. No lockups, no fees, no surprises.',
            },
            {
              n: '02',
              title: 'Yield streams to a curated team',
              body: 'The yield routes to a team you choose. You\'re the support — patient capital, weekly drips.',
            },
            {
              n: '03',
              title: 'Earn on-chain reputation',
              body: 'A soulbound score that scales with capital × time. Readable by other Solana protocols.',
            },
          ].map((item) => (
            <div key={item.n} className="space-y-4">
              <div className="font-mono text-xs text-gray-400">{item.n}</div>
              <h3 className="font-serif text-2xl text-gray-900 leading-snug">{item.title}</h3>
              <p className="text-gray-600 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured teams */}
      <section className="py-24 border-t border-gray-200">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <SectionHeading label="Featured">Teams shipping right now</SectionHeading>
          <button
            onClick={onBrowse}
            className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-4"
          >
            See all projects
          </button>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {PROJECTS.slice(0, 3).map((p) => (
            <article key={p.slug} className="space-y-5">
              <PhotoBox size="xl" />
              <div className="space-y-3">
                <h3 className="font-serif text-2xl tracking-tight text-gray-900">{p.name}</h3>
                <p className="text-gray-600 leading-relaxed">{p.pitch}</p>
                <div className="flex items-center gap-2 pt-1">
                  <PhotoBox size="xs" shape="circle" />
                  <span className="text-sm text-gray-500">by {p.team}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 flex items-center gap-6 text-sm text-gray-500">
                  <span>${fmt(p.committed)} committed</span>
                  <span>{p.supporters} supporters</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* The problem */}
      <section className="py-24 border-t border-gray-200">
        <SectionLabel>The problem we&rsquo;re solving</SectionLabel>
        <blockquote className="mt-12 max-w-4xl">
          <p className="font-serif text-3xl md:text-5xl leading-[1.15] tracking-tight text-gray-900">
            &ldquo;21 of 21 startups I backed failed.&rdquo;
          </p>
          <footer className="mt-6 text-sm text-gray-500">— Wefunder investor</footer>
        </blockquote>
        <p className="mt-12 max-w-2xl text-gray-600 leading-relaxed text-lg">
          Equity crowdfunding turned retail backers into worse-informed angels. Patreon turned creators into
          performers. Both shapes lose principal or attention. Kommit asks for neither: keep your money,
          loan your yield, accumulate reputation for showing up early and staying.
        </p>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-gray-200">
        <SectionHeading label="FAQ">Common questions</SectionHeading>
        <div className="mt-12 max-w-3xl divide-y divide-gray-200 border-y border-gray-200">
          {FAQ.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left"
                >
                  <span className="font-serif text-xl text-gray-900">{item.q}</span>
                  <span className="font-mono text-gray-400 text-lg shrink-0">{open ? '–' : '+'}</span>
                </button>
                {open && <div className="pb-6 text-gray-600 leading-relaxed max-w-2xl">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-gray-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="font-serif text-xl text-gray-900">Kommit</div>
          <div className="flex items-center gap-8 text-sm text-gray-500">
            <a className="hover:text-gray-900" href="#">
              GitHub
            </a>
            <span>Built on Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Screen 2: Browse ─────────────────────────────────────────────────────
function Browse({ onOpenProject }: { onOpenProject: () => void }) {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 py-16">
      <header className="space-y-2">
        <SectionLabel>Browse</SectionLabel>
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight text-gray-900">
          Projects taking commitments
        </h1>
      </header>

      {/* Sort + filters */}
      <div className="mt-12 flex flex-wrap items-center gap-3 pb-6 border-b border-gray-200">
        <button className="text-sm text-gray-700 px-3 py-2 border border-gray-300 rounded-sm hover:border-gray-900">
          Sort: Most recent ▾
        </button>
        <div className="hidden md:block w-px h-6 bg-gray-200 mx-2" />
        {['Sector', 'Stage', 'Team size'].map((c) => (
          <button
            key={c}
            className="text-sm text-gray-600 px-3 py-2 border border-gray-200 rounded-full hover:border-gray-400 hover:text-gray-900"
          >
            {c} ▾
          </button>
        ))}
        <div className="ml-auto text-sm text-gray-500">{PROJECTS.length} projects</div>
      </div>

      {/* Grid */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14">
        {PROJECTS.map((p) => (
          <button key={p.slug} onClick={onOpenProject} className="text-left group">
            <PhotoBox size="xl" />
            <div className="mt-5 space-y-3">
              <h2 className="font-serif text-2xl md:text-[28px] tracking-tight text-gray-900 group-hover:underline underline-offset-4">
                {p.name}
              </h2>
              <p className="text-gray-600 leading-relaxed">{p.pitch}</p>
              <div className="flex items-center gap-2 pt-1">
                <PhotoBox size="xs" shape="circle" />
                <span className="text-sm text-gray-500">by {p.team}</span>
              </div>
            </div>
            <dl className="mt-5 pt-5 border-t border-gray-200 grid grid-cols-3 gap-3">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Committed</dt>
                <dd className="mt-1 text-sm text-gray-900">${fmt(p.committed)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Supporters</dt>
                <dd className="mt-1 text-sm text-gray-900">{p.supporters}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Yield/wk</dt>
                <dd className="mt-1 text-sm text-gray-900">${fmt(p.weeklyYield)}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Screen 3: Project detail ─────────────────────────────────────────────
function ProjectDetail({
  onCommit,
  onWithdraw,
}: {
  onCommit: () => void;
  onWithdraw: () => void;
}) {
  const p = featuredProject;
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 py-16">
      {/* Hero */}
      <header className="max-w-4xl">
        <SectionLabel>Project</SectionLabel>
        <h1 className="mt-6 font-serif text-5xl md:text-7xl tracking-[-0.02em] leading-[1.04] text-gray-900">
          {p.name}
        </h1>
        <p className="mt-6 font-serif text-xl md:text-2xl text-gray-700 leading-snug max-w-3xl">
          {p.pitch}
        </p>
        <div className="mt-8 flex items-center gap-3">
          <PhotoBox size="sm" shape="circle" />
          <span className="text-gray-500">
            by <span className="text-gray-900 font-medium">{p.team}</span>
          </span>
        </div>
        {p.pivoted && (
          <div className="mt-4 inline-flex items-center gap-3 text-sm text-gray-500 border-l-2 border-gray-300 pl-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-700">Pivot</span>
            <span>
              Pivoted from {p.pivoted.from} on {p.pivoted.date}
            </span>
          </div>
        )}
      </header>

      {/* Two-col body */}
      <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left */}
        <div className="lg:col-span-2 space-y-16">
          {/* Long pitch */}
          <section>
            <SectionLabel>The pitch</SectionLabel>
            <div className="mt-4 space-y-5 text-gray-700 leading-relaxed text-lg max-w-2xl">
              <p>
                Most teams running serverless code rely on bespoke logging, expensive APMs, or nothing at
                all. Beacon is an open-core observability layer that drops in across AWS Lambda, Cloudflare
                Workers, Vercel, and Deno Deploy with one SDK and a single dashboard.
              </p>
              <p>
                We started as Lantern, a structured-logging library. Three months of customer interviews
                surfaced the deeper pain — debugging cross-provider serverless apps. We&rsquo;re focused
                there now and the response has been different in kind, not degree.
              </p>
            </div>
          </section>

          {/* Founders */}
          <section>
            <SectionLabel>Founders</SectionLabel>
            <ul className="mt-6 space-y-5">
              {FOUNDERS_BEACON.map((f) => (
                <li key={f.name} className="flex items-center gap-4">
                  <PhotoBox size="lg" shape="circle" />
                  <div>
                    <div className="font-serif text-lg text-gray-900">{f.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{f.role}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Updates */}
          <section>
            <SectionLabel>Recent updates</SectionLabel>
            <ul className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
              {UPDATES_BEACON.map((u, i) => (
                <li key={i} className="py-6">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gray-400">{u.date}</span>
                    {u.pivot && (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-gray-700 border border-gray-300 px-2 py-0.5 rounded-sm">
                        Pivot
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 font-serif text-xl text-gray-900 leading-snug">{u.title}</h4>
                  <p className="mt-2 text-gray-600 leading-relaxed max-w-2xl">{u.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right — stats card */}
        <aside className="lg:col-span-1">
          <div className="border border-gray-300 rounded-sm p-6 md:p-8 lg:sticky lg:top-24 space-y-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <Stat label="Committed" value={`$${fmt(p.committed)}`} />
              <Stat label="Supporters" value={`${p.supporters}`} />
              <Stat label="Yield this week" value={`$${fmt(p.weeklyYield)}`} sub="routed to team" />
              <Stat label="Your commitment" value="$50" sub="since Apr 17" />
            </div>
            <div className="pt-6 border-t border-gray-200 grid grid-cols-2 gap-3">
              <Btn variant="primary" size="lg" full onClick={onCommit}>
                Commit
              </Btn>
              <Btn variant="outline" size="lg" full onClick={onWithdraw}>
                Withdraw
              </Btn>
            </div>
            <div className="text-xs text-gray-500 leading-relaxed">
              Withdraw anytime. No fees. Yield stops on withdrawal; points stay.
            </div>
          </div>
        </aside>
      </div>

      {/* Activity */}
      <section className="mt-24 pt-16 border-t border-gray-200">
        <SectionLabel>Recent supporter activity</SectionLabel>
        <ul className="mt-6 divide-y divide-gray-200 border-y border-gray-200">
          {ACTIVITY.map((a, i) => (
            <li key={i} className="py-4 flex items-center gap-6">
              <span className="font-mono text-xs text-gray-400 w-20 shrink-0">{a.when}</span>
              <span className="text-gray-700">{a.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── Screen 4: User dashboard ─────────────────────────────────────────────
function Dashboard({
  onWithdraw,
  onOpenProject,
}: {
  onWithdraw: () => void;
  onOpenProject: () => void;
}) {
  const activeTotal = COMMITMENTS.reduce((s, c) => s + c.amount, 0);
  const activePts = COMMITMENTS.reduce((s, c) => s + c.points, 0);

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 py-12">
      <header className="space-y-2">
        <SectionLabel>Your commitments</SectionLabel>
        <h1 className="font-sans text-2xl md:text-3xl text-gray-900 font-medium">Dashboard</h1>
      </header>

      {/* Summary */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 border border-gray-200 rounded-sm overflow-hidden">
        <div className="bg-white p-6 md:p-8">
          <SectionLabel>Active</SectionLabel>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <div className="font-serif text-4xl text-gray-900">${fmt(activeTotal)}</div>
            <div className="text-sm text-gray-500">across {COMMITMENTS.length} teams</div>
          </div>
          <div className="mt-2 text-sm text-gray-500">{fmt(activePts)} active points</div>
        </div>
        <div className="bg-white p-6 md:p-8">
          <SectionLabel>Lifetime</SectionLabel>
          <div className="mt-3 flex items-baseline gap-3 flex-wrap">
            <div className="font-serif text-4xl text-gray-900">$1,250</div>
            <div className="text-sm text-gray-500">across 7 teams</div>
          </div>
          <div className="mt-2 text-sm text-gray-500">47,891 lifetime points</div>
        </div>
      </section>

      {/* Commitments list */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <SectionLabel>Active commitments</SectionLabel>
          <span className="text-xs text-gray-400 font-mono">{COMMITMENTS.length} teams</span>
        </div>
        <ul className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
          {COMMITMENTS.map((c, i) => (
            <li key={i} className="py-5 flex items-center gap-5 flex-wrap md:flex-nowrap">
              <PhotoBox size="md" shape="circle" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-medium text-gray-900">{c.team}</span>
                  <span className="text-sm text-gray-500">— {c.project}</span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Committed ${fmt(c.amount)} · since {c.since} · {fmt(c.points)} pts
                </div>
              </div>
              <div className="text-right hidden md:block">
                <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                  This week
                </div>
                <div className="text-sm text-gray-900 mt-1">${fmt(c.weekYield)} routed</div>
              </div>
              <Btn variant="outline" size="sm" onClick={onWithdraw}>
                Withdraw
              </Btn>
            </li>
          ))}
        </ul>
      </section>

      {/* Discover */}
      <section className="mt-16">
        <div className="flex items-end justify-between">
          <SectionHeading label="Discover">Teams you might support next</SectionHeading>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {PROJECTS.slice(3, 6).map((p) => (
            <button key={p.slug} onClick={onOpenProject} className="text-left group">
              <PhotoBox size="xl" />
              <h3 className="mt-4 font-serif text-xl text-gray-900 group-hover:underline underline-offset-4">
                {p.name}
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.pitch}</p>
              <div className="mt-3 flex items-center gap-2">
                <PhotoBox size="xs" shape="circle" />
                <span className="text-xs text-gray-500">by {p.team}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Screen 5: Founder dashboard ──────────────────────────────────────────
function Founder() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 py-12">
      <header className="space-y-2">
        <SectionLabel>Founder dashboard</SectionLabel>
        <h1 className="font-sans text-2xl md:text-3xl text-gray-900 font-medium">
          Caldera <span className="text-gray-400 font-normal">— Geyser</span>
        </h1>
      </header>

      {/* Top stats */}
      <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-sm overflow-hidden">
        {[
          { label: 'Received this month', value: '$42.18' },
          { label: 'Total received', value: '$187.34' },
          { label: 'Supporters', value: '87' },
          { label: 'Committed', value: '$18,420' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 md:p-6">
            <SectionLabel>{s.label}</SectionLabel>
            <div className="mt-2 font-serif text-2xl md:text-3xl text-gray-900">{s.value}</div>
          </div>
        ))}
      </section>

      {/* Post update */}
      <section className="mt-12">
        <SectionLabel>Post an update</SectionLabel>
        <div className="mt-4 border border-gray-300 rounded-sm">
          <textarea
            className="w-full p-4 text-sm text-gray-700 bg-transparent outline-none resize-none placeholder:text-gray-400"
            rows={5}
            placeholder="What did you ship this week? What did you learn?"
          />
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" className="accent-gray-700" />
              Tag as pivot
            </label>
            <Btn size="sm">Post update</Btn>
          </div>
        </div>
      </section>

      {/* Supporters */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <SectionLabel>Supporters</SectionLabel>
          <span className="text-xs text-gray-400 font-mono">{SUPPORTERS.length} of 87</span>
        </div>
        <div className="mt-4 border border-gray-200 rounded-sm overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-gray-200 bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
            <div className="col-span-5 cursor-pointer hover:text-gray-900">Wallet ↕</div>
            <div className="col-span-2 cursor-pointer hover:text-gray-900">Committed ↕</div>
            <div className="col-span-3 cursor-pointer hover:text-gray-900">Since ↕</div>
            <div className="col-span-2 text-right cursor-pointer hover:text-gray-900">Points ↕</div>
          </div>
          <ul className="divide-y divide-gray-200">
            {SUPPORTERS.map((s, i) => (
              <li key={i} className="grid grid-cols-12 px-4 py-3 text-sm">
                <div className="col-span-5 font-mono text-gray-700 truncate">{s.wallet}</div>
                <div className="col-span-2 text-gray-900">${fmt(s.amount)}</div>
                <div className="col-span-3 text-gray-500">{s.since}</div>
                <div className="col-span-2 text-right text-gray-900">{fmt(s.points)}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Yield receipts */}
      <section className="mt-12 mb-16">
        <SectionLabel>Yield receipts</SectionLabel>
        <div className="mt-4 border border-gray-200 rounded-sm overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 border-b border-gray-200 bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
            <div className="col-span-3">Date</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-6">Tx</div>
          </div>
          <ul className="divide-y divide-gray-200">
            {RECEIPTS.map((r, i) => (
              <li key={i} className="grid grid-cols-12 px-4 py-3 text-sm">
                <div className="col-span-3 text-gray-500">{r.date}</div>
                <div className="col-span-3 text-gray-900">${fmt(r.amount)}</div>
                <div className="col-span-6 font-mono text-gray-500 truncate">{r.tx}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 md:p-8">
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-white border border-gray-300 rounded-sm shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-gray-200">
        <div>
          <SectionLabel>Action</SectionLabel>
          <h2 className="mt-1 font-serif text-2xl text-gray-900">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-900 text-xl leading-none w-8 h-8 flex items-center justify-center"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="px-6 md:px-8 py-7 space-y-6">{children}</div>
    </Modal>
  );
}

// ─── Screen 6: Commit modal ───────────────────────────────────────────────
function CommitModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('50');
  const weekly = (Number(amount) * 0.052) / 52;
  return (
    <ModalShell title={`Commit to ${featuredProject.team}`} onClose={onClose}>
      <div>
        <SectionLabel>Amount</SectionLabel>
        <div className="mt-2 flex items-stretch border border-gray-300 rounded-sm">
          <span className="px-4 flex items-center text-gray-500 font-serif text-2xl">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-2 py-4 font-serif text-2xl text-gray-900 bg-transparent outline-none min-w-0"
          />
          <span className="px-4 flex items-center text-xs text-gray-400 font-mono uppercase tracking-widest">
            USDC
          </span>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Yield routed to team:{' '}
          <span className="text-gray-900">~${weekly.toFixed(2)}/week</span> at current Kamino USDC APY 5.2%.
        </p>
      </div>

      <div className="border-l-2 border-gray-300 pl-4 py-1 text-sm text-gray-600 leading-relaxed">
        You can withdraw your principal anytime. No fees. Yield stops on withdrawal; points stay.
      </div>

      <div className="space-y-3">
        <Btn full size="lg">
          Commit
        </Btn>
        <p className="text-center text-xs text-gray-500">Signs in your wallet.</p>
      </div>
    </ModalShell>
  );
}

// ─── Screen 7: Withdraw modal ─────────────────────────────────────────────
function WithdrawModal({ onClose }: { onClose: () => void }) {
  const committed = 100;
  const [amount, setAmount] = useState('');
  return (
    <ModalShell title={`Withdraw from ${COMMITMENTS[0].team}`} onClose={onClose}>
      <div>
        <SectionLabel>Currently committed</SectionLabel>
        <div className="mt-2 font-serif text-3xl text-gray-900">${fmt(committed)}</div>
      </div>

      <div>
        <SectionLabel>Withdraw amount</SectionLabel>
        <div className="mt-2 flex items-stretch border border-gray-300 rounded-sm">
          <span className="px-4 flex items-center text-gray-500 font-serif text-2xl">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 px-2 py-4 font-serif text-2xl text-gray-900 bg-transparent outline-none placeholder:text-gray-300 min-w-0"
          />
          <button
            onClick={() => setAmount(String(committed))}
            className="px-4 text-xs text-gray-700 font-mono uppercase tracking-widest border-l border-gray-200 hover:bg-gray-50"
          >
            Full
          </button>
        </div>
      </div>

      <div className="border-l-2 border-gray-300 pl-4 py-1 text-sm text-gray-600 leading-relaxed">
        Your lifetime score is preserved (47,891 pts). Active points scale with remaining commitment.
      </div>

      <div className="space-y-3">
        <Btn full size="lg" variant="outline">
          Withdraw
        </Btn>
        <p className="text-center text-xs text-gray-500">Signs in your wallet.</p>
      </div>
    </ModalShell>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────
export default function Kommit() {
  const [screen, setScreen] = useState<ScreenKey>('landing');
  const [wordIndex, setWordIndex] = useState(0);
  const [showCommit, setShowCommit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const handleTab = (s: ScreenKey) => {
    if (s === 'commit') {
      setScreen('project');
      setShowCommit(true);
      setShowWithdraw(false);
    } else if (s === 'withdraw') {
      setScreen('dashboard');
      setShowWithdraw(true);
      setShowCommit(false);
    } else {
      setScreen(s);
      setShowCommit(false);
      setShowWithdraw(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex-1">
      <TopNav current={screen} onChange={handleTab} />
      <main>
        {screen === 'landing' && (
          <Landing
            onBrowse={() => handleTab('browse')}
            wordIndex={wordIndex}
            openFaq={openFaq}
            setOpenFaq={setOpenFaq}
          />
        )}
        {screen === 'browse' && <Browse onOpenProject={() => handleTab('project')} />}
        {screen === 'project' && (
          <ProjectDetail onCommit={() => setShowCommit(true)} onWithdraw={() => setShowWithdraw(true)} />
        )}
        {screen === 'dashboard' && (
          <Dashboard onWithdraw={() => setShowWithdraw(true)} onOpenProject={() => handleTab('project')} />
        )}
        {screen === 'founder' && <Founder />}
      </main>

      {showCommit && <CommitModal onClose={() => setShowCommit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
    </div>
  );
}
