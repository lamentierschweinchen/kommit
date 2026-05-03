// Devnet smoke test for the klend integration.
//
// Round-trip: create_project → commit USDC → supply_to_yield_source → wait
// → harvest → recipient receives non-zero USDC. Prints all tx hashes.
//
// PREREQUISITES (Lukas — run before invoking):
//   1. Solana CLI configured for devnet:
//        solana config set --url https://api.devnet.solana.com
//   2. Wallet with enough devnet SOL (~3 SOL covers deploy + a few txs):
//        solana balance --url devnet     # check first
//        # If < 1 SOL: get from https://faucet.solana.com (web faucet, since
//        # CLI airdrop is rate-limited / often exhausted)
//   3. Wallet with devnet USDC (the smoke uses 0.1 USDC):
//        # mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
//        # faucet: https://faucet.circle.com/  (toggle network → Solana Devnet)
//   4. Kommit program deployed to devnet:
//        anchor deploy --provider.cluster devnet
//        anchor idl init --provider.cluster devnet \
//          --filepath target/idl/kommit.json \
//          GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3
//
// USAGE:
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=~/.config/solana/id.json \
//   npx ts-node scripts/smoke_klend_devnet.ts

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from '@solana/spl-token';
import { Kommit } from '../target/types/kommit';

// --- Devnet klend account graph (verified via getProgramAccounts on 2026-05-03). ---
const KLEND_PROGRAM_ID = new anchor.web3.PublicKey(
  'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD'
);
const KLEND_LENDING_MARKET = new anchor.web3.PublicKey(
  '6aaNTBEmwdN19AAdTwbNrWyUo6iEyiLguxCTePEzSqoH'
);
const KLEND_USDC_RESERVE = new anchor.web3.PublicKey(
  'HRwMj8uuoGVWCanKzKvpTWN5ZvXjtjKGxcFbn2qTPKMW'
);
const KLEND_LENDING_MARKET_AUTHORITY = new anchor.web3.PublicKey(
  '7Aoc3MHQkYSB5y3g3ipyFKWF2TBsYdvqNWHbQ2btWXJt'
);
const KLEND_RESERVE_LIQUIDITY_SUPPLY = new anchor.web3.PublicKey(
  '6icVFmuKEsH5dzDwTSrxzrnJ14N27gDKRc2XAxPtB4ep'
);
const KLEND_RESERVE_COLLATERAL_MINT = new anchor.web3.PublicKey(
  '6FY2rwh5wWrtSveAG9t9ANc2YsrChNasVSEpMQubJcXd'
);
const USDC_MINT = new anchor.web3.PublicKey(
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);
const SYSVAR_INSTRUCTIONS_PUBKEY = new anchor.web3.PublicKey(
  'Sysvar1nstructions1111111111111111111111111'
);

const COMMIT_AMOUNT = 100_000n; // 0.1 USDC (USDC has 6 decimals)
const WAIT_SECONDS = 30;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Kommit as Program<Kommit>;
  const wallet = provider.wallet as anchor.Wallet;
  const conn = provider.connection;

  console.log('=== Kommit klend devnet smoke ===');
  console.log('Program:', program.programId.toBase58());
  console.log('Wallet :', wallet.publicKey.toBase58());
  console.log('SOL bal:', (await conn.getBalance(wallet.publicKey)) / anchor.web3.LAMPORTS_PER_SOL);

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );

  // Confirm config is initialized.
  const cfg = await program.account.kommitConfig.fetchNullable(configPda);
  if (!cfg) {
    throw new Error(
      'KommitConfig not initialized on devnet. Run bootstrap first: ' +
        'await program.methods.initializeConfig().accounts({...}).rpc()'
    );
  }
  console.log('Admin  :', cfg.admin.toBase58());

  // Step 1: create_project (admin must == wallet).
  if (!cfg.admin.equals(wallet.publicKey)) {
    throw new Error(`smoke wallet must be admin (got ${cfg.admin})`);
  }
  const recipientKp = anchor.web3.Keypair.generate();
  const recipient = recipientKp.publicKey;
  const [projectPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('project'), recipient.toBuffer()],
    program.programId
  );
  const metadataHash = new Uint8Array(32).fill(7);

  const sigCreate = await program.methods
    .createProject(recipient, Array.from(metadataHash) as any)
    .accounts({
      project: projectPda,
      admin: wallet.publicKey,
      config: configPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log(`[1/5] create_project        tx=${sigCreate}`);

  // Step 2: ensure recipient has USDC ATA + commit USDC into escrow.
  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
  const [commitmentPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('commitment'), wallet.publicKey.toBuffer(), projectPda.toBuffer()],
    program.programId
  );
  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), projectPda.toBuffer()],
    program.programId
  );

  const sigCommit = await program.methods
    .commit(new anchor.BN(COMMIT_AMOUNT.toString()))
    .accounts({
      commitment: commitmentPda,
      project: projectPda,
      user: wallet.publicKey,
      userUsdcTokenAccount: userUsdcAta,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      config: configPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log(`[2/5] commit ${COMMIT_AMOUNT} USDC      tx=${sigCommit}`);

  // Step 3: supply_to_yield_source — escrow → klend.
  const [collateralPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('collateral'), projectPda.toBuffer()],
    program.programId
  );
  const [lendingPositionPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('lending'), projectPda.toBuffer(), Buffer.from([0])],
    program.programId
  );

  const sigSupply = await program.methods
    .supplyToYieldSource(new anchor.BN(COMMIT_AMOUNT.toString()))
    .accounts({
      project: projectPda,
      config: configPda,
      escrowTokenAccount: escrowPda,
      collateralTokenAccount: collateralPda,
      lendingPosition: lendingPositionPda,
      usdcMint: USDC_MINT,
      klendReserve: KLEND_USDC_RESERVE,
      klendLendingMarket: KLEND_LENDING_MARKET,
      klendLendingMarketAuthority: KLEND_LENDING_MARKET_AUTHORITY,
      klendReserveLiquidityMint: USDC_MINT,
      klendReserveLiquiditySupply: KLEND_RESERVE_LIQUIDITY_SUPPLY,
      reserveCollateralMint: KLEND_RESERVE_COLLATERAL_MINT,
      klendProgram: KLEND_PROGRAM_ID,
      instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
      payer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log(`[3/5] supply_to_yield_source tx=${sigSupply}`);

  console.log(`[wait] sleeping ${WAIT_SECONDS}s for yield to accrue...`);
  await new Promise((r) => setTimeout(r, WAIT_SECONDS * 1000));

  // Step 4: harvest — redeem some cTokens to the recipient.
  // Recipient ATA must exist before harvest. Create it.
  const recipientAta = await getOrCreateAssociatedTokenAccount(
    conn,
    wallet.payer,
    USDC_MINT,
    recipient
  );

  // Redeem a small amount of cTokens. The off-chain crank should compute
  // the right amount from the current exchange rate; for the smoke we just
  // pick a token amount and verify the recipient gets some USDC.
  const REDEEM_CTOKENS = new anchor.BN(50_000); // arbitrary small amount
  const MIN_YIELD = new anchor.BN(1); // accept any non-zero routing as success

  const sigHarvest = await program.methods
    .harvest(REDEEM_CTOKENS, MIN_YIELD)
    .accounts({
      project: projectPda,
      lendingPosition: lendingPositionPda,
      collateralTokenAccount: collateralPda,
      recipientTokenAccount: recipientAta.address,
      usdcMint: USDC_MINT,
      klendReserve: KLEND_USDC_RESERVE,
      klendLendingMarket: KLEND_LENDING_MARKET,
      klendLendingMarketAuthority: KLEND_LENDING_MARKET_AUTHORITY,
      klendReserveLiquidityMint: USDC_MINT,
      klendReserveLiquiditySupply: KLEND_RESERVE_LIQUIDITY_SUPPLY,
      reserveCollateralMint: KLEND_RESERVE_COLLATERAL_MINT,
      klendProgram: KLEND_PROGRAM_ID,
      instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log(`[4/5] harvest                tx=${sigHarvest}`);

  // Step 5: confirm recipient received USDC.
  const recipientBalance = await getAccount(conn, recipientAta.address);
  console.log(`[5/5] recipient USDC balance: ${recipientBalance.amount.toString()} base units`);
  if (recipientBalance.amount === 0n) {
    throw new Error('recipient received 0 USDC — harvest did not route yield');
  }

  console.log('\n=== ALL TX HASHES (paste into commit message) ===');
  console.log(`create_project        : ${sigCreate}`);
  console.log(`commit                : ${sigCommit}`);
  console.log(`supply_to_yield_source: ${sigSupply}`);
  console.log(`harvest               : ${sigHarvest}`);
  console.log(`Recipient delta       : ${recipientBalance.amount.toString()} USDC base units`);
  console.log(`\nView on Solscan: https://solscan.io/tx/${sigHarvest}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
