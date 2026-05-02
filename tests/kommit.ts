import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kommit } from "../target/types/kommit";
import { assert } from "chai";

describe("kommit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Kommit as Program<Kommit>;

  it("initializes config", async () => {
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    await program.methods
      .initializeConfig()
      .accounts({
        config: configPda,
        admin: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.kommitConfig.fetch(configPda);
    assert.equal(config.admin.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(config.paused, false);
  });
});
