# Security notes

Operational addendum to [`SECURITY.md`](SECURITY.md). Documents known accepted-risk items in the dependency chain for the v1 hackathon submission, with reachability analysis. Updated as the security posture evolves.

Last updated: 2026-05-07 (Codex Layer-9 burndown).

## Known npm audit findings — accepted with reachability analysis

After running `npm audit --omit=dev` in `app/web` and applying available overrides (`axios@^1.16.0`; `postcss@8.5.14` direct devDep), 5 advisories remain. All have negligible runtime exposure given Kommit's actual usage and are accepted for the hackathon/devnet submission posture. Full triage follows.

### bigint-buffer 1.1.5 — `GHSA-3gc7-fjrx-p6mg` (3 high)

**Chain:** `@solana/spl-token@0.4.14` → `@solana/buffer-layout-utils@0.2.0` → `bigint-buffer@1.1.5`

**Advisory:** Buffer overflow via `toBigIntLE()` / `toBigIntBE()` when a malicious input buffer is shorter than the expected byte length.

**Reachability in Kommit:**

- `bigint-buffer` is invoked by `@solana/buffer-layout-utils` to decode u64 / u128 / etc. fields out of Solana account data layouts.
- The account data Kommit's frontend decodes comes from on-chain program state — `KommitConfig`, `Project`, `Commitment`, `LendingPosition`, `KaminoAdapterConfig`. All five PDAs have fixed Anchor-defined byte layouts; Anchor enforces the expected size when fetching, so a malformed buffer can't reach `toBigIntLE` with a too-short slice without first failing Anchor's account discriminator + size check.
- The frontend never accepts attacker-controlled buffer input that flows into bigint-buffer paths.

**Upstream status:** No fixed version of bigint-buffer published. Latest is `1.1.5` (the vulnerable version). The maintainer hasn't shipped 1.1.6+. Even latest `@solana/spl-token` chains continue to pull `1.1.5`. `npm audit fix --force` proposes downgrading `@solana/spl-token` to `0.1.8` — a multi-major break that loses critical functionality.

**Decision:** accept-with-reachability for the hackathon/devnet posture. Re-evaluate on any of:

1. bigint-buffer ships a fixed release.
2. `@solana/spl-token` migrates to a non-vulnerable replacement.
3. Kommit ever processes attacker-controlled buffer payloads through this chain (currently structurally impossible).

### postcss 8.4.31 (vendored by Next.js 15.5.15) — `GHSA-qx2v-qp2m-jg93` (2 moderate)

**Chain:** `next@15.5.15` (vendored) → `postcss@8.4.31`. Note: the **root** `postcss` was bumped to `8.5.14` (latest); Next ships its own internal copy that npm overrides cannot cleanly cascade into without a Next major bump.

**Advisory:** XSS via unescaped `</style>` in PostCSS's CSS Stringify output. Triggered when PostCSS processes attacker-controlled CSS.

**Reachability in Kommit:**

- PostCSS is **build-time only** in our pipeline. It runs during `next build` to process Tailwind CSS and our author-controlled `globals.css`.
- Zero runtime exposure. The browser never executes PostCSS.
- The CSS PostCSS processes is authored by us — Tailwind config + our `globals.css`. No attacker-controlled CSS flows in.

**Upstream status:** Codex's review confirmed even the latest `next@16.2.5` still bundles `postcss@8.4.31` internally. Upstream Next hasn't moved; Next 17 may. `npm audit fix --force` proposes downgrading Next to `9.3.3` — multiple-major break, loses App Router + React 19.

**Decision:** accept-with-reachability for the hackathon/devnet posture. Re-evaluate when Next ships a postcss bump.

## Pre-commit secret scanning

Active. `.git/hooks/pre-commit` runs `gitleaks protect --staged --redact --no-banner`. Verified working on every commit in this branch's history (May 6+).

## Allowlisted historical findings

`.gitleaksignore` baselines a single intentional fixture from commit `7d1c1ac` (Frontend Pass 1, 2026-05-06): `MOCK_KEY` constant in `ExportKeyModal.tsx`. The fixture was a deliberately key-shaped placeholder for visual demo of the export-private-key UX; never a real secret. Pass 2 replaced the mock with a real Privy `exportWallet` call. The historical commit remains in git history; rather than rewrite history (which would invalidate downstream branch ancestors), the finding is suppressed via the baseline file with explicit documentation.

Verified by Codex Layer-9 (2026-05-07): zero verified secrets across all-history TruffleHog + git-secrets scans. Gitleaks now passes after baseline.

## What's NOT yet covered

- **Production CSP / `frame-ancestors`** — `next.config.ts` ships baseline headers (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy). CSP + `frame-ancestors` are queued for the next frontend pass.
- **Supabase function execute privileges** — `process_event` and `_mat_*` helpers in migration `0002` rely on default PostgreSQL grants. Migration `0003` (queued) will add explicit `security invoker` + `revoke execute from public, anon, authenticated` + `grant execute to service_role`.
- **Server-side form validation** — the `/build` form has zod client-side caps but no server route. This is a Pass 3+ requirement; the form currently mock-submits to `/build/submitted`.
- **Branch protection on `main`** — requires GitHub Pro for private repos; will be enabled the moment the repo flips public.
- **Independent third-party security audit** — gates any meaningful mainnet posture. Out of scope for v1 hackathon.

See [`SECURITY.md`](SECURITY.md) for disclosure path. See [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) for the internal Anchor program audit. The full-stack pass log lives at the workspace level (`SECURITY_HARDENING.md`); not in the public repo.
