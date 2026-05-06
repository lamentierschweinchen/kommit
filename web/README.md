# Kommit — web (app/web)

Mock-only frontend rebuilt per **handoff 30**. Replaces the legacy Next 16 / Tailwind 4 / shadcn scaffold (now at `app/web-legacy-anchor-ref/`).

## Stack (pinned)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind v3 |
| Component primitives | Radix UI primitives directly (`@radix-ui/react-dialog`, `-select`, `-dropdown-menu`, `-checkbox`, `-toast`) |
| Forms | React Hook Form + zod |
| Fonts | next/font/google for Bricolage Grotesque + Public Sans + JetBrains Mono. Material Symbols via CSS `@import` in globals.css. |
| State | React Context (`AuthProvider`) + `useState` per page. No Zustand, no Redux, no TanStack Query yet — there's no backend to talk to this session. |
| Deploy | Vercel |

## Run

```sh
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (passes clean as of 2026-05-06)
```

## File map

```
src/
  app/
    layout.tsx                       — root layout, fonts, providers
    page.tsx                         — / landing
    not-found.tsx                    — 404
    about/page.tsx
    projects/page.tsx                — browse
    projects/[slug]/page.tsx         — detail
    dashboard/page.tsx               — committer dashboard
    founder/[slug]/page.tsx          — founder dashboard
    founder/[slug]/FounderDashboardClient.tsx
    build/page.tsx                   — application form
    build/submitted/page.tsx
    account/page.tsx
  components/
    auth/AuthProvider.tsx            — mock role-aware auth (default = Lukas, kommitter)
    auth/SignInModal.tsx
    layout/AuthHeader.tsx            — top nav, public vs. authed mode (audit #2)
    layout/MobileDrawer.tsx          — hamburger drawer (audit #1)
    layout/Sidebar.tsx               — left rail for dashboard / account / founder
    layout/Footer.tsx
    layout/DemoControls.tsx          — floating persona switcher (kept in dev only? — surfaces always for now)
    landing/HeroRotatingWord.tsx     — 11-word rotation
    project/ProjectCard.tsx
    project/UpdatesList.tsx
    project/KommittersList.tsx
    project/PositionCard.tsx         — sticky right-rail position card
    project/RecentUpdatesMini.tsx    — under-PositionCard mini-card (audit #17)
    project/BrowseToolbar.tsx        — sort right, filters left, search right (audit #4, #5)
    commit/CommitModal.tsx
    commit/WithdrawModal.tsx         — % presets (audit #13)
    dashboard/CommitmentRow.tsx      — pivoted commitment row (audit #6)
    dashboard/RightRail.tsx          — Recent updates feed + Pivot alerts (audit #14)
    founder/PostUpdateEditor.tsx     — multiline + pivot toggle + in-memory append
    account/ExportKeyModal.tsx       — destructive-as-black (audit #11)
    account/StubModal.tsx            — change name / email / connect / add method
    common/Modal.tsx                 — Radix Dialog wrapper, scrim @ bg-black/50 (audit #8)
    common/BrutalButton.tsx
    common/BrutalInput.tsx
    common/BrutalSelect.tsx
    common/Tape.tsx                  — STATE INDICATOR ONLY (audit #16)
    common/Skeleton.tsx
    common/ToastProvider.tsx         — Radix Toast + brutal styling
  lib/
    cn.ts                            — clsx + tailwind-merge
    fonts.ts
    date-utils.ts                    — DEMO_TODAY_ISO = "2026-04-28"
    kommit-math.ts                   — kommits = USD × days held
    data/users.ts                    — Lukas, Julian, Lina
    data/projects.ts                 — 10 projects
    data/commitments.ts              — Lukas's portfolio (6 commitments)
    hooks/useFilteredProjects.ts
```

## Demo personas

Default is signed in as Lukas (kommitter). Three ways to switch:

1. **Floating dev widget** at bottom-left (`DEMO · LUKAS (KOMMITTER)` — click to swap)
2. **Query string**: `?as=julian` (founder/Caldera), `?as=lina` (founder/Margin House), `?as=lukas` (default), `?as=anon` (signed out)
3. Sign-in modal redirects to `/dashboard` on submit; sign-out from the top dropdown returns to `/`

## Audit fixes baked in

P0 — #1 mobile drawer · #2 auth-header consistency · #3 hero rotating word can wrap on mobile.
P1 — #4 drop nav search on /projects · #5 sort moved right · #6 Quire Chess pivot tag · #7 sign-in close-link removed · #8 modal scrim locked to bg-black/50 · #9 404 widened · #10 browse card title scales + content-safe `px-6` · #11 destructive-as-black for export key · #12 sign-in methods as status pills · #13 withdraw % presets · #14 dashboard right rail · #15 drop project-detail in-image text · #16 tape = state-only · #17 RecentUpdatesMini under sticky position card.
P2 — about-page rotation reduced to -0.2deg · 404 sizing.
Deferred — #18 card-variant consolidation.

## Held for follow-on sessions

- Real auth (Privy/passkey/social) — handoff 31?
- Solana program integration — separate session
- Founder application admin queue
- OG image generation
- Production hardening (error boundaries, real loading states, a11y audit, perf)
- Anonymous variants of `/projects` and `/projects/[slug]`
- Card-variant consolidation (audit #18)

## Deploy

The legacy Vercel project at `kommit-design-v2.vercel.app` is `prj_xm7Wbxxt4DEXSUsvwSeq17AdNGNT`. Plan: link this app at `app/web/` to a new project (or repurpose the legacy alias once parity is signed off). Static mockups in `design/v2/` stay as repo artifacts.
