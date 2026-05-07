# Security policy

Kommit is a hackathon/devnet-grade prototype submitted to Solana Frontier (May 2026). It is **not third-party audited**, **not production-ready**, and currently **only deployed on Solana devnet**. Mainnet is whenever-if-ever — the architecture is mainnet-ready, but the button has not been pressed.

If you find a security issue, please follow this disclosure path before opening a public issue or PR.

## Disclosure

**Email:** lukas.c.seel@gmail.com

Please put `[Kommit security]` in the subject line. We aim to acknowledge within 72 hours and provide a fix or mitigation timeline within 7 days for in-scope issues. Out-of-scope issues are acknowledged but not fixed.

We follow [coordinated vulnerability disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):
- Don't publicly disclose before we've had a reasonable opportunity to mitigate.
- We will credit you in the fix commit + release notes if you want.
- We won't pursue legal action against good-faith research that respects the boundaries below.

## In scope

- The Anchor program at `programs/kommit/` (devnet program ID `GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`)
- The off-chain webhook indexer at `web/src/app/api/webhook/helius/`
- The Supabase schema migrations at `migrations/supabase/`
- The Next.js frontend at `web/`
- The mainnet deploy scripts at `scripts/`
- This repository's secrets posture (any reachable production key, private repo data, etc.)

## Severity rubric

- **Critical:** principal-loss path, unauthorized fund movement, full admin compromise, RCE on production infra, secret exfiltration enabling any of the above.
- **High:** unauthorized state writes, RLS bypass that exposes user identity, supply-chain compromise, denial-of-service that costs the platform > $1k/day.
- **Medium:** information disclosure of non-PII, privilege escalation between user roles, persistent XSS, CSRF on state-changing routes.
- **Low:** missing security headers, weak password policies on admin tooling, non-exploitable code-quality issues with security flavor.
- **Info:** best-practice deviations, architectural notes.

## Out of scope

- Reports against `web-legacy-anchor-ref/` — this directory exists as a code reference for an in-progress migration and is **not deployed anywhere**. Issues there are not security-relevant.
- Theoretical vulnerabilities without a working exploit on devnet.
- Social engineering against Kommit team members.
- Physical attacks against Lukas's hardware.
- Reports about third-party services (Privy, Supabase, Helius, Kamino, Solana itself) that do not affect Kommit's specific integration. Please report those upstream.
- Self-XSS, missing rate limits on demo endpoints, or other low-impact theoretical issues that require unrealistic preconditions.

## Known limitations

These are documented and intentional, not bugs:

- **No KYC** — private beta is whitelisted; no KYC plumbing in v0.5. KYC plumbing arrives with v1 fiat rails (card / SEPA partners enforce it upstream).
- **Curation is centralized** — admin-curated invite-only in v0.5; less-centralized paths (DAO, staked-reputation) explored in v2+.
- **Single yield-source adapter** in v0.5 (Kamino USDC reserve). Second adapter (marginfi or Jupiter Lend) is a v1 task.
- **Demo controls (`?as=` persona override + floating `<DemoControls />`)** are gated behind `NODE_ENV !== "production"` for production builds. Mock auth never runs in production.
- **`SECURITY_REVIEW.md`** — internal self-audit of the Anchor program with file:line citations. Verdict: hackathon-private-beta-grade. Pre-scaling upgrade items (multisig admin + multisig upgrade authority + third-party audit) called out explicitly.
- **`SECURITY_HARDENING.md`** (at workspace parent) — full-stack security review by an internal Codex pass. Verdict: HOLD-WITH-FIXES at time of writing; tracked findings burned down in this commit cycle.
