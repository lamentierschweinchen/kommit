'use client';

import { useEffect, useState, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Patient Capital Almanac — Direction 9
// Kommit as a certificate, not a dashboard. Time is the visible material.
// ─────────────────────────────────────────────────────────────────────────

// ─── Sample data ──────────────────────────────────────────────────────────
const PROJECTS = [
  {
    vol: '04',
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
    days: 51,
    since: 'Mar 12',
    pivoted: null as null | { from: string; date: string },
  },
  {
    vol: '07',
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
    days: 35,
    since: 'Mar 28',
    pivoted: { from: 'Lantern, a structured-logging library', date: 'Mar 28' },
  },
  {
    vol: '02',
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
    days: 30,
    since: 'Apr 02',
    pivoted: null,
  },
  {
    vol: '11',
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
    days: 88,
    since: 'Feb 04',
    pivoted: null,
  },
  {
    vol: '09',
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
    days: 100,
    since: 'Jan 22',
    pivoted: null,
  },
  {
    vol: '14',
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
    days: 22,
    since: 'Apr 10',
    pivoted: null,
  },
];

const COMMITMENTS = [
  { vol: '04', team: 'Caldera', project: 'Geyser', amount: 200, since: 'Mar 12', days: 51, points: 3240, weekYield: 0.42 },
  { vol: '09', team: 'Frame Studio', project: 'Atelier', amount: 100, since: 'Jan 22', days: 100, points: 9860, weekYield: 0.21 },
  { vol: '11', team: 'Aurora Ventures', project: 'North', amount: 50, since: 'Apr 04', days: 28, points: 720, weekYield: 0.1 },
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
    body: 'Cohort of three Series-B infra teams agreed to a 90-day pilot. Early feedback is driving the roadmap.',
    pivot: false,
  },
  {
    date: 'Mar 28',
    title: 'Why we pivoted from Lantern to Beacon',
    body: 'Lantern was a structured-logging library that wasn\'t finding pull. Three customer interviews surfaced the deeper pain — observability for serverless. We\'re doubling down there.',
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
  { wallet: 'Hf3k…d4f9', amount: 200, since: 'Mar 12', points: 3240 },
  { wallet: 'Q9aB…c811', amount: 500, since: 'Mar 14', points: 7820 },
  { wallet: 'Lp2v…e004', amount: 50, since: 'Mar 28', points: 540 },
  { wallet: 'Mn7d…a1c3', amount: 1000, since: 'Apr 01', points: 13200 },
  { wallet: 'Tx5k…f902', amount: 25, since: 'Apr 09', points: 210 },
  { wallet: 'Vb6r…8aa2', amount: 100, since: 'Apr 17', points: 870 },
  { wallet: 'Yq1n…dd55', amount: 300, since: 'Apr 21', points: 1980 },
];

const RECEIPTS = [
  { date: 'Apr 28', amount: 5.32, tx: '7eK3pQm2nL…x9' },
  { date: 'Apr 21', amount: 4.91, tx: '4pM8tRk1hC…a2' },
  { date: 'Apr 14', amount: 4.74, tx: '9bN1cVq7oS…c0' },
  { date: 'Apr 07', amount: 4.12, tx: '2hL6rXw3jB…e7' },
  { date: 'Mar 31', amount: 3.88, tx: 'd5R2yZf8mP…11' },
  { date: 'Mar 24', amount: 3.41, tx: 'k7T0aHj4uN…3f' },
];

const ROTATING_WORDS = ['big idea', 'great team', 'breakthrough', 'generational company', 'moonshot'];

type ScreenKey = 'landing' | 'browse' | 'project' | 'dashboard' | 'founder' | 'commit' | 'withdraw';

const TABS: { key: ScreenKey; label: string; numeral: string }[] = [
  { key: 'landing', label: 'Landing', numeral: 'I' },
  { key: 'browse', label: 'Browse', numeral: 'II' },
  { key: 'project', label: 'Project', numeral: 'III' },
  { key: 'dashboard', label: 'Dashboard', numeral: 'IV' },
  { key: 'founder', label: 'Founder', numeral: 'V' },
  { key: 'commit', label: 'Commit', numeral: 'VI' },
  { key: 'withdraw', label: 'Withdraw', numeral: 'VII' },
];

const featuredProject = PROJECTS.find((p) => p.slug === 'beacon')!;

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });

// Double-rule motif (thick over thin, the certificate signature)
function Rule({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="border-t-2 border-ink" />
      <div className="border-t border-ink mt-[3px]" />
    </div>
  );
}

function Ornament({ className = '' }: { className?: string }) {
  return <span className={`font-display text-oxblood ${className}`}>✶</span>;
}

function CapsLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-caps font-bold uppercase tracking-[0.18em] text-oxblood ${className}`}>
      {children}
    </div>
  );
}

function MonoLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono uppercase tracking-[0.14em] text-ink-faint ${className}`}>
      {children}
    </span>
  );
}

function LedgerStrip({ rows, className = '' }: { rows: [string, string][]; className?: string }) {
  return (
    <div className={`font-mono text-[11px] tracking-[0.02em] ${className}`}>
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex justify-between gap-4 py-1.5 ${
            i < rows.length - 1 ? 'border-b border-ink/15' : ''
          }`}
        >
          <span className="text-ink-faint uppercase tracking-[0.06em]">{r[0]}</span>
          <span className="font-medium text-ink">{r[1]}</span>
        </div>
      ))}
    </div>
  );
}

// Certificate header strip — ink bg, paper text, mono caps
function CertHead({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <div className="bg-ink text-paper px-4 py-2 flex flex-wrap items-center justify-between gap-2 font-caps font-bold uppercase tracking-[0.18em] text-[10px]">
      <span>{left}</span>
      {center && <span className="hidden md:inline">{center}</span>}
      <span>{right}</span>
    </div>
  );
}

// Time bar — sage line with date markers, the recurring tenure motif
function TimeBar({ start, days }: { start: string; days: number }) {
  return (
    <div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint mb-1.5">
        <span>{start}, 2026</span>
        <span className="text-sage">— {days} days —</span>
        <span>Today</span>
      </div>
      <div className="h-1 bg-sage-soft relative">
        <div className="absolute inset-y-0 left-0 w-full bg-sage" />
      </div>
    </div>
  );
}

// Two doors, one weight — buttons with equal visual weight
function DoorBtn({
  children,
  onClick,
  variant = 'ink',
  size = 'md',
  full = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'ink' | 'paper';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}) {
  const sizes = {
    sm: 'px-4 py-2.5 text-[10px]',
    md: 'px-6 py-3.5 text-[11px]',
    lg: 'px-7 py-4 text-[12px]',
  };
  const variants = {
    ink: 'bg-ink text-paper border border-ink hover:bg-ink-dim',
    paper: 'bg-paper text-ink border border-ink hover:bg-paper-edge',
  };
  return (
    <button
      onClick={onClick}
      className={`${sizes[size]} ${variants[variant]} ${
        full ? 'w-full' : ''
      } font-caps font-bold uppercase tracking-[0.18em] transition-colors cursor-pointer`}
    >
      {children}
    </button>
  );
}

// Wordmark
function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-5xl' };
  return (
    <span className={`font-display tracking-[-0.025em] text-ink leading-none ${sizes[size]}`}>
      Kommit<span className="text-oxblood">.</span>
    </span>
  );
}

// ─── Running head ─────────────────────────────────────────────────────────
function RunningHead() {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span>The Kommit Almanac · Vol. I · № 04</span>
      <span className="hidden md:inline">Solana mainnet · Saturday, May 02, 2026</span>
      <span>Yield 5.21% · Block 294,182,557</span>
    </div>
  );
}

// ─── Top nav ──────────────────────────────────────────────────────────────
function TopNav({ current, onChange }: { current: ScreenKey; onChange: (s: ScreenKey) => void }) {
  return (
    <nav className="sticky top-0 z-30 bg-paper border-b border-ink">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">
        <div className="flex items-center h-14 gap-6">
          <button onClick={() => onChange('landing')} className="cursor-pointer shrink-0">
            <Wordmark size="md" />
          </button>
          <div className="flex-1 overflow-x-auto">
            <ul className="flex items-center gap-1 min-w-max font-caps font-bold uppercase tracking-[0.18em] text-[10px]">
              {TABS.slice(0, 5).map((t) => (
                <li key={t.key}>
                  <button
                    onClick={() => onChange(t.key)}
                    className={`px-3 py-2 transition-colors cursor-pointer border-b-2 flex items-baseline gap-2 ${
                      current === t.key
                        ? 'text-ink border-oxblood'
                        : 'text-ink-faint hover:text-ink border-transparent'
                    }`}
                  >
                    <span className="text-oxblood">{t.numeral}</span>
                    <span>{t.label}</span>
                  </button>
                </li>
              ))}
              <li className="mx-2 text-ink-faint select-none">·</li>
              {TABS.slice(5).map((t) => (
                <li key={t.key}>
                  <button
                    onClick={() => onChange(t.key)}
                    className={`px-3 py-2 transition-colors cursor-pointer border-b-2 flex items-baseline gap-2 ${
                      current === t.key
                        ? 'text-ink border-oxblood'
                        : 'text-ink-faint hover:text-ink border-transparent'
                    }`}
                  >
                    <span className="text-oxblood">{t.numeral}</span>
                    <span>{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
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
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-14 pt-7">
      {/* Masthead */}
      <RunningHead />
      <Rule className="mt-4" />

      {/* Wordmark line */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mt-6">
        <div className="font-display text-6xl md:text-7xl text-ink leading-none tracking-[-0.025em]">
          Kommit<span className="text-oxblood">.</span>
        </div>
        <div className="font-body italic text-lg md:text-xl text-ink-dim md:pb-3">
          a primitive for patient capital, on Solana.
        </div>
      </div>
      <Rule className="mt-4" />

      {/* Hero — three-column composition */}
      <section className="mt-12 grid grid-cols-1 lg:grid-cols-[1fr_1.6fr_0.9fr] gap-10 lg:gap-12">
        {/* Left — premise + pull quote */}
        <div>
          <CapsLabel className="text-[10px] mb-4">I · The Premise</CapsLabel>
          <p className="dropcap font-body text-[17px] leading-[1.55] text-ink">
            Park USDC. The principal stays yours, in escrow. The yield streams to the team building it.
            Withdraw your principal anytime; earn on-chain reputation that compounds quietly with the
            days you stayed.
          </p>
          <blockquote className="mt-7 italic text-[17px] leading-snug text-ink-dim border-l-2 border-oxblood pl-4">
            &ldquo;21 of 21 startups I backed failed.&rdquo;
            <div className="font-mono not-italic text-[10px] mt-2 text-ink-faint uppercase tracking-[0.06em]">
              — Wefunder investor, 2024
            </div>
          </blockquote>
        </div>

        {/* Center — banner */}
        <div>
          <CapsLabel className="text-[10px] mb-4">
            II · The Banner <Ornament className="ml-1" />
          </CapsLabel>
          <h1 className="font-display text-ink leading-[0.92] tracking-[-0.02em] text-[clamp(48px,9vw,116px)]">
            Back<br />
            the next<br />
            <span key={wordIndex} className="word-rotate font-body italic text-oxblood">
              {ROTATING_WORDS[wordIndex]}.
            </span>
          </h1>
          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <DoorBtn size="lg" onClick={onBrowse}>
              Browse projects &nbsp;→
            </DoorBtn>
            <span className="italic text-base text-ink-dim">or read the prospectus.</span>
          </div>
        </div>

        {/* Right — today's roll */}
        <aside className="lg:border-l lg:border-ink lg:pl-6">
          <CapsLabel className="text-[10px] mb-4">III · Today&rsquo;s Roll</CapsLabel>
          <LedgerStrip
            rows={[
              ['Total parked', '$2,847,392.04'],
              ['Active committers', '1,204'],
              ['Teams supported', '47'],
              ['Yield routed (wk)', '$2,851.18'],
              ['Mean tenure', '128 days'],
              ['Longest commit', '614 days'],
              ['Pivots survived', '6'],
              ['Pivots not survived', '3'],
            ]}
          />
          <p className="italic text-sm text-ink-dim mt-4 leading-snug">
            Read the rolls in any order. Time accrues either way.
          </p>
        </aside>
      </section>

      {/* IV — Mechanism */}
      <section className="mt-24">
        <Rule />
        <div className="flex items-baseline justify-between mt-5 mb-8 flex-wrap gap-3">
          <CapsLabel className="text-[11px]">
            IV · The Mechanism <Ornament className="ml-1" />
          </CapsLabel>
          <span className="italic text-ink-dim">three movements.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
          {[
            {
              n: 'i',
              title: 'Park USDC',
              body: 'Principal stays in escrow only you can withdraw from. No lockups, no fees, no surprises.',
            },
            {
              n: 'ii',
              title: 'Yield streams to a curated team',
              body: 'The yield routes to a team you choose. You are the support — patient capital, weekly drips.',
            },
            {
              n: 'iii',
              title: 'Earn on-chain reputation',
              body: 'A soulbound score that scales with capital × time. Readable by other Solana protocols.',
            },
          ].map((item) => (
            <div key={item.n} className="space-y-3">
              <div className="font-mono uppercase tracking-[0.14em] text-oxblood text-[11px]">{item.n}</div>
              <h3 className="font-display text-2xl md:text-[28px] text-ink leading-tight tracking-[-0.01em]">
                {item.title}
              </h3>
              <p className="font-body text-[16px] leading-relaxed text-ink-dim">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* V — Listings preview */}
      <section className="mt-24">
        <Rule />
        <div className="flex items-baseline justify-between mt-5 mb-8 flex-wrap gap-3">
          <CapsLabel className="text-[11px]">
            V · The Listings <Ornament className="ml-1" />
          </CapsLabel>
          <button onClick={onBrowse} className="italic text-ink-dim hover:text-ink underline underline-offset-4 cursor-pointer">
            see all current rolls →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROJECTS.slice(0, 3).map((p) => (
            <ProjectCard key={p.slug} p={p} compact />
          ))}
        </div>
      </section>

      {/* VI — The problem */}
      <section className="mt-24">
        <Rule />
        <div className="mt-5 mb-8">
          <CapsLabel className="text-[11px]">VI · The Problem We&rsquo;re Solving</CapsLabel>
        </div>
        <blockquote className="max-w-4xl">
          <p className="font-display text-[clamp(36px,5.5vw,72px)] leading-[1.05] tracking-[-0.018em] text-ink">
            &ldquo;21 of 21 startups I backed failed.&rdquo;
          </p>
          <footer className="mt-5 italic text-ink-dim">— Wefunder investor</footer>
        </blockquote>
        <p className="mt-12 max-w-2xl font-body text-[17px] leading-relaxed text-ink-dim">
          Equity crowdfunding turned retail backers into worse-informed angels. Patreon turned creators
          into performers. Both shapes lose principal or attention. Kommit asks for neither: keep your
          money, loan your yield, accumulate reputation for showing up early and staying.
        </p>
      </section>

      {/* VII — FAQ */}
      <section className="mt-24">
        <Rule />
        <div className="mt-5 mb-8">
          <CapsLabel className="text-[11px]">VII · Common Questions</CapsLabel>
        </div>
        <div className="max-w-3xl">
          <div className="border-t-2 border-ink" />
          {FAQ.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className="border-b border-ink/40">
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full flex items-baseline justify-between gap-6 py-5 text-left cursor-pointer group"
                >
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-oxblood text-[11px] uppercase tracking-[0.12em] w-8 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-[22px] md:text-[26px] text-ink leading-tight tracking-[-0.01em] group-hover:text-oxblood transition-colors">
                      {item.q}
                    </span>
                  </span>
                  <span className="font-display text-2xl text-oxblood shrink-0">{open ? '–' : '+'}</span>
                </button>
                {open && (
                  <div className="pb-6 pl-11 max-w-2xl font-body text-[16px] leading-relaxed text-ink-dim">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Colophon */}
      <footer className="mt-24 mb-12">
        <Rule />
        <div className="mt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
          <span className="flex items-center gap-3">
            <Wordmark size="sm" />
            <span className="italic font-body normal-case tracking-normal text-ink-faint">est. mmxxv · on Solana</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-ink">GitHub</a>
            <span>Built on Solana</span>
            <span className="text-oxblood">✶</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Project card (used on Landing + Browse + Discover) ───────────────────
function ProjectCard({
  p,
  compact = false,
  onClick,
}: {
  p: (typeof PROJECTS)[number];
  compact?: boolean;
  onClick?: () => void;
}) {
  const Component = onClick ? 'button' : 'article';
  return (
    <Component
      onClick={onClick}
      className={`bg-paper border border-ink relative text-left w-full block ${
        onClick ? 'cursor-pointer hover:bg-paper-edge transition-colors' : ''
      }`}
    >
      <CertHead left={`Vol. ${p.vol}`} center={p.sector} right={`est. ${p.since}`} />

      <div className="px-5 pt-5 pb-3 relative">
        <h3 className="font-display text-[36px] md:text-[42px] leading-[0.95] tracking-[-0.02em] text-ink pr-16">
          {p.name}
        </h3>
        <p className="font-body italic text-[16px] text-ink-dim mt-2 leading-snug">{p.pitch}</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-sage-soft border border-ink shrink-0" />
          <div className="font-body text-sm text-ink">
            by <span className="italic">{p.team}</span>
          </div>
        </div>
        {p.pivoted && (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-oxblood">
            ↳ Pivoted from {p.pivoted.from.split(',')[0]} on {p.pivoted.date}
          </div>
        )}

        {/* Seal — circular, slight rotation, oxblood */}
        <div className="absolute top-4 right-4 w-14 h-14 rounded-full border-[1.5px] border-oxblood text-oxblood flex flex-col items-center justify-center -rotate-6">
          <div className="font-caps font-bold uppercase text-[7px] tracking-[0.14em]">active</div>
          <div className="font-display text-[20px] leading-none mt-0.5">{p.days}</div>
          <div className="font-mono uppercase text-[7px] tracking-[0.06em] mt-0.5">days</div>
        </div>
      </div>

      <div className="mx-5">
        <Rule />
      </div>

      <div className="px-5 pt-3 pb-4">
        <LedgerStrip
          rows={
            compact
              ? [
                  ['Committed', `$${fmt(p.committed)}`],
                  ['Supporters', `${p.supporters}`],
                  ['Yield (wk)', `$${fmt(p.weeklyYield)}`],
                ]
              : [
                  ['Committed', `$${fmt(p.committed)}`],
                  ['Supporters', `${p.supporters}`],
                  ['Yield routed (wk)', `$${fmt(p.weeklyYield)}`],
                  ['Days active', `${p.days}`],
                ]
          }
        />
      </div>
    </Component>
  );
}

// ─── Screen 2: Browse ─────────────────────────────────────────────────────
function Browse({ onOpenProject }: { onOpenProject: () => void }) {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-14 pt-7">
      <RunningHead />
      <Rule className="mt-4" />

      <header className="mt-8">
        <CapsLabel className="text-[11px] mb-3">II · The Listings, in full</CapsLabel>
        <h1 className="font-display text-5xl md:text-6xl text-ink tracking-[-0.02em] leading-[0.95]">
          Projects taking commitments
        </h1>
        <p className="mt-4 font-body italic text-lg text-ink-dim max-w-2xl">
          Each is a current combination of team and idea. Back the combo; retain through pivots; let the
          chain remember.
        </p>
      </header>

      <Rule className="mt-10" />

      {/* Sort + filters as ledger-row */}
      <div className="py-4 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.08em]">
        <button className="text-ink px-3 py-1.5 border border-ink hover:bg-ink hover:text-paper transition-colors cursor-pointer">
          Sort: Most recent ↕
        </button>
        <span className="text-ink-faint">|</span>
        {['Sector', 'Stage', 'Team size'].map((c) => (
          <button
            key={c}
            className="text-ink-dim px-3 py-1.5 border border-ink/40 hover:border-ink hover:text-ink transition-colors cursor-pointer"
          >
            {c} ▾
          </button>
        ))}
        <span className="ml-auto text-ink-faint italic font-body normal-case text-base tracking-normal">
          {PROJECTS.length} current rolls
        </span>
      </div>

      <Rule />

      {/* Grid */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
        {PROJECTS.map((p) => (
          <ProjectCard key={p.slug} p={p} onClick={onOpenProject} />
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
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-14 pt-7">
      <RunningHead />
      <Rule className="mt-4" />

      {/* Hero — certificate of listing */}
      <header className="mt-8">
        <CertHead
          left={`Vol. ${p.vol} · Listing`}
          center={`Sector: ${p.sector}`}
          right={`Established ${p.since}, 2026`}
        />
        <div className="border border-t-0 border-ink p-6 md:p-10 relative">
          <CapsLabel className="text-[10px] mb-4">III · The Listing</CapsLabel>
          <h1 className="font-display text-[clamp(56px,11vw,128px)] text-ink tracking-[-0.025em] leading-[0.92]">
            {p.name}
          </h1>
          <p className="font-body italic text-xl md:text-2xl text-ink-dim mt-5 max-w-3xl leading-snug">
            {p.pitch}
          </p>
          <div className="mt-7 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sage-soft border border-ink shrink-0" />
            <span className="font-body text-ink-dim">
              by <span className="italic text-ink">{p.team}</span>
            </span>
          </div>
          {p.pivoted && (
            <div className="mt-4 inline-flex items-baseline gap-3 border-l-2 border-oxblood pl-3 py-0.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-oxblood">Pivot</span>
              <span className="italic text-ink-dim">
                Pivoted from {p.pivoted.from} on {p.pivoted.date}, 2026
              </span>
            </div>
          )}

          {/* Seal */}
          <div className="absolute top-6 right-6 md:top-10 md:right-10 w-20 h-20 rounded-full border-[1.5px] border-oxblood text-oxblood flex flex-col items-center justify-center -rotate-6 hidden md:flex">
            <div className="font-caps font-bold uppercase text-[8px] tracking-[0.14em]">active</div>
            <div className="font-display text-[28px] leading-none mt-1">{p.days}</div>
            <div className="font-mono uppercase text-[8px] tracking-[0.08em] mt-1">days</div>
          </div>
        </div>
      </header>

      {/* Two-col body */}
      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left */}
        <div className="lg:col-span-2 space-y-12">
          {/* The pitch */}
          <section>
            <CapsLabel className="text-[10px] mb-4">i · The Pitch</CapsLabel>
            <div className="font-body text-[18px] leading-[1.6] text-ink space-y-4 max-w-2xl">
              <p>
                Most teams running serverless code rely on bespoke logging, expensive APMs, or nothing at
                all. Beacon is an open-core observability layer that drops in across AWS Lambda, Cloudflare
                Workers, Vercel, and Deno Deploy with one SDK and a single dashboard.
              </p>
              <p className="italic text-ink-dim">
                We started as Lantern, a structured-logging library. Three months of customer interviews
                surfaced the deeper pain — debugging cross-provider serverless apps. We&rsquo;re focused
                there now and the response has been different in kind, not degree.
              </p>
            </div>
          </section>

          {/* Founders */}
          <section>
            <CapsLabel className="text-[10px] mb-4">ii · The Founders</CapsLabel>
            <ul className="space-y-5">
              {FOUNDERS_BEACON.map((f) => (
                <li key={f.name} className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-sage-soft border border-ink shrink-0" />
                  <div>
                    <div className="font-display text-[22px] text-ink leading-none">{f.name}</div>
                    <div className="font-body italic text-ink-dim text-sm mt-1">{f.role}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Updates */}
          <section>
            <CapsLabel className="text-[10px] mb-4">iii · Recent Updates</CapsLabel>
            <Rule />
            <ul>
              {UPDATES_BEACON.map((u, i) => (
                <li key={i} className="py-6 border-b border-ink/40 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                      {u.date}
                    </span>
                    {u.pivot && (
                      <span className="font-caps font-bold uppercase text-[10px] tracking-[0.14em] text-oxblood border border-oxblood px-2 py-0.5">
                        ✶ Pivot
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 font-display text-[24px] text-ink leading-tight tracking-[-0.01em]">
                    {u.title}
                  </h4>
                  <p className="mt-2 font-body italic text-[16px] text-ink-dim leading-relaxed max-w-2xl">
                    {u.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right — stats certificate */}
        <aside className="lg:col-span-1">
          <div className="bg-paper border border-ink lg:sticky lg:top-20">
            <CertHead left="Certificate" right="of Listing" />
            <div className="p-6 space-y-6">
              <LedgerStrip
                rows={[
                  ['Total committed', `$${fmt(p.committed)}`],
                  ['Supporters', `${p.supporters}`],
                  ['Yield routed (wk)', `$${fmt(p.weeklyYield)} → ${p.team}`],
                  ['Mean tenure', '47 days'],
                  ['Your commitment', '$50.00'],
                  ['Your tenure', '15 days · since Apr 17'],
                ]}
              />
              <Rule />
              <div className="grid grid-cols-2 gap-3">
                <DoorBtn variant="ink" size="md" full onClick={onCommit}>
                  Commit&nbsp;+
                </DoorBtn>
                <DoorBtn variant="paper" size="md" full onClick={onWithdraw}>
                  Withdraw
                </DoorBtn>
              </div>
              <p className="font-body italic text-[14px] text-ink-dim leading-snug">
                Two doors, one weight. The certificate doesn&rsquo;t shame you for closing it; tenure is
                recorded either way.
              </p>
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint border-t border-ink/40 pt-3">
                Both sign in your wallet. Neither costs gas to your principal.
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Activity */}
      <section className="mt-20 mb-16">
        <Rule />
        <div className="mt-5 mb-6 flex items-baseline justify-between flex-wrap gap-3">
          <CapsLabel className="text-[11px]">iv · Recent Supporter Activity</CapsLabel>
          <span className="italic text-ink-dim text-sm">last week.</span>
        </div>
        <div className="border-t-2 border-ink">
          <ul>
            {ACTIVITY.map((a, i) => (
              <li key={i} className="py-3 border-b border-ink/40 flex items-baseline gap-6 font-mono text-[12px]">
                <span className="text-ink-faint w-20 shrink-0 uppercase tracking-[0.06em]">{a.when}</span>
                <span className="text-ink">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
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
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-14 pt-7">
      <RunningHead />
      <Rule className="mt-4" />

      <header className="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <CapsLabel className="text-[11px] mb-3">IV · The Holding</CapsLabel>
          <h1 className="font-display text-5xl md:text-[64px] text-ink tracking-[-0.02em] leading-[0.95]">
            Your certificate
          </h1>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim">
          Holder: 7xKa…m31q
        </div>
      </header>

      {/* Summary — two ledger panels */}
      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="border border-ink">
          <CertHead left="Active" right="as of today" />
          <div className="p-5 space-y-3">
            <div className="flex items-baseline gap-3">
              <div className="font-display text-[56px] text-ink leading-none tracking-[-0.02em]">
                ${fmt(activeTotal)}
              </div>
              <div className="italic text-ink-dim">across {COMMITMENTS.length} teams</div>
            </div>
            <div className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.08em]">
              {fmt(activePts)} active points · capital × time
            </div>
          </div>
        </div>
        <div className="border border-ink">
          <CertHead left="Lifetime" right="all rolls" />
          <div className="p-5 space-y-3">
            <div className="flex items-baseline gap-3">
              <div className="font-display text-[56px] text-ink leading-none tracking-[-0.02em]">
                $1,250
              </div>
              <div className="italic text-ink-dim">across 7 teams</div>
            </div>
            <div className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.08em]">
              47,891 lifetime points · soulbound
            </div>
          </div>
        </div>
      </section>

      {/* Active commitments — each as a small certificate */}
      <section className="mt-12">
        <Rule />
        <div className="mt-5 mb-6 flex items-baseline justify-between">
          <CapsLabel className="text-[11px]">v · Active Commitments</CapsLabel>
          <span className="italic text-ink-dim text-sm">{COMMITMENTS.length} teams · time accruing.</span>
        </div>
        <ul className="space-y-4">
          {COMMITMENTS.map((c, i) => (
            <li key={i} className="border border-ink bg-paper">
              <CertHead
                left={`Certificate of Commitment · Vol. ${c.vol}`}
                right={`Holder: 7xKa…m31q`}
              />
              <div className="p-5 grid grid-cols-1 md:grid-cols-[64px_1fr_1.1fr_auto] gap-5 items-center">
                <div className="w-16 h-16 rounded-full bg-sage-soft border border-ink relative shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center font-display text-[32px] text-ink">
                    {c.team[0]}
                  </div>
                </div>
                <div>
                  <div className="font-display text-[28px] text-ink leading-none tracking-[-0.01em]">
                    {c.team}
                  </div>
                  <div className="italic text-ink-dim text-sm mt-1">— {c.project}</div>
                </div>
                <LedgerStrip
                  rows={[
                    ['Committed', `$${fmt(c.amount)}.00`],
                    ['Tenure', `${c.days} days · since ${c.since}`],
                    ['Reputation (active)', `${fmt(c.points)} pts`],
                    ['Yield routed (wk)', `$${fmt(c.weekYield)} → ${c.team}`],
                  ]}
                />
                <div className="flex md:flex-col gap-2 shrink-0">
                  <DoorBtn variant="ink" size="sm">Commit&nbsp;+</DoorBtn>
                  <DoorBtn variant="paper" size="sm" onClick={onWithdraw}>Withdraw</DoorBtn>
                </div>
              </div>
              <div className="px-5 pb-4">
                <TimeBar start={c.since} days={c.days} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Discover */}
      <section className="mt-16 mb-16">
        <Rule />
        <div className="mt-5 mb-6 flex items-baseline justify-between flex-wrap gap-3">
          <CapsLabel className="text-[11px]">
            vi · Teams You Might Support Next <Ornament className="ml-1" />
          </CapsLabel>
          <span className="italic text-ink-dim text-sm">three for your consideration.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PROJECTS.slice(3, 6).map((p) => (
            <ProjectCard key={p.slug} p={p} compact onClick={onOpenProject} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Screen 5: Founder dashboard ──────────────────────────────────────────
function Founder() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-14 pt-7">
      <RunningHead />
      <Rule className="mt-4" />

      <header className="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <CapsLabel className="text-[11px] mb-3">V · The Founder&rsquo;s Roll</CapsLabel>
          <h1 className="font-display text-5xl md:text-[64px] text-ink tracking-[-0.02em] leading-[0.95]">
            Caldera <span className="italic text-ink-dim">— Geyser</span>
          </h1>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-dim">
          Wallet: 9pTr…m31q
        </div>
      </header>

      {/* Top stats — four-pane certificate */}
      <section className="mt-8 border border-ink">
        <CertHead
          left="Founder's Certificate · Vol. 04"
          center="Caldera"
          right="As of May 02, 2026"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-ink/40">
          {[
            { label: 'Received this month', value: '$42.18' },
            { label: 'Total received', value: '$187.34' },
            { label: 'Supporters', value: '87' },
            { label: 'Total committed', value: '$18,420' },
          ].map((s, i) => (
            <div key={i} className="p-5">
              <CapsLabel className="text-[10px] !text-ink-faint mb-2">{s.label}</CapsLabel>
              <div className="font-display text-[36px] md:text-[44px] text-ink leading-none tracking-[-0.01em]">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Post update */}
      <section className="mt-12">
        <Rule />
        <div className="mt-5 mb-4 flex items-baseline justify-between flex-wrap gap-3">
          <CapsLabel className="text-[11px]">i · Post an Update</CapsLabel>
          <span className="italic text-ink-dim text-sm">posted to your committers&rsquo; rolls.</span>
        </div>
        <div className="border border-ink bg-paper">
          <textarea
            className="w-full p-4 font-body text-[16px] text-ink bg-transparent outline-none resize-none placeholder:text-ink-faint placeholder:italic"
            rows={5}
            placeholder="What did you ship this week? What did you learn?"
          />
          <div className="flex items-center justify-between border-t border-ink/40 px-4 py-3">
            <label className="flex items-center gap-2 font-mono text-[11px] text-ink-dim uppercase tracking-[0.08em]">
              <input type="checkbox" className="accent-oxblood" />
              ✶ Tag as pivot
            </label>
            <DoorBtn size="sm">Post update</DoorBtn>
          </div>
        </div>
      </section>

      {/* Supporters */}
      <section className="mt-12">
        <Rule />
        <div className="mt-5 mb-4 flex items-baseline justify-between flex-wrap gap-3">
          <CapsLabel className="text-[11px]">ii · Supporters</CapsLabel>
          <span className="italic text-ink-dim text-sm">{SUPPORTERS.length} of 87 shown.</span>
        </div>
        <div className="border border-ink">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-ink text-paper font-caps font-bold uppercase tracking-[0.18em] text-[10px]">
            <div className="col-span-5 cursor-pointer hover:underline">Wallet ↕</div>
            <div className="col-span-2 cursor-pointer hover:underline">Committed ↕</div>
            <div className="col-span-3 cursor-pointer hover:underline">Since ↕</div>
            <div className="col-span-2 text-right cursor-pointer hover:underline">Points ↕</div>
          </div>
          <ul>
            {SUPPORTERS.map((s, i) => (
              <li
                key={i}
                className={`grid grid-cols-12 px-4 py-3 font-mono text-[12px] ${
                  i < SUPPORTERS.length - 1 ? 'border-b border-ink/30' : ''
                }`}
              >
                <div className="col-span-5 text-ink truncate">{s.wallet}</div>
                <div className="col-span-2 text-ink">${fmt(s.amount)}</div>
                <div className="col-span-3 text-ink-dim uppercase tracking-[0.06em]">{s.since}</div>
                <div className="col-span-2 text-right text-ink">{fmt(s.points)}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Yield receipts */}
      <section className="mt-12 mb-16">
        <Rule />
        <div className="mt-5 mb-4 flex items-baseline justify-between flex-wrap gap-3">
          <CapsLabel className="text-[11px]">iii · Yield Receipts</CapsLabel>
          <span className="italic text-ink-dim text-sm">weekly settlement, on-chain.</span>
        </div>
        <div className="border border-ink">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-ink text-paper font-caps font-bold uppercase tracking-[0.18em] text-[10px]">
            <div className="col-span-3">Date</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-6">Tx</div>
          </div>
          <ul>
            {RECEIPTS.map((r, i) => (
              <li
                key={i}
                className={`grid grid-cols-12 px-4 py-3 font-mono text-[12px] ${
                  i < RECEIPTS.length - 1 ? 'border-b border-ink/30' : ''
                }`}
              >
                <div className="col-span-3 text-ink-dim uppercase tracking-[0.06em]">{r.date}</div>
                <div className="col-span-3 text-ink">${fmt(r.amount)}</div>
                <div className="col-span-6 text-ink-faint truncate">{r.tx}</div>
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
        className="absolute inset-0 bg-ink/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-paper border border-ink shadow-[0_30px_60px_-20px_rgba(34,18,12,0.4)]">
        {children}
      </div>
    </div>
  );
}

function ModalShell({
  vol,
  action,
  team,
  onClose,
  children,
}: {
  vol: string;
  action: string;
  team: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal onClose={onClose}>
      <CertHead left={`Vol. ${vol} · ${action}`} right="✶ Action" />
      <div className="px-6 md:px-8 pt-6 pb-2 flex items-start justify-between gap-4">
        <h2 className="font-display text-[34px] md:text-[40px] text-ink leading-none tracking-[-0.02em]">
          {action}
          <br />
          <span className="italic text-oxblood text-[24px] md:text-[28px]">{team}</span>
        </h2>
        <button
          onClick={onClose}
          className="text-ink-faint hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center cursor-pointer shrink-0"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="px-6 md:px-8 pt-4 pb-7 space-y-6">{children}</div>
    </Modal>
  );
}

// ─── Screen 6: Commit modal ───────────────────────────────────────────────
function CommitModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('200');
  const weekly = (Number(amount || 0) * 0.052) / 52;
  return (
    <ModalShell vol={featuredProject.vol} action="Commit to" team={featuredProject.team} onClose={onClose}>
      <div>
        <CapsLabel className="text-[10px] mb-2">i · Amount</CapsLabel>
        <div className="flex items-stretch border border-ink">
          <span className="px-4 flex items-center font-display text-[32px] text-ink-dim">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-2 py-3 font-display text-[32px] text-ink bg-transparent outline-none min-w-0 tracking-[-0.02em]"
          />
          <span className="px-4 flex items-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            USDC
          </span>
        </div>
        <p className="mt-3 font-body italic text-[15px] text-ink-dim leading-snug">
          Yield routed to team:{' '}
          <span className="not-italic font-mono text-ink text-sm">~${weekly.toFixed(2)}/week</span> at
          current Kamino USDC APY 5.2%.
        </p>
      </div>

      <Rule />

      <LedgerStrip
        rows={[
          ['Principal', `$${amount || '0'}.00 (yours)`],
          ['Routed annually', `$${(Number(amount || 0) * 0.052).toFixed(2)} → ${featuredProject.team}`],
          ['Reputation rate', `${(Number(amount || 0) / 100).toFixed(0)} pts/day`],
          ['Lockup', 'none'],
        ]}
      />

      <div className="border-l-2 border-oxblood pl-4 py-1 font-body italic text-[15px] text-ink-dim leading-snug">
        You can withdraw your principal anytime. No fees. Yield stops on withdrawal; points stay.
      </div>

      <div className="space-y-3">
        <DoorBtn full size="lg">Commit ${amount || '0'}&nbsp;→</DoorBtn>
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          ✶ Signs in your wallet
        </p>
      </div>
    </ModalShell>
  );
}

// ─── Screen 7: Withdraw modal ─────────────────────────────────────────────
function WithdrawModal({ onClose }: { onClose: () => void }) {
  const committed = 100;
  const [amount, setAmount] = useState('');
  return (
    <ModalShell vol="09" action="Withdraw from" team={COMMITMENTS[0].team} onClose={onClose}>
      <div>
        <CapsLabel className="text-[10px] mb-2">i · Currently Committed</CapsLabel>
        <div className="font-display text-[44px] text-ink leading-none tracking-[-0.02em]">
          ${fmt(committed)}<span className="text-ink-faint text-[24px]">.00</span>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint mt-2">
          51 days · since Mar 12
        </div>
      </div>

      <div>
        <CapsLabel className="text-[10px] mb-2">ii · Withdraw Amount</CapsLabel>
        <div className="flex items-stretch border border-ink">
          <span className="px-4 flex items-center font-display text-[32px] text-ink-dim">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 px-2 py-3 font-display text-[32px] text-ink bg-transparent outline-none placeholder:text-ink-faint min-w-0 tracking-[-0.02em]"
          />
          <button
            onClick={() => setAmount(String(committed))}
            className="px-4 font-caps font-bold uppercase text-[10px] tracking-[0.18em] text-ink border-l border-ink/40 hover:bg-paper-edge cursor-pointer"
          >
            Full
          </button>
        </div>
      </div>

      <Rule />

      <LedgerStrip
        rows={[
          ['Lifetime score', '47,891 pts (preserved)'],
          ['Active points after', `${amount && Number(amount) >= committed ? '0' : '8,210'} pts`],
          ['Tenure recorded', '51 days (kept on-chain)'],
        ]}
      />

      <div className="border-l-2 border-oxblood pl-4 py-1 font-body italic text-[15px] text-ink-dim leading-snug">
        Your lifetime score is preserved. Active points scale with remaining commitment. Tenure stays
        recorded either way.
      </div>

      <div className="space-y-3">
        <DoorBtn full size="lg" variant="paper">
          ←&nbsp; Withdraw {amount ? `$${amount}` : ''}
        </DoorBtn>
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          ✶ Signs in your wallet
        </p>
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
    }, 2000);
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
    <div className="min-h-screen bg-paper text-ink flex-1">
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
