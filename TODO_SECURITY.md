# Security Follow-up Backlog

Created during hand-off 74 Codex condensed pass on 2026-05-12.

## Medium

- Add a per-email cooldown and bot-friction strategy for `/api/founder-application`. Current server validation is strong on field sizes, but the route only has an in-memory per-IP bucket, so rotating IPs can still fill the admin queue.
- Add per-wallet/per-update rate limits to `/api/updates/[id]/comments` and `/api/updates/[id]/reactions`. Auth and sybil gates are present, but eligible wallets can still spam engagement writes.
- Replace the `kommit:withdrawn-overlay` localStorage display overlay with trusted server/indexer state. The current overlay cannot move funds or authority, but a user can self-inflate lifetime kommits for screenshots.

## Low

- Flip `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy` after a clean browser walk on preview/production.
- Prune retired Visa/Helio variables from `web/.env.example` so operators do not configure dead surfaces.
- Add URL validation and a stricter slug-collision prompt to `scripts/onboard_founder.ts`; it is admin-only, but it currently trusts social-link schemes and overwrites matching dynamic-project slugs idempotently.
