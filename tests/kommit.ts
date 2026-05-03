import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kommit } from "../target/types/kommit";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.Kommit as Program<Kommit>;
const connection = provider.connection;

const CONFIG_SEED = Buffer.from("config");
const PROJECT_SEED = Buffer.from("project");
const COMMITMENT_SEED = Buffer.from("commitment");
const ESCROW_SEED = Buffer.from("escrow");
const USDC_DECIMALS = 6;
const ONE_USDC = 1_000_000n;

const findConfigPda = () =>
  anchor.web3.PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId)[0];
const findProjectPda = (recipient: anchor.web3.PublicKey) =>
  anchor.web3.PublicKey.findProgramAddressSync(
    [PROJECT_SEED, recipient.toBuffer()],
    program.programId
  )[0];
const findCommitmentPda = (user: anchor.web3.PublicKey, project: anchor.web3.PublicKey) =>
  anchor.web3.PublicKey.findProgramAddressSync(
    [COMMITMENT_SEED, user.toBuffer(), project.toBuffer()],
    program.programId
  )[0];
const findEscrowPda = (project: anchor.web3.PublicKey) =>
  anchor.web3.PublicKey.findProgramAddressSync(
    [ESCROW_SEED, project.toBuffer()],
    program.programId
  )[0];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function airdrop(to: anchor.web3.PublicKey, sol = 5) {
  const sig = await connection.requestAirdrop(to, sol * anchor.web3.LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

describe("kommit", () => {
  const wallet = provider.wallet as anchor.Wallet;
  const admin = wallet.publicKey;

  let usdcMint: anchor.web3.PublicKey;

  // Per-test state holders so test scope stays clear.
  before(async () => {
    // Create a mock USDC mint owned by the admin/wallet.
    usdcMint = await createMint(
      connection,
      wallet.payer,
      admin,
      null,
      USDC_DECIMALS
    );
  });

  it("initializes config", async () => {
    const configPda = findConfigPda();

    // Idempotent across runs against a long-lived validator: skip if already initialized.
    const existing = await connection.getAccountInfo(configPda);
    if (existing) {
      const cfg = await program.account.kommitConfig.fetch(configPda);
      assert.equal(cfg.admin.toBase58(), admin.toBase58());
      return;
    }

    await program.methods
      .initializeConfig()
      .accounts({
        config: configPda,
        admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.kommitConfig.fetch(configPda);
    assert.equal(cfg.admin.toBase58(), admin.toBase58());
    assert.equal(cfg.paused, false);
  });

  it("create_project_succeeds_for_admin", async () => {
    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const metadataHash = new Uint8Array(32).fill(1);

    await program.methods
      .createProject(recipient, Array.from(metadataHash) as any)
      .accounts({
        project: projectPda,
        admin,
        config: findConfigPda(),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const proj = await program.account.project.fetch(projectPda);
    assert.equal(proj.recipientWallet.toBase58(), recipient.toBase58());
    assert.deepEqual(Array.from(proj.metadataUriHash), Array.from(metadataHash));
    assert.equal(proj.cumulativePrincipal.toString(), "0");
    assert.equal(proj.cumulativeYieldRouted.toString(), "0");
    assert.isAbove(proj.createdAt.toNumber(), 0);
  });

  it("create_project_rejects_non_admin", async () => {
    const imposter = anchor.web3.Keypair.generate();
    await airdrop(imposter.publicKey, 1);

    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const metadataHash = new Uint8Array(32).fill(2);

    let threw = false;
    try {
      await program.methods
        .createProject(recipient, Array.from(metadataHash) as any)
        .accounts({
          project: projectPda,
          admin: imposter.publicKey,
          config: findConfigPda(),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([imposter])
        .rpc();
    } catch (e: any) {
      threw = true;
      const msg = e.toString();
      assert.match(msg, /Unauthorized/, `expected Unauthorized error, got: ${msg}`);
    }
    assert.isTrue(threw, "expected createProject to fail for non-admin");
  });

  // Helper: stand up a project + a funded user with a USDC ATA for commit tests.
  async function setupProjectAndUser(initialMintAmount: bigint) {
    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const metadataHash = new Uint8Array(32).fill(3);
    await program.methods
      .createProject(recipient, Array.from(metadataHash) as any)
      .accounts({
        project: projectPda,
        admin,
        config: findConfigPda(),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const user = anchor.web3.Keypair.generate();
    await airdrop(user.publicKey, 5);
    const userAta = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      user.publicKey
    );
    await mintTo(
      connection,
      wallet.payer,
      usdcMint,
      userAta,
      admin,
      initialMintAmount
    );

    return { recipient, projectPda, user, userAta };
  }

  async function commit(
    user: anchor.web3.Keypair,
    userAta: anchor.web3.PublicKey,
    projectPda: anchor.web3.PublicKey,
    amount: bigint
  ) {
    const commitmentPda = findCommitmentPda(user.publicKey, projectPda);
    const escrowPda = findEscrowPda(projectPda);
    await program.methods
      .commit(new anchor.BN(amount.toString()))
      .accounts({
        commitment: commitmentPda,
        project: projectPda,
        user: user.publicKey,
        userUsdcTokenAccount: userAta,
        escrowTokenAccount: escrowPda,
        usdcMint,
        config: findConfigPda(),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    return { commitmentPda, escrowPda };
  }

  async function withdraw(
    user: anchor.web3.Keypair,
    userAta: anchor.web3.PublicKey,
    projectPda: anchor.web3.PublicKey,
    amount: bigint | "full"
  ) {
    const commitmentPda = findCommitmentPda(user.publicKey, projectPda);
    const escrowPda = findEscrowPda(projectPda);
    const amt =
      amount === "full"
        ? new anchor.BN("18446744073709551615") // u64::MAX
        : new anchor.BN(amount.toString());
    await program.methods
      .withdraw(amt, new anchor.BN(0))
      .accounts({
        commitment: commitmentPda,
        project: projectPda,
        user: user.publicKey,
        userUsdcTokenAccount: userAta,
        escrowTokenAccount: escrowPda,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
  }

  it("commit_first_time_initializes_commitment", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const amount = 3n * ONE_USDC;
    const { commitmentPda, escrowPda } = await commit(user, userAta, projectPda, amount);

    const c = await program.account.commitment.fetch(commitmentPda);
    assert.equal(c.user.toBase58(), user.publicKey.toBase58());
    assert.equal(c.project.toBase58(), projectPda.toBase58());
    assert.equal(c.principal.toString(), amount.toString());
    assert.isAbove(c.depositTs.toNumber(), 0);
    assert.equal(c.activeScore.toString(), "0");
    assert.equal(c.lifetimeScore.toString(), "0");
    assert.equal(c.lastAccrualTs.toNumber(), c.depositTs.toNumber());

    const esc = await getAccount(connection, escrowPda);
    assert.equal(esc.amount.toString(), amount.toString());

    const proj = await program.account.project.fetch(projectPda);
    assert.equal(proj.cumulativePrincipal.toString(), amount.toString());
  });

  it("commit_compounds_existing_commitment", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const a1 = 2n * ONE_USDC;
    const a2 = 4n * ONE_USDC;

    const { commitmentPda } = await commit(user, userAta, projectPda, a1);
    const c1 = await program.account.commitment.fetch(commitmentPda);
    const ts1 = c1.depositTs.toNumber();

    // Wait so that ts2 > ts1 by at least one second to make weighted-avg meaningful.
    await sleep(1500);

    await commit(user, userAta, projectPda, a2);
    const c2 = await program.account.commitment.fetch(commitmentPda);

    assert.equal(c2.principal.toString(), (a1 + a2).toString());
    // Weighted-avg deposit_ts: (old_principal * ts1 + a2 * ts2) / (old + a2)
    // Bounds: ts1 < new_ts < ts2 (since both contributions are positive).
    assert.isAtLeast(c2.depositTs.toNumber(), ts1);
    // Active score should be > 0 from the accrual that fires on top-up.
    assert.isTrue(BigInt(c2.activeScore.toString()) > 0n);
  });

  it("commit_rejects_when_paused", async () => {
    // Pause first.
    await program.methods
      .adminPause()
      .accounts({ config: findConfigPda(), admin })
      .rpc();
    try {
      const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
      let threw = false;
      try {
        await commit(user, userAta, projectPda, ONE_USDC);
      } catch (e: any) {
        threw = true;
        assert.match(e.toString(), /Paused/, `expected Paused, got: ${e}`);
      }
      assert.isTrue(threw, "expected commit to fail while paused");
    } finally {
      // Unpause so the rest of the suite can run.
      await program.methods
        .adminUnpause()
        .accounts({ config: findConfigPda(), admin })
        .rpc();
    }
  });

  it("withdraw_partial_scales_active_score", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const principal = 6n * ONE_USDC;
    const { commitmentPda } = await commit(user, userAta, projectPda, principal);

    // Let some time accrue, then explicit accrue, so we have a known active_score.
    await sleep(2500);
    await program.methods
      .accruePoints()
      .accounts({ commitment: commitmentPda, project: projectPda })
      .rpc();
    const before = await program.account.commitment.fetch(commitmentPda);
    const oldActive = BigInt(before.activeScore.toString());
    assert.isTrue(oldActive > 0n, "expected active_score > 0 before partial withdraw");

    const withdrawAmount = 2n * ONE_USDC; // remaining = 4 USDC
    await withdraw(user, userAta, projectPda, withdrawAmount);
    const after = await program.account.commitment.fetch(commitmentPda);
    const newActive = BigInt(after.activeScore.toString());
    const remaining = BigInt(after.principal.toString());
    assert.equal(remaining.toString(), (4n * ONE_USDC).toString());

    // Expected scaled active: (oldActive_after_final_accrue * remaining / principal).
    // Since withdraw also accrues first, the active grew slightly between our manual
    // accrue and the inner accrue. Use a tolerance: newActive must be in
    // [(oldActive * remaining)/principal, (oldActive * remaining * 1.5)/principal].
    const lower = (oldActive * remaining) / principal;
    const upper = ((oldActive * 3n) * remaining) / (principal * 2n); // 1.5x slack
    assert.isTrue(
      newActive >= lower,
      `newActive ${newActive} should be >= ${lower}`
    );
    assert.isTrue(
      newActive <= upper,
      `newActive ${newActive} should be <= ${upper}`
    );
  });

  it("withdraw_full_zeroes_active_preserves_lifetime", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const principal = 5n * ONE_USDC;
    const { commitmentPda } = await commit(user, userAta, projectPda, principal);

    await sleep(2000);
    await program.methods
      .accruePoints()
      .accounts({ commitment: commitmentPda, project: projectPda })
      .rpc();
    const before = await program.account.commitment.fetch(commitmentPda);
    const lifetimeBefore = BigInt(before.lifetimeScore.toString());
    assert.isTrue(lifetimeBefore > 0n);

    await withdraw(user, userAta, projectPda, "full");
    const after = await program.account.commitment.fetch(commitmentPda);
    assert.equal(after.principal.toString(), "0");
    assert.equal(after.activeScore.toString(), "0");
    const lifetimeAfter = BigInt(after.lifetimeScore.toString());
    assert.isTrue(
      lifetimeAfter >= lifetimeBefore,
      `lifetime should be preserved or extended; before=${lifetimeBefore} after=${lifetimeAfter}`
    );
  });

  it("withdraw_succeeds_when_paused", async () => {
    // Set up a commit while unpaused.
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const principal = 3n * ONE_USDC;
    await commit(user, userAta, projectPda, principal);

    // Now pause and confirm withdraw still works.
    await program.methods
      .adminPause()
      .accounts({ config: findConfigPda(), admin })
      .rpc();
    try {
      await withdraw(user, userAta, projectPda, "full");
      const c = await program.account.commitment.fetch(
        findCommitmentPda(user.publicKey, projectPda)
      );
      assert.equal(c.principal.toString(), "0");
    } finally {
      await program.methods
        .adminUnpause()
        .accounts({ config: findConfigPda(), admin })
        .rpc();
    }
  });

  it("accrue_points_known_delta", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const principal = 7n * ONE_USDC;
    const { commitmentPda } = await commit(user, userAta, projectPda, principal);

    const c0 = await program.account.commitment.fetch(commitmentPda);
    const ts0 = c0.lastAccrualTs.toNumber();
    assert.equal(c0.activeScore.toString(), "0");

    await sleep(2500);
    await program.methods
      .accruePoints()
      .accounts({ commitment: commitmentPda, project: projectPda })
      .rpc();

    const c1 = await program.account.commitment.fetch(commitmentPda);
    const ts1 = c1.lastAccrualTs.toNumber();
    const elapsed = BigInt(ts1 - ts0);
    const expected = BigInt(principal) * elapsed;
    const active = BigInt(c1.activeScore.toString());

    // Should match exactly: delta = principal × (now - last_accrual_ts).
    assert.equal(
      active.toString(),
      expected.toString(),
      `active_score should equal principal × elapsed (got ${active}, expected ${expected}, elapsed ${elapsed}s)`
    );
    assert.equal(c1.lifetimeScore.toString(), expected.toString());
  });

  it("accrue_points_idempotent", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const { commitmentPda } = await commit(user, userAta, projectPda, 2n * ONE_USDC);

    await sleep(1500);
    await program.methods
      .accruePoints()
      .accounts({ commitment: commitmentPda, project: projectPda })
      .rpc();
    const c1 = await program.account.commitment.fetch(commitmentPda);
    const active1 = BigInt(c1.activeScore.toString());

    // Immediately call accrue again. Same slot or next; delta should be 0 or 1 second's worth at most.
    await program.methods
      .accruePoints()
      .accounts({ commitment: commitmentPda, project: projectPda })
      .rpc();
    const c2 = await program.account.commitment.fetch(commitmentPda);
    const active2 = BigInt(c2.activeScore.toString());

    const deltaBetweenCalls = active2 - active1;
    const onesSecondWorth = BigInt(c2.principal.toString()); // principal × 1s
    assert.isTrue(
      deltaBetweenCalls >= 0n && deltaBetweenCalls <= onesSecondWorth * 2n,
      `back-to-back accrue delta should be ~0 (got ${deltaBetweenCalls}, principal=${onesSecondWorth})`
    );
  });
});
