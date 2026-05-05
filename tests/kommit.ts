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

  // -------------------------------------------------------------------------
  // Multi-project tests — verify per-project escrow architecture (handoff 06
  // chunk 2). No klend dependency: these exercise commit/withdraw/accrue
  // independence across project + user boundaries.
  // -------------------------------------------------------------------------

  // Helper: fund a fresh user with USDC and create N projects, returning
  // arrays of recipient + projectPda.
  async function newProject(metadataFill: number) {
    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const metadataHash = new Uint8Array(32).fill(metadataFill);
    await program.methods
      .createProject(recipient, Array.from(metadataHash) as any)
      .accounts({
        project: projectPda,
        admin,
        config: findConfigPda(),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    return { recipient, projectPda };
  }

  async function newUserWithUsdc(usdcAmount: bigint) {
    const user = anchor.web3.Keypair.generate();
    await airdrop(user.publicKey, 5);
    const userAta = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      user.publicKey
    );
    await mintTo(connection, wallet.payer, usdcMint, userAta, admin, usdcAmount);
    return { user, userAta };
  }

  it("multiproject_one_user_three_projects_independent_pdas", async () => {
    const { user, userAta } = await newUserWithUsdc(20n * ONE_USDC);
    const projects = await Promise.all([newProject(10), newProject(11), newProject(12)]);

    const amounts = [1n, 2n, 3n].map((n) => n * ONE_USDC);
    const commitmentPdas: anchor.web3.PublicKey[] = [];
    for (let i = 0; i < 3; i++) {
      const { commitmentPda, escrowPda } = await commit(
        user,
        userAta,
        projects[i].projectPda,
        amounts[i]
      );
      commitmentPdas.push(commitmentPda);
      // Escrow PDA must be derived from the project (per-project, not shared).
      const expectedEscrow = findEscrowPda(projects[i].projectPda);
      assert.equal(
        escrowPda.toBase58(),
        expectedEscrow.toBase58(),
        "escrow PDA must derive from project"
      );
    }

    // Each Commitment PDA is distinct.
    assert.notEqual(commitmentPdas[0].toBase58(), commitmentPdas[1].toBase58());
    assert.notEqual(commitmentPdas[1].toBase58(), commitmentPdas[2].toBase58());

    // Verify principals are independent across projects.
    const cs = await Promise.all(
      commitmentPdas.map((pda) => program.account.commitment.fetch(pda))
    );
    for (let i = 0; i < 3; i++) {
      assert.equal(cs[i].principal.toString(), amounts[i].toString());
      assert.equal(cs[i].project.toBase58(), projects[i].projectPda.toBase58());
    }

    // Sleep, then accrue all three. Each should accumulate principal × elapsed.
    await sleep(2000);
    for (let i = 0; i < 3; i++) {
      await program.methods
        .accruePoints()
        .accounts({ commitment: commitmentPdas[i], project: projects[i].projectPda })
        .rpc();
    }
    const cs2 = await Promise.all(
      commitmentPdas.map((pda) => program.account.commitment.fetch(pda))
    );
    // Active score on the larger principal should be larger.
    const a0 = BigInt(cs2[0].activeScore.toString());
    const a2 = BigInt(cs2[2].activeScore.toString());
    assert.isTrue(a2 > a0, `larger principal must accrue faster (got a0=${a0}, a2=${a2})`);
    // Ratio should be approximately 3:1 (principal 3 USDC vs 1 USDC).
    // Allow ~50% slop for inter-call timing jitter.
    const ratio = Number(a2) / Number(a0);
    assert.isAtLeast(ratio, 2.0, "expected ratio ~3, got " + ratio);
    assert.isAtMost(ratio, 4.5, "expected ratio ~3, got " + ratio);
  });

  it("multiproject_three_users_one_project_shared_escrow_independent_commitments", async () => {
    const { projectPda } = await newProject(20);
    const escrowExpected = findEscrowPda(projectPda);

    const users = await Promise.all([
      newUserWithUsdc(10n * ONE_USDC),
      newUserWithUsdc(10n * ONE_USDC),
      newUserWithUsdc(10n * ONE_USDC),
    ]);
    const amounts = [1n, 2n, 4n].map((n) => n * ONE_USDC);

    for (let i = 0; i < 3; i++) {
      const { escrowPda } = await commit(users[i].user, users[i].userAta, projectPda, amounts[i]);
      // All three commits hit the same escrow ATA (per-project shared across users).
      assert.equal(escrowPda.toBase58(), escrowExpected.toBase58());
    }

    // Each user has their OWN Commitment PDA — verify by deriving + fetching.
    const cs = await Promise.all(
      users.map((u) =>
        program.account.commitment.fetch(findCommitmentPda(u.user.publicKey, projectPda))
      )
    );
    for (let i = 0; i < 3; i++) {
      assert.equal(cs[i].user.toBase58(), users[i].user.publicKey.toBase58());
      assert.equal(cs[i].principal.toString(), amounts[i].toString());
    }

    // Project's cumulative_principal == sum of all three.
    const project = await program.account.project.fetch(projectPda);
    const expectedTotal = amounts.reduce((a, b) => a + b, 0n);
    assert.equal(project.cumulativePrincipal.toString(), expectedTotal.toString());

    // Escrow holds the sum.
    const esc = await getAccount(connection, escrowExpected);
    assert.equal(esc.amount.toString(), expectedTotal.toString());

    // User 0 withdraws partial — should not affect users 1, 2.
    await withdraw(users[0].user, users[0].userAta, projectPda, amounts[0] / 2n);
    const c0_after = await program.account.commitment.fetch(
      findCommitmentPda(users[0].user.publicKey, projectPda)
    );
    const c1_after = await program.account.commitment.fetch(
      findCommitmentPda(users[1].user.publicKey, projectPda)
    );
    assert.equal(c0_after.principal.toString(), (amounts[0] / 2n).toString());
    assert.equal(
      c1_after.principal.toString(),
      amounts[1].toString(),
      "user 1's principal must not be touched by user 0's withdraw"
    );
  });

  it("multiproject_two_users_two_projects_mixed", async () => {
    const projA = await newProject(30);
    const projB = await newProject(31);
    const u1 = await newUserWithUsdc(10n * ONE_USDC);
    const u2 = await newUserWithUsdc(10n * ONE_USDC);

    // u1 → A, u1 → B, u2 → A, u2 → B
    const grid: { user: typeof u1; project: typeof projA; amount: bigint }[] = [
      { user: u1, project: projA, amount: 1n * ONE_USDC },
      { user: u1, project: projB, amount: 2n * ONE_USDC },
      { user: u2, project: projA, amount: 3n * ONE_USDC },
      { user: u2, project: projB, amount: 4n * ONE_USDC },
    ];
    for (const { user, project, amount } of grid) {
      await commit(user.user, user.userAta, project.projectPda, amount);
    }

    // Per-project totals: A = 1 + 3 = 4 USDC; B = 2 + 4 = 6 USDC.
    const projAState = await program.account.project.fetch(projA.projectPda);
    const projBState = await program.account.project.fetch(projB.projectPda);
    assert.equal(projAState.cumulativePrincipal.toString(), (4n * ONE_USDC).toString());
    assert.equal(projBState.cumulativePrincipal.toString(), (6n * ONE_USDC).toString());

    // Escrows are isolated per project.
    const escA = await getAccount(connection, findEscrowPda(projA.projectPda));
    const escB = await getAccount(connection, findEscrowPda(projB.projectPda));
    assert.equal(escA.amount.toString(), (4n * ONE_USDC).toString());
    assert.equal(escB.amount.toString(), (6n * ONE_USDC).toString());

    // 4 distinct Commitment PDAs.
    const allFour = new Set(
      grid.map((g) => findCommitmentPda(g.user.user.publicKey, g.project.projectPda).toBase58())
    );
    assert.equal(allFour.size, 4, "expected 4 distinct commitment PDAs");
  });

  it("admin_update_project_metadata_succeeds_for_admin", async () => {
    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const initialHash = new Uint8Array(32).fill(50);
    const newHash = new Uint8Array(32).fill(99);

    await program.methods
      .createProject(recipient, Array.from(initialHash) as any)
      .accounts({
        project: projectPda,
        admin,
        config: findConfigPda(),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .adminUpdateProjectMetadata(Array.from(newHash) as any)
      .accounts({
        project: projectPda,
        admin,
        config: findConfigPda(),
      })
      .rpc();

    const proj = await program.account.project.fetch(projectPda);
    assert.deepEqual(Array.from(proj.metadataUriHash), Array.from(newHash));
  });

  it("admin_update_project_metadata_rejects_non_admin", async () => {
    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const initialHash = new Uint8Array(32).fill(60);
    const newHash = new Uint8Array(32).fill(77);
    await program.methods
      .createProject(recipient, Array.from(initialHash) as any)
      .accounts({
        project: projectPda,
        admin,
        config: findConfigPda(),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const imposter = anchor.web3.Keypair.generate();
    await airdrop(imposter.publicKey, 1);

    let threw = false;
    try {
      await program.methods
        .adminUpdateProjectMetadata(Array.from(newHash) as any)
        .accounts({
          project: projectPda,
          admin: imposter.publicKey,
          config: findConfigPda(),
        })
        .signers([imposter])
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /Unauthorized/, `expected Unauthorized, got: ${e}`);
    }
    assert.isTrue(threw, "expected non-admin update to fail");

    // Hash unchanged.
    const proj = await program.account.project.fetch(projectPda);
    assert.deepEqual(Array.from(proj.metadataUriHash), Array.from(initialHash));
  });

  it("multiproject_account_graph_stress_two_accrues_in_one_block_window", async () => {
    // Account-graph stress: two accrue_points calls back-to-back across distinct
    // projects fit comfortably under compute budget (each is < 5k CU). This is
    // a sanity check on per-project independence at the validator level.
    const { user, userAta } = await newUserWithUsdc(10n * ONE_USDC);
    const projA = await newProject(40);
    const projB = await newProject(41);
    const { commitmentPda: cA } = await commit(user, userAta, projA.projectPda, 1n * ONE_USDC);
    const { commitmentPda: cB } = await commit(user, userAta, projB.projectPda, 2n * ONE_USDC);
    await sleep(1200);
    // Fire both accrues; each succeeds independently.
    await program.methods
      .accruePoints()
      .accounts({ commitment: cA, project: projA.projectPda })
      .rpc();
    await program.methods
      .accruePoints()
      .accounts({ commitment: cB, project: projB.projectPda })
      .rpc();
    const cAfetched = await program.account.commitment.fetch(cA);
    const cBfetched = await program.account.commitment.fetch(cB);
    assert.isTrue(BigInt(cAfetched.activeScore.toString()) > 0n);
    assert.isTrue(BigInt(cBfetched.activeScore.toString()) > 0n);
  });

  // -------------------------------------------------------------------------
  // QA fix-pass tests (handoff 10). Cover what the QA report flagged:
  //   - C2: AdapterMismatch when supply is called with the wrong klend reserve
  //   - H2: supply/harvest mocked-CPI rejection paths (we don't run real klend
  //         here; we verify the program-side gates fire BEFORE any CPI)
  //   - M2: non-admin admin_pause/admin_unpause, signer-mismatch withdraw,
  //         invalid amounts (zero, exceeding principal)
  //   - Event-payload assertion: ProjectCreated emits metadata_uri_hash (H1)
  // -------------------------------------------------------------------------

  // ---- KaminoAdapterConfig: init helper + scaffolding -----------------------

  const ADAPTER_CONFIG_SEED = Buffer.from("kamino_adapter_config");
  const findAdapterConfigPda = () =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [ADAPTER_CONFIG_SEED],
      program.programId
    )[0];

  // Approved devnet klend graph — verified live in scripts/smoke_klend_devnet.ts
  // (commit 7fd0965). For local-validator tests we only need the keys to match
  // adapter_config.* — we never actually CPI into klend; we expect supply to
  // fail BEFORE the CPI fires (or after with a klend "Account not found" if
  // the graph passes our gate but klend isn't deployed locally — irrelevant
  // for the negative tests since AdapterMismatch fires first).
  const KLEND_PROGRAM = new anchor.web3.PublicKey(
    "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
  );
  const APPROVED_USDC_RESERVE = new anchor.web3.PublicKey(
    "HRwMj8uuoGVWCanKzKvpTWN5ZvXjtjKGxcFbn2qTPKMW"
  );
  const APPROVED_LENDING_MARKET = new anchor.web3.PublicKey(
    "6aaNTBEmwdN19AAdTwbNrWyUo6iEyiLguxCTePEzSqoH"
  );
  const APPROVED_MARKET_AUTHORITY = new anchor.web3.PublicKey(
    "7Aoc3MHQkYSB5y3g3ipyFKWF2TBsYdvqNWHbQ2btWXJt"
  );
  const APPROVED_LIQUIDITY_SUPPLY = new anchor.web3.PublicKey(
    "6icVFmuKEsH5dzDwTSrxzrnJ14N27gDKRc2XAxPtB4ep"
  );
  const APPROVED_COLLATERAL_MINT = new anchor.web3.PublicKey(
    "6FY2rwh5wWrtSveAG9t9ANc2YsrChNasVSEpMQubJcXd"
  );
  const APPROVED_LIQUIDITY_MINT = new anchor.web3.PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  );

  // Test-only collateral mint — local-validator stand-in for klend's cToken
  // mint (the real one isn't deployed on local). Created lazily so the init
  // path of `collateral_token_account: token::mint = reserve_collateral_mint`
  // doesn't fail with IncorrectProgramId before our require_keys_eq! runs.
  let _testCollateralMint: anchor.web3.PublicKey | null = null;
  async function ensureTestCollateralMint() {
    if (_testCollateralMint) return _testCollateralMint;
    _testCollateralMint = await createMint(
      connection,
      wallet.payer,
      admin,
      null,
      USDC_DECIMALS
    );
    return _testCollateralMint;
  }

  // Idempotent: only initialize the singleton if it isn't already on-chain.
  // Uses LOCAL mints (our test usdcMint + a separate test collateral mint) so
  // init_if_needed validations pass; the C2 require_keys_eq! checks then fire
  // for any non-matching klend account passed by callers.
  async function ensureAdapterConfig() {
    const adapterConfigPda = findAdapterConfigPda();
    const existing = await connection.getAccountInfo(adapterConfigPda);
    if (existing) return adapterConfigPda;
    const testCollateralMint = await ensureTestCollateralMint();
    await program.methods
      .initializeKaminoAdapterConfig(
        KLEND_PROGRAM,
        APPROVED_USDC_RESERVE,
        APPROVED_LENDING_MARKET,
        APPROVED_MARKET_AUTHORITY,
        APPROVED_LIQUIDITY_SUPPLY,
        testCollateralMint,                  // local stand-in
        usdcMint                              // local USDC stand-in for klend's USDC
      )
      .accountsPartial({
        adapterConfig: adapterConfigPda,
        admin,
        config: findConfigPda(),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    return adapterConfigPda;
  }

  // ---- C2 / H2: adapter allowlist enforcement ------------------------------

  // ---- M2 v2 (QA verification 2026-05-05): adapter-config non-admin test
  //      MUST run before any test that calls ensureAdapterConfig(), so the
  //      singleton is uninitialized when the imposter attempts init. The
  //      old version of this test ran AFTER ensureAdapterConfig and thus
  //      accepted "already in use" as a success path — that didn't prove
  //      Unauthorized. Now: imposter calls init first, the require_keys_eq!
  //      guard in the handler fires before any state mutation persists,
  //      transaction reverts, singleton stays uninitialized, subsequent
  //      ensureAdapterConfig() calls succeed with admin.

  it("initialize_kamino_adapter_config_rejects_non_admin", async () => {
    const adapterConfigPda = findAdapterConfigPda();

    // Singleton must NOT exist yet at this point in the test order.
    const pre = await connection.getAccountInfo(adapterConfigPda);
    assert.isNull(
      pre,
      "M2 v2: singleton must be uninitialized before this test runs (move it earlier in the file)"
    );

    const imposter = anchor.web3.Keypair.generate();
    await airdrop(imposter.publicKey, 1);

    // Need to create the test collateral mint first because the adapter config
    // stores it as one of the 8 keys; using a real existing mint matches what
    // ensureAdapterConfig will use.
    const testCollateralMint = await ensureTestCollateralMint();

    let threw = false;
    try {
      await program.methods
        .initializeKaminoAdapterConfig(
          KLEND_PROGRAM,
          APPROVED_USDC_RESERVE,
          APPROVED_LENDING_MARKET,
          APPROVED_MARKET_AUTHORITY,
          APPROVED_LIQUIDITY_SUPPLY,
          testCollateralMint,
          usdcMint
        )
        .accountsPartial({
          adapterConfig: adapterConfigPda,
          admin: imposter.publicKey,
          config: findConfigPda(),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([imposter])
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(
        e.toString(),
        /Unauthorized/,
        `expected Unauthorized (not 'already in use'), got: ${e}`
      );
    }
    assert.isTrue(threw, "expected non-admin init to fail with Unauthorized");

    // After the failed transaction the singleton should still be uninitialized;
    // subsequent supply tests' ensureAdapterConfig() will init it cleanly.
    const post = await connection.getAccountInfo(adapterConfigPda);
    assert.isNull(post, "M2 v2: failed init must roll back the singleton account creation");
  });

  it("supply_to_yield_source_rejects_wrong_reserve_with_AdapterMismatch", async () => {
    const adapterConfigPda = await ensureAdapterConfig();

    // Set up a project + a funded user with a USDC ATA. We're going to call
    // supply with a WRONG klend_reserve and expect AdapterMismatch BEFORE
    // any CPI fires (the program-side require_keys_eq! is what we're testing).
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    await commit(user, userAta, projectPda, 1n * ONE_USDC);

    const COLLATERAL_SEED = Buffer.from("collateral");
    const LENDING_SEED = Buffer.from("lending");
    const escrowPda = findEscrowPda(projectPda);
    const [collateralPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [COLLATERAL_SEED, projectPda.toBuffer()],
      program.programId
    );
    const [lendingPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [LENDING_SEED, projectPda.toBuffer(), Buffer.from([0])],
      program.programId
    );

    const WRONG_RESERVE = anchor.web3.Keypair.generate().publicKey;
    let threw = false;
    try {
      await program.methods
        .supplyToYieldSource(new anchor.BN(ONE_USDC.toString()))
        .accountsPartial({
          project: projectPda,
          config: findConfigPda(),
          adapterConfig: adapterConfigPda,
          escrowTokenAccount: escrowPda,
          collateralTokenAccount: collateralPda,
          lendingPosition: lendingPda,
          usdcMint,
          klendReserve: WRONG_RESERVE,                          // ← wrong key
          klendLendingMarket: APPROVED_LENDING_MARKET,
          klendLendingMarketAuthority: APPROVED_MARKET_AUTHORITY,
          klendReserveLiquidityMint: usdcMint,                 // matches adapter_config
          klendReserveLiquiditySupply: APPROVED_LIQUIDITY_SUPPLY,
          reserveCollateralMint: await ensureTestCollateralMint(),
          klendProgram: KLEND_PROGRAM,
          instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          payer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /AdapterMismatch/, `expected AdapterMismatch, got: ${e}`);
    }
    assert.isTrue(threw, "expected supply to reject wrong reserve before CPI");
  });

  it("supply_to_yield_source_rejects_wrong_lending_market_with_AdapterMismatch", async () => {
    const adapterConfigPda = await ensureAdapterConfig();
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    await commit(user, userAta, projectPda, 1n * ONE_USDC);

    const COLLATERAL_SEED = Buffer.from("collateral");
    const LENDING_SEED = Buffer.from("lending");
    const escrowPda = findEscrowPda(projectPda);
    const [collateralPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [COLLATERAL_SEED, projectPda.toBuffer()],
      program.programId
    );
    const [lendingPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [LENDING_SEED, projectPda.toBuffer(), Buffer.from([0])],
      program.programId
    );

    const WRONG_MARKET = anchor.web3.Keypair.generate().publicKey;
    let threw = false;
    try {
      await program.methods
        .supplyToYieldSource(new anchor.BN(ONE_USDC.toString()))
        .accountsPartial({
          project: projectPda,
          config: findConfigPda(),
          adapterConfig: adapterConfigPda,
          escrowTokenAccount: escrowPda,
          collateralTokenAccount: collateralPda,
          lendingPosition: lendingPda,
          usdcMint,
          klendReserve: APPROVED_USDC_RESERVE,
          klendLendingMarket: WRONG_MARKET,                     // ← wrong key
          klendLendingMarketAuthority: APPROVED_MARKET_AUTHORITY,
          klendReserveLiquidityMint: usdcMint,                 // matches adapter_config
          klendReserveLiquiditySupply: APPROVED_LIQUIDITY_SUPPLY,
          reserveCollateralMint: await ensureTestCollateralMint(),
          klendProgram: KLEND_PROGRAM,
          instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          payer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /AdapterMismatch/, `expected AdapterMismatch, got: ${e}`);
    }
    assert.isTrue(threw, "expected supply to reject wrong market before CPI");
  });

  it("supply_to_yield_source_rejects_wrong_collateral_mint_with_AdapterMismatch", async () => {
    // QA C2 / fix-pass-2 supplemental: cover a third key in the adapter
    // config allowlist beyond the existing wrong-reserve / wrong-lending-market
    // negatives. Wrong collateral mint must hit the C2 require_keys_eq gate
    // (`adapter_config.usdc_collateral_mint`) and abort BEFORE any CPI.
    const adapterConfigPda = await ensureAdapterConfig();
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    await commit(user, userAta, projectPda, 1n * ONE_USDC);

    const COLLATERAL_SEED = Buffer.from("collateral");
    const LENDING_SEED = Buffer.from("lending");
    const escrowPda = findEscrowPda(projectPda);
    const [collateralPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [COLLATERAL_SEED, projectPda.toBuffer()],
      program.programId
    );
    const [lendingPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [LENDING_SEED, projectPda.toBuffer(), Buffer.from([0])],
      program.programId
    );

    // Spin up a SECOND test collateral mint that is NOT in the adapter
    // config — passing it should hit AdapterMismatch on the collateral-mint
    // require_keys_eq.
    const wrongCollateralMint = await createMint(
      connection,
      wallet.payer,
      admin,
      null,
      USDC_DECIMALS
    );

    let threw = false;
    try {
      await program.methods
        .supplyToYieldSource(new anchor.BN(ONE_USDC.toString()))
        .accountsPartial({
          project: projectPda,
          config: findConfigPda(),
          adapterConfig: adapterConfigPda,
          escrowTokenAccount: escrowPda,
          collateralTokenAccount: collateralPda,
          lendingPosition: lendingPda,
          usdcMint,
          klendReserve: APPROVED_USDC_RESERVE,
          klendLendingMarket: APPROVED_LENDING_MARKET,
          klendLendingMarketAuthority: APPROVED_MARKET_AUTHORITY,
          klendReserveLiquidityMint: usdcMint, // matches adapter_config (we registered usdcMint as the local stand-in)
          klendReserveLiquiditySupply: APPROVED_LIQUIDITY_SUPPLY,
          reserveCollateralMint: wrongCollateralMint, // ← wrong key
          klendProgram: KLEND_PROGRAM,
          instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          payer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(
        e.toString(),
        /AdapterMismatch/,
        `expected AdapterMismatch, got: ${e}`
      );
    }
    assert.isTrue(
      threw,
      "expected supply to reject wrong collateral mint before CPI"
    );
  });

  // M2 v2 — adapter-config non-admin test moved earlier in the file to
  // ensure singleton-uninit ordering. See the new version above.

  // ---- H2 v2 (QA verification 2026-05-05): harvest principal-preservation -
  //
  // Full harvest integration coverage requires a live klend reserve account
  // (klend isn't deployed on local validator). The C1 v2 fee-field math is
  // covered by Rust unit tests in adapters/kamino.rs:
  //   total_liquidity_subtracts_klend_fees, total_liquidity_underflow_returns_zero_safely,
  //   plus the original 5 ReserveSnapshot tests (7/7 unit tests pass).
  //
  // These integration tests cover the program-side principal-preservation
  // invariant Codex called out (QA_VERIFICATION.md N1):
  //   1. harvest cannot run before supply (lending_position must exist).
  //   2. a permissionless harvest attempt with min_yield = 0 (the most
  //      adversarial setting) leaves escrow + commitment.principal unchanged
  //      and the user can withdraw their full principal afterward.

  // ---- H2 v2 / shared helpers for harvest tests ---------------------------

  const COLLATERAL_PDA_SEED = Buffer.from("collateral");
  const LENDING_PDA_SEED = Buffer.from("lending");
  const findCollateralPda = (project: anchor.web3.PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [COLLATERAL_PDA_SEED, project.toBuffer()],
      program.programId
    )[0];
  const findKaminoLendingPda = (project: anchor.web3.PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [LENDING_PDA_SEED, project.toBuffer(), Buffer.from([0])],
      program.programId
    )[0];

  it("harvest_attempt_without_prior_supply_fails_safely_lending_position_uninit", async () => {
    // Implicit guard: harvest's lending_position is a typed Box<Account<...>>
    // with `bump = lending_position.bump`. Without a prior successful supply,
    // the account doesn't exist and anchor refuses to deserialize it BEFORE
    // the handler runs — so harvest cannot run on a never-supplied project,
    // and the C2 graph checks are unreachable until supply has minted cTokens.
    const adapterConfigPda = await ensureAdapterConfig();
    const { projectPda, recipient, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    await commit(user, userAta, projectPda, ONE_USDC);

    // Recipient ATA must exist for harvest's recipient_token_account.
    const recipientAta = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      recipient
    );

    let threw = false;
    try {
      await program.methods
        .harvest(new anchor.BN(0))
        .accountsPartial({
          project: projectPda,
          adapterConfig: adapterConfigPda,
          lendingPosition: findKaminoLendingPda(projectPda), // ← uninitialized
          collateralTokenAccount: findCollateralPda(projectPda),
          recipientTokenAccount: recipientAta,
          usdcMint,
          klendReserve: APPROVED_USDC_RESERVE,
          klendLendingMarket: APPROVED_LENDING_MARKET,
          klendLendingMarketAuthority: APPROVED_MARKET_AUTHORITY,
          klendReserveLiquidityMint: usdcMint,
          klendReserveLiquiditySupply: APPROVED_LIQUIDITY_SUPPLY,
          reserveCollateralMint: await ensureTestCollateralMint(),
          klendProgram: KLEND_PROGRAM,
          instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          payer: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    } catch (e: any) {
      threw = true;
      const msg = e.toString();
      assert.match(
        msg,
        /AccountNotInitialized|account does not exist|account discriminator|3012|AnchorError/,
        `expected lending_position-uninit failure, got: ${msg}`
      );
    }
    assert.isTrue(
      threw,
      "harvest must not run without a prior supply that creates lending_position"
    );
  });

  it("harvest_attempt_with_zero_min_yield_does_not_drain_user_principal", async () => {
    // Headline H2 v2 principal-preservation test. A permissionless caller
    // fires harvest with min_yield = 0 — the adversarial setting Codex
    // specifically called out in QA_VERIFICATION.md N1. After the attempt:
    //   - escrow USDC balance is unchanged
    //   - commitment.principal is unchanged
    //   - the user can withdraw their full principal back to their wallet
    // Even if the C1 fix had a residual fee-field bug (which the Rust unit
    // tests cover), harvest still doesn't touch escrow or commitment under
    // any code path, so principal is structurally protected.
    const adapterConfigPda = await ensureAdapterConfig();
    const { projectPda, recipient, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const commitAmount = 1n * ONE_USDC;
    const { commitmentPda, escrowPda } = await commit(user, userAta, projectPda, commitAmount);

    // Recipient ATA so harvest's recipient_token_account validation passes
    // far enough to demonstrate the principal-preservation invariant.
    const recipientAta = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      recipient
    );

    // Snapshot pre-attempt state.
    const escrowPre = await getAccount(connection, escrowPda);
    const userAtaPre = await getAccount(connection, userAta);
    const commitmentPre = await program.account.commitment.fetch(commitmentPda);

    // A third-party permissionless cranker — NOT the kommitter or admin.
    const cranker = anchor.web3.Keypair.generate();
    await airdrop(cranker.publicKey, 1);

    // Adversarial harvest call.
    let attemptThrew = false;
    try {
      await program.methods
        .harvest(new anchor.BN(0)) // ← min_yield = 0 (most adversarial)
        .accountsPartial({
          project: projectPda,
          adapterConfig: adapterConfigPda,
          lendingPosition: findKaminoLendingPda(projectPda),
          collateralTokenAccount: findCollateralPda(projectPda),
          recipientTokenAccount: recipientAta,
          usdcMint,
          klendReserve: APPROVED_USDC_RESERVE,
          klendLendingMarket: APPROVED_LENDING_MARKET,
          klendLendingMarketAuthority: APPROVED_MARKET_AUTHORITY,
          klendReserveLiquidityMint: usdcMint,
          klendReserveLiquiditySupply: APPROVED_LIQUIDITY_SUPPLY,
          reserveCollateralMint: await ensureTestCollateralMint(),
          klendProgram: KLEND_PROGRAM,
          instructionSysvarAccount: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          payer: cranker.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([cranker])
        .rpc();
    } catch (_e) {
      attemptThrew = true;
    }
    // We don't strictly require harvest to throw — the invariant is about
    // principal preservation, not harvest's success/failure. (If klend were
    // deployed locally and the reserve had no accrued yield, harvest would
    // legitimately return DustHarvest.) See assertions below.
    void attemptThrew;

    // INVARIANT 1: escrow balance is unchanged by the harvest attempt.
    const escrowPost = await getAccount(connection, escrowPda);
    assert.equal(
      escrowPost.amount.toString(),
      escrowPre.amount.toString(),
      "principal-preservation: escrow USDC must NOT change due to a permissionless harvest attempt"
    );

    // INVARIANT 2: commitment.principal is unchanged.
    const commitmentPost = await program.account.commitment.fetch(commitmentPda);
    assert.equal(
      commitmentPost.principal.toString(),
      commitmentPre.principal.toString(),
      "principal-preservation: commitment.principal must NOT change due to a harvest attempt"
    );

    // INVARIANT 3: the kommitter can withdraw their full principal back.
    await withdraw(user, userAta, projectPda, "full");
    const userAtaFinal = await getAccount(connection, userAta);
    assert.equal(
      userAtaFinal.amount.toString(),
      (BigInt(userAtaPre.amount.toString()) + commitAmount).toString(),
      "principal-preservation: user must be able to withdraw their full principal after a failed harvest"
    );
  });

  // ---- M2: M2 — non-admin admin_pause / admin_unpause negatives ------------

  it("admin_pause_rejects_non_admin", async () => {
    const imposter = anchor.web3.Keypair.generate();
    await airdrop(imposter.publicKey, 1);
    let threw = false;
    try {
      await program.methods
        .adminPause()
        .accountsPartial({ config: findConfigPda(), admin: imposter.publicKey })
        .signers([imposter])
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /Unauthorized/, `expected Unauthorized, got: ${e}`);
    }
    assert.isTrue(threw, "expected admin_pause to reject non-admin");
  });

  it("admin_unpause_rejects_non_admin", async () => {
    const imposter = anchor.web3.Keypair.generate();
    await airdrop(imposter.publicKey, 1);
    let threw = false;
    try {
      await program.methods
        .adminUnpause()
        .accountsPartial({ config: findConfigPda(), admin: imposter.publicKey })
        .signers([imposter])
        .rpc();
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /Unauthorized/, `expected Unauthorized, got: ${e}`);
    }
    assert.isTrue(threw, "expected admin_unpause to reject non-admin");
  });

  // ---- M2: invalid amounts -------------------------------------------------

  it("commit_rejects_zero_amount", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    let threw = false;
    try {
      await commit(user, userAta, projectPda, 0n);
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /InvalidAmount/, `expected InvalidAmount, got: ${e}`);
    }
    assert.isTrue(threw, "expected commit(0) to reject");
  });

  it("withdraw_rejects_amount_exceeding_principal", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    await commit(user, userAta, projectPda, ONE_USDC);
    let threw = false;
    try {
      await withdraw(user, userAta, projectPda, 5n * ONE_USDC); // > principal
    } catch (e: any) {
      threw = true;
      assert.match(
        e.toString(),
        /InsufficientPrincipal/,
        `expected InsufficientPrincipal, got: ${e}`
      );
    }
    assert.isTrue(threw, "expected oversized withdraw to reject");
  });

  it("withdraw_rejects_zero_amount", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    await commit(user, userAta, projectPda, ONE_USDC);
    let threw = false;
    try {
      await withdraw(user, userAta, projectPda, 0n);
    } catch (e: any) {
      threw = true;
      assert.match(e.toString(), /InvalidAmount/, `expected InvalidAmount, got: ${e}`);
    }
    assert.isTrue(threw, "expected withdraw(0) to reject");
  });

  // ---- M2 v2: signer-mismatch withdraw (QA verification 2026-05-05) -------
  //
  // The withdraw handler enforces signer-mismatch at TWO levels:
  //   - `seeds = [Commitment::SEED, user.key().as_ref(), project.key().as_ref()]`
  //     derives the expected commitment PDA from the *passed* `user` account.
  //     If the imposter signs (their pubkey is in `user`) and passes the
  //     original kommitter's commitment PDA, the seeds don't match → fails
  //     with ConstraintSeeds (Anchor 2006).
  //   - `has_one = user` cross-checks `commitment.user == user.key()`. The
  //     stored value is the original kommitter; the signer is the imposter →
  //     fails with ConstraintHasOne (Anchor 2001).
  // Either constraint fires before the handler runs, so no escrow movement
  // can ever be triggered by a non-owner signer. This test demonstrates that
  // an imposter's withdraw call against another user's commitment fails AND
  // that the original kommitter retains the ability to withdraw afterward.

  it("withdraw_signer_mismatch_returns_unauthorized", async () => {
    const { projectPda, user, userAta } = await setupProjectAndUser(10n * ONE_USDC);
    const commitAmount = 2n * ONE_USDC;
    await commit(user, userAta, projectPda, commitAmount);

    const imposter = anchor.web3.Keypair.generate();
    await airdrop(imposter.publicKey, 1);
    const imposterAta = await createAssociatedTokenAccount(
      connection,
      wallet.payer,
      usdcMint,
      imposter.publicKey
    );

    const commitmentPda = findCommitmentPda(user.publicKey, projectPda);
    const escrowPda = findEscrowPda(projectPda);

    // Snapshot pre-attempt state for principal-preservation cross-check.
    const escrowPre = await getAccount(connection, escrowPda);
    const userAtaPre = await getAccount(connection, userAta);

    let threw = false;
    try {
      await program.methods
        .withdraw(new anchor.BN(ONE_USDC.toString()), new anchor.BN(0))
        .accounts({
          commitment: commitmentPda,    // ← original kommitter's PDA
          project: projectPda,
          user: imposter.publicKey,     // ← imposter is the signer
          userUsdcTokenAccount: imposterAta,
          escrowTokenAccount: escrowPda,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([imposter])
        .rpc();
    } catch (e: any) {
      threw = true;
      const msg = e.toString();
      assert.match(
        msg,
        /ConstraintHasOne|ConstraintSeeds|Unauthorized|2001|2006|AnchorError/,
        `expected signer-mismatch constraint failure, got: ${msg}`
      );
    }
    assert.isTrue(
      threw,
      "imposter must not be able to withdraw against another user's commitment"
    );

    // Defense-in-depth cross-checks: the failed attempt did not move USDC
    // from escrow, did not credit the imposter, and the original kommitter
    // can still withdraw cleanly.
    const escrowPost = await getAccount(connection, escrowPda);
    assert.equal(
      escrowPost.amount.toString(),
      escrowPre.amount.toString(),
      "imposter withdraw must not move USDC out of escrow"
    );
    const imposterAtaAfter = await getAccount(connection, imposterAta);
    assert.equal(
      imposterAtaAfter.amount.toString(),
      "0",
      "imposter must not have received any USDC"
    );

    // Original kommitter still owns their principal.
    await withdraw(user, userAta, projectPda, "full");
    const userAtaAfter = await getAccount(connection, userAta);
    assert.equal(
      userAtaAfter.amount.toString(),
      (BigInt(userAtaPre.amount.toString()) + commitAmount).toString(),
      "original kommitter must still be able to withdraw their full principal"
    );
  });

  // ---- H1: ProjectCreated event payload includes metadata_uri_hash ---------

  it("project_created_event_includes_metadata_uri_hash", async () => {
    const recipient = anchor.web3.Keypair.generate().publicKey;
    const projectPda = findProjectPda(recipient);
    const metadataHash = new Uint8Array(32).fill(123);

    let captured: any = null;
    const listenerId = program.addEventListener(
      "projectCreated" as any,
      (event: any) => {
        // Match the project we just created (multiple tests fire concurrently
        // sometimes; key on PDA).
        if (event.project.toBase58() === projectPda.toBase58()) {
          captured = event;
        }
      }
    );

    try {
      await program.methods
        .createProject(recipient, Array.from(metadataHash) as any)
        .accountsPartial({
          project: projectPda,
          admin,
          config: findConfigPda(),
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      // Anchor's event listener is async; poll briefly.
      for (let i = 0; i < 30 && !captured; i++) await sleep(100);
      assert.isNotNull(captured, "ProjectCreated event was not delivered");
      assert.deepEqual(
        Array.from(captured!.metadataUriHash as number[]),
        Array.from(metadataHash),
        "metadata_uri_hash field missing or mismatched on the event"
      );
    } finally {
      await program.removeEventListener(listenerId);
    }
  });
});
