# `@kommit/reader`

**An open-source TypeScript SDK for reading Kommit conviction records on Solana.** ~10 lines to integrate; no auth, no API key, no rate limit. MIT-licensed.

Every Kommit user has a public, soulbound, capital-weighted conviction history (`capital × time committed`, accrued on-chain). Read it to gate features — discounts, beta access, allocation priority, recruitment funnels — on **real conviction** instead of token holdings or NFT collections.

> Devnet only in v0.1. Mainnet shipping in `0.2.x`.
> Program ID: [`GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3`](https://explorer.solana.com/address/GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3?cluster=devnet)

---

## Install

```bash
npm install @kommit/reader @solana/web3.js
```

Peer with `@coral-xyz/anchor@0.31.x` if you don't already have it:

```bash
npm install @coral-xyz/anchor@^0.31.1
```

## Example — read a wallet's conviction record

```ts
import { getKommitsForWallet } from "@kommit/reader";

const RPC = "https://api.devnet.solana.com";
const wallet = "5x9Lk...kT2"; // any Solana wallet address

const records = await getKommitsForWallet(RPC, wallet);

for (const r of records) {
  console.log(
    `project ${r.project.slice(0, 4)}…${r.project.slice(-4)} — ` +
    `lifetime ${r.lifetimeScore} kommits, ` +
    `principal ${Number(r.principal) / 1_000_000} USDC`
  );
}
```

That's it. Replace `RPC` with your favorite RPC provider (Helius, Triton, etc.) and the wallet with the user you want to inspect.

## Example — read a project's cohort

```ts
import { findProjectPda, getKommittersForProject } from "@kommit/reader";
import { PublicKey } from "@solana/web3.js";

const RPC = "https://api.devnet.solana.com";
const recipientWallet = new PublicKey("..."); // founder wallet

const projectPda = findProjectPda(recipientWallet);
const cohort = await getKommittersForProject(RPC, projectPda);

// Sorted by lifetimeScore desc — strongest conviction first
const top10 = cohort.slice(0, 10);
```

## Why this exists

Stake-backed signal. Sybil-resistant by construction (capital × time is hard to fake at scale). Public-by-default — Kommit doesn't gatekeep its own reputation graph. Built so other Solana products can read kommit balances and gate features (discounts, beta access, allocation priority) on **real conviction** — money that's been committed for time — rather than token holdings, NFT collections, or off-chain signups that anyone can fake.

> kommit.now is the first integrator of this SDK — see the founder dashboard's "Cohort" section, which reads through `getKommittersForProject` exactly as documented above. <https://kommit.now>

---

## API reference

### `getKommitsForWallet(rpcUrl, wallet)`

Returns `Promise<KommitRecord[]>` — every conviction record where the wallet is the kommitter, sorted by `lifetimeScore` descending.

| Param | Type | Description |
|---|---|---|
| `rpcUrl` | `string` | A Solana JSON-RPC URL. Devnet: `https://api.devnet.solana.com`. |
| `wallet` | `PublicKey \| string` | Wallet address (base58 string or `PublicKey` instance). |

### `getKommittersForProject(rpcUrl, projectPda)`

Returns `Promise<KommitRecord[]>` — every kommitter of the given project, sorted by `lifetimeScore` descending.

| Param | Type | Description |
|---|---|---|
| `rpcUrl` | `string` | A Solana JSON-RPC URL. |
| `projectPda` | `PublicKey \| string` | The on-chain Project PDA. Use `findProjectPda(recipientWallet)` if you only have the founder's wallet address. |

### `findProjectPda(recipientWallet, programId?)`

Derive a Project's PDA from its recipient wallet. Pure, no RPC.

### `findCommitmentPda(user, project, programId?)`

Derive a Commitment's PDA from `(user, project)`. Pure, no RPC.

### `KOMMIT_PROGRAM_ID`

`PublicKey` — the deployed devnet program ID. Mainnet swap is a `0.2.x` config bump.

### `getReadProgram(rpcUrl)`

Escape hatch — returns a typed read-only `Program<Kommit>`. Use only if you need to drive Anchor's account API directly. The provider's wallet refuses to sign.

### `KommitRecord` — return shape

```ts
type KommitRecord = {
  commitmentPda:  string;   // base58
  user:           string;   // base58
  project:        string;   // base58
  principal:      bigint;   // u64 USDC base units (1_000_000n = $1.00)
  depositTs:      number;   // unix seconds
  activeScore:    bigint;   // u128, resets on full withdraw
  lifetimeScore:  bigint;   // u128, never decreases
  lastAccrualTs:  number;   // unix seconds, last on-chain accrual
};
```

`activeScore` and `lifetimeScore` are accrued on-chain at every commit / withdraw. They reflect the **last on-chain write** — they don't auto-tick on read. For a live-ticking display (e.g., a real-time UI counter):

```ts
function nowKommits(r: KommitRecord, nowSec = Math.floor(Date.now() / 1000)): bigint {
  const elapsed = BigInt(Math.max(0, nowSec - r.lastAccrualTs));
  return r.activeScore + r.principal * elapsed;
}
```

That formula matches what the on-chain program does at the next `accrue`, `commit`, or `withdraw` write.

---

## Security model

- Read-only by construction. The SDK's internal Anchor provider holds a dummy wallet that throws on any sign attempt.
- The Kommit program enforces all financial invariants on-chain (audited; see [`SECURITY_REVIEW.md`](https://github.com/lamentierschweinchen/kommit/blob/main/SECURITY_REVIEW.md) in the parent repo). The SDK can't introduce new ones — it just reads state.
- No secrets in this package. The published tarball ships source, types, and the IDL JSON only. Bring your own RPC URL.
- Bundled IDL pinned to v0.1 of the program. If the program upgrades to introduce new fields, older SDK versions still read the legacy fields fine; use a newer SDK to read new fields.

## License

MIT. See [`LICENSE`](./LICENSE).

## Source

<https://github.com/lamentierschweinchen/kommit/tree/main/app/packages/kommit-reader>
