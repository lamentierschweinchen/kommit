// Mainnet bootstrap — call initialize_config exactly once after deploy.
//
// USAGE:
//   ANCHOR_WALLET=~/.config/solana/mainnet-deployer.json \
//   ANCHOR_PROVIDER_URL=https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY \
//   npx ts-node scripts/bootstrap_mainnet.ts
//
// Idempotent: if config is already initialized, the script exits cleanly
// without re-initializing.
//
// After this: project creation + first commits are interactive (run
// create_project for each seed founder via the frontend or a CLI helper,
// then scripts/smoke_mainnet.ts to verify).
//
// The wallet that signs initialize_config becomes config.admin — i.e. the
// curation admin in v1. Make sure ANCHOR_WALLET points to the right key
// (typically Lukas's hardware wallet for the initial cohort; v1.5 plan
// is to rotate to Squads multisig per SECURITY_REVIEW.md item 14.2).

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Kommit } from '../target/types/kommit';

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Kommit as Program<Kommit>;
  const wallet = provider.wallet as anchor.Wallet;
  const conn = provider.connection;

  // Genesis hash identifies the network (mainnet/devnet/testnet/local). Cluster
  // detection is loose — we print the prefix so a human can sanity-check at a
  // glance. (Mainnet genesis starts `5eykt4Us...`; devnet `EtWTRABZ...`.)
  const genesis = (await conn.getGenesisHash()).slice(0, 8);
  let clusterHint = '';
  if (genesis.startsWith('5eykt4Us')) clusterHint = ' (looks like MAINNET — confirm)';
  else if (genesis.startsWith('EtWTRABZ')) clusterHint = ' (devnet)';
  else if (genesis.startsWith('4uhcVJyU')) clusterHint = ' (testnet)';
  console.log('Program  :', program.programId.toBase58());
  console.log('RPC      :', (provider.connection as any)._rpcEndpoint ?? '(unknown)');
  console.log('Wallet   :', wallet.publicKey.toBase58());
  console.log('SOL bal  :', (await conn.getBalance(wallet.publicKey)) / anchor.web3.LAMPORTS_PER_SOL);
  console.log(`Genesis  : ${genesis}${clusterHint}`);

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );
  console.log('Config   :', configPda.toBase58());

  const existing = await program.account.kommitConfig.fetchNullable(configPda);
  if (existing) {
    console.log('\nKommitConfig already exists. No action.');
    console.log('  admin   :', existing.admin.toBase58());
    console.log('  paused  :', existing.paused);
    if (!existing.admin.equals(wallet.publicKey)) {
      console.warn(
        `  WARNING: existing admin (${existing.admin.toBase58()}) is NOT this wallet (${wallet.publicKey.toBase58()})`
      );
    }
    process.exit(0);
  }

  console.log('\nCalling initialize_config...');
  // Anchor 0.31's typed `.accounts()` excludes PDA-derivable fields like
  // `config` (it auto-derives from the IDL's seeds). `accountsPartial` accepts
  // explicit overrides for any account, which matters when ts-node runs
  // against the bundled IDL JSON directly. (Verified during devnet dry-run
  // 2026-05-05.)
  const sig = await program.methods
    .initializeConfig()
    .accountsPartial({
      config: configPda,
      admin: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log(`initialize_config tx: ${sig}`);

  const cfg = await program.account.kommitConfig.fetch(configPda);
  console.log('\n=== KommitConfig ===');
  console.log('  admin   :', cfg.admin.toBase58());
  console.log('  paused  :', cfg.paused);
  console.log('  bump    :', cfg.bump);

  console.log('\nNext steps:');
  console.log('  1. Create seed projects via the frontend or a CLI helper.');
  console.log('  2. Run scripts/smoke_mainnet.ts <PROJECT_PDA> to verify end-to-end.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
