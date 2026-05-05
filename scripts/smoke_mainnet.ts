// Mainnet smoke — small-amount end-to-end verification once a seed project
// is on-chain.
//
// Steps: commit $10 USDC → wait briefly → accrue_points → withdraw fully.
// Prints all tx hashes. No yield-source CPI involved (pure layer-1 path);
// supply_to_yield_source + harvest get exercised separately by the klend
// devnet smoke and (eventually) the production cron.
//
// USAGE:
//   ANCHOR_WALLET=~/.config/solana/mainnet-deployer.json \
//   ANCHOR_PROVIDER_URL=https://mainnet.helius-rpc.com/?api-key=$HELIUS_API_KEY \
//   npx ts-node scripts/smoke_mainnet.ts <PROJECT_PDA>
//
// PREREQUISITES:
//   - Program deployed (scripts/deploy_mainnet.sh) and config initialized
//     (scripts/bootstrap_mainnet.ts).
//   - At least one project created (admin called create_project).
//   - Wallet funded with > $10 USDC (mainnet USDC mint:
//     EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v) and at least 0.05 SOL
//     for fees.
//   - PROJECT_PDA arg = the on-chain Project PDA (derive via
//     findProgramAddressSync([b"project", recipient_wallet.toBuffer()]).

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import { Kommit } from '../target/types/kommit';

const USDC_MINT = new anchor.web3.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const COMMIT_AMOUNT = 10_000_000n; // $10 USDC (6 decimals)

async function main() {
  const projectArg = process.argv[2];
  if (!projectArg) {
    console.error('USAGE: ts-node scripts/smoke_mainnet.ts <PROJECT_PDA>');
    process.exit(1);
  }
  const projectPda = new anchor.web3.PublicKey(projectArg);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Kommit as Program<Kommit>;
  const wallet = provider.wallet as anchor.Wallet;
  const conn = provider.connection;

  console.log('Program   :', program.programId.toBase58());
  console.log('Wallet    :', wallet.publicKey.toBase58());
  console.log('Project   :', projectPda.toBase58());

  // Confirm the project exists.
  const project = await program.account.project.fetchNullable(projectPda);
  if (!project) throw new Error(`project ${projectPda.toBase58()} not found on chain`);
  console.log('Recipient :', project.recipientWallet.toBase58());

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  );
  const [commitmentPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('commitment'), wallet.publicKey.toBuffer(), projectPda.toBuffer()],
    program.programId
  );
  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), projectPda.toBuffer()],
    program.programId
  );
  const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

  // Verify the user has enough USDC.
  const userBefore = await getAccount(conn, userUsdcAta);
  if (userBefore.amount < COMMIT_AMOUNT) {
    throw new Error(
      `wallet has ${userBefore.amount} USDC base units; need at least ${COMMIT_AMOUNT}`
    );
  }
  console.log('USDC bal  :', userBefore.amount.toString(), 'base units');

  // Step 1: commit $10.
  console.log('\n[1/3] commit $10 USDC...');
  const sigCommit = await program.methods
    .commit(new anchor.BN(COMMIT_AMOUNT.toString()))
    .accountsPartial({
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
  console.log(`     tx: ${sigCommit}`);

  // Step 2: wait briefly + accrue.
  console.log('[wait] sleeping 5s for accrual...');
  await new Promise((r) => setTimeout(r, 5000));

  console.log('[2/3] accrue_points...');
  const sigAccrue = await program.methods
    .accruePoints()
    .accountsPartial({ commitment: commitmentPda, project: projectPda })
    .rpc();
  console.log(`     tx: ${sigAccrue}`);

  // Step 3: withdraw full.
  console.log('[3/3] withdraw full...');
  const sigWithdraw = await program.methods
    .withdraw(new anchor.BN('18446744073709551615'), new anchor.BN(0))
    .accountsPartial({
      commitment: commitmentPda,
      project: projectPda,
      user: wallet.publicKey,
      userUsdcTokenAccount: userUsdcAta,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log(`     tx: ${sigWithdraw}`);

  // Verify USDC came back.
  const userAfter = await getAccount(conn, userUsdcAta);
  const delta = userBefore.amount - userAfter.amount;
  console.log(`\nUSDC delta : ${delta} base units (should be ~0; expected 0 if no yield ran)`);

  // Read the final commitment state.
  const c = await program.account.commitment.fetch(commitmentPda);
  console.log('\n=== Commitment final state ===');
  console.log('  principal     :', c.principal.toString(), '(should be 0)');
  console.log('  active_score  :', c.activeScore.toString(), '(should be 0)');
  console.log('  lifetime_score:', c.lifetimeScore.toString(), '(should be > 0)');

  console.log('\n=== TX HASHES ===');
  console.log(`commit         : ${sigCommit}`);
  console.log(`accrue_points  : ${sigAccrue}`);
  console.log(`withdraw       : ${sigWithdraw}`);
  console.log(`\nView on Solscan: https://solscan.io/tx/${sigWithdraw}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
